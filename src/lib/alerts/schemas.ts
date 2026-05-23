import { z } from 'zod';
import { tickerSchema } from '@/lib/finance/schemas';

export const alertDirectionSchema = z.enum(['above', 'below']);

export const addPriceAlertSchema = z.object({
  ticker: tickerSchema,
  direction: alertDirectionSchema,
  threshold: z.coerce.number().positive().max(1_000_000_000),
});

export const updatePriceAlertSchema = z
  .object({
    direction: alertDirectionSchema.optional(),
    threshold: z.coerce.number().positive().max(1_000_000_000).optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.direction !== undefined ||
      d.threshold !== undefined ||
      d.active !== undefined,
    { message: 'At least one field must be provided' },
  );

export const addEarningsAlertSchema = z.object({
  ticker: tickerSchema,
  daysBefore: z.coerce.number().int().min(1).max(30),
});

export const updateEarningsAlertSchema = z
  .object({
    daysBefore: z.coerce.number().int().min(1).max(30).optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => d.daysBefore !== undefined || d.active !== undefined, {
    message: 'At least one field must be provided',
  });

export type AddPriceAlertInput = z.infer<typeof addPriceAlertSchema>;
export type UpdatePriceAlertInput = z.infer<typeof updatePriceAlertSchema>;
export type AddEarningsAlertInput = z.infer<typeof addEarningsAlertSchema>;
export type UpdateEarningsAlertInput = z.infer<typeof updateEarningsAlertSchema>;
