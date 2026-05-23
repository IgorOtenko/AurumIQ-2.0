'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { listHoldings } from '@/lib/portfolio/api-client';
import type { EnrichedHolding } from '@/lib/portfolio/types';
import { cn } from '@/lib/utils';

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPrice(price: number | null): string {
  if (price == null) return '—';
  return usdFormatter.format(price);
}

function formatPercent(value: number | null): string {
  if (value == null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function performanceTone(gainLoss: number | null): string {
  if (gainLoss == null) return 'text-muted-foreground';
  if (gainLoss >= 0) return 'text-emerald-500';
  return 'text-rose-500';
}

function arrowFor(gainLoss: number | null): string {
  if (gainLoss == null) return '·';
  return gainLoss >= 0 ? '▲' : '▼';
}

function TickerPill({ holding }: { holding: EnrichedHolding }) {
  const tone = performanceTone(holding.gainLoss);
  return (
    <Link
      href={`/dashboard/${holding.ticker}`}
      className={cn(
        'group flex min-w-[9rem] shrink-0 snap-start flex-col rounded-md border border-border bg-card px-4 py-2',
        'transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <span className="text-base font-bold leading-tight text-foreground">
        {holding.ticker}
      </span>
      <span className="text-sm font-medium text-foreground/90">
        {formatPrice(holding.currentPrice)}
      </span>
      <span className={cn('text-xs font-semibold', tone)}>
        <span aria-hidden="true">{arrowFor(holding.gainLoss)}</span>{' '}
        {formatPercent(holding.gainLossPercent)}
      </span>
    </Link>
  );
}

function SkeletonPill() {
  return (
    <div
      aria-hidden="true"
      className="h-16 w-36 shrink-0 animate-pulse rounded-md border border-border bg-muted"
    />
  );
}

function MessagePill({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-[14rem] shrink-0 items-center rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export default function StockTickerBar() {
  const { data, isLoading, isError } = useQuery<EnrichedHolding[]>({
    queryKey: ['holdings'],
    queryFn: listHoldings,
  });

  const containerClasses = cn(
    'flex gap-3 overflow-x-auto px-2 py-3 scroll-smooth snap-x snap-mandatory',
  );

  if (isLoading) {
    return (
      <div className={containerClasses} role="status" aria-label="Loading portfolio">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonPill key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className={containerClasses}>
        <MessagePill>Failed to load portfolio</MessagePill>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={containerClasses}>
        <MessagePill>No holdings yet — add one to get started</MessagePill>
      </div>
    );
  }

  return (
    <div className={containerClasses} role="list" aria-label="Portfolio holdings">
      {data.map((holding) => (
        <div key={holding.id} role="listitem">
          <TickerPill holding={holding} />
        </div>
      ))}
    </div>
  );
}
