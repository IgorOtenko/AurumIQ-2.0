'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addSchedule } from '@/lib/scheduling/api-client';
import {
  addScheduleSchema,
  type AddScheduleInput,
} from '@/lib/scheduling/schemas';
import { SECTION_TYPES, type SectionType } from '@/lib/ai/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SECTION_LABEL: Record<SectionType, string> = {
  bullBear: 'Bull vs Bear',
  catalystsRisks: 'Catalysts & Risks',
  liveOnCall: 'Live on the Call',
};

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
] as const;

function detectDefaultTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return (TIMEZONES as readonly string[]).includes(tz) ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

export default function AddScheduleForm() {
  const qc = useQueryClient();
  const defaultTz = useMemo(detectDefaultTimezone, []);
  const [timeValue, setTimeValue] = useState('09:30');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<AddScheduleInput>({
    resolver: zodResolver(addScheduleSchema),
    defaultValues: {
      ticker: '',
      sectionType: 'bullBear',
      hour: 9,
      minute: 30,
      timezone: defaultTz,
    },
  });

  useEffect(() => {
    const [h, m] = timeValue.split(':');
    setValue('hour', Number(h));
    setValue('minute', Number(m));
  }, [timeValue, setValue]);

  const addMut = useMutation({
    mutationFn: addSchedule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] });
      reset({
        ticker: '',
        sectionType: 'bullBear',
        hour: 9,
        minute: 30,
        timezone: defaultTz,
      });
      setTimeValue('09:30');
    },
  });

  const onSubmit = handleSubmit((values) => {
    const [h, m] = timeValue.split(':');
    const normalized: AddScheduleInput = {
      ...values,
      ticker: values.ticker.toUpperCase(),
      hour: Number(h),
      minute: Number(m),
    };
    addMut.mutate(normalized);
  });

  const conflictMessage =
    addMut.isError &&
    (addMut.error as Error).message ===
      'A schedule already exists for that ticker + section'
      ? (addMut.error as Error).message
      : null;
  const otherErrorMessage =
    addMut.isError && !conflictMessage ? (addMut.error as Error).message : null;

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-schedule-ticker">Ticker</Label>
          <Input
            id="add-schedule-ticker"
            type="text"
            autoComplete="off"
            placeholder="AAPL"
            style={{ textTransform: 'uppercase' }}
            aria-invalid={errors.ticker ? true : undefined}
            {...register('ticker')}
          />
          {errors.ticker?.message && (
            <p className="text-xs text-rose-500" role="alert">
              {errors.ticker.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-schedule-section">Section</Label>
          <select
            id="add-schedule-section"
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            aria-invalid={errors.sectionType ? true : undefined}
            {...register('sectionType')}
          >
            {SECTION_TYPES.map((s) => (
              <option key={s} value={s}>
                {SECTION_LABEL[s]}
              </option>
            ))}
          </select>
          {errors.sectionType?.message && (
            <p className="text-xs text-rose-500" role="alert">
              {errors.sectionType.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-schedule-time">Time</Label>
          <input
            id="add-schedule-time"
            type="time"
            value={timeValue}
            onChange={(e) => setTimeValue(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          {(errors.hour?.message || errors.minute?.message) && (
            <p className="text-xs text-rose-500" role="alert">
              {errors.hour?.message ?? errors.minute?.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-schedule-timezone">Timezone</Label>
          <select
            id="add-schedule-timezone"
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            aria-invalid={errors.timezone ? true : undefined}
            {...register('timezone')}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          {errors.timezone?.message && (
            <p className="text-xs text-rose-500" role="alert">
              {errors.timezone.message}
            </p>
          )}
        </div>
      </div>

      {(conflictMessage || otherErrorMessage) && (
        <p className="text-sm text-rose-500" role="alert">
          {conflictMessage ?? otherErrorMessage}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Daily at {timeValue} preview ({pad2(Number(timeValue.split(':')[0]))}:
          {pad2(Number(timeValue.split(':')[1]))})
        </p>
        <Button type="submit" disabled={addMut.isPending}>
          {addMut.isPending ? 'Adding…' : 'Add Schedule'}
        </Button>
      </div>
    </form>
  );
}
