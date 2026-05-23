"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLatestAnalysis } from "@/lib/ai/hooks";
import { generateAnalysisStream } from "@/lib/ai/api-client";
import type { BullBearContent } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

interface Props {
  ticker: string;
}

type StreamStep = "fetching_data" | "generating" | "validating";

const STEP_ORDER: StreamStep[] = ["fetching_data", "generating", "validating"];

const STEP_LABEL: Record<StreamStep, string> = {
  fetching_data: "Fetching market data...",
  generating: "Analyzing with Claude...",
  validating: "Validating output...",
};

function formatRelative(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (!t || Number.isNaN(t)) return "—";
  const seconds = Math.max(0, Math.floor((now - t) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const d = Math.floor(seconds / 86400);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function stepIndex(step: StreamStep | null): number {
  if (step == null) return -1;
  return STEP_ORDER.indexOf(step);
}

function ProgressSteps({ current }: { current: StreamStep | null }) {
  const activeIdx = stepIndex(current);
  return (
    <ol className="space-y-2" aria-label="Generation progress">
      {STEP_ORDER.map((step, idx) => {
        const isActive = idx === activeIdx;
        const isDone = activeIdx > idx;
        return (
          <li key={step} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                isDone &&
                  "border-emerald-500 bg-emerald-500/10 text-emerald-500",
                isActive &&
                  "animate-pulse border-foreground text-foreground",
                !isActive &&
                  !isDone &&
                  "border-border text-muted-foreground",
              )}
              aria-hidden="true"
            >
              {isDone ? "✓" : idx + 1}
            </span>
            <span
              className={cn(
                isActive && "text-foreground",
                isDone && "text-emerald-500",
                !isActive && !isDone && "text-muted-foreground",
              )}
            >
              {STEP_LABEL[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function CaseCard({
  side,
  items,
}: {
  side: "bull" | "bear";
  items: string[];
}) {
  const isBull = side === "bull";
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-background/40 p-4",
        isBull ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-rose-500",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-sm text-xs font-bold",
            isBull
              ? "bg-emerald-500/15 text-emerald-500"
              : "bg-rose-500/15 text-rose-500",
          )}
          aria-hidden="true"
        >
          {isBull ? "▲" : "▼"}
        </span>
        <h3
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            isBull ? "text-emerald-500" : "text-rose-500",
          )}
        >
          {isBull ? "Bull Case" : "Bear Case"}
        </h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li
            key={idx}
            className="flex gap-2 text-sm leading-relaxed text-foreground"
          >
            <span
              className={cn(
                "mt-2 inline-block h-1 w-1 shrink-0 rounded-full",
                isBull ? "bg-emerald-500" : "bg-rose-500",
              )}
              aria-hidden="true"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function BullBear({ ticker }: Props) {
  const qc = useQueryClient();
  const analysisQuery = useLatestAnalysis(ticker, "bullBear");
  const analysis = analysisQuery.data ?? null;

  const [generating, setGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<StreamStep | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // The wire schema types `content` as the union of all section payloads.
  // The API enforces per-section shape, so narrowing to BullBearContent here
  // is safe whenever sectionType === 'bullBear'.
  const content = analysis?.content as BullBearContent | null;

  async function handleRefresh() {
    if (generating) return;
    setGenerating(true);
    setCurrentStep(null);
    setStreamError(null);
    try {
      for await (const event of generateAnalysisStream(ticker, "bullBear")) {
        if (event.type === "progress") {
          setCurrentStep(event.step);
        } else if (event.type === "complete") {
          await qc.invalidateQueries({
            queryKey: ["analysis", ticker, "bullBear"],
          });
        } else if (event.type === "error") {
          setStreamError(event.message);
        }
      }
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGenerating(false);
      setCurrentStep(null);
    }
  }

  const hasAnalysis = analysis != null;
  const hasContent = content != null;
  const status = analysis?.status ?? null;
  const buttonLabel = hasAnalysis ? "Refresh" : "Generate";

  return (
    <section
      className="rounded-lg border border-border bg-card p-6"
      aria-label="Bull vs Bear"
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Bull vs Bear</h2>
          <p className="text-sm text-muted-foreground">
            AI-generated long and short thesis for {ticker}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasAnalysis && (
            <span className="text-xs text-muted-foreground tabular-nums">
              Generated {formatRelative(analysis.generatedAt, Date.now())}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={generating || analysisQuery.isLoading || ticker.length === 0}
            className={cn(
              "rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors",
              "hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {generating ? "Generating..." : buttonLabel}
          </button>
        </div>
      </header>

      {analysisQuery.isLoading ? (
        <div className="space-y-3" aria-hidden="true">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="h-40 animate-pulse rounded bg-muted" />
            <div className="h-40 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ) : analysisQuery.isError ? (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-400">
          Failed to load analysis: {analysisQuery.error instanceof Error ? analysisQuery.error.message : "Unknown error"}
        </div>
      ) : generating ? (
        <div className="space-y-4">
          <ProgressSteps current={currentStep} />
          {streamError && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-400">
              {streamError}
            </div>
          )}
        </div>
      ) : !hasAnalysis ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-background/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No analysis yet for {ticker}.
          </p>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={generating}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Generate Bull vs Bear
          </button>
          {streamError && (
            <p className="text-xs text-rose-400">{streamError}</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {status === "validation_failed" && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-400">
              Latest refresh contained unverified figures and was rejected.
              Showing previous version. — try again.
            </div>
          )}
          {status === "failed" && hasContent && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-400">
              Latest refresh failed
              {analysis.errorMessage ? `: ${analysis.errorMessage}` : ""}.
              Showing previous version.
            </div>
          )}
          {status === "failed" && !hasContent ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-rose-500/30 bg-rose-500/5 p-10 text-center">
              <p className="text-sm text-rose-400">
                Generation failed
                {analysis.errorMessage ? `: ${analysis.errorMessage}` : "."}
              </p>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={generating}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Retry
              </button>
            </div>
          ) : hasContent ? (
            <>
              {content.oneLiner && (
                <p className="text-base italic text-muted-foreground">
                  {content.oneLiner}
                </p>
              )}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <CaseCard side="bull" items={content.bullCase} />
                <CaseCard side="bear" items={content.bearCase} />
              </div>
              {streamError && (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-400">
                  {streamError}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
