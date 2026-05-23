'use client';

import { useEarnings, useProfile } from '@/lib/finance/hooks';
import { cn } from '@/lib/utils';
import FreshnessIndicator from '@/components/dashboard/FreshnessIndicator';

// Per-segment revenue breakdowns live in SEC 10-Q filings, not Yahoo Finance's
// quoteSummary. Integrating EDGAR is outside v1 scope, so this section is built
// to gracefully degrade today and slot in a real segment source later without a
// rewrite — the structural skeleton (sector/industry + consolidated growth) is
// the honest, useful subset we CAN show from current adapters.

interface Props {
  ticker: string;
}

function formatPercentDecimal(value: number | null | undefined): string {
  if (value == null) return '—';
  const pct = value * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function growthTone(value: number | null | undefined): string {
  if (value == null) return 'text-foreground';
  return value >= 0 ? 'text-emerald-500' : 'text-rose-500';
}

function Field({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn('text-base font-semibold', tone ?? 'text-foreground')}>
        {value}
      </span>
    </div>
  );
}

function FieldSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      <div className="h-5 w-32 animate-pulse rounded bg-muted" />
    </div>
  );
}

export default function SegmentExpectations({ ticker }: Props) {
  const earnings = useEarnings(ticker);
  const profile = useProfile(ticker);

  const earningsPayload = earnings.data?.data ?? null;
  const profilePayload = profile.data?.data ?? null;

  const sector = profilePayload?.sector ?? '—';
  const industry = profilePayload?.industry ?? '—';
  const revenueGrowth = earningsPayload?.financialData?.revenueGrowth ?? null;

  // Compose freshness across both source queries: take the most recent update
  // timestamp and surface cached/stale if EITHER underlying response was so.
  const lastUpdated = Math.max(
    earnings.dataUpdatedAt ?? 0,
    profile.dataUpdatedAt ?? 0,
  );
  const fromCache =
    (earnings.data?.fromCache ?? false) || (profile.data?.fromCache ?? false);
  const forceStale =
    (earnings.data?.stale ?? false) || (profile.data?.stale ?? false);

  const isLoading = earnings.isLoading || profile.isLoading;
  const bothErrored = earnings.isError && profile.isError;

  return (
    <section
      className="bg-card border border-border rounded-lg p-6"
      aria-label="Segment Expectations"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Segment Expectations
        </h2>
        <FreshnessIndicator
          updatedAt={lastUpdated || null}
          fromCache={fromCache}
          forceStale={forceStale}
        />
      </div>

      {isLoading ? (
        <>
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
            <div className="mt-4">
              <FieldSkeleton />
            </div>
          </div>
        </>
      ) : bothErrored ? (
        <p className="text-sm text-muted-foreground">
          Failed to load segment data
        </p>
      ) : (
        <>
          <p className="text-sm italic text-muted-foreground">
            Per-segment revenue breakdowns are not available from our current
            data source. The SEC 10-Q filings contain this data, and we plan to
            integrate them in a future release.
          </p>

          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              What we know
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Sector" value={sector} />
              <Field label="Industry" value={industry} />
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <Field
                label="Revenue growth (consolidated)"
                value={formatPercentDecimal(revenueGrowth)}
                tone={growthTone(revenueGrowth)}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
