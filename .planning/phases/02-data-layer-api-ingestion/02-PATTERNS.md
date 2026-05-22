# Phase 2: Data Layer & API Ingestion - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 15 new/modified files
**Analogs found:** 5 / 15 (Phase 1 is slim -- most Phase 2 files are novel patterns)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `prisma/schema.prisma` (modify) | model | CRUD | `prisma/schema.prisma` | exact (extend) |
| `src/lib/logger.ts` | utility | transform | `src/lib/db.ts` | role-match (singleton) |
| `src/lib/finance/types.ts` | utility | N/A (types) | none | -- |
| `src/lib/finance/schemas.ts` | utility | transform | `src/app/api/auth/signup/route.ts` | partial (Zod usage) |
| `src/lib/finance/cache.ts` | service | CRUD | `src/lib/db.ts` | partial (Prisma usage) |
| `src/lib/finance/yahoo-client.ts` | service | request-response | `src/lib/db.ts` | role-match (singleton) |
| `src/lib/finance/config.ts` | config | N/A | `src/lib/env.ts` | role-match (config) |
| `src/lib/finance/adapters/price.adapter.ts` | service | request-response | `src/app/api/auth/signup/route.ts` | partial (Zod + try/catch) |
| `src/lib/finance/adapters/earnings.adapter.ts` | service | request-response | same as above | partial |
| `src/lib/finance/adapters/analyst.adapter.ts` | service | request-response | same as above | partial |
| `src/lib/finance/adapters/options.adapter.ts` | service | request-response | same as above | partial |
| `src/lib/finance/adapters/profile.adapter.ts` | service | request-response | same as above | partial |
| `src/lib/finance/adapters/news.adapter.ts` | service | request-response | same as above | partial |
| `src/app/api/finance/[ticker]/route.ts` | controller | request-response | `src/app/api/auth/signup/route.ts` | exact |
| `src/lib/finance/__tests__/*.test.ts` (4 files) | test | N/A | none (no tests exist yet) | -- |

## Pattern Assignments

### `prisma/schema.prisma` (model, extend existing)

**Analog:** `prisma/schema.prisma` (self -- extend with new model)

**Existing conventions** (lines 1-42):
```prisma
// Convention: triple-slash doc comments above models
// Convention: uuid() for all IDs
// Convention: @@map("snake_case_table_name") on every model
// Convention: createdAt + updatedAt on every model
// Convention: @map("snake_case") on camelCase fields

/// Core user account for authentication and portfolio ownership.
model User {
  id             String   @id @default(uuid())
  email          String   @unique
  hashedPassword String
  name           String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@map("users")
}
```

**New model must follow:** uuid ID, triple-slash doc comment, `@@map("raw_data")`, `@map("snake_case")` on multi-word fields, `createdAt`/`updatedAt` pair.

---

### `src/lib/logger.ts` (utility, singleton)

**Analog:** `src/lib/db.ts` (singleton pattern)

**Singleton pattern** (lines 1-20):
```typescript
// Convention: export a singleton instance, not a class
// Convention: dev vs prod behavior via NODE_ENV check
// Convention: file-level JSDoc comment explaining WHY

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
```

**Apply to logger.ts:** Same globalThis singleton pattern for Pino. Dev uses pino-pretty transport, prod uses raw JSON. Export named `logger` and `financeLogger` child.

---

### `src/lib/finance/schemas.ts` (utility, Zod validation)

**Analog:** `src/app/api/auth/signup/route.ts` (Zod schema definition + safeParse)

**Zod definition pattern** (lines 6-12):
```typescript
// Convention: schema defined as const at module level
// Convention: descriptive error messages in validators
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
});
```

**safeParse usage pattern** (lines 17-24):
```typescript
// Convention: safeParse (not parse) -- never throw on invalid input
const parsed = signupSchema.safeParse(body);

if (!parsed.success) {
  return NextResponse.json(
    { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
    { status: 400 },
  );
}
```

**Apply to schemas.ts:** Define all Yahoo Finance Zod schemas at module level. Use `.nullable().optional()` liberally for volatile fields. Export both schema and inferred type (`z.infer<typeof Schema>`).

---

### `src/lib/finance/cache.ts` (service, CRUD)

**Analog:** `src/lib/db.ts` (Prisma client import pattern)

**Prisma import pattern** (line 1 of db.ts):
```typescript
// Convention: import db singleton from @/lib/db
import { db } from '@/lib/db';
```

**Prisma query pattern** (from signup/route.ts lines 30-31, 45-51):
```typescript
// Convention: findUnique/findFirst for reads
const existing = await db.user.findUnique({
  where: { email: email.toLowerCase() },
});

// Convention: create for inserts
const user = await db.user.create({
  data: {
    email: email.toLowerCase(),
    hashedPassword,
    name: name || null,
  },
});
```

**Apply to cache.ts:** Use `db.rawData.findFirst()` with `where` + `orderBy` for cache reads. Use `db.rawData.upsert()` for cache writes (unique on `[ticker, dataType]`).

---

### `src/lib/finance/config.ts` (config, constants)

**Analog:** `src/lib/env.ts` (config/constants module)

**Config module pattern** (lines 1-20):
```typescript
// Convention: @t3-oss/env-nextjs for env vars
// Convention: Zod validates config values
// Convention: single exported const
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),
  },
  // ...
});
```

**Apply to config.ts:** Export a single `CACHE_TTL` const object with `as const`. Add JSDoc comments explaining each TTL value choice.

---

### `src/app/api/finance/[ticker]/route.ts` (controller, request-response)

**Analog:** `src/app/api/auth/signup/route.ts` (exact role match)

**Full route handler pattern** (lines 1-65):
```typescript
// Convention: NextResponse for all responses
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

// Convention: Zod schema at top of file for request validation
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// Convention: named export matching HTTP method
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      );
    }

    // ... business logic ...

    return NextResponse.json(
      { id: user.id, email: user.email },
      { status: 201 },
    );
  } catch (error) {
    // Convention: log server-side, generic message client-side
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
```

**Apply to finance route:** Same structure. Validate ticker param with Zod regex (`/^[A-Z0-9.]{1,10}$/`). Extract `dataType` from query params. Call adapter. Return JSON. Replace `console.error` with Pino logger (Phase 2 upgrade).

---

### `src/lib/finance/adapters/*.adapter.ts` (service, request-response)

**Analog:** `src/app/api/auth/signup/route.ts` (partial -- Zod + try/catch structure)

**Error handling pattern** (lines 57-64):
```typescript
// Convention: try/catch wraps entire operation
// Convention: log details server-side, generic message to caller
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
```

**Apply to adapters:** Same try/catch structure. Replace `console.error` with Pino structured logging (`logger.error({ ticker, dataType, error })`). On failure, attempt stale cache fallback before returning null.

**Adapter-specific conventions (from RESEARCH.md):**
- Each adapter is a standalone module exporting one `fetch[DataType](ticker: string)` function
- Cache check at top, Yahoo Finance call only on miss
- Zod safeParse on API response (log warning, don't throw)
- Store raw response in cache even if partial validation fails
- Return typed data or null

---

### `src/lib/finance/__tests__/*.test.ts` (test files)

**Analog:** None -- no test files exist in the codebase yet.

**Vitest config** (`vitest.config.ts` lines 1-16):
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,   // describe, it, expect are global
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Apply to tests:** Use Vitest globals (no imports for describe/it/expect). Use `@/` path alias. Mock `yahoo-finance2` and `@/lib/db` with `vi.mock()`. Create fixtures directory for Yahoo Finance response mocks.

---

## Shared Patterns

### Import Path Convention
**Source:** All `src/lib/*.ts` and `src/app/api/**/*.ts` files
**Apply to:** All new Phase 2 files
```typescript
// Convention: @/ alias for src/ directory
import { db } from '@/lib/db';
import { env } from '@/lib/env';
```

### Zod Validation at Boundaries
**Source:** `src/app/api/auth/signup/route.ts` lines 6-24
**Apply to:** All adapters (validate Yahoo Finance responses), API route (validate ticker input)
```typescript
// Convention: safeParse, not parse -- never throw on invalid input
// Convention: schema defined at module top as const
const parsed = schema.safeParse(data);
if (!parsed.success) {
  // log warning, handle gracefully
}
```

### Error Handling
**Source:** `src/app/api/auth/signup/route.ts` lines 57-64, `src/app/api/auth/reset-password/route.ts` lines 59-65
**Apply to:** All adapter and route files
```typescript
// Convention: try/catch wraps entire operation
// Convention: detailed log server-side, generic message to client
// UPGRADE for Phase 2: replace console.error with Pino logger
try {
  // ... operation ...
} catch (error) {
  logger.error({ context, error }, 'descriptive message');
  // return graceful fallback or generic error
}
```

### Prisma Model Convention
**Source:** `prisma/schema.prisma` lines 17-26
**Apply to:** New RawData model
```prisma
// Convention: triple-slash doc comment
// Convention: uuid() ID
// Convention: @@map("snake_case") table name
// Convention: @map("snake_case") on camelCase fields
// Convention: createdAt + updatedAt pair
```

### Response Format Convention
**Source:** `src/app/api/auth/signup/route.ts` lines 53-56
**Apply to:** Finance API route
```typescript
// Convention: { data: ... } for success, { error: string } for failure
// Convention: appropriate HTTP status codes (200, 201, 400, 500)
return NextResponse.json({ data: result }, { status: 200 });
return NextResponse.json({ error: 'message' }, { status: 400 });
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/finance/types.ts` | utility | N/A | Pure type definitions -- no existing pattern needed; follow TypeScript conventions |
| `src/lib/finance/yahoo-client.ts` | service | request-response | No external API client exists yet. Use singleton pattern from `db.ts` + retry pattern from RESEARCH.md |
| `src/lib/finance/__tests__/adapters.test.ts` | test | N/A | No tests exist. Use Vitest config conventions + RESEARCH.md test structure |
| `src/lib/finance/__tests__/validation.test.ts` | test | N/A | Same as above |
| `src/lib/finance/__tests__/cache.test.ts` | test | N/A | Same as above |
| `src/lib/finance/__tests__/edge-cases.test.ts` | test | N/A | Same as above |
| `src/lib/finance/__tests__/fixtures/` | test data | N/A | No fixtures exist. Create mock Yahoo Finance responses as JSON/TS exports |

## Metadata

**Analog search scope:** `src/lib/`, `src/app/api/`, `prisma/`
**Files scanned:** 12 existing files
**Pattern extraction date:** 2026-05-22
