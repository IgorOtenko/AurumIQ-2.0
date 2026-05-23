import { z } from 'zod';
import { SECTION_TYPES } from '@/lib/ai/types';
import { tickerSchema } from '@/lib/finance/schemas';

export const sectionTypeSchema = z.enum(SECTION_TYPES);

export const addScheduleSchema = z.object({
  ticker: tickerSchema,
  sectionType: sectionTypeSchema,
  hour: z.coerce.number().int().min(0).max(23),
  minute: z.coerce.number().int().min(0).max(59),
  timezone: z.string().min(3),
});

export const updateScheduleSchema = z
  .object({
    hour: z.coerce.number().int().min(0).max(23).optional(),
    minute: z.coerce.number().int().min(0).max(59).optional(),
    timezone: z.string().min(3).optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.hour !== undefined ||
      d.minute !== undefined ||
      d.timezone !== undefined ||
      d.active !== undefined,
    { message: 'At least one field must be provided' },
  );

export type AddScheduleInput = z.infer<typeof addScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
