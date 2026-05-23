'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteHolding,
  listHoldings,
  updateHolding,
} from '@/lib/portfolio/api-client';
import type { UpdateHoldingInput } from '@/lib/portfolio/schemas';
import type { EnrichedHolding } from '@/lib/portfolio/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatUSD(value: number | null): string {
  if (value == null) return '—';
  return usdFormatter.format(value);
}

function formatQuantity(qty: number): string {
  // Up to 4 decimal places, trim trailing zeros (and trailing decimal point).
  return qty.toFixed(4).replace(/\.?0+$/, '');
}

function formatPercent(value: number | null): string {
  if (value == null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function formatGainLoss(value: number | null): string {
  if (value == null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${usdFormatter.format(value)}`;
}

function gainLossTone(value: number | null): string {
  if (value == null) return 'text-muted-foreground';
  return value >= 0 ? 'text-emerald-500' : 'text-rose-500';
}

interface EditState {
  quantity: string;
  costBasis: string;
}

function EditRow({
  holding,
  onSave,
  onCancel,
  isSaving,
  error,
}: {
  holding: EnrichedHolding;
  onSave: (input: UpdateHoldingInput) => void;
  onCancel: () => void;
  isSaving: boolean;
  error: string | null;
}) {
  const [state, setState] = useState<EditState>({
    quantity: String(holding.quantity),
    costBasis: holding.costBasis == null ? '' : String(holding.costBasis),
  });

  const handleSave = () => {
    const input: UpdateHoldingInput = {
      quantity: Number(state.quantity),
      costBasis: state.costBasis === '' ? null : Number(state.costBasis),
    };
    onSave(input);
  };

  return (
    <tr className="border-t border-border bg-muted/30">
      <td className="px-3 py-2 font-medium text-foreground">{holding.ticker}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          step="any"
          min="0"
          value={state.quantity}
          onChange={(e) => setState((s) => ({ ...s, quantity: e.target.value }))}
          className="h-8 w-24 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          step="any"
          min="0"
          placeholder="—"
          value={state.costBasis}
          onChange={(e) =>
            setState((s) => ({ ...s, costBasis: e.target.value }))
          }
          className="h-8 w-28 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {formatUSD(holding.currentPrice)}
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {formatUSD(holding.currentValue)}
      </td>
      <td className="px-3 py-2 text-muted-foreground">—</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          {error && (
            <span className="text-xs text-rose-500" role="alert">
              {error}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

function HoldingRow({
  holding,
  onEdit,
  onDelete,
  isDeleting,
}: {
  holding: EnrichedHolding;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const tone = gainLossTone(holding.gainLoss);
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-medium text-foreground">{holding.ticker}</td>
      <td className="px-3 py-2 text-foreground">
        {formatQuantity(holding.quantity)}
      </td>
      <td className="px-3 py-2 text-foreground">
        {formatUSD(holding.costBasis)}
      </td>
      <td className="px-3 py-2 text-foreground">
        {formatUSD(holding.currentPrice)}
      </td>
      <td className="px-3 py-2 text-foreground">
        {formatUSD(holding.currentValue)}
      </td>
      <td className={cn('px-3 py-2 font-medium', tone)}>
        {formatGainLoss(holding.gainLoss)}{' '}
        <span className="text-xs">
          ({formatPercent(holding.gainLossPercent)})
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}>
            Edit
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
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
        </td>
      ))}
    </tr>
  );
}

export default function PortfolioTable() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery<EnrichedHolding[]>({
    queryKey: ['holdings'],
    queryFn: listHoldings,
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateHoldingInput }) =>
      updateHolding(id, input),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ['holdings'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteHolding(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holdings'] }),
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
        Failed to load holdings
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        No holdings yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-sm">
        <TableHead />
        <tbody>
          {data.map((holding) =>
            editingId === holding.id ? (
              <EditRow
                key={holding.id}
                holding={holding}
                isSaving={updateMut.isPending}
                error={
                  updateMut.isError && updateMut.variables?.id === holding.id
                    ? (updateMut.error as Error).message
                    : null
                }
                onCancel={() => {
                  setEditingId(null);
                  updateMut.reset();
                }}
                onSave={(input) =>
                  updateMut.mutate({ id: holding.id, input })
                }
              />
            ) : (
              <HoldingRow
                key={holding.id}
                holding={holding}
                isDeleting={
                  deleteMut.isPending && deleteMut.variables === holding.id
                }
                onEdit={() => {
                  updateMut.reset();
                  setEditingId(holding.id);
                }}
                onDelete={() => {
                  if (
                    window.confirm(
                      `Delete ${holding.ticker} from portfolio?`,
                    )
                  ) {
                    deleteMut.mutate(holding.id);
                  }
                }}
              />
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function TableHead() {
  return (
    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
      <tr>
        <th className="px-3 py-2 font-medium">Ticker</th>
        <th className="px-3 py-2 font-medium">Quantity</th>
        <th className="px-3 py-2 font-medium">Cost Basis</th>
        <th className="px-3 py-2 font-medium">Current Price</th>
        <th className="px-3 py-2 font-medium">Current Value</th>
        <th className="px-3 py-2 font-medium">Gain/Loss</th>
        <th className="px-3 py-2 font-medium">Actions</th>
      </tr>
    </thead>
  );
}
