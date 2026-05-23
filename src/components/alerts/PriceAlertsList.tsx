'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  deletePriceAlert,
  updatePriceAlert,
} from '@/lib/alerts/api-client';
import { usePriceAlerts } from '@/lib/alerts/hooks';
import type { SerializedPriceAlert } from '@/lib/alerts/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatUSD(value: number): string {
  return usdFormatter.format(value);
}

function formatTriggeredAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type AlertStatus = 'active' | 'triggered' | 'inactive';

function statusOf(alert: SerializedPriceAlert): AlertStatus {
  if (!alert.active) return 'inactive';
  if (alert.triggeredAt !== null) return 'triggered';
  return 'active';
}

function StatusPill({ status }: { status: AlertStatus }) {
  const styles =
    status === 'active'
      ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20'
      : status === 'triggered'
        ? 'bg-amber-500/10 text-amber-500 ring-amber-500/20'
        : 'bg-muted text-muted-foreground ring-border';
  const label =
    status === 'active'
      ? 'Active'
      : status === 'triggered'
        ? 'Triggered'
        : 'Inactive';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        styles,
      )}
    >
      {label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-t border-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
        </td>
      ))}
    </tr>
  );
}

function TableHead() {
  return (
    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
      <tr>
        <th className="px-3 py-2 font-medium">Ticker</th>
        <th className="px-3 py-2 font-medium">Direction</th>
        <th className="px-3 py-2 font-medium">Threshold</th>
        <th className="px-3 py-2 font-medium">Status</th>
        <th className="px-3 py-2 font-medium">Triggered</th>
        <th className="px-3 py-2 font-medium">Actions</th>
      </tr>
    </thead>
  );
}

export default function PriceAlertsList() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = usePriceAlerts();

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updatePriceAlert(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts', 'price'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePriceAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts', 'price'] }),
  });

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-left text-sm">
          <TableHead />
          <tbody>
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-rose-500"
      >
        Failed to load price alerts
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        No price alerts yet. Use the form above to create one.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-sm">
        <TableHead />
        <tbody>
          {data.map((alert) => {
            const status = statusOf(alert);
            const isAbove = alert.direction === 'above';
            const directionTone = isAbove
              ? 'text-emerald-500'
              : 'text-rose-500';
            const isToggling =
              toggleMut.isPending && toggleMut.variables?.id === alert.id;
            const isDeleting =
              deleteMut.isPending && deleteMut.variables === alert.id;
            return (
              <tr key={alert.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium text-foreground">
                  {alert.ticker}
                </td>
                <td
                  className={cn(
                    'px-3 py-2 font-medium',
                    directionTone,
                  )}
                >
                  <span aria-hidden="true">{isAbove ? '↑' : '↓'}</span>{' '}
                  {isAbove ? 'Above' : 'Below'}
                </td>
                <td className="px-3 py-2 text-foreground">
                  {formatUSD(alert.threshold)}
                </td>
                <td className="px-3 py-2">
                  <StatusPill status={status} />
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {alert.triggeredAt
                    ? formatTriggeredAt(alert.triggeredAt)
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isToggling}
                      onClick={() =>
                        toggleMut.mutate({
                          id: alert.id,
                          active: !alert.active,
                        })
                      }
                    >
                      {isToggling
                        ? 'Saving…'
                        : alert.active
                          ? 'Deactivate'
                          : 'Activate'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isDeleting}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete price alert for ${alert.ticker}?`,
                          )
                        ) {
                          deleteMut.mutate(alert.id);
                        }
                      }}
                    >
                      {isDeleting ? 'Deleting…' : 'Delete'}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
