"use client";

import { useState } from "react";
import { useAnalysisHistory } from "@/lib/scheduling/hooks";
import type {
  BullBearContent,
  CatalystsRisksContent,
  LiveOnCallContent,
  SectionType,
} from "@/lib/ai/types";
import type { SerializedAnalysisHistory } from "@/lib/scheduling/types";

interface Props {
  ticker: string;
  sectionType: SectionType;
}

const SECTION_LABEL: Record<SectionType, string> = {
  bullBear: "Bull vs Bear",
  catalystsRisks: "Catalysts & Risks",
  liveOnCall: "Live on the Call",
};

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
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

// Content is `unknown` from the JSON column; narrowing by `sectionType` is
// safe because the generation pipeline only writes shape-matched content
// per sectionType (validated by Zod in `@/lib/ai/validation`).
function getCollapsedPreview(
  sectionType: SectionType,
  content: unknown,
): string {
  if (sectionType === "bullBear") {
    return (content as BullBearContent).oneLiner;
  }
  if (sectionType === "catalystsRisks") {
    const c = content as CatalystsRisksContent;
    return `${c.catalysts[0] ?? ""} • ${c.risks[0] ?? ""}`;
  }
  const c = content as LiveOnCallContent;
  return c.items[0]?.topic ?? "";
}

function ExpandedContent({
  sectionType,
  content,
}: {
  sectionType: SectionType;
  content: unknown;
}) {
  if (sectionType === "bullBear") {
    const c = content as BullBearContent;
    return (
      <div className="mt-3 space-y-3 text-sm">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-400">
            Bull case
          </div>
          <ul className="list-disc space-y-1 pl-5 text-foreground">
            {c.bullCase.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-400">
            Bear case
          </div>
          <ul className="list-disc space-y-1 pl-5 text-foreground">
            {c.bearCase.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (sectionType === "catalystsRisks") {
    const c = content as CatalystsRisksContent;
    return (
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-400">
            Catalysts
          </div>
          <ul className="list-disc space-y-1 pl-5 text-foreground">
            {c.catalysts.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-400">
            Risks
          </div>
          <ul className="list-disc space-y-1 pl-5 text-foreground">
            {c.risks.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const c = content as LiveOnCallContent;
  return (
    <ol className="mt-3 space-y-3 text-sm">
      {c.items.map((item, i) => (
        <li key={i} className="rounded-md border border-border bg-background/40 p-3">
          <div className="font-medium text-foreground">{item.topic}</div>
          <div className="mt-1 text-muted-foreground">{item.rationale}</div>
        </li>
      ))}
    </ol>
  );
}

function TimelineEntry({
  entry,
  sectionType,
  expanded,
  onToggle,
}: {
  entry: SerializedAnalysisHistory;
  sectionType: SectionType;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="relative pl-6">
      <span className="absolute left-0 top-2 h-2 w-2 -translate-x-1/2 rounded-full bg-primary" />
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {formatRelative(entry.generatedAt)}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            {entry.model}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="text-xs text-primary hover:underline"
          aria-expanded={expanded}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
      {!expanded && (
        <p className="mt-2 line-clamp-2 text-sm text-foreground">
          {getCollapsedPreview(sectionType, entry.content)}
        </p>
      )}
      {expanded && (
        <ExpandedContent sectionType={sectionType} content={entry.content} />
      )}
    </li>
  );
}

export function AnalysisHistoryView({ ticker, sectionType }: Props) {
  const { data, isLoading, isError, error } = useAnalysisHistory(
    ticker,
    sectionType,
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          Analysis History
        </h2>
        <p className="text-sm text-muted-foreground">
          {SECTION_LABEL[sectionType]} for {ticker}
        </p>
      </header>

      {isLoading ? (
        <ul className="space-y-4">
          {[0, 1, 2].map((i) => (
            <li key={i} className="relative pl-6">
              <span className="absolute left-0 top-2 h-2 w-2 -translate-x-1/2 rounded-full bg-muted" />
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-3 w-full animate-pulse rounded bg-muted/70" />
              <div className="mt-1 h-3 w-3/4 animate-pulse rounded bg-muted/70" />
            </li>
          ))}
        </ul>
      ) : isError ? (
        <p className="text-sm text-muted-foreground">
          {error instanceof Error
            ? error.message
            : "Failed to load analysis history."}
        </p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No previous analyses for this section yet. Generate one or wait for
          the scheduled daily run to populate history.
        </p>
      ) : (
        <ul className="space-y-5 border-l border-border pl-2">
          {data.map((entry) => (
            <TimelineEntry
              key={entry.id}
              entry={entry}
              sectionType={sectionType}
              expanded={expanded.has(entry.id)}
              onToggle={() => toggle(entry.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default AnalysisHistoryView;
