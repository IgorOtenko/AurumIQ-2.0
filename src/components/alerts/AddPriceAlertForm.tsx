'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addPriceAlert } from '@/lib/alerts/api-client';
import {
  addPriceAlertSchema,
  type AddPriceAlertInput,
} from '@/lib/alerts/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AddPriceAlertForm() {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AddPriceAlertInput>({
    resolver: zodResolver(addPriceAlertSchema),
    defaultValues: {
      ticker: '',
      direction: 'above',
      threshold: undefined as unknown as number,
    },
  });

  const addMut = useMutation({
    mutationFn: addPriceAlert,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts', 'price'] });
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
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-price-alert-ticker">Ticker</Label>
          <Input
            id="add-price-alert-ticker"
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
          <Label htmlFor="add-price-alert-direction">Direction</Label>
          <select
            id="add-price-alert-direction"
            aria-invalid={errors.direction ? true : undefined}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            {...register('direction')}
          >
            <option value="above">Above</option>
            <option value="below">Below</option>
          </select>
          {errors.direction?.message && (
            <p className="text-xs text-rose-500" role="alert">
              {errors.direction.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-price-alert-threshold">Threshold (USD)</Label>
          <Input
            id="add-price-alert-threshold"
            type="number"
            step="any"
            min="0"
            placeholder="200.00"
            aria-invalid={errors.threshold ? true : undefined}
            {...register('threshold')}
          />
          {errors.threshold?.message && (
            <p className="text-xs text-rose-500" role="alert">
              {errors.threshold.message}
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
          {addMut.isPending ? 'Adding…' : 'Add Price Alert'}
        </Button>
      </div>
    </form>
  );
}
