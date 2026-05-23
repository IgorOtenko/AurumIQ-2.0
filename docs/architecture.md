# AurumIQ Architecture

## Overview

AurumIQ is a full-stack Next.js 15 monolith. Frontend rendering, API endpoints, authentication, financial data ingestion, AI generation, and scheduled background jobs all run inside a single Node.js process. This keeps the deployment footprint within AWS free tier (one EC2 t3.micro plus one RDS db.t3.micro) while preserving clear separation of concerns through file-system routing and explicit module boundaries inside `src/lib`.

**Design philosophy.** Modular dashboard, validated data layer, hallucination-aware AI pipeline, observability-from-day-one. Every feature is a self-contained vertical (component → hook → API route → adapter / pipeline → model → cache) so that each can evolve, be tested, or be replaced without ripping into the rest of the app.

**Target reader.** An engineer reviewing the project as portfolio material. The codebase is small enough to read end-to-end in an afternoon; this document is the map.

## System architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Browser                                                                       │
│  ┌─────────────┐  ┌──────────────────────────────────────────────────────┐  │
│  │ (auth)      │  │ (dashboard)  [middleware-gated]                      │  │
│  │  login      │  │  /dashboard           portfolio CRUD + ticker bar    │  │
│  │  signup     │  │  /dashboard/[ticker]  10 lazy-mounted sections       │  │
│  │  reset      │  │  /settings            account, alerts, schedules     │  │
│  └─────────────┘  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                │                                            │
                │ React Server Components + Tanstack Query   │
                ▼                                            │
┌──────────────────────────────────────────────────────────────────────────────┐
│ Next.js process (single Node.js runtime)                                      │
│  ┌────────────────────────────┐  ┌─────────────────────────────────────────┐│
│  │ Route Handlers             │  │ instrumentation.ts                      ││
│  │  /api/auth/*               │  │  → initTelemetry()                      ││
│  │  /api/portfolio            │  │  → startCronJobs()                      ││
│  │  /api/finance/[ticker]     │  └─────────────────────────────────────────┘│
│  │  /api/ai/[ticker] (SSE)    │  ┌─────────────────────────────────────────┐│
│  │  /api/alerts/*             │  │ in-process cron jobs                    ││
│  │  /api/schedules/*          │  │  price-alerts    */5 * * * *            ││
│  │  /api/analysis-history/*   │  │  earnings-alerts 0   * * * *            ││
│  │  /api/account/*            │  │  scheduled-ai    *   * * * *            ││
│  └────────────────────────────┘  └─────────────────────────────────────────┘│
│  ┌────────────────────────────┐  ┌─────────────────────────────────────────┐│
│  │ Finance adapters           │  │ AI pipeline                             ││
│  │  price / earnings / analyst│  │  prompts → anthropic.messages.parse()   ││
│  │  options / profile / news  │  │  zodOutputFormat → traceability check   ││
│  │  → JSONB cache (raw_data)  │  │  → upsert Analysis + append History     ││
│  └────────────────────────────┘  └─────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
   │                              │                              │
   │ Prisma                       │ HTTPS                        │ HTTPS
   ▼                              ▼                              ▼
┌────────────────┐         ┌──────────────────────┐    ┌──────────────────────┐
│ PostgreSQL 16  │         │ Yahoo Finance        │    │ Anthropic Claude API │
│  9 models      │         │  (yahoo-finance2 v3) │    │  (Sonnet 4.6 / Haiku)│
└────────────────┘         └──────────────────────┘    └──────────────────────┘
```

The arrows above are call directions, not data ownership: the database is the source of truth for user state, while Yahoo Finance is treated as a refresh-only upstream that the JSONB cache absorbs.

## Data flow: a dashboard section

The five non-AI sections all share the same flow. Walk through a Stock Header render for `AAPL`:

1. **Navigation.** User clicks an AAPL pill in the `StockTickerBar`. Next.js Server Component at `src/app/(dashboard)/dashboard/[ticker]/page.tsx` validates the ticker server-side.
2. **Lazy mount.** Each section component is wrapped in `<LazySection>` (`src/components/dashboard/LazySection.tsx`). It renders a `SectionSkeleton` until the section scrolls into view (200px rootMargin via `useInView`), at which point the real section mounts.
3. **Hook fires.** `StockHeader` calls `usePrice(ticker)` and `useProfile(ticker)` (both in `src/lib/finance/hooks.ts`). These are Tanstack Query hooks keyed `['finance', ticker, type]` with `staleTime: 1h`.
4. **HTTP.** The hooks call `GET /api/finance/AAPL?type=price`. Route Handler at `src/app/api/finance/[ticker]/route.ts` looks up the dispatcher (`ADAPTERS: Record<DataType, fetcher>`), authenticates via `auth()`, dispatches to `fetchPrice`.
5. **Adapter.** `fetchPrice` (`src/lib/finance/adapters/price.adapter.ts`) checks the JSONB cache via `getCache(ticker, 'price')` first. On hit-within-TTL it returns immediately (and increments the `finance.cache.events{outcome=hit}` counter). On miss, it calls `yahooFinance.quoteSummary` through the `yahoo-client` singleton, validates the response with a Zod schema (warn-and-store-raw on partial), projects to the typed shape, and `setCache`s the result.
6. **Response.** The Route Handler returns `{ data: { data, fromCache, stale } }`. Tanstack Query caches by key and the section component reads `data` to render. A sibling section (`Sources`) attaches to the same cache with `enabled: false` so it never double-fetches — it just observes status and timestamps.
7. **Error isolation.** Every section is wrapped in a `SectionWrapper` class component (React 19 still requires a class for error boundaries). A throw inside one section renders a red-bordered error card; the other nine sections keep rendering.

The same pattern carries the other data sections — Numbers Going In drives off `useEarnings`, QoQ/YoY Trend mixes `useEarnings` + lightweight-charts, Analyst Setup drives off `useAnalyst`, and Sources subscribes to all six finance hooks for status pills.

## Data flow: AI generation

The three AI sections share a streamed generation flow. Walk through a Bull vs Bear refresh:

1. **Trigger.** User clicks "Refresh" inside `<BullBear />`. The component calls `generateAnalysisStream(ticker, 'bullBear')` (an async generator over an SSE parser in `src/lib/ai/api-client.ts`).
2. **POST.** `POST /api/ai/AAPL` with `{ sectionType: 'bullBear' }`. Route Handler at `src/app/api/ai/[ticker]/route.ts` authenticates, opens a `ReadableStream`.
3. **Server-side fetch (parallel).** The handler calls the four relevant Phase 2 adapters in parallel — `fetchPrice` + `fetchEarnings` + `fetchAnalyst` + `fetchProfile`. This is a server-side call, not an HTTP round-trip, so the data comes straight from the JSONB cache or Yahoo. Emits `progress: fetching_data` over SSE.
4. **Generate.** Emits `progress: generating` and calls `generateSection({ userId, ticker, sectionType, sources })` in `src/lib/ai/generate.ts`. Inside `generateSection`:
   - Upsert the `Analysis` row with `status='generating'`.
   - Wrap the entire call in a `withSpan('ai.generate', ...)` (see [Observability](#observability)).
   - Call `anthropic.messages.parse({ model, thinking: adaptive, effort: high, system: SYSTEM_PROMPT, output_config.format: zodOutputFormat(schema) })`. The system prompt is marked `cache_control: 'ephemeral'` — see [Caching strategy](#caching-strategy).
   - Default model is Sonnet 4.6 (`ANTHROPIC_MODEL` env var); scheduled cron runs override to Haiku 4.5 via the `model` param.
5. **Validate.** Emits `progress: validating`. `validateTraceability(content, sources)` walks every currency / percent / large-bare number in the AI output and verifies it traces back to a source figure, accounting for unit conversions and pairwise derivations. See [`docs/ai-pipeline.md`](ai-pipeline.md#validator).
6. **Persist.**
   - **Success** → `status='completed'`, `content` persisted, `db.analysisHistory.create({...})` appends to the history table, `aiTokens` counter incremented by direction (input / output / cache_read / cache_creation), `aiSkillDuration` histogram observed with outcome=completed, span set OK.
   - **Schema parse failure** (`messages.parse` threw) → `status='failed'`, prior content preserved if any, span set ERROR.
   - **Traceability failure** → `status='validation_failed'`, prior content **untouched**, span set ERROR with a `validation_failed` attribute. The component renders an amber warning banner over the last-validated content.
7. **Stream complete.** SSE emits `complete: { analysis }`. Component invalidates `['ai', ticker, sectionType]` query; `useLatestAnalysis` refetches the persisted row and re-renders.

## Background jobs

Three `node-cron` jobs registered once per Node process via `instrumentation.ts → startCronJobs()`. The registry (`src/lib/cron/index.ts`) is guarded by a `globalThis` flag so Turbopack HMR doesn't re-register on every edit.

| Job | Schedule | Source | What it does |
|---|---|---|---|
| `price-alerts` | `*/5 * * * *` | `src/lib/cron/price-alerts.ts` | Loads active `PriceAlert` rows, fetches current price per unique ticker via `fetchPrice` (Phase 2 cache), checks crossings, sends email + flips `active=false` on fire. |
| `earnings-alerts` | `0 * * * *` | `src/lib/cron/earnings-alerts.ts` | Loads active `EarningsAlert` rows, calls `yahooFinance.quoteSummary` with the `calendarEvents` module inline (the typed `fetchEarnings` doesn't expose next-earnings-date today), checks the days-before window, sends email + stamps `lastNotifiedDate`. |
| `scheduled-ai` | `* * * * *` | `src/lib/cron/scheduled-ai.ts` | Loads active `Schedule` rows. For each, computes the user's local wall-clock via `Intl.DateTimeFormat.formatToParts(timezone)` (no `date-fns-tz` dep), checks ±60s match AND `lastRunDate < today`, then calls `generateSection({ ..., model: 'claude-haiku-4-5' })` with Haiku for cost. |

Each tick is wrapped in a `withSpan('cron.<job>', ...)` and increments the `cron.runs{job, outcome}` counter. Re-arming an alert or schedule (`PATCH active: true`) clears the relevant fire-state stamp (`triggeredAt`, `lastNotifiedDate`, `lastRunDate`) so the cron can fire again — otherwise users would re-arm and never be notified.

## Data model

Nine Prisma models. Source of truth: `prisma/schema.prisma`.

| Model | Purpose | Key constraint |
|---|---|---|
| `User` | Account + portfolio owner. bcryptjs-hashed password at the app layer. | `email @unique` |
| `PasswordResetToken` | Token-based reset flow. Single-use (`usedAt`), 1-hour expiry. | `token @unique` |
| `Holding` | One portfolio position per (user, ticker). `Decimal(20,8)` quantity for fractional shares. | `@@unique([userId, ticker])` |
| `RawData` | Cached Yahoo Finance responses as JSONB. One row per (ticker, dataType); upserted on refresh. | `@@unique([ticker, dataType])` |
| `Analysis` | Latest AI generation per (user, ticker, sectionType). Status one of `generating / completed / validation_failed / failed`. `content` JSONB + `sources` JSONB snapshot for the prompt context. | `@@unique([userId, ticker, sectionType])` |
| `AnalysisHistory` | Append-only versioned log of every **completed** AI generation. Indexed `[userId, ticker, sectionType, generatedAt desc]` for the history-list query. | — |
| `PriceAlert` | One-shot price-cross alert. `direction in {above, below}`. `triggeredAt` + `active=false` on fire. | indexes on `(userId, active)`, `(ticker, active)` |
| `EarningsAlert` | Earnings-date reminder. `daysBefore 1..30`, `lastNotifiedDate @db.Date` prevents double-firing the same event. | indexes on `(userId, active)`, `(ticker, active)` |
| `Schedule` | Daily scheduled AI regeneration. `hour + minute + timezone` express the user's local slot. `lastRunDate` gates re-firing same day. | `@@unique([userId, ticker, sectionType])` |

Anti-enumeration applies uniformly: every PATCH/DELETE endpoint that takes an `id` returns 404 (not 403) when the row exists but belongs to a different user. Same pattern as the original login enumeration defense (Phase 1).

## Authentication

**Auth.js v5** (NextAuth) with the Credentials provider, JWT sessions in **httpOnly cookies**, no client-readable tokens.

### Split-config pattern

Auth.js v5 supports both Edge and Node.js runtimes. We use the split-config pattern to share config but isolate Node-only dependencies:

- **`src/lib/auth.config.ts`** — Edge-compatible. Defines the `authorized()` callback for middleware. No Prisma, no bcryptjs (both require Node APIs unavailable on Edge).
- **`src/lib/auth.ts`** — Node-only. Extends `auth.config.ts` with the Credentials provider, performs Prisma lookups, runs `bcryptjs.compare()`. Used in API routes and server components.

### Route protection (defense in depth)

1. **Edge middleware** (`src/middleware.ts`) — intercepts every request to `/(dashboard)/*`, redirects unauthenticated users to `/login`. Runs on the Edge runtime, so the split-config pattern is mandatory.
2. **Server-side `auth()` check** in `(dashboard)/layout.tsx` — even if middleware were misconfigured, the layout re-verifies the session before rendering.

### Password security

- **Hashing.** bcryptjs cost factor 12. Pure JavaScript — avoids native-binding portability headaches on EC2.
- **Comparison.** Timing-safe (`bcryptjs.compare()`).
- **Reset flow.** 128-bit UUID token, 1-hour expiry, single-use enforcement via `usedAt`, atomic password update + token consumption inside a Prisma `$transaction`.
- **Anti-enumeration.** Login returns a generic "Invalid email or password" for any failure. Password reset returns 200 regardless of email existence. Email update via Settings is the one place enumeration is accepted (the attacker already has the user's current password to reach that endpoint).

## Hallucination mitigation

AI output is gated by three layers, in order:

1. **Schema enforcement at the SDK.** `anthropic.messages.parse()` with `zodOutputFormat(schema)` makes the SDK enforce the schema server-side. The SDK strips unsupported constraints (Zod array `min/max`) before sending and validates them client-side via the Zod parser. Schema parse failure → `status='failed'`, prior content preserved.
2. **Structured output ensures shape but not truth.** `messages.parse` guarantees the output is JSON matching the schema, but the LLM can still invent numbers inside string fields.
3. **Traceability validation.** `validateTraceability(content, sources)` extracts every currency, percent, and large bare number from the AI output and confirms each traces to a source figure. It's **unit-aware** (decimal↔percent, compact billion/trillion scaling) and **derivation-aware** (catches pairwise sum / diff / ratio / % change between source numbers — the canonical case is "implied upside = (target − current) / current × 100"). Bare integers under 100 are skipped to avoid false positives on ordinal counts. Tolerance: 0.5% relative or 0.01 absolute for rounding.

On traceability failure the persisted `content` is **left untouched** — the user keeps seeing the last-validated version with an amber warning banner. This is the "fall back to previous analysis" requirement.

Full details: [`docs/ai-pipeline.md`](ai-pipeline.md#validator).

## Caching strategy

Three independent cache layers, each tuned to its access pattern:

1. **Prisma JSONB cache (`raw_data` table).** Per `(ticker, dataType)`, upserted on each external fetch. TTL is per-data-type, set in `src/lib/finance/config.ts`:
   - `price` 60s · `options` 1h · `analyst` 12h · `earnings` 24h · `news` 30min · `profile` 7d
   The cache is **stale-fallback-aware**: when Yahoo throws, the adapter falls back to the most recent cached row regardless of TTL (with `stale: true` set on the response) so a Yahoo outage degrades rather than fails the dashboard.
2. **Tanstack Query (browser).** Query keys: `['holdings']` for portfolio, `['finance', ticker, type]` for finance data, `['ai', ticker, sectionType]` for AI. Portfolio uses `staleTime: 60s`; finance hooks use `staleTime: 1h`; mutations always `invalidateQueries` on completion. The `Sources` section attaches to all six finance hooks with `enabled: false` so it observes status without triggering its own fetches.
3. **Anthropic prompt cache.** The shared `SYSTEM_PROMPT` (~3000 tokens, in `src/lib/ai/prompts/system.ts`) is marked `cache_control: { type: 'ephemeral' }`. The prompt is intentionally long enough to clear Sonnet 4.6's 2048-token minimum cacheable threshold, so the second-and-later sections generated for the same (user, ticker) get cache reads at roughly 10% of input cost. Cache read/creation token counts are recorded on the `aiTokens` counter (see [Observability](#observability)).

## Observability

- **Logging.** Pino with structured JSON output (`src/lib/logger.ts`). Child loggers per module — `financeLogger = logger.child({ module: 'finance' })`, `aiLogger = logger.child({ module: 'ai' })`, plus an in-cron equivalent. Dev uses `pino-pretty` as a **synchronous** destination (not the worker-thread transport) because Turbopack HMR kills transport workers between reloads.
- **Tracing.** OpenTelemetry NodeSDK in `src/lib/telemetry/tracer.ts`. Initialized once per process from `instrumentation.ts`, singleton via `globalThis`. Exporter is `ConsoleSpanExporter` for v1 — free-tier AWS has no CloudWatch agent or OTLP collector. Swapping in `OTLPTraceExporter` is a one-line change in `tracer.ts`. **No auto-instrumentations** — we register `instrumentations: []` so the trace stream stays signal-dense (HTTP / Prisma / fs spans would bury the four hot-path spans).
- **Spans.** `withSpan(name, attrs, fn)` helper in `src/lib/telemetry/spans.ts` wraps work with auto exception capture + status. Three hot paths instrumented:
  - `ai.generate` per analysis with attrs `ai.ticker`, `ai.sectionType`, `ai.model`, `ai.outcome`, and token counts.
  - `cron.price-alerts`, `cron.earnings-alerts`, `cron.scheduled-ai` per tick.
- **Metrics.** Four custom instruments in `src/lib/telemetry/metrics.ts`:
  - `ai.skill.duration` (histogram, ms) — tagged section + model + outcome.
  - `ai.tokens` (counter) — tagged section + model + direction (input / output / cache_read / cache_creation).
  - `finance.cache.events` (counter) — tagged dataType + outcome (hit | miss).
  - `cron.runs` (counter) — tagged job + outcome (success | error).

Full inventory and label dimensions: [`docs/observability.md`](observability.md).

## Deployment topology

Target: **AWS free tier**. One EC2 t3.micro for the Next.js process, one RDS db.t3.micro for Postgres.

```
EC2 t3.micro (Ubuntu 22.04)
  PM2
   └── node server.js          ← MUST be `node server.js`, not `next start`
        Next.js (port 3000 behind Nginx)
        OpenTelemetry SDK     (ConsoleSpanExporter → CloudWatch logs in v1)
        node-cron registry    (3 jobs registered at boot)

RDS db.t3.micro (PostgreSQL 16, 20 GB SSD)
  same VPC as EC2
  Prisma connection pool from the Next.js process
```

**Important.** In-process cron requires a long-lived server. `next start` works for HTTP serving but lifecycle hooks (signal handling, shutdown drains) are cleaner under a custom server. CLAUDE.md's `node-cron` + Next.js 15 compatibility note: deploy with `next build && node server.js`, not `next start`. PM2 keeps the process alive (`pm2 start "node server.js" --name aurumiq`), rotates logs, and restarts on crash.

Future swap-in points (each is a single-file change):
- `tracer.ts` → `OTLPTraceExporter` pointed at CloudWatch / Honeycomb / Tempo.
- `src/lib/email.ts` `sendPriceAlert` / `sendEarningsReminder` → real SES SDK call (currently console-logs in dev).

## Tradeoffs and known follow-ups

Surfaced honestly so the engineering bias is visible. Each entry traces to a phase SUMMARY.

| Tradeoff | Why we accepted it | Phase ref |
|---|---|---|
| No YTD field on Stock Header | Yahoo `quoteSummary` doesn't expose YTD directly; would need a historical-prices adapter | Phase 4 |
| No recent-revisions block on Analyst Setup | `upgradeDowngradeHistory` is in raw cache but not in the typed `AnalystData` interface; type widening deferred | Phase 4 |
| No Vitest tests for AI validator or generate flow | Phase 5 was UI-heavy; validator correctness was driven by real-data probing (AAPL 16.6%, NVDA 36.6% upside) | Phase 5 |
| No optimistic UI on portfolio CRUD | Relies on `invalidateQueries` round-trip; fine for v1 latency | Phase 3 |
| Email-enumeration accepted on signup / email-update | Matches existing signup behavior; the attacker already needs the user's current password to reach `/api/account/email` | Phase 6 |
| In-process cron, not EventBridge / Lambda | Cold starts and free-tier Lambda complexity outweigh the simplicity of a single long-lived process at this scale | CLAUDE.md |
| `ConsoleSpanExporter` instead of OTLP in v1 | Free-tier AWS has no collector; swap is one line in `tracer.ts` | Phase 7 |
| No MeterProvider wired yet | Meter API records into a no-op until we add a provider; instruments and call sites are real, swap is additive | Phase 7 |
| Pino synchronous destination in dev | Turbopack HMR kills the worker-thread transport; tiny perf cost vs full stderr cleanliness | Phase 3 |
| History pagination capped at 50 rows | Sufficient for ~2 months of daily generation; cursor pagination is a Phase 7 polish item | Phase 6 |
| Real SES wiring deferred | Dev console logs verify the cron logic; actual delivery is a single-file change | Phase 6 |
| One yahoo-finance2 client, no rate limiting middleware | Free Yahoo endpoint isn't rate-limited enough to justify it at v1 traffic | Phase 2 |

See the per-phase SUMMARYs in `.planning/phases/*/0X-SUMMARY.md` for the full execution detail behind each phase.
