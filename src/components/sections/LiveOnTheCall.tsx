'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLatestAnalysis } from '@/lib/ai/hooks';
import { generateAnalysisStream } from '@/lib/ai/api-client';
import type { ProgressEvent } from '@/lib/ai/api-client';
import type { LiveOnCallContent } from '@/lib/ai/types';
import FreshnessIndicator from '@/components/dashboard/FreshnessIndicator';

interface Props {
  ticker: string;
}

const PROGRESS_COPY: Record<ProgressEvent['step'], string> = {
  fetching_data: 'Fetching market data...',
  generating: 'Preparing earnings call agenda...',
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

export default function LiveOnTheCall({ ticker }: Props) {
  const qc = useQueryClient();
  const { data: analysis, isLoading } = useLatestAnalysis(
    ticker,
    'liveOnCall',
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
      for await (const event of generateAnalysisStream(ticker, 'liveOnCall')) {
        if (event.type === 'progress') {
          setCurrentStep(event.step);
        } else if (event.type === 'complete') {
          await qc.invalidateQueries({
            queryKey: ['analysis', ticker, 'liveOnCall'],
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
  // 'liveOnCall' has content of shape LiveOnCallContent (validated server-side).
  const content = analysis?.content as LiveOnCallContent | null;

  const status = analysis?.status;
  const hasPrior = analysis != null;
  const isCompleted = status === 'completed' && content != null;
  const isValidationFailed = status === 'validation_failed';
  const isFailed = status === 'failed';

  return (
    <section
      className="rounded-lg border border-border bg-card p-6"
      aria-label="Live on the Call"
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Live on the Call
          </h2>
          <p className="text-sm text-muted-foreground">
            What to listen for during the next earnings call.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {analysis?.generatedAt && (
            <span className="text-xs text-muted-foreground">
              Generated {formatRelativeTime(analysis.generatedAt)}
            </span>
          )}
          <FreshnessIndicator
            updatedAt={
              analysis?.generatedAt
                ? new Date(analysis.generatedAt).getTime()
                : null
            }
          />
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
          <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
        </div>
      ) : streaming ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-400" />
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
          No analysis yet. Click Generate to produce an earnings-call agenda
          for {ticker}.
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
        <ol className="space-y-3">
          {content!.items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sm font-semibold text-sky-400">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground">{item.topic}</div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {item.rationale}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">
          Analysis in an unexpected state. Try regenerating.
        </p>
      )}
    </section>
  );
}
