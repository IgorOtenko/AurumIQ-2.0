# Phase 02 / Wave 2B-2C — Execution Summary

**Plans:** `02-02-PLAN.md` (5 adapters + API wiring + comprehensive tests)
**Executed:** 2026-05-23 (immediately after Wave 2A)
**Status:** Complete — build green, 34/34 tests passing across 5 test files, all 6 data types wired through the API route.

## Execution model

Wave 2B-2C used **parallel sub-agents on a single tree with strict file ownership** (no worktrees). Each agent owned exactly one file; the orchestrator handled shared-file edits (`schemas.ts`, `route.ts`, `fixtures/yahoo-responses.ts`) centrally to eliminate merge risk. Wiring-check gates ran after each parallel wave (`tsc`, `lint`, `vitest`).

| Wave | Agents | Files | Outcome |
|------|--------|-------|---------|
| 2B (adapter build) | 5 parallel | earnings, analyst, options, profile, news adapters | all green |
| 2B → 2C bridge (orchestrator) | 1 (main thread) | `schemas.ts`, `route.ts`, `fixtures` extension | green |
| 2C (test build) | 3 parallel | adapters.test, cache.test, edge-cases.test | all green |

## Files created / modified

### New adapters (5 files, all `src/lib/finance/adapters/`)
- `earnings.adapter.ts` — `fetchEarnings`, modules `['earnings', 'earningsTrend', 'financialData']`, TTL 24 h. Projects `earningsChart.quarterly`, `currentQuarterEstimate`, and `financialData.{currentPrice, targetMeanPrice, revenueGrowth}` to `EarningsData`.
- `analyst.adapter.ts` — `fetchAnalyst`, modules `['recommendationTrend', 'upgradeDowngradeHistory']`, TTL 12 h. Projects recommendation trend (4 periods × strongBuy/buy/hold/sell/strongSell) to `AnalystData`.
- `options.adapter.ts` — `fetchOptions`, calls `yahooFinance.options(ticker)` (different endpoint), TTL 1 h. Handles **two no-chain paths**: empty `options[]` array AND thrown "no options" errors (`NO_CHAIN_HINTS` matcher). Both return `{ data: null }` with `financeLogger.info` (not warn) — expected condition for ETFs/ADRs.
- `profile.adapter.ts` — `fetchProfile`, modules `['assetProfile', 'defaultKeyStatistics']`, TTL 7 d. Coalesces `assetProfile` and `summaryProfile` shapes (Yahoo returns one or the other per security type) into `ProfileData`.
- `news.adapter.ts` — `fetchNews`, calls `yahooFinance.search(ticker, { newsCount: 20 })` (different endpoint), TTL 30 min. Projects `news[]` to `{ articles: [{ title, publisher, link, providerPublishTime }] }`; filters articles missing `title` or `link` (e.g., spam stubs).

All 5 adapters mirror `price.adapter.ts` structurally: cache-first → `withRetry` → `safeParse` (warn-and-store-raw) → `setCache` → stale-fallback → return `AdapterResult`.

### Extended modules
- `src/lib/finance/schemas.ts` — added `EarningsDataSchema`, `AnalystDataSchema`, `OptionsDataSchema`, `ProfileDataSchema`, `NewsDataSchema`. All use `.passthrough()` and `.nullable().optional()` on volatile fields so partial Yahoo responses survive validation.
- `src/app/api/finance/[ticker]/route.ts` — switched single-type dispatch to `ADAPTERS: Record<DataType, fetcher>` map. All 6 types dispatch correctly. Unknown types → 400; unauthenticated → 401; invalid ticker → 400; server error → generic 500 with `financeLogger.error`.
- `src/lib/finance/__tests__/fixtures/yahoo-responses.ts` — extended with `validEarningsResponse`, `validAnalystResponse`, `validOptionsResponse`, `emptyOptionsResponse`, `validProfileResponse`, `validNewsResponse` (includes a spam item with null title for the news-filter test), `etfQuoteSummaryResponse`, `adrQuoteSummaryResponse`.

### New test files (3)
- `src/lib/finance/__tests__/adapters.test.ts` — 6 tests, one per non-price adapter. Each verifies: correct Yahoo endpoint called with correct modules, `setCache` invoked with matching `dataType` key, projected output matches the interface. Includes the no-options-chain path for `fetchOptions`.
- `src/lib/finance/__tests__/cache.test.ts` — 5 tests directly against the cache module: null on miss, hit within TTL, expired-cache filter uses `where.fetchedAt.gte: Date(now - ttlMs)`, ticker uppercase normalization, upsert update + create both set `fetchedAt`.
- `src/lib/finance/__tests__/edge-cases.test.ts` — 5 cross-cutting tests: ETF (SPY) graceful degradation, ADR (TSM) nullable fields preserved, `BRK.B` ticker passes validation while `BRK-B` rejects, all 4 quoteSummary adapters fall back to stale cache when Yahoo throws, concurrent `fetchPrice` calls share cache after first miss (quoteSummary called once).

## Verification results

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `pnpm exec tsc --noEmit` | ✅ silent (no errors) |
| Lint | `pnpm lint` | ✅ no warnings or errors |
| Tests | `pnpm vitest run` | ✅ **34 / 34 passing** across 5 files |
| Build | `pnpm build` | ✅ Next.js production build successful; `/api/finance/[ticker]` registered as dynamic route |

Test breakdown: 12 (auth) + 6 (price-pipeline) + 6 (adapters) + 5 (cache) + 5 (edge-cases) = 34.

## Phase 2 success criteria (from ROADMAP.md)

1. ✅ Fetching ticker stores price / earnings / analyst / news in `raw_data` with `fetched_at` — verified by `adapters.test.ts` (each adapter calls `setCache` with the correct dataType key).
2. ✅ Yahoo returns NaN/null/missing → graceful fallback with structured warning — verified by `price-pipeline.test.ts` partial-response test and `edge-cases.test.ts` ETF/ADR tests.
3. ✅ Cache hit returns stored result without external call — verified by `cache.test.ts` (TTL filter) and `edge-cases.test.ts` (concurrent fetch test asserts `quoteSummary` called once).
4. ✅ Unit tests cover partial responses, missing options chain, ETF vs stock vs ADR, and fallback paths — covered across all 4 finance test files.

## Notable design decisions

- **yahoo-finance2 v3 is a constructor class**, not a singleton object — both adapters and tests mock it as `class YahooFinance { ... }` with `default` export. The yahoo-client wraps it behind a `globalThis` singleton matching `db.ts`.
- **Schemas use `.passthrough()` everywhere** — the adapter's `project()` function is the load-bearing type extractor. The schema only triggers a warning on partial responses; it never blocks the data path.
- **Options adapter has two no-chain branches** (empty `options[]` AND thrown errors with hint phrases). Both log at `info` level (not `warn`) because no-chain is an expected condition for ETFs/ADRs, not an error.
- **News articles missing `title` or `link` are filtered out** in `project()` rather than at the schema level — preserves the raw cache for re-extraction if filtering rules change.
- **Test mocks bind class methods via arrow functions** (`quoteSummary = (...args) => quoteSummaryMock(...args)`) — direct `vi.fn` assignment to class properties did not re-bind correctly across mock resets.

## INFRA-04 delivery

Each dashboard section in Phases 3-8 now has an independent data pipeline through the adapter layer. The API surface is a single endpoint with type dispatch:

```
GET /api/finance/[ticker]?type={price|earnings|analyst|options|profile|news}
```

Auth required (Auth.js v5 session). Returns `{ data: { data, fromCache, stale } }`. All caching, validation, and error handling is uniform across types.

## Not yet done (deferred)

- **Runtime smoke test against real Yahoo Finance** — the unit tests fully mock `yahoo-finance2`; an end-to-end test hitting the real API is deferred to manual verification or a Playwright integration test in Phase 7 (Observability & Polish).
- **Rate limiting** — accepted risk per the Phase 2 threat model; added in Phase 7 middleware.
