'use client';

import { usePrice, useProfile, useEarnings } from '@/lib/finance/hooks';
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

const compactUsdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});

const earningsDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatUsd(value: number | null | undefined): string {
  if (value == null) return '—';
  return usdFormatter.format(value);
}

function formatSignedUsd(value: number | null | undefined): string {
  if (value == null) return '—';
  const sign = value >= 0 ? '+' : '−';
  return `${sign}${usdFormatter.format(Math.abs(value))}`;
}

// Yahoo encodes regularMarketChangePercent inconsistently: typically a decimal
// (0.0042 = 0.42%) but occasionally an already-scaled percent (0.42). Detect by
// magnitude — anything |x| < 1 is treated as a decimal fraction.
function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—';
  const scaled = Math.abs(value) < 1 ? value * 100 : value;
  const sign = scaled >= 0 ? '+' : '−';
  return `${sign}${Math.abs(scaled).toFixed(2)}%`;
}

function formatCompactUsd(value: number | null | undefined): string {
  if (value == null) return '—';
  return compactUsdFormatter.format(value);
}

function tone(value: number | null | undefined): string {
  if (value == null) return 'text-muted-foreground';
  if (value >= 0) return 'text-emerald-500';
  return 'text-rose-500';
}

function pickNextEarningsDate(
  quarterly:
    | Array<{ date: string; actual: number | null; estimate: number | null }>
    | undefined,
): string {
  if (!quarterly || quarterly.length === 0) return '—';
  const now = Date.now();
  for (const q of quarterly) {
    const parsed = Date.parse(q.date);
    if (Number.isFinite(parsed) && parsed > now) {
      return earningsDateFormatter.format(new Date(parsed));
    }
  }
  return '—';
}

function Skeleton() {
  return (
    <section
      aria-label="Loading stock header"
      className="rounded-lg border border-border bg-card p-6"
    >
      <div className="animate-pulse space-y-6">
        <div className="flex items-baseline gap-4">
          <div className="h-9 w-24 rounded bg-muted" />
          <div className="h-6 w-56 rounded bg-muted" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="h-10 w-40 rounded bg-muted" />
            <div className="h-5 w-32 rounded bg-muted" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 rounded bg-muted" />
                <div className="h-4 w-24 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function StockHeader({ ticker }: Props) {
  const price = usePrice(ticker);
  const profile = useProfile(ticker);
  const earnings = useEarnings(ticker);

  if (price.isLoading || profile.isLoading) {
    return <Skeleton />;
  }

  if (price.isError) {
    return (
      <section className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Failed to load stock header
        </p>
      </section>
    );
  }

  const priceData = price.data?.data ?? null;
  const profileData = profile.data?.data ?? null;
  const earningsData = earnings.data?.data ?? null;

  const displayName =
    priceData?.longName ?? priceData?.shortName ?? '—';

  const changeValue = priceData?.regularMarketChange ?? null;
  const changePercent = priceData?.regularMarketChangePercent ?? null;
  const changeTone = tone(changeValue);

  const nextEarnings = pickNextEarningsDate(
    earningsData?.earningsChart?.quarterly,
  );

  return (
    <section
      aria-label={`${ticker} overview`}
      className="rounded-lg border border-border bg-card p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="font-mono text-3xl font-bold tracking-tight text-foreground">
            {ticker}
          </h2>
          <p className="text-lg text-muted-foreground">{displayName}</p>
        </div>
        <FreshnessIndicator
          updatedAt={price.dataUpdatedAt || null}
          fromCache={price.data?.fromCache ?? false}
          forceStale={price.data?.stale ?? false}
        />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="text-4xl font-semibold tabular-nums text-foreground">
            {formatUsd(priceData?.regularMarketPrice)}
          </span>
          <span
            className={cn('text-base font-medium tabular-nums', changeTone)}
          >
            {formatSignedUsd(changeValue)}{' '}
            <span className="text-sm">({formatPercent(changePercent)})</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <MetaItem
            label="Market Cap"
            value={formatCompactUsd(priceData?.marketCap)}
          />
          <MetaItem label="Sector" value={profileData?.sector ?? '—'} />
          <MetaItem label="Industry" value={profileData?.industry ?? '—'} />
          <MetaItem
            label="Currency"
            value={priceData?.currency ?? 'USD'}
          />
          <MetaItem label="Next Earnings" value={nextEarnings} />
        </div>
      </div>
    </section>
  );
}
