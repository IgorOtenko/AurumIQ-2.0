'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addHolding } from '@/lib/portfolio/api-client';
import {
  addHoldingSchema,
  type AddHoldingInput,
} from '@/lib/portfolio/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AddHoldingForm() {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AddHoldingInput>({
    resolver: zodResolver(addHoldingSchema),
    defaultValues: {
      ticker: '',
      quantity: undefined as unknown as number,
      costBasis: null,
    },
  });

  const addMut = useMutation({
    mutationFn: addHolding,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holdings'] });
      reset();
    },
  });

  const onSubmit = handleSubmit((values) => {
    const normalized: AddHoldingInput = {
      ...values,
      ticker: values.ticker.toUpperCase(),
      costBasis:
        values.costBasis === null || values.costBasis === undefined
          ? null
          : values.costBasis,
    };
    addMut.mutate(normalized);
  });

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-holding-ticker">Ticker</Label>
          <Input
            id="add-holding-ticker"
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
          <Label htmlFor="add-holding-quantity">Quantity</Label>
          <Input
            id="add-holding-quantity"
            type="number"
            step="any"
            min="0"
            placeholder="10"
            aria-invalid={errors.quantity ? true : undefined}
            {...register('quantity')}
          />
          {errors.quantity?.message && (
            <p className="text-xs text-rose-500" role="alert">
              {errors.quantity.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-holding-cost-basis">
            Cost Basis{' '}
            <span className="text-xs font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            id="add-holding-cost-basis"
            type="number"
            step="any"
            min="0"
            placeholder="150.00"
            aria-invalid={errors.costBasis ? true : undefined}
            {...register('costBasis', {
              setValueAs: (v) =>
                v === '' || v === null || v === undefined ? null : Number(v),
            })}
          />
          {errors.costBasis?.message && (
            <p className="text-xs text-rose-500" role="alert">
              {errors.costBasis.message}
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
          {addMut.isPending ? 'Adding…' : 'Add Holding'}
        </Button>
      </div>
    </form>
  );
}
