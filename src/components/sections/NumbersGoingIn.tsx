'use client';

import { useEarnings, useAnalyst } from '@/lib/finance/hooks';
import { cn } from '@/lib/utils';
import FreshnessIndicator from '@/components/dashboard/FreshnessIndicator';

interface Props {
  ticker: string;
}

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatUsd(value: number | null | undefined): string {
  if (value == null) return '—';
  return usdFormatter.format(value);
}

function formatPercentDecimal(value: number | null | undefined): string {
  if (value == null) return '—';
  const pct = value * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function formatSurprisePercent(value: number | null): string {
  if (value == null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function growthTone(value: number | null | undefined): string {
  if (value == null) return 'text-foreground';
  return value >= 0 ? 'text-emerald-500' : 'text-rose-500';
}

function surpriseTone(
  actual: number | null,
  estimate: number | null,
): string {
  if (actual == null || estimate == null) return 'text-muted-foreground';
  if (actual > estimate) return 'text-emerald-500';
  if (actual < estimate) return 'text-rose-500';
  return 'text-muted-foreground';
}

// Quarterly date may arrive as "4Q2024" (Yahoo convention) or ISO. Detect the
// fiscal-quarter form first and pass through; otherwise try to render as a
// short ISO date. Falls back to the raw string so we never drop a label.
function formatQuarterLabel(raw: string): string {
  if (/^[1-4]Q\d{4}$/i.test(raw)) return raw.toUpperCase();
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  }
  return raw;
}

function quarterSortKey(raw: string): number {
  const fiscal = raw.match(/^([1-4])Q(\d{4})$/i);
  if (fiscal) {
    const q = Number(fiscal[1]);
    const y = Number(fiscal[2]);
    return y * 10 + q;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime() / 1e8;
  return 0;
}

function Metric({
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
      <span className={cn('text-2xl font-semibold', tone ?? 'text-foreground')}>
        {value}
      </span>
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      <div className="h-7 w-20 animate-pulse rounded bg-muted" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-8 w-full animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}

export default function NumbersGoingIn({ ticker }: Props) {
  const earnings = useEarnings(ticker);
  const analyst = useAnalyst(ticker);

  const earningsPayload = earnings.data?.data ?? null;
  const stale = earnings.data?.stale === true || analyst.data?.stale === true;
  const fromCache =
    (earnings.data?.fromCache ?? false) || (analyst.data?.fromCache ?? false);
  // Use the more recent of the two source timestamps so the pill reflects the
  // freshest underlying data shown in this combined section.
  const lastUpdated = Math.max(
    earnings.dataUpdatedAt ?? 0,
    analyst.dataUpdatedAt ?? 0,
  );

  const revenueGrowth = earningsPayload?.financialData?.revenueGrowth ?? null;
  const epsEstimate =
    earningsPayload?.earningsChart?.currentQuarterEstimate ?? null;
  const targetPrice = earningsPayload?.financialData?.targetMeanPrice ?? null;

  const quarterly = earningsPayload?.earningsChart?.quarterly ?? [];
  const sortedQuarters = [...quarterly]
    .sort((a, b) => quarterSortKey(b.date) - quarterSortKey(a.date))
    .slice(0, 4);

  // Partial state: if earnings failed entirely but analyst loaded (or vice
  // versa) we still want to render the card scaffold with em-dash placeholders.
  const earningsUnavailable = earnings.isError || earningsPayload == null;

  return (
    <section
      className="bg-card border border-border rounded-lg p-6"
      aria-label="Numbers Going In"
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Numbers Going In
          </h2>
          <p className="text-sm text-muted-foreground">
            Consensus expectations and recent earnings track record.
          </p>
        </div>
        <FreshnessIndicator
          updatedAt={lastUpdated || null}
          fromCache={fromCache}
          forceStale={stale}
        />
      </header>

      {earnings.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
        </div>
      ) : earnings.isError && analyst.isError ? (
        <p className="text-sm text-muted-foreground">
          Failed to load earnings data
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Metric
            label="Revenue Growth (next)"
            value={formatPercentDecimal(revenueGrowth)}
            tone={growthTone(revenueGrowth)}
          />
          <Metric
            label="EPS Estimate (this Q)"
            value={formatUsd(epsEstimate)}
          />
          <Metric label="Analyst Target" value={formatUsd(targetPrice)} />
        </div>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Last 4 Quarters
        </h3>

        {earnings.isLoading ? (
          <TableSkeleton />
        ) : earningsUnavailable ? (
          <p className="text-sm text-muted-foreground">
            {earnings.isError
              ? 'Failed to load earnings data'
              : 'No earnings history available'}
          </p>
        ) : sortedQuarters.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No earnings history available
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Quarter</th>
                  <th className="pb-2 pr-4 font-medium">Estimate</th>
                  <th className="pb-2 pr-4 font-medium">Actual</th>
                  <th className="pb-2 pr-4 font-medium">Surprise</th>
                  <th className="pb-2 font-medium">Surprise %</th>
                </tr>
              </thead>
              <tbody>
                {sortedQuarters.map((q) => {
                  const hasBoth = q.actual != null && q.estimate != null;
                  const surprise = hasBoth
                    ? (q.actual as number) - (q.estimate as number)
                    : null;
                  const surprisePct =
                    hasBoth && (q.estimate as number) !== 0
                      ? (((q.actual as number) - (q.estimate as number)) /
                          Math.abs(q.estimate as number)) *
                        100
                      : null;
                  const tone = surpriseTone(q.actual, q.estimate);
                  return (
                    <tr
                      key={q.date}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="py-2 pr-4 text-foreground">
                        {formatQuarterLabel(q.date)}
                      </td>
                      <td className="py-2 pr-4 text-foreground">
                        {formatUsd(q.estimate)}
                      </td>
                      <td className="py-2 pr-4 text-foreground">
                        {formatUsd(q.actual)}
                      </td>
                      <td className={cn('py-2 pr-4 font-medium', tone)}>
                        {surprise == null
                          ? '—'
                          : `${surprise >= 0 ? '+' : ''}${usdFormatter.format(surprise)}`}
                      </td>
                      <td className={cn('py-2 font-medium', tone)}>
                        {formatSurprisePercent(surprisePct)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {analyst.isError && !earnings.isError && (
          <p className="mt-3 text-xs text-muted-foreground">—</p>
        )}
      </div>
    </section>
  );
}
