"use client";

import { useOptions } from "@/lib/finance/hooks";
import FreshnessIndicator from "@/components/dashboard/FreshnessIndicator";

interface Props {
  ticker: string;
}

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const expirationDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const MS_PER_DAY = 86_400_000;

function SectionShell({
  children,
  freshness,
}: {
  children: React.ReactNode;
  freshness?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Expected Move &amp; Options
        </h2>
        {freshness}
      </header>
      {children}
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <SectionShell>
      <div className="space-y-6" role="status" aria-label="Loading options data">
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="h-6 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

export default function ExpectedMoveOptions({ ticker }: Props) {
  const options = useOptions(ticker);

  if (options.isLoading) {
    return <LoadingSkeleton />;
  }

  const freshness = (
    <FreshnessIndicator
      updatedAt={options.dataUpdatedAt || null}
      fromCache={options.data?.fromCache ?? false}
      forceStale={options.data?.stale ?? false}
    />
  );

  if (options.isError) {
    return (
      <SectionShell freshness={freshness}>
        <p className="text-sm text-muted-foreground">
          Failed to load options data
        </p>
      </SectionShell>
    );
  }

  const payload = options.data?.data ?? null;
  const expirationDates = payload?.expirationDates ?? [];
  const strikes = payload?.strikes ?? [];

  if (payload === null || expirationDates.length === 0 || strikes.length === 0) {
    return (
      <SectionShell freshness={freshness}>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>No options chain available for this ticker.</p>
          <p>
            Options data is typically unavailable for ETFs, ADRs, and small-cap
            stocks. Try AAPL, MSFT, NVDA, or SPY for a populated view.
          </p>
        </div>
      </SectionShell>
    );
  }

  const minStrike = Math.min(...strikes);
  const maxStrike = Math.max(...strikes);
  const expirationCount = expirationDates.length;

  // Yahoo encodes expirationDates as Unix seconds, not milliseconds — multiply
  // by 1000 before constructing Date. Ceil the day count so today + minutes
  // shows as 1 day out, not 0.
  const now = Date.now();
  const upcoming = expirationDates
    .map((ts) => {
      const ms = ts * 1000;
      const daysOut = Math.ceil((ms - now) / MS_PER_DAY);
      return { ms, daysOut };
    })
    .filter((row) => row.daysOut >= 0 && row.daysOut <= 90)
    .sort((a, b) => a.ms - b.ms)
    .slice(0, 8);

  return (
    <SectionShell freshness={freshness}>
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Expirations
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {expirationCount}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Strike Range
            </div>
            <div className="mt-1 text-lg font-medium text-foreground">
              {usdFormatter.format(minStrike)} – {usdFormatter.format(maxStrike)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Options Chain
            </div>
            <div className="mt-1 text-lg font-medium text-emerald-500">
              Available
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Upcoming Expirations
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No expirations within the next 90 days.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 text-right font-medium">Days Out</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((row) => (
                  <tr
                    key={row.ms}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-2 text-foreground">
                      {expirationDateFormatter.format(new Date(row.ms))}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {row.daysOut}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
