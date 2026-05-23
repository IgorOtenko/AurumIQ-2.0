'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteSchedule, updateSchedule } from '@/lib/scheduling/api-client';
import { useSchedules } from '@/lib/scheduling/hooks';
import type { SerializedSchedule } from '@/lib/scheduling/types';
import type { SectionType } from '@/lib/ai/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SECTION_LABEL: Record<SectionType, string> = {
  bullBear: 'Bull vs Bear',
  catalystsRisks: 'Catalysts & Risks',
  liveOnCall: 'Live on the Call',
};

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatTime(hour: number, minute: number, timezone: string): string {
  return `${pad2(hour)}:${pad2(minute)} ${timezone}`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Never';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        active
          ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function ScheduleRow({
  schedule,
  onToggle,
  onDelete,
  isToggling,
  isDeleting,
}: {
  schedule: SerializedSchedule;
  onToggle: () => void;
  onDelete: () => void;
  isToggling: boolean;
  isDeleting: boolean;
}) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-medium text-foreground">
        {schedule.ticker}
      </td>
      <td className="px-3 py-2 text-foreground">
        {SECTION_LABEL[schedule.sectionType]}
      </td>
      <td className="px-3 py-2 text-foreground">
        {formatTime(schedule.hour, schedule.minute, schedule.timezone)}
      </td>
      <td className="px-3 py-2">
        <StatusPill active={schedule.active} />
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {formatRelative(schedule.lastRunAt)}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onToggle}
            disabled={isToggling}
          >
            {isToggling
              ? 'Saving…'
              : schedule.active
                ? 'Deactivate'
                : 'Activate'}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </td>
    </tr>
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
        <th className="px-3 py-2 font-medium">Section</th>
        <th className="px-3 py-2 font-medium">Time</th>
        <th className="px-3 py-2 font-medium">Status</th>
        <th className="px-3 py-2 font-medium">Last Run</th>
        <th className="px-3 py-2 font-medium">Actions</th>
      </tr>
    </thead>
  );
}

export default function SchedulesList() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useSchedules();

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateSchedule(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
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
        Failed to load schedules
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        No schedules yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-sm">
        <TableHead />
        <tbody>
          {data.map((schedule) => (
            <ScheduleRow
              key={schedule.id}
              schedule={schedule}
              isToggling={
                toggleMut.isPending && toggleMut.variables?.id === schedule.id
              }
              isDeleting={
                deleteMut.isPending && deleteMut.variables === schedule.id
              }
              onToggle={() =>
                toggleMut.mutate({
                  id: schedule.id,
                  active: !schedule.active,
                })
              }
              onDelete={() => {
                if (
                  window.confirm(
                    `Delete daily schedule for ${schedule.ticker} ${SECTION_LABEL[schedule.sectionType]}?`,
                  )
                ) {
                  deleteMut.mutate(schedule.id);
                }
              }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
