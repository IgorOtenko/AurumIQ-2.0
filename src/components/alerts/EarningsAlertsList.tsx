'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  deleteEarningsAlert,
  updateEarningsAlert,
} from '@/lib/alerts/api-client';
import { useEarningsAlerts } from '@/lib/alerts/hooks';
import type { SerializedEarningsAlert } from '@/lib/alerts/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

function formatDate(value: string | null): string {
  if (value === null) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return dateFormatter.format(d);
}

type Tone = 'active' | 'notified' | 'inactive';

function statusOf(alert: SerializedEarningsAlert): {
  tone: Tone;
  label: string;
} {
  if (!alert.active) return { tone: 'inactive', label: 'Inactive' };
  if (alert.lastNotifiedDate !== null)
    return { tone: 'notified', label: 'Notified' };
  return { tone: 'active', label: 'Active' };
}

function StatusPill({ alert }: { alert: SerializedEarningsAlert }) {
  const { tone, label } = statusOf(alert);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'active' &&
          'bg-emerald-500/10 text-emerald-500 ring-1 ring-inset ring-emerald-500/20',
        tone === 'notified' &&
          'bg-amber-500/10 text-amber-500 ring-1 ring-inset ring-amber-500/20',
        tone === 'inactive' &&
          'bg-muted text-muted-foreground ring-1 ring-inset ring-border',
      )}
    >
      {label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-t border-border">
      {Array.from({ length: 5 }).map((_, i) => (
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
        <th className="px-3 py-2 font-medium">Notice Window</th>
        <th className="px-3 py-2 font-medium">Status</th>
        <th className="px-3 py-2 font-medium">Last Notified</th>
        <th className="px-3 py-2 font-medium">Actions</th>
      </tr>
    </thead>
  );
}

export default function EarningsAlertsList() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useEarningsAlerts();

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateEarningsAlert(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts', 'earnings'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteEarningsAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts', 'earnings'] }),
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
        Failed to load earnings alerts
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        No earnings alerts yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-sm">
        <TableHead />
        <tbody>
          {data.map((alert) => {
            const isTogglePending =
              toggleMut.isPending && toggleMut.variables?.id === alert.id;
            const isDeletePending =
              deleteMut.isPending && deleteMut.variables === alert.id;
            return (
              <tr key={alert.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium text-foreground">
                  {alert.ticker}
                </td>
                <td className="px-3 py-2 text-foreground">
                  {alert.daysBefore} {alert.daysBefore === 1 ? 'day' : 'days'}{' '}
                  before
                </td>
                <td className="px-3 py-2">
                  <StatusPill alert={alert} />
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {formatDate(alert.lastNotifiedDate)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        toggleMut.mutate({
                          id: alert.id,
                          active: !alert.active,
                        })
                      }
                      disabled={isTogglePending}
                    >
                      {isTogglePending
                        ? 'Saving…'
                        : alert.active
                          ? 'Deactivate'
                          : 'Activate'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete earnings alert for ${alert.ticker}?`,
                          )
                        ) {
                          deleteMut.mutate(alert.id);
                        }
                      }}
                      disabled={isDeletePending}
                    >
                      {isDeletePending ? 'Deleting…' : 'Delete'}
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
