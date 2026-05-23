"use client";

import { useEffect, useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  usePrice,
  useEarnings,
  useAnalyst,
  useOptions,
  useProfile,
  useNews,
} from "@/lib/finance/hooks";
import type { AdapterResult } from "@/lib/finance/types";
import FreshnessIndicator from "@/components/dashboard/FreshnessIndicator";

interface Props {
  ticker: string;
}

type AnyAdapterQuery = UseQueryResult<AdapterResult<unknown>>;

type StatusKind = "live" | "cached" | "stale" | "failed" | "loading";

interface SourceRow {
  source: string;
  data: string;
  query: AnyAdapterQuery;
}

function classifyStatus(query: AnyAdapterQuery): StatusKind {
  if (query.isError) return "failed";
  if (query.isLoading) return "loading";
  const result = query.data;
  if (result?.stale) return "stale";
  if (result?.fromCache) return "cached";
  if (result) return "live";
  return "loading";
}

function statusLabel(kind: StatusKind): string {
  switch (kind) {
    case "live":
      return "Live";
    case "cached":
      return "Cached";
    case "stale":
      return "Cached (stale)";
    case "failed":
      return "Failed";
    case "loading":
      return "Loading…";
  }
}

function statusClasses(kind: StatusKind): string {
  switch (kind) {
    case "live":
      return "bg-emerald-500/10 text-emerald-400";
    case "stale":
      return "bg-amber-500/10 text-amber-400";
    case "failed":
      return "bg-rose-500/10 text-rose-400";
    case "cached":
    case "loading":
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatRelative(updatedAt: number, now: number): string {
  if (!updatedAt) return "—";
  const seconds = Math.max(0, Math.floor((now - updatedAt) / 1000));
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

export default function Sources({ ticker }: Props) {
  // Observer pattern: pass `enabled: false` so this component does NOT trigger
  // fresh fetches. Tanstack Query's shared cache means that if another section
  // has already requested the same queryKey, we'll observe its cached result
  // (including dataUpdatedAt) without duplicating network calls.
  const price = usePrice(ticker, false) as AnyAdapterQuery;
  const earnings = useEarnings(ticker, false) as AnyAdapterQuery;
  const analyst = useAnalyst(ticker, false) as AnyAdapterQuery;
  const options = useOptions(ticker, false) as AnyAdapterQuery;
  const profile = useProfile(ticker, false) as AnyAdapterQuery;
  const news = useNews(ticker, false) as AnyAdapterQuery;

  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();

  const allQueries = [price, earnings, analyst, options, profile, news];
  const aggregateUpdatedAt = Math.max(
    ...allQueries.map((q) => q.dataUpdatedAt ?? 0),
  );
  const anyStale = allQueries.some((q) => q.data?.stale === true);
  const anyFromCache = allQueries.some((q) => q.data?.fromCache === true);

  const rows: SourceRow[] = [
    { source: "Yahoo Finance", data: "Price & quote summary", query: price },
    { source: "Yahoo Finance", data: "Earnings", query: earnings },
    { source: "Yahoo Finance", data: "Analyst ratings", query: analyst },
    { source: "Yahoo Finance", data: "Options chain", query: options },
    { source: "Yahoo Finance", data: "Company profile", query: profile },
    { source: "Yahoo Finance Search", data: "News", query: news },
  ];

  return (
    <section className="bg-card border border-border rounded-lg p-6">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Sources</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Client-side cache timestamps (server does not return a fetched-at).
          </p>
        </div>
        <FreshnessIndicator
          updatedAt={aggregateUpdatedAt || null}
          fromCache={anyFromCache}
          forceStale={anyStale}
        />
      </header>

      <div className="grid grid-cols-[1fr_2fr_auto_auto] gap-x-4 gap-y-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground pb-2 border-b border-border">
          Source
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground pb-2 border-b border-border">
          Data
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground pb-2 border-b border-border">
          Status
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground pb-2 border-b border-border text-right">
          Last refreshed
        </div>

        {rows.map((row, idx) => {
          const kind = classifyStatus(row.query);
          const isLast = idx === rows.length - 1;
          const borderCls = isLast ? "" : "border-b border-border/50";
          return (
            <div key={`${row.source}-${row.data}`} className="contents">
              <div className={`py-3 text-sm text-foreground ${borderCls}`}>
                {row.source}
              </div>
              <div className={`py-3 text-sm text-muted-foreground ${borderCls}`}>
                {row.data}
              </div>
              <div className={`py-3 ${borderCls}`}>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(kind)}`}
                >
                  {statusLabel(kind)}
                </span>
              </div>
              <div
                className={`py-3 text-sm text-muted-foreground text-right tabular-nums ${borderCls}`}
              >
                {formatRelative(row.query.dataUpdatedAt ?? 0, now)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
