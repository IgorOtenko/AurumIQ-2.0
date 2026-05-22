# Phase 2: Data Layer & API Ingestion - Research

**Researched:** 2026-05-22
**Domain:** Financial data ingestion, caching, Prisma schema design, Yahoo Finance API
**Confidence:** HIGH

## Summary

Phase 2 builds the data backbone: Prisma models for raw financial data storage, adapter modules that fetch from Yahoo Finance (via `yahoo-finance2`), Zod validation of volatile API responses, a TTL-based cache layer backed by PostgreSQL JSONB, and structured Pino logging. The entire layer is server-only (Next.js API routes / server actions) -- no client-side fetching of external financial APIs (CORS blocks it anyway).

The primary data source is `yahoo-finance2` (v3.14.1), which wraps Yahoo Finance's unofficial API and provides typed modules for quotes, earnings, analyst ratings, options, historical prices, and news search. It is mature (4+ years, active maintenance) and covers all data categories needed through Phase 8. A separate news API is not required for MVP -- `yahoo-finance2`'s `search` module returns news articles per ticker.

**Primary recommendation:** Use `yahoo-finance2` as the single data source for MVP. Store all raw API responses as JSONB in a `raw_data` table with `ticker + data_type + fetched_at` indexing. Serve downstream consumers from the cache; only hit Yahoo Finance when TTL expires.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-04 | Each dashboard section is an independent modular component with its own data pipeline and logic | Adapter-per-data-type pattern: separate adapters for price, earnings, analyst, options, news. Each stores independently in `raw_data` with its own TTL. Downstream sections query their specific `data_type` from cache. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| External API fetching | API / Backend (Route Handlers) | -- | Yahoo Finance blocks CORS; all external calls must be server-side |
| Response validation | API / Backend | -- | Zod schemas validate at ingestion time before storage |
| Raw data caching | Database / Storage (PostgreSQL JSONB) | -- | Persistent cache survives server restarts; queryable |
| Cache TTL management | API / Backend | -- | Application logic checks `fetched_at` against TTL |
| Structured logging | API / Backend | -- | Pino logs at adapter layer only |
| Data type adapters | API / Backend | -- | Each adapter is a standalone module with fetch + validate + store |

## Standard Stack

### Core (New for Phase 2)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| yahoo-finance2 | 3.14.1 | Financial data from Yahoo Finance | [ASSUMED] Only viable free Yahoo Finance wrapper for Node.js; 4+ years old; covers quotes, earnings, options, analyst ratings, historical, news in one package |
| pino | 10.3.1 | Structured JSON logging | [VERIFIED: npm registry] CLAUDE.md specifies Pino 9.x; current is 10.3.1. Fast JSON logger, integrates with OpenTelemetry (Phase 7) |
| pino-pretty | 13.1.3 | Dev-friendly log formatting | [VERIFIED: npm registry] Pretty-prints Pino JSON logs in development |

### Already Installed (from Phase 1)

| Library | Version | Purpose |
|---------|---------|---------|
| @prisma/client | ^5 | Database ORM -- extends schema for raw_data table |
| zod | ^3 | Schema validation -- validates Yahoo Finance responses |
| axios | -- | HTTP client -- NOT needed; yahoo-finance2 handles its own HTTP |

**Note on Axios:** CLAUDE.md lists Axios for external API calls, but `yahoo-finance2` handles its own HTTP internally. Axios is not needed for Phase 2. It may be needed in later phases if additional APIs are added.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| yahoo-finance2 | Alpha Vantage API + Axios | Alpha Vantage has 25 req/day free limit; yahoo-finance2 has no hard rate limit (but has cookie/crumb instability). yahoo-finance2 covers more data types in one package |
| yahoo-finance2 | Finnhub free tier | Finnhub free: 60 calls/min. Good for real-time quotes but lacks the depth of earnings/analyst/options data that yahoo-finance2 provides |
| PostgreSQL JSONB cache | Redis | Redis is better for pure caching but adds infrastructure cost. PostgreSQL is already running on RDS free tier; JSONB provides queryable caching at zero additional cost |
| Separate News API | yahoo-finance2 search module | search() returns news articles per ticker. Quality is sufficient for MVP. Can add NewsAPI/MarketAux later if needed |

**Installation:**
```bash
pnpm add yahoo-finance2 pino pino-pretty
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| yahoo-finance2 | npm | 4+ yrs (Jan 2021) | ~30K/wk | github.com/gadicc/yahoo-finance2 | [OK] | Approved |
| pino | npm | 8+ yrs | 10M+/wk | github.com/pinojs/pino | [OK] | Approved |
| pino-pretty | npm | 7+ yrs | 5M+/wk | github.com/pinojs/pino-pretty | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
User Request (ticker: "AAPL", type: "earnings")
        |
        v
  [Next.js API Route / Server Action]
        |
        v
  [Cache Check] ---> raw_data WHERE ticker="AAPL"
        |              AND data_type="earnings"
        |              AND fetched_at > NOW() - TTL
        |
   cache hit?
   /        \
  YES        NO
  |           |
  |     [Yahoo Finance Adapter]
  |           |
  |     [yahoo-finance2.quoteSummary()]
  |           |
  |     [Zod Validation] ---> invalid? ---> Log warning, return partial/stale
  |           |
  |     [Store in raw_data as JSONB]
  |           |
  v           v
  [Return typed data to caller]
```

### Recommended Project Structure

```
src/
├── lib/
│   ├── db.ts                    # Existing Prisma singleton
│   ├── logger.ts                # Pino logger singleton
│   └── finance/
│       ├── types.ts             # Shared TypeScript types for financial data
│       ├── schemas.ts           # Zod schemas for Yahoo Finance response validation
│       ├── cache.ts             # Generic cache read/write with TTL logic
│       ├── yahoo-client.ts      # yahoo-finance2 singleton with error handling
│       └── adapters/
│           ├── price.adapter.ts       # Quote + historical price data
│           ├── earnings.adapter.ts    # Earnings history + estimates + trends
│           ├── analyst.adapter.ts     # Recommendation trends + upgrades/downgrades
│           ├── options.adapter.ts     # Options chain data
│           ├── profile.adapter.ts     # Company profile + key stats
│           └── news.adapter.ts        # News headlines via search module
├── app/
│   └── api/
│       └── finance/
│           └── [ticker]/
│               └── route.ts     # API route exposing adapters (optional, for testing)
```

### Pattern 1: Adapter Pattern (One Per Data Type)

**What:** Each financial data category (price, earnings, analyst, options, news) gets its own adapter module with a consistent interface: `fetch(ticker) -> validated data`.
**When to use:** Always. This is the foundation for INFRA-04 (independent data pipelines per dashboard section).

```typescript
// Source: project convention based on CLAUDE.md INFRA-04 requirement
// src/lib/finance/adapters/earnings.adapter.ts

import yahooFinance from 'yahoo-finance2';
import { z } from 'zod';
import { getCache, setCache } from '../cache';
import { logger } from '../../logger';

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const DATA_TYPE = 'earnings';

// Zod schema validates the shape we actually need from Yahoo Finance
const EarningsDataSchema = z.object({
  earningsChart: z.object({
    quarterly: z.array(z.object({
      date: z.string(),
      actual: z.number().nullable(),
      estimate: z.number().nullable(),
    })),
    currentQuarterEstimate: z.number().nullable(),
  }).optional(),
  financialData: z.object({
    currentPrice: z.number().optional(),
    targetMeanPrice: z.number().optional(),
    revenueGrowth: z.number().nullable().optional(),
  }).optional(),
});

export type EarningsData = z.infer<typeof EarningsDataSchema>;

export async function fetchEarnings(ticker: string): Promise<EarningsData | null> {
  // Check cache first
  const cached = await getCache(ticker, DATA_TYPE, CACHE_TTL_MS);
  if (cached) {
    logger.debug({ ticker, dataType: DATA_TYPE }, 'cache hit');
    return cached as EarningsData;
  }

  try {
    const raw = await yahooFinance.quoteSummary(ticker, {
      modules: ['earnings', 'earningsTrend', 'financialData'],
    });

    const parsed = EarningsDataSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn({ ticker, dataType: DATA_TYPE, errors: parsed.error.issues },
        'partial data - Zod validation failed on some fields');
      // Store what we got anyway (graceful degradation)
    }

    const data = parsed.success ? parsed.data : raw;
    await setCache(ticker, DATA_TYPE, data);
    return data as EarningsData;

  } catch (error) {
    logger.error({ ticker, dataType: DATA_TYPE, error }, 'Yahoo Finance fetch failed');
    // Try returning stale cache
    const stale = await getCache(ticker, DATA_TYPE, Infinity);
    if (stale) {
      logger.warn({ ticker, dataType: DATA_TYPE }, 'returning stale cache after fetch failure');
      return stale as EarningsData;
    }
    return null;
  }
}
```

### Pattern 2: JSONB Cache with TTL

**What:** Store raw API responses as JSONB in PostgreSQL with `fetched_at` timestamps. Cache reads check TTL; cache misses trigger fresh fetch.
**When to use:** All adapter fetches go through this layer.

```typescript
// src/lib/finance/cache.ts
import { db } from '../db';
import { logger } from '../logger';

export async function getCache(
  ticker: string,
  dataType: string,
  ttlMs: number
): Promise<unknown | null> {
  const cutoff = new Date(Date.now() - ttlMs);

  const cached = await db.rawData.findFirst({
    where: {
      ticker: ticker.toUpperCase(),
      dataType,
      fetchedAt: { gte: cutoff },
    },
    orderBy: { fetchedAt: 'desc' },
  });

  return cached?.data ?? null;
}

export async function setCache(
  ticker: string,
  dataType: string,
  data: unknown
): Promise<void> {
  await db.rawData.upsert({
    where: {
      ticker_dataType: {
        ticker: ticker.toUpperCase(),
        dataType,
      },
    },
    update: {
      data: data as any,
      fetchedAt: new Date(),
    },
    create: {
      ticker: ticker.toUpperCase(),
      dataType,
      data: data as any,
      fetchedAt: new Date(),
    },
  });
}
```

### Pattern 3: yahoo-finance2 Singleton with Cookie/Crumb Handling

**What:** Single yahoo-finance2 instance with error recovery for the known cookie/crumb expiration issue.
**When to use:** All Yahoo Finance calls go through this wrapper.

```typescript
// src/lib/finance/yahoo-client.ts
import yahooFinance from 'yahoo-finance2';
import { logger } from '../logger';

// Suppress internal validation warnings from yahoo-finance2
// (it logs warnings for fields it doesn't recognize)
yahooFinance.setGlobalConfig({
  validation: { logErrors: false },
});

export { yahooFinance };

// Wrapper with retry for cookie/crumb issues
export async function withRetry<T>(
  fn: () => Promise<T>,
  context: { ticker: string; module: string },
  retries = 2
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isAuthError = error?.message?.includes('crumb') ||
                          error?.message?.includes('cookie') ||
                          error?.message?.includes('401');
      if (isAuthError && attempt < retries) {
        logger.warn({ ...context, attempt }, 'cookie/crumb error, retrying');
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error('unreachable');
}
```

### Anti-Patterns to Avoid

- **Client-side Yahoo Finance calls:** Yahoo Finance blocks CORS from browsers. ALL external API calls MUST go through Next.js API routes / server actions. [CITED: CLAUDE.md "What NOT to Use" table]
- **Storing parsed/transformed data only:** Store the RAW response as JSONB. Downstream phases may need fields you didn't anticipate. Transform at read time, not write time.
- **Single monolithic fetch:** Don't fetch all data types in one call. Each adapter fetches independently so sections can refresh independently (INFRA-04).
- **Swallowing errors silently:** Every error must produce a structured Pino log with ticker, data_type, and error details. Silent failures make debugging impossible.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Yahoo Finance HTTP/auth | Custom HTTP client with cookie management | yahoo-finance2 | Handles crumb/cookie dance, response parsing, TypeScript types; 4+ years of edge case handling |
| JSON schema validation | Manual if/else checking of API response fields | Zod `.safeParse()` | Yahoo Finance responses are volatile (NaN, null, missing fields); Zod gives structured error reporting |
| Structured logging | console.log with JSON.stringify | Pino | 5-10x faster; structured JSON; integrates with OpenTelemetry in Phase 7; log levels, child loggers |
| Cache invalidation | Custom timestamp comparison logic in every adapter | Shared `getCache/setCache` with TTL parameter | Centralized cache logic; each adapter just passes its TTL |
| Retry with backoff | Custom retry loops in each adapter | Shared `withRetry` wrapper | Cookie/crumb issues affect all modules; centralized retry handles them uniformly |

**Key insight:** Yahoo Finance's unofficial API is unstable -- fields appear/disappear, types change, auth breaks. The adapter + Zod + cache pattern absorbs this instability at the boundary so downstream code never sees raw API volatility.

## Common Pitfalls

### Pitfall 1: Yahoo Finance Cookie/Crumb Expiration
**What goes wrong:** After 10-20 minutes, yahoo-finance2 starts throwing 401/crumb errors because Yahoo rotates authentication cookies.
**Why it happens:** Yahoo Finance tightened scraping defenses mid-2023. Cookies now expire faster and are tied to specific user agents/IPs. [CITED: github.com/gadicc/yahoo-finance2/issues/741]
**How to avoid:** Implement retry with exponential backoff in the yahoo-client wrapper. Cache aggressively to minimize API calls. yahoo-finance2 v3.x has internal crumb refresh logic, but it doesn't always work.
**Warning signs:** Sudden burst of 401 errors in logs after a period of successful fetches.

### Pitfall 2: NaN/null/undefined in Yahoo Finance Responses
**What goes wrong:** Yahoo Finance returns `NaN`, `null`, or omits fields entirely for some tickers (especially ADRs, ETFs, newly listed stocks, or low-volume securities).
**Why it happens:** Not all data modules are populated for all security types. ETFs lack earnings data. ADRs may lack analyst coverage. Options chains don't exist for all tickers.
**How to avoid:** Zod schemas must use `.nullable().optional()` liberally. Adapters must handle partial data gracefully -- return what's available, log what's missing. Never assume a field exists.
**Warning signs:** Zod validation errors spiking for specific tickers.

### Pitfall 3: Over-Fetching Kills Free Tier
**What goes wrong:** Fetching all quoteSummary modules for every request burns through Yahoo Finance's informal rate limits, resulting in temporary bans.
**Why it happens:** quoteSummary accepts an array of modules. Requesting all 30+ modules when you only need 3 wastes bandwidth and increases ban risk.
**How to avoid:** Each adapter requests ONLY the modules it needs. Price adapter requests `['price', 'summaryDetail']`. Earnings adapter requests `['earnings', 'earningsTrend', 'financialData']`. Never use `modules: ['all']`.
**Warning signs:** HTTP 429 responses or sudden empty responses from Yahoo Finance.

### Pitfall 4: JSONB Type Safety Gap
**What goes wrong:** Prisma's JSONB column is typed as `Prisma.JsonValue` -- essentially `any`. Reading from cache loses all type information.
**Why it happens:** PostgreSQL JSONB is schema-less by design. Prisma can't infer TypeScript types from JSONB content.
**How to avoid:** Always Zod-parse data when reading FROM cache, not just when storing. Define a `parseFromCache<T>(data: unknown, schema: ZodSchema<T>)` utility.
**Warning signs:** Runtime `undefined` errors when accessing nested fields from cached data.

### Pitfall 5: Prisma Migration on RDS Free Tier
**What goes wrong:** `prisma migrate deploy` fails or times out on RDS free tier db.t3.micro because the instance is in sleep mode (after 7 days of inactivity).
**Why it happens:** RDS free tier instances go to sleep. First connection after sleep can take 30-60 seconds.
**How to avoid:** Run a simple `SELECT 1` health check before migration. Set connection timeout to 60s in DATABASE_URL: `?connect_timeout=60`. [ASSUMED]
**Warning signs:** Migration hangs for 30+ seconds then times out.

## Code Examples

### Prisma Schema Extension for raw_data

```prisma
// Source: Prisma JSONB docs (prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields)

/// Cached raw API responses from financial data providers.
/// Each row stores one data_type for one ticker.
/// JSONB allows flexible schema as Yahoo Finance response shapes vary by security type.
model RawData {
  id        String   @id @default(uuid())
  ticker    String
  dataType  String   @map("data_type")
  data      Json     // PostgreSQL JSONB -- stores raw API response
  fetchedAt DateTime @default(now()) @map("fetched_at")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([ticker, dataType])
  @@index([ticker, dataType, fetchedAt])
  @@map("raw_data")
}
```

### Pino Logger Setup

```typescript
// src/lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  base: { service: 'aurumiq' },
});

// Child logger for finance adapters
export const financeLogger = logger.child({ module: 'finance' });
```

### yahoo-finance2 Module-to-Dashboard Mapping

```
Dashboard Section       -> Yahoo Finance Module(s)        -> Adapter
-----------------------------------------------------------------
Stock Header (DASH-02)  -> quote, summaryDetail           -> price.adapter
Numbers Going In (03)   -> earnings, earningsTrend        -> earnings.adapter
QoQ/YoY Trend (04)     -> earnings, incomeStatementHist  -> earnings.adapter
Analyst Setup (05)      -> recommendationTrend, upgradeHx -> analyst.adapter
Options/Move (08)       -> options                        -> options.adapter
Segment (07)            -> assetProfile, earnings         -> profile.adapter
News/Sources (06)       -> search (news)                  -> news.adapter
```

### Data Type TTL Configuration

```typescript
// src/lib/finance/config.ts
// TTLs balance freshness vs API call volume.
// Market data changes during trading hours; fundamentals change quarterly.
export const CACHE_TTL = {
  price: 15 * 60 * 1000,        // 15 min -- most volatile
  earnings: 24 * 60 * 60 * 1000, // 24 hours -- changes quarterly
  analyst: 12 * 60 * 60 * 1000,  // 12 hours -- changes with new reports
  options: 1 * 60 * 60 * 1000,   // 1 hour -- options pricing changes frequently
  profile: 7 * 24 * 60 * 60 * 1000, // 7 days -- company info rarely changes
  news: 30 * 60 * 1000,          // 30 min -- news is time-sensitive
} as const;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| yahoo-finance (v1, node-yahoo-finance) | yahoo-finance2 v3.x | 2021 | v2 has TypeScript types, ESM support, built-in validation, crumb handling |
| Manual cookie/crumb extraction | yahoo-finance2 internal crumb refresh | 2023-2024 | Library handles auth dance internally (mostly); still needs retry wrapper for edge cases |
| Prisma Json type (untyped) | Prisma Json + Zod validation at read time | Current best practice | Type safety without losing JSONB flexibility |

**Deprecated/outdated:**
- `node-yahoo-finance` (v1): Unmaintained since 2020. Use yahoo-finance2.
- `yahoo-finance` npm package: Abandoned. Different from yahoo-finance2.
- Yahoo Finance official API: Discontinued years ago. All current access is unofficial.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | yahoo-finance2 is the best Node.js Yahoo Finance library for this use case | Standard Stack | LOW -- it's the only actively maintained option; verified on npm/GitHub |
| A2 | yahoo-finance2's search module returns news articles sufficient for DASH-06 | Architecture Patterns | LOW -- if insufficient, NewsAPI.org free tier (100 req/day) can supplement |
| A3 | Yahoo Finance informal rate limits won't block development/demo usage with caching | Common Pitfalls | MEDIUM -- if rate-limited, fallback to longer TTLs or Alpha Vantage supplementation |
| A4 | Pino 10.x (latest) is compatible with the CLAUDE.md spec of "9.x" | Standard Stack | LOW -- major version bump but API is stable; can pin to 9.x if needed |
| A5 | RDS free tier sleep/wake behavior causes connection timeouts | Pitfall 5 | LOW -- standard behavior, connect_timeout param handles it |

## Open Questions (RESOLVED)

1. **Pino version: 9.x vs 10.x?** — RESOLVED: Pin to `pino@^9` per CLAUDE.md locked stack. Pino 9.x is the documented version; no deviation without explicit user approval.

2. **News data source adequacy?** — RESOLVED: Start with yahoo-finance2 search module for MVP. News quality assessment deferred to Phase 4 (DASH-06). If insufficient, NewsAPI.org free tier (100 req/day) can be added as a separate adapter in Phase 4 or 8.

3. **ETF / ADR / non-standard ticker handling scope?** — RESOLVED: Build adapters with Zod `.nullable().optional()` for all fields. Test with representative tickers: AAPL (stock), SPY (ETF), TSM (ADR), BRK-B (special chars). Graceful degradation — return partial data with structured Pino warning rather than throwing.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (RDS) | raw_data table | Assumed (Phase 1 deployed) | 16.x | Local PostgreSQL for dev |
| Node.js | yahoo-finance2, Pino | Yes | 20.x+ | -- |
| pnpm | Package installation | Yes | 9.x | npm |
| Yahoo Finance (unofficial) | All data adapters | Yes (no auth required) | -- | Alpha Vantage free tier (25 req/day) |

**Missing dependencies with no fallback:** None identified.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | vitest.config.ts (exists) |
| Quick run command | `pnpm test -- --run` |
| Full suite command | `pnpm test -- --run --coverage` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | Fetching ticker stores price, earnings, analyst, news in raw_data | integration | `pnpm test -- --run src/lib/finance/__tests__/adapters.test.ts` | Wave 0 |
| SC-2 | NaN/null fallback with structured warning log | unit | `pnpm test -- --run src/lib/finance/__tests__/validation.test.ts` | Wave 0 |
| SC-3 | Cache hit returns stored result (no external call) | unit | `pnpm test -- --run src/lib/finance/__tests__/cache.test.ts` | Wave 0 |
| SC-4 | Partial responses, missing options, ETF/stock/ADR, fallback paths | unit | `pnpm test -- --run src/lib/finance/__tests__/edge-cases.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test -- --run`
- **Per wave merge:** `pnpm test -- --run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/finance/__tests__/adapters.test.ts` -- covers SC-1
- [ ] `src/lib/finance/__tests__/validation.test.ts` -- covers SC-2 (Zod schemas with NaN/null fixtures)
- [ ] `src/lib/finance/__tests__/cache.test.ts` -- covers SC-3 (mock db, verify no external call)
- [ ] `src/lib/finance/__tests__/edge-cases.test.ts` -- covers SC-4 (ETF/ADR/stock fixtures)
- [ ] `src/lib/finance/__tests__/fixtures/` -- mock Yahoo Finance response fixtures for each security type

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase 1 handles auth |
| V3 Session Management | No | Phase 1 handles sessions |
| V4 Access Control | Yes (minor) | API routes must verify session before returning financial data |
| V5 Input Validation | Yes | Zod validates all external API responses AND ticker input (alphanumeric + dots only) |
| V6 Cryptography | No | No secrets stored in this phase |

### Known Threat Patterns for Financial Data Ingestion

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Ticker injection (malicious ticker string) | Tampering | Validate ticker format with Zod: `/^[A-Z0-9.]{1,10}$/` before passing to yahoo-finance2 |
| SSRF via ticker-like URLs | Tampering | yahoo-finance2 only accepts ticker symbols, not URLs; additional regex validation at API boundary |
| Cache poisoning (storing bad data) | Tampering | Zod validation BEFORE cache write; reject structurally invalid responses |
| Information disclosure via error messages | Information Disclosure | Pino logs detailed errors server-side; API returns generic error messages to client |
| Denial of service via bulk ticker requests | Denial of Service | Rate limit API routes (middleware); max 10 tickers per batch request |

## Sources

### Primary (HIGH confidence)
- [npm: yahoo-finance2](https://www.npmjs.com/package/yahoo-finance2) - version 3.14.1 confirmed, modules list verified
- [npm: pino](https://www.npmjs.com/package/pino) - version 10.3.1 confirmed
- [Prisma JSONB docs](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields) - Json field usage patterns
- [GitHub: yahoo-finance2](https://github.com/gadicc/yahoo-finance2) - source repo, issues #741 and #764 for cookie/crumb problems

### Secondary (MEDIUM confidence)
- [JSR: yahoo-finance2 modules](https://jsr.io/@gadicc/yahoo-finance2/doc/modules) - full module listing
- [GitHub: yahoo-finance2 quoteSummary source](https://github.com/gadicc/yahoo-finance2/blob/dev/src/modules/quoteSummary.ts) - module names enumeration

### Tertiary (LOW confidence)
- [NewsAPI.org pricing](https://newsapi.org/pricing) - free tier limits (100 req/day)
- [MarketAux](https://www.marketaux.com/) - alternative free news API

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - yahoo-finance2 is the de facto Node.js Yahoo Finance library; Pino is industry standard; both verified on npm
- Architecture: HIGH - adapter + cache + Zod pattern is well-established for volatile external APIs
- Pitfalls: HIGH - cookie/crumb issues are extensively documented in GitHub issues; NaN handling is a known Yahoo Finance problem
- Security: MEDIUM - ticker injection is straightforward to mitigate; cache poisoning patterns are standard

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (30 days -- yahoo-finance2 ecosystem is stable but Yahoo Finance auth changes are unpredictable)
