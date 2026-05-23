'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLatestAnalysis } from '@/lib/ai/hooks';
import {
  generateAnalysisStream,
  type ProgressEvent,
} from '@/lib/ai/api-client';
import type { CatalystsRisksContent } from '@/lib/ai/types';

interface Props {
  ticker: string;
}

const PROGRESS_COPY: Record<ProgressEvent['step'], string> = {
  fetching_data: 'Fetching market data...',
  generating: 'Identifying catalysts and risks...',
  validating: 'Validating output...',
};

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown';
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export default function CatalystsRisks({ ticker }: Props) {
  const qc = useQueryClient();
  const { data: analysis, isLoading } = useLatestAnalysis(
    ticker,
    'catalystsRisks',
  );

  const [streaming, setStreaming] = useState(false);
  const [currentStep, setCurrentStep] =
    useState<ProgressEvent['step'] | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  async function handleGenerate() {
    setStreaming(true);
    setStreamError(null);
    setCurrentStep(null);
    try {
      for await (const event of generateAnalysisStream(
        ticker,
        'catalystsRisks',
      )) {
        if (event.type === 'progress') {
          setCurrentStep(event.step);
        } else if (event.type === 'complete') {
          await qc.invalidateQueries({
            queryKey: ['analysis', ticker, 'catalystsRisks'],
          });
        } else if (event.type === 'error') {
          setStreamError(event.message);
        }
      }
    } catch (err) {
      setStreamError(
        err instanceof Error ? err.message : 'Generation failed',
      );
    } finally {
      setStreaming(false);
      setCurrentStep(null);
    }
  }

  // Safe because the API guarantees that any row returned for sectionType
  // 'catalystsRisks' has content of shape CatalystsRisksContent (validated server-side).
  const content = analysis?.content as CatalystsRisksContent | null;

  const status = analysis?.status;
  const hasPrior = analysis != null;
  const isCompleted = status === 'completed' && content != null;
  const isValidationFailed = status === 'validation_failed';
  const isFailed = status === 'failed';

  return (
    <section
      className="rounded-lg border border-border bg-card p-6"
      aria-label="Catalysts and Risks"
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Catalysts &amp; Risks
          </h2>
          <p className="text-sm text-muted-foreground">
            AI-identified upside drivers and downside concerns.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {analysis?.generatedAt && (
            <span className="text-xs text-muted-foreground">
              Generated {formatRelativeTime(analysis.generatedAt)}
            </span>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={streaming || isLoading}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {streaming
              ? 'Generating...'
              : hasPrior
                ? 'Refresh'
                : 'Generate'}
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-3" aria-hidden="true">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      ) : streaming ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span>
            {currentStep ? PROGRESS_COPY[currentStep] : 'Starting...'}
          </span>
        </div>
      ) : streamError ? (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-400">
          {streamError}
        </div>
      ) : !hasPrior ? (
        <p className="text-sm text-muted-foreground">
          No analysis yet. Click Generate to produce catalysts and risks for{' '}
          {ticker}.
        </p>
      ) : isValidationFailed ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-400">
          The model returned output that failed validation
          {analysis?.errorMessage ? `: ${analysis.errorMessage}` : '.'} Try
          regenerating.
        </div>
      ) : isFailed ? (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-400">
          {analysis?.errorMessage ?? 'Generation failed. Try again.'}
        </div>
      ) : isCompleted ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-border border-l-4 border-l-emerald-500 bg-background p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Potential Catalysts
            </h3>
            <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
              {content!.catalysts.map((item, idx) => (
                <li key={idx} className="leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-border border-l-4 border-l-amber-500 bg-background p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Key Risks
            </h3>
            <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
              {content!.risks.map((item, idx) => (
                <li key={idx} className="leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Analysis in an unexpected state. Try regenerating.
        </p>
      )}
    </section>
  );
}
