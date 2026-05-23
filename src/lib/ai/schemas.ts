// AI schemas use Zod v4 (via the `zod/v4` subpath shipped by zod 3.25+)
// because the Anthropic SDK's `zodOutputFormat()` helper imports v4
// internally and rejects v3 schema instances at the type level.
import * as z from 'zod/v4';

export const bullBearSchema = z.object({
  bullCase: z.array(z.string().min(1)).min(3).max(5),
  bearCase: z.array(z.string().min(1)).min(3).max(5),
  oneLiner: z.string().min(1),
});

export const catalystsRisksSchema = z.object({
  catalysts: z.array(z.string().min(1)).min(3).max(5),
  risks: z.array(z.string().min(1)).min(3).max(5),
});

export const liveOnCallSchema = z.object({
  items: z
    .array(
      z.object({
        topic: z.string().min(1),
        rationale: z.string().min(1),
      }),
    )
    .min(5)
    .max(8),
});

// The `sources` JSON column shape — used by validators that need to walk
// the snapshot without re-importing finance schemas. Loose (passthrough)
// so future finance fields don't require an AI-layer migration.
export const sourcesSchema = z
  .object({
    ticker: z.string(),
    price: z.unknown().nullable().optional(),
    earnings: z.unknown().nullable().optional(),
    analyst: z.unknown().nullable().optional(),
    profile: z.unknown().nullable().optional(),
  })
  .passthrough();
