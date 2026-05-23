'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addEarningsAlert } from '@/lib/alerts/api-client';
import {
  addEarningsAlertSchema,
  type AddEarningsAlertInput,
} from '@/lib/alerts/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AddEarningsAlertForm() {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AddEarningsAlertInput>({
    resolver: zodResolver(addEarningsAlertSchema),
    defaultValues: {
      ticker: '',
      daysBefore: undefined as unknown as number,
    },
  });

  const addMut = useMutation({
    mutationFn: addEarningsAlert,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts', 'earnings'] });
      reset();
    },
  });

  const onSubmit = handleSubmit((values) => {
    addMut.mutate({
      ...values,
      ticker: values.ticker.toUpperCase(),
    });
  });

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-earnings-alert-ticker">Ticker</Label>
          <Input
            id="add-earnings-alert-ticker"
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
          <Label htmlFor="add-earnings-alert-days-before">
            Days Before{' '}
            <span className="text-xs font-normal text-muted-foreground">
              (1-30)
            </span>
          </Label>
          <Input
            id="add-earnings-alert-days-before"
            type="number"
            step="1"
            min="1"
            max="30"
            placeholder="7"
            aria-invalid={errors.daysBefore ? true : undefined}
            {...register('daysBefore')}
          />
          {errors.daysBefore?.message && (
            <p className="text-xs text-rose-500" role="alert">
              {errors.daysBefore.message}
            </p>
          )}
        </div>
      </div>

      {addMut.isError && (
        <p className="text-sm text-rose-500" role="alert">
          {(addMut.error as Error).message}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={addMut.isPending}>
          {addMut.isPending ? 'Adding…' : 'Add Earnings Alert'}
        </Button>
      </div>
    </form>
  );
}
