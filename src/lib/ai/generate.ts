import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { Analysis } from '@prisma/client';
import type * as z from 'zod/v4';
import { db } from '@/lib/db';
import { aiLogger } from '@/lib/logger';
import { aiSkillDuration, aiTokens } from '@/lib/telemetry/metrics';
import { withSpan } from '@/lib/telemetry/spans';
import { anthropic, MODEL } from './client';
import { buildBullBearMessages } from './prompts/bullBear';
import { buildCatalystsRisksMessages } from './prompts/catalystsRisks';
import { buildLiveOnCallMessages } from './prompts/liveOnCall';
import { SYSTEM_PROMPT } from './prompts/system';
import {
  bullBearSchema,
  catalystsRisksSchema,
  liveOnCallSchema,
} from './schemas';
import type { SectionType, SourcesData } from './types';
import { validateTraceability } from './validation';

const BUILDERS: Record<
  SectionType,
  (sources: SourcesData) => Anthropic.MessageParam[]
> = {
  bullBear: buildBullBearMessages,
  catalystsRisks: buildCatalystsRisksMessages,
  liveOnCall: buildLiveOnCallMessages,
};

const SCHEMAS: Record<SectionType, z.ZodType> = {
  bullBear: bullBearSchema,
  catalystsRisks: catalystsRisksSchema,
  liveOnCall: liveOnCallSchema,
};

interface GenerateParams {
  userId: string;
  ticker: string;
  sectionType: SectionType;
  sources: SourcesData;
  // Override the default model — scheduled cron runs pass Haiku for cost.
  model?: string;
}

export async function generateSection(
  params: GenerateParams,
): Promise<Analysis> {
  const { userId, ticker, sectionType, sources } = params;
  const model = params.model ?? MODEL;
  const log = aiLogger.child({ userId, ticker, sectionType, model });

  // Wrap the entire generation pipeline in one span. Attributes include the
  // dimensions we'll want to filter/group by in a trace UI (ticker / section /
  // model), and we set `ai.outcome` + token-count attributes as the run
  // resolves so a single span carries the full story of the request.
  return withSpan(
    'ai.generate',
    {
      'ai.ticker': ticker,
      'ai.section_type': sectionType,
      'ai.model': model,
    },
    async (span) => {
      const startedAt = Date.now();

      // On validation_failed we leave `content` untouched on the existing row.
      // That keeps the previous validated section visible to the user instead
      // of swapping it for known-hallucinated content. New rows simply have
      // no content yet, which the UI renders as "no analysis available".
      await db.analysis.upsert({
        where: { userId_ticker_sectionType: { userId, ticker, sectionType } },
        create: {
          userId,
          ticker,
          sectionType,
          status: 'generating',
          sources: sources as object,
          model,
        },
        update: {
          status: 'generating',
          sources: sources as object,
          model,
          errorMessage: null,
        },
      });

      try {
        const response = await anthropic.messages.parse({
          model,
          max_tokens: 4096,
          system: [
            {
              type: 'text',
              text: SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: BUILDERS[sectionType](sources),
          thinking: { type: 'adaptive' },
          output_config: {
            effort: 'high',
            format: zodOutputFormat(SCHEMAS[sectionType]),
          },
        });

        log.info(
          {
            usage: response.usage,
            stopReason: response.stop_reason,
          },
          'anthropic response received',
        );

        // Capture token usage on the span + counter. Doing this before the
        // validation branch ensures cost is always recorded even when the
        // output is later rejected for hallucination.
        const usage = response.usage;
        const inputTokens = usage.input_tokens ?? 0;
        const outputTokens = usage.output_tokens ?? 0;
        const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
        const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
        span.setAttribute('ai.tokens.input', inputTokens);
        span.setAttribute('ai.tokens.output', outputTokens);
        span.setAttribute('ai.tokens.cache_read', cacheReadTokens);
        span.setAttribute('ai.tokens.cache_creation', cacheCreationTokens);

        const tokenLabels = { section: sectionType, model };
        aiTokens.add(inputTokens, { ...tokenLabels, direction: 'input' });
        aiTokens.add(outputTokens, { ...tokenLabels, direction: 'output' });
        aiTokens.add(cacheReadTokens, {
          ...tokenLabels,
          direction: 'cache_read',
        });
        aiTokens.add(cacheCreationTokens, {
          ...tokenLabels,
          direction: 'cache_creation',
        });

        if (response.parsed_output == null) {
          log.warn(
            { stopReason: response.stop_reason },
            'model returned no parseable output',
          );
          span.setAttribute('ai.outcome', 'failed');
          aiSkillDuration.record(Date.now() - startedAt, {
            section: sectionType,
            model,
            outcome: 'failed',
          });
          return db.analysis.update({
            where: {
              userId_ticker_sectionType: { userId, ticker, sectionType },
            },
            data: {
              status: 'failed',
              errorMessage: `No structured output (stop_reason=${response.stop_reason})`,
            },
          });
        }

        const traceability = validateTraceability(
          response.parsed_output,
          sources,
        );
        if (!traceability.valid) {
          log.warn(
            { missing: traceability.missing },
            'model output contains numbers not present in source data',
          );
          // Keep prior content intact — surfacing a stale but validated section
          // is preferable to showing freshly-hallucinated figures. We do NOT
          // write `content` in this branch, so any prior value remains.
          span.setAttribute('ai.outcome', 'validation_failed');
          aiSkillDuration.record(Date.now() - startedAt, {
            section: sectionType,
            model,
            outcome: 'validation_failed',
          });
          return db.analysis.update({
            where: {
              userId_ticker_sectionType: { userId, ticker, sectionType },
            },
            data: {
              status: 'validation_failed',
              errorMessage: JSON.stringify({
                missing: traceability.missing,
                rejectedContent: response.parsed_output,
              }),
            },
          });
        }

        // Append a versioned snapshot before flipping the latest row to
        // `completed`. AnalysisHistory is append-only and powers the
        // "compare with last month" view; the latest row stays on Analysis
        // so the read path remains a single-row lookup.
        await db.analysisHistory.create({
          data: {
            userId,
            ticker,
            sectionType,
            content: response.parsed_output as object,
            sources: sources as object,
            model,
          },
        });

        span.setAttribute('ai.outcome', 'completed');
        aiSkillDuration.record(Date.now() - startedAt, {
          section: sectionType,
          model,
          outcome: 'completed',
        });
        return db.analysis.update({
          where: {
            userId_ticker_sectionType: { userId, ticker, sectionType },
          },
          data: {
            status: 'completed',
            content: response.parsed_output as object,
            errorMessage: null,
            generatedAt: new Date(),
          },
        });
      } catch (err) {
        // Record duration on the failure path too so the histogram isn't
        // biased toward successful runs. Specific status/error attributes
        // come from `withSpan` — we just tag the outcome label.
        const durationLabels = {
          section: sectionType,
          model,
          outcome: 'failed',
        };
        if (err instanceof Anthropic.RateLimitError) {
          log.warn({ err }, 'anthropic rate limited');
          span.setAttribute('ai.outcome', 'rate_limited');
          aiSkillDuration.record(Date.now() - startedAt, {
            ...durationLabels,
            outcome: 'rate_limited',
          });
          return db.analysis.update({
            where: {
              userId_ticker_sectionType: { userId, ticker, sectionType },
            },
            data: {
              status: 'failed',
              errorMessage: 'Rate limited by Anthropic API',
            },
          });
        }
        if (err instanceof Anthropic.APIError) {
          log.error({ err, status: err.status }, 'anthropic API error');
          span.setAttribute('ai.outcome', 'api_error');
          aiSkillDuration.record(Date.now() - startedAt, {
            ...durationLabels,
            outcome: 'api_error',
          });
          return db.analysis.update({
            where: {
              userId_ticker_sectionType: { userId, ticker, sectionType },
            },
            data: {
              status: 'failed',
              errorMessage: `Anthropic API error (${err.status}): ${err.message}`,
            },
          });
        }
        log.error({ err }, 'unexpected generation failure');
        span.setAttribute('ai.outcome', 'failed');
        aiSkillDuration.record(Date.now() - startedAt, durationLabels);
        return db.analysis.update({
          where: { userId_ticker_sectionType: { userId, ticker, sectionType } },
          data: {
            status: 'failed',
            errorMessage: err instanceof Error ? err.message : 'Unknown error',
          },
        });
      }
    },
  );
}
