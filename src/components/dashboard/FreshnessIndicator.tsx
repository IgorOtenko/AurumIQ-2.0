"use client";

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  // ms epoch of last data update
  updatedAt: number | null;
  // ms threshold above which the pill becomes amber (stale). Default: 12 hours.
  staleAfterMs?: number;
  // Server already told us the response was stale (e.g., cache fallback). Forces amber.
  forceStale?: boolean;
  // Server told us the response came from cache. Renders muted (not stale).
  fromCache?: boolean;
}

export default function FreshnessIndicator({
  updatedAt,
  staleAfterMs = 12 * 60 * 60 * 1000,
  forceStale = false,
  fromCache = false,
}: Props) {
  // Re-render every 30s so the relative time updates without a refetch.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (updatedAt == null) {
    return (
      <span className="text-xs text-muted-foreground">No data yet</span>
    );
  }

  const ageMs = Date.now() - updatedAt;
  const isStale = forceStale || ageMs > staleAfterMs;
  const tone = isStale
    ? 'bg-amber-500/10 text-amber-400'
    : fromCache
      ? 'bg-muted text-muted-foreground'
      : 'bg-emerald-500/10 text-emerald-400';
  const label = isStale ? 'Stale' : fromCache ? 'Cached' : 'Fresh';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs',
        tone,
      )}
      title={`Last updated: ${new Date(updatedAt).toISOString()}`}
    >
      <span>{label}</span>
      <span className="text-muted-foreground">·</span>
      <span>{formatAge(ageMs)}</span>
    </span>
  );
}

function formatAge(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
