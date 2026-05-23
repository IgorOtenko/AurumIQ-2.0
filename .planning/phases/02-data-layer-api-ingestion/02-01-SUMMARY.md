# Phase 02 / Wave 2A — Execution Summary

**Plan:** `02-01-PLAN.md` (foundation vertical slice for financial data ingestion)
**Executed:** 2026-05-23
**Status:** Complete — build green, all 6 tests passing.

## What shipped

End-to-end vertical slice proving the data ingestion architecture: API route → adapter → yahoo-finance2 → Zod → PostgreSQL JSONB cache → typed response. Every layer is exercised by one real code path so the remaining 5 adapters (earnings, analyst, options, profile, news) can be cloned from this template in subsequent waves.

## Files created

### Foundation (Task 1)
- `prisma/schema.prisma` — extended with `RawData` model (JSONB `data`, unique `[ticker, dataType]`, index `[ticker, dataType, fetchedAt]`, `@@map("raw_data")`). User + PasswordResetToken models preserved.
- `src/lib/logger.ts` — Pino singleton (globalThis pattern matching `db.ts`). Exports `logger` (service: aurumiq) + `financeLogger` (child, module: finance). pino-pretty transport in dev, raw JSON in prod, `LOG_LEVEL` env override.
- `src/lib/finance/types.ts` — `DataType` union, `DATA_TYPES` const array, `AdapterResult<T>` generic, and `PriceData` / `EarningsData` / `AnalystData` / `OptionsData` / `ProfileData` / `NewsData` interfaces.
- `src/lib/finance/schemas.ts` — `tickerSchema` (`/^[A-Z0-9.]{1,10}$/`), `PriceDataSchema` (modules-aware with `.passthrough()`), placeholder schemas for the other 4 data types.
- `src/lib/finance/config.ts` — `CACHE_TTL` const (price 15min, earnings 24h, analyst 12h, options 1h, profile 7d, news 30min) with JSDoc rationale per key.
- `src/lib/finance/cache.ts` — `getCache(ticker, dataType, ttlMs)` (uppercases ticker, supports `Infinity` TTL for stale-fallback) + `setCache(ticker, dataType, data)` (Prisma `upsert` on the unique pair).
- `src/lib/finance/yahoo-client.ts` — singleton `YahooFinance` instance (v3 default export is a constructor — see note below) plus `withRetry` wrapper with exponential backoff on cookie/crumb/401 errors.

### Vertical slice (Task 2)
- `src/lib/finance/adapters/price.adapter.ts` — `fetchPrice(ticker)` returning `AdapterResult<PriceData>`. Cache-first (TTL 15m), fetches `['price', 'summaryDetail']` modules, Zod-validates with `passthrough`, stores raw response (graceful-degradation: caches even on partial validation), falls back to stale cache on Yahoo failure, returns `{ data: null }` only if nothing usable exists. Projects raw shape to flat `PriceData` (coalesces `marketCap` from `price` or `summaryDetail`).
- `src/app/api/finance/[ticker]/route.ts` — `GET` handler. Auth.js v5 session check via `auth()` from `@/lib/auth` (401 if no session), ticker validated via `tickerSchema` (400 on fail), `?type=` query validated against `DataType` union, only `price` routed for this wave (others return 400 "available in next update"), generic 500 on uncaught errors with full context to `financeLogger`.
- `src/lib/finance/__tests__/fixtures/yahoo-responses.ts` — 5 fixtures: valid AAPL, partial SPY (nulls in volume/marketCap), empty-all-null, ETF SPY, ADR TSM.
- `src/lib/finance/__tests__/price-pipeline.test.ts` — 6 tests using Vitest globals + `vi.mock` for `yahoo-finance2` (mocked as constructor class) and `@/lib/db`, plus logger spies via the mocked module.

## Verification results

**Tests:** 6 / 6 passing (`pnpm vitest run src/lib/finance/__tests__/price-pipeline.test.ts`):
- fetchPrice returns fresh data on cache miss
- fetchPrice returns cached data on cache hit
- fetchPrice handles partial Yahoo Finance response gracefully (Zod warning emitted, data still returned)
- fetchPrice falls back to stale cache on fetch error (`stale: true`, `fromCache: true`)
- fetchPrice returns null when no cache and fetch fails
- tickerSchema rejects invalid tickers (lowercase, >10 chars, SQL injection, empty)

**Build:** `pnpm build` succeeds — TypeScript clean, all routes including `/api/finance/[ticker]` compile.

**Database:** `npx prisma db push` synced the `raw_data` table to PostgreSQL (Docker `aurumiq-postgres`).

## Deviations from plan

1. **yahoo-finance2 v3 API shift.** The plan specified `yahooFinance.setGlobalConfig({ validation: { logErrors: false } })`. In v3.14.1 the default export is a `YahooFinance` constructor class, not a pre-configured singleton — `setGlobalConfig` does not exist. Resolution: instantiate `new YahooFinance({ validation: { logErrors: false }, suppressNotices: ['yahooSurvey'] })` once behind the same globalThis singleton pattern used by `db.ts`. Net effect on consumers is identical (import `{ yahooFinance }` and call `.quoteSummary(...)`); test mock updated to expose a class with a `quoteSummary` method.
2. **Schema strategy for Zod.** Plan suggested validating individual quote fields (`regularMarketPrice` etc.) at the schema root. yahoo-finance2 returns these nested under `price` and `summaryDetail` module keys, so `PriceDataSchema` validates the module-keyed shape with `.passthrough()` and the adapter projects the flat `PriceData` shape downstream. Same security posture (Zod-validates the trust boundary, stores raw on partial), better fidelity to the actual API contract.

## Blockers

None.

## Hand-off to next wave

The foundation is ready for waves 2B+ (earnings, analyst, options, profile, news adapters). The template to clone:
1. Define a data-type-specific Zod schema in `schemas.ts`.
2. Pick the right Yahoo Finance modules and `CACHE_TTL` key.
3. Mirror `price.adapter.ts` structure (cache check → withRetry fetch → safeParse + warn → setCache → project to flat type → stale fallback → null).
4. Extend the `[ticker]` route's `rawType` switch to call the new adapter.
5. Add fixture + 5-test suite per adapter.

The `RawData` table's `@@unique([ticker, dataType])` constraint means each new `DataType` automatically gets its own cache slot without schema change.
