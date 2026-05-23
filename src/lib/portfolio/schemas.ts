import { z } from 'zod';
import { tickerSchema } from '@/lib/finance/schemas';

export const addHoldingSchema = z.object({
  ticker: tickerSchema,
  quantity: z.coerce.number().positive().max(1_000_000_000),
  costBasis: z.coerce.number().positive().nullable().optional(),
});

export const updateHoldingSchema = z
  .object({
    quantity: z.coerce.number().positive().max(1_000_000_000).optional(),
    costBasis: z.coerce.number().positive().nullable().optional(),
  })
  .refine((d) => d.quantity !== undefined || d.costBasis !== undefined, {
    message: 'At least one field must be provided',
  });

export type AddHoldingInput = z.infer<typeof addHoldingSchema>;
export type UpdateHoldingInput = z.infer<typeof updateHoldingSchema>;
