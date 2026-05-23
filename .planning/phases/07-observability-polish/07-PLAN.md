# Phase 07 — Observability & Polish

> Status: in-progress (Wave 7A complete)
> Goal: ship the observability foundation promised in CLAUDE.md (traces, custom metrics, span coverage of hot paths) and finish presentation-grade polish before demo.

## Scope

CLAUDE.md commits us to: every AI skill execution producing an OpenTelemetry trace with duration, token counts, model, and cache status; custom metrics for skill-duration histogram, cache hit rate, daily token usage, and schedule success rate. Phase 7 delivers that plus a freshness UX, test/error refinement, and docs polish.

Out of scope: production OTLP/CloudWatch wiring (free-tier deploy stays on stdout export), perf optimization, new feature work.

## Wave 7A — Telemetry foundation (DONE)

Single-thread wave (instrumentation touches code paths the other waves don't).

- Install OTel packages: `@opentelemetry/api`, `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http`.
- `src/lib/telemetry/tracer.ts` — `NodeSDK` singleton via `globalThis`; `ConsoleSpanExporter` for v1 (free-tier compatible); no auto-instrumentations to keep trace stream signal-dense.
- `src/lib/telemetry/metrics.ts` — `ai.skill.duration` histogram, `ai.tokens` counter, `finance.cache.events` counter, `cron.runs` counter.
- `src/lib/telemetry/spans.ts` — `withSpan(name, attributes, fn)` helper with auto exception capture + status.
- `src/instrumentation.ts` — `initTelemetry()` runs before `startCronJobs()`.
- Wire `ai.generate` span + token/duration metrics into `src/lib/ai/generate.ts` (all outcome branches).
- Wire `finance.cache.events` counter into `src/lib/finance/cache.ts` (no span — too hot).
- Wire `cron.<job>` spans + `cron.runs` counter into each cron module's `tick()`.

Exit: tsc clean, vitest green, `pnpm build` succeeds, console traces visible on dev request.

## Wave 7B — Three parallel tracks (PLANNED)

Independent — dispatchable as parallel subagents once 7A is on the branch.

### 7B.1 — Freshness UI
- Show "as of HH:MM" + last-refresh badge on every dashboard section.
- Stale indicator when `generatedAt` older than section-specific threshold.
- Manual refresh button feedback (pending → success → updated timestamp).
- Files: `src/components/dashboard/section-shell.tsx`, dashboard section components.

### 7B.2 — Tests + error refinement
- Add Vitest cases for `withSpan` happy/sad paths and metric instruments (assert recorded values).
- Tighten error messages surfaced from `generateSection` failure branches (user-friendly, not raw API status).
- Replay test for cron tick error path → `cron.runs{outcome=error}` counter increments.

### 7B.3 — Docs polish
- README: add Observability section pointing at metric/trace names.
- ARCHITECTURE doc: telemetry data flow diagram.
- PROJECT.md Key Decisions: log the stdout-exporter-for-v1 decision and the no-auto-instrumentations decision.
- Inline JSDoc on the four metric instruments documenting label dimensions.

## Verification gates

- `pnpm exec tsc --noEmit` silent.
- `pnpm vitest run` — 34/34 baseline maintained (7B.2 will add cases on top).
- `pnpm build` succeeds.
- Manual: hit dashboard, confirm `ai.generate` spans + `aurumiq` resource attributes appear in stdout.

## Key design decisions

- **Exporter = ConsoleSpanExporter (v1)** — AWS free tier has no CloudWatch agent; OTLP collector is out of scope. Switching to OTLP/CloudWatch later is a one-line change in `tracer.ts`. Interview story stays intact: instrumentation is real, export target is the only thing that's dev-only.
- **No auto-instrumentations** — `instrumentations: []` in the NodeSDK config. Auto HTTP/Prisma/fs spans would bury our 4 hot-path spans in noise. Explicit `withSpan` calls give a curated trace stream.
- **Span per cron tick, not per alert** — one alert table with N rows would produce N spans per tick; tick-level is the right unit of work.
- **Counter (not span) for cache lookups** — `getCache` runs many times per request; one counter add is ~free and gives us hit rate without the buffer overhead.
