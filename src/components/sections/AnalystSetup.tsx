"use client";

import { useAnalyst, useEarnings } from "@/lib/finance/hooks";

interface Props {
  ticker: string;
}

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatUsd(value: number | null | undefined): string {
  if (value == null) return "—";
  return usdFormatter.format(value);
}

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function upsideTone(value: number | null): string {
  if (value == null) return "text-muted-foreground";
  if (value >= 0) return "text-emerald-500";
  return "text-rose-500";
}

interface RatingBucket {
  label: string;
  count: number;
  className: string;
}

function buildBuckets(trend: {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}): RatingBucket[] {
  return [
    { label: "Strong Buy", count: trend.strongBuy, className: "bg-emerald-600" },
    { label: "Buy", count: trend.buy, className: "bg-emerald-400" },
    { label: "Hold", count: trend.hold, className: "bg-amber-400" },
    { label: "Sell", count: trend.sell, className: "bg-rose-400" },
    { label: "Strong Sell", count: trend.strongSell, className: "bg-rose-600" },
  ];
}

function RatingsBar({ buckets }: { buckets: RatingBucket[] }) {
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  if (total === 0) {
    return (
      <div className="flex h-4 w-full overflow-hidden rounded bg-muted" aria-hidden="true" />
    );
  }
  return (
    <div className="flex h-4 w-full overflow-hidden rounded" role="img" aria-label="Analyst ratings breakdown">
      {buckets.map((bucket) =>
        bucket.count > 0 ? (
          <div
            key={bucket.label}
            className={bucket.className}
            style={{ flex: bucket.count }}
            title={`${bucket.label}: ${bucket.count}`}
          />
        ) : null,
      )}
    </div>
  );
}

function Legend({ buckets }: { buckets: RatingBucket[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {buckets.map((bucket) => (
        <div key={bucket.label} className="flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-sm ${bucket.className}`} />
          <span>
            {bucket.label} <span className="text-foreground">{bucket.count}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function StalePill() {
  return (
    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      Stale
    </span>
  );
}

function SectionShell({
  children,
  stale,
}: {
  children: React.ReactNode;
  stale?: boolean;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <header className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Analyst Setup</h3>
        {stale ? <StalePill /> : null}
      </header>
      {children}
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <SectionShell>
      <div className="space-y-6" role="status" aria-label="Loading analyst data">
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </SectionShell>
  );
}

export default function AnalystSetup({ ticker }: Props) {
  const analyst = useAnalyst(ticker);
  const earnings = useEarnings(ticker);

  if (analyst.isLoading || earnings.isLoading) {
    return <LoadingSkeleton />;
  }

  if (analyst.isError && earnings.isError) {
    return (
      <SectionShell>
        <p className="text-sm text-muted-foreground">Failed to load analyst data</p>
      </SectionShell>
    );
  }

  const stale = Boolean(analyst.data?.stale || earnings.data?.stale);

  const trendArr = analyst.data?.data?.recommendationTrend?.trend ?? [];
  const currentTrend = trendArr.find((t) => t.period === "0m") ?? trendArr[0];
  const buckets = currentTrend ? buildBuckets(currentTrend) : null;

  const financial = earnings.data?.data?.financialData;
  const targetMean = financial?.targetMeanPrice ?? null;
  const currentPrice = financial?.currentPrice ?? null;
  const impliedUpside =
    targetMean != null && currentPrice != null && currentPrice !== 0
      ? ((targetMean - currentPrice) / currentPrice) * 100
      : null;

  // upgradeDowngradeHistory exists in the raw Yahoo response but is not exposed
  // on the AnalystData type — skipping the revisions block until Phase 7 widens it.

  return (
    <SectionShell stale={stale}>
      <div className="space-y-6">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Ratings (current month)
            </span>
            {buckets ? (
              <span className="text-xs text-muted-foreground">
                {buckets.reduce((s, b) => s + b.count, 0)} analysts
              </span>
            ) : null}
          </div>
          {buckets ? (
            <>
              <RatingsBar buckets={buckets} />
              <Legend buckets={buckets} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 border-t border-border pt-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Target
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {formatUsd(targetMean)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current
            </div>
            <div className="mt-1 text-lg font-medium text-foreground">
              {formatUsd(currentPrice)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Implied Upside
            </div>
            <div className={`mt-1 text-lg font-semibold ${upsideTone(impliedUpside)}`}>
              {formatPercent(impliedUpside)}
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
