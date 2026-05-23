# Phase 05 — Execution Summary

**Plan:** `05-PLAN.md` (AI Pipeline & 3 Core Analysis Sections)
**Executed:** 2026-05-23
**Status:** Complete — build green, 34/34 tests passing, UI verified with real Claude generations against multiple tickers (AAPL, NVDA) including a hallucination-validation false-positive that drove follow-up validator improvements.

## What shipped

Users can now click "Generate" (or "Refresh") on the Bull vs Bear, Catalysts & Risks, and Live on the Call dashboard sections and get streamed Claude Sonnet 4.6 analysis grounded in the Phase 2-4 financial data. Output is structured-output-enforced JSON; numerical figures are validated against source data with unit- and derivation-aware traceability checks before being persisted.

**Requirements delivered:** AI-01, AI-02, AI-03, AI-04. (INFRA-04 was already complete from Phase 2.)

## Execution model

Wave 5A foundation (1 agent, sequential — tightly coupled pipeline) → wiring gate → Wave 5B 3 parallel section components (strict file ownership) → wiring gate → orchestrator integration into `/dashboard/[ticker]/page.tsx` → user verification → two validator follow-ups (unit-aware + derivation-aware) driven by real-data false positives.

| Wave | Pattern | Files | Outcome |
|------|---------|-------|---------|
| 5A | 1 agent | Analysis Prisma model, env extension, Anthropic client, prompts, validation, generate, SSE endpoint, api-client, hooks, logger child | ✅ |
| 5B | 3 parallel | BullBear, CatalystsRisks, LiveOnTheCall section components | ✅ |
| 5C | Orchestrator | dashboard `[ticker]/page.tsx` integration | ✅ |
| 5D (follow-up) | Orchestrator | validator unit-awareness + derivation-awareness; switched generation to `messages.parse()` + `zodOutputFormat()` for guaranteed JSON | ✅ |

## Architecture

```
┌─────────────────────┐
│ Per-ticker dashboard │
│  ┌────────────────┐ │
│  │ Section.tsx    │ │  "use client" — useLatestAnalysis (read)
│  │ - Generate btn │ │            + generateAnalysisStream (SSE)
│  │ - Refresh btn  │ │
│  │ - 5 states     │ │
│  └────────┬───────┘ │
└───────────┼─────────┘
            │ POST /api/ai/[ticker]
            ▼
┌─────────────────────────────────────┐
│ /api/ai/[ticker]/route.ts (SSE)     │
│  1. auth() check                    │
│  2. fetch 4 finance data types in   │
│     parallel via Phase 2 adapters   │
│  3. Open ReadableStream             │
│  4. emit progress: fetching_data    │
│  5. emit progress: generating       │
│  6. call generateSection()          │
│  7. emit progress: validating       │
│  8. emit complete with stored row   │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ src/lib/ai/generate.ts              │
│  1. upsert row with status=generating│
│  2. anthropic.messages.parse({      │
│       model: sonnet-4-6,            │
│       thinking: adaptive,           │
│       effort: high,                 │
│       system: SYSTEM_PROMPT         │
│         (cache_control: ephemeral), │
│       output_config.format:         │
│         zodOutputFormat(schema)     │
│     }) → response.parsed_output     │
│  3. validateTraceability()          │
│       (unit-aware + derivation-aware)│
│  4. on valid → status=completed,    │
│       persist content               │
│     on traceability fail →          │
│       status=validation_failed,     │
│       prior content untouched       │
│     on schema fail / API error →    │
│       status=failed                 │
└─────────────────────────────────────┘
```

## Files

### New (Wave 5A foundation)
- `src/lib/ai/types.ts` — `SECTION_TYPES` const + `SectionType` union, `BullBearContent`/`CatalystsRisksContent`/`LiveOnCallContent`, `SourcesData` snapshot shape, `SerializedAnalysis` wire shape, `ANALYSIS_STATUSES`.
- `src/lib/ai/schemas.ts` — Zod v4 (via `zod/v4` subpath — required by the Anthropic SDK's `zodOutputFormat()` helper) schemas for the 3 section types + a loose `sourcesSchema`.
- `src/lib/ai/client.ts` — `anthropic` Anthropic SDK singleton (globalThis pattern matching `db.ts`) + `MODEL` export from env.
- `src/lib/ai/prompts/system.ts` — single shared `SYSTEM_PROMPT` (~3000 tokens) intentionally long enough to clear Sonnet 4.6's 2048-token prompt-cache threshold; commands JSON-only, traceability ("every number must trace to source"), and section-quality bars.
- `src/lib/ai/prompts/{bullBear,catalystsRisks,liveOnCall}.ts` — per-section `buildXMessages(sources)` functions building the user-turn content. The system prompt is the cacheable prefix shared across all three.
- `src/lib/ai/validation.ts` — `extractNumbers` + `validateTraceability`. After follow-ups: unit-aware (decimal↔percent, compact billion/trillion scaling), derivation-aware (catches `(target - current) / current * 100`-style upside calculations, sums, ratios, differences between any pair of source numbers), and bounded false-positive surface (only currency/percent/≥100 figures are traced; bare ordinal counts skipped).
- `src/lib/ai/generate.ts` — `generateSection({userId, ticker, sectionType, sources})`. Upserts a row with `status=generating`, calls `anthropic.messages.parse()` with `zodOutputFormat()` for guaranteed structured output, validates traceability, persists the result. Anti-overwrite: on `validation_failed` the prior `content` is left untouched so the user keeps seeing the last-validated version.
- `src/lib/ai/api-client.ts` — `fetchLatestAnalysis` + `generateAnalysisStream` (typed async-generator over a 30-line inline SSE parser; no extra dependency for what amounts to `data: <json>\n\n` blocks).
- `src/lib/ai/hooks.ts` — `useLatestAnalysis(ticker, sectionType)` Tanstack Query hook (1-min staleTime).
- `src/app/api/ai/[ticker]/route.ts` — POST (SSE stream: `progress` → `complete`/`error` events) + GET (returns latest stored Analysis for tuple).

### New (Wave 5B section components — `src/components/sections/`)
- `BullBear.tsx` (315 lines) — emerald-bordered Bull Case + rose-bordered Bear Case side-by-side cards with up/down arrows + italic one-liner summary at top + 5 UX states (no-analysis / generating / completed / validation_failed / failed).
- `CatalystsRisks.tsx` (188 lines) — emerald Catalysts + amber Risks (amber chosen over rose: risks are forward-looking concerns to monitor, not error states; rose reserved for genuine UI errors).
- `LiveOnTheCall.tsx` (173 lines) — numbered list with sky-tinted circular badges; each item has bold `topic` + muted `rationale` line. Sky accent distinguishes informational section from the value-coded ones.

All three share the identical refresh flow (`generateAnalysisStream` async generator → progress steps → invalidate Tanstack Query on complete) and the 5-state UI pattern.

### Modified
- `prisma/schema.prisma` — added `Analysis` model (uuid id, userId FK, ticker, sectionType, status, content JSONB, sources JSONB snapshot, model, errorMessage, generatedAt, updatedAt, `@@unique([userId, ticker, sectionType])` for upsert-on-refresh) + `User.analyses` back-relation. Pushed via `npx prisma db push`.
- `src/lib/env.ts` — added `ANTHROPIC_API_KEY` (required) + `ANTHROPIC_MODEL` (optional, default `claude-sonnet-4-6`) to the validated env.
- `src/lib/logger.ts` — added `aiLogger` child logger (`module: 'ai'`).
- `src/app/(dashboard)/dashboard/[ticker]/page.tsx` — replaced 3 SectionSkeleton placeholders with `<BullBear />`, `<CatalystsRisks />`, `<LiveOnTheCall />` (each wrapped in `LazySection` for scroll-triggered mount). Removed those 3 from the still-pending list; only Segments + Options remain (Phase 8).

### Package
- `@anthropic-ai/sdk@0.98.0`

## Verification

| Check | Result |
|-------|--------|
| `pnpm exec tsc --noEmit` | ✅ silent |
| `pnpm lint` | ✅ no warnings or errors |
| `pnpm vitest run` | ✅ 34/34 (no new AI unit tests yet — UI-heavy phase, validated via real Claude generations against AAPL/NVDA) |
| `pnpm build` | ✅ `/dashboard/[ticker]` bundle 60.3 kB / 183 kB First Load JS; `/api/ai/[ticker]` registered as dynamic route |
| Browser verification — AAPL | ✅ user confirmed all 3 sections generated valid analysis with traceable figures |
| Browser verification — NVDA | ✅ after derivation-aware validator fix; implied upside calculation now passes |

## Phase 5 success criteria

1. ✅ Clicking Refresh triggers async AI generation; SSE progress updates in real time; section re-renders on completion; UI never blocks.
2. ✅ Bull vs Bear renders AI-generated bull case + bear case cards.
3. ✅ Catalysts & Risks renders bullet-pointed lists.
4. ✅ Live on the Call renders numbered listening points.
5. ✅ Post-generation validation rejects AI output containing financial figures not present in (or derivable from) source data; logs structured warning; falls back to previous content. Validated by NVDA test case where "$36.6%" (computed implied upside) initially failed before derivation-awareness was added.

## Notable design decisions

- **Sonnet 4.6 default, configurable via `ANTHROPIC_MODEL` env var** — matches the user's stated intent ("sonnet for on-demand deep analysis") from the project's CLAUDE.md tech-stack table. Older model strings (`claude-3-5-haiku`, `claude-3-7-sonnet`) map to current versions per Anthropic's migration guide. Haiku 4.5 alternative reserved for Phase 6 scheduled generation (cheap nightly runs).
- **Adaptive thinking + `effort: high`** — financial reasoning benefits from extended thinking. `effort: high` keeps quality predictable without going to `max` cost.
- **Structured outputs via `messages.parse()` + `zodOutputFormat()`** — switched from manual JSON parsing during the validator follow-up. Eliminates the "Model returned non-JSON output" failure mode entirely; the SDK enforces the schema server-side and the SDK strips unsupported constraints (array length bounds) while validating them client-side via Zod.
- **Zod v4 just for AI schemas** — discovered that `zod ^3.25` ships v4 at the `zod/v4` subpath and the Anthropic SDK's helper requires v4 at the type level. Only `src/lib/ai/schemas.ts` imports from `zod/v4`; the rest of the project stays on v3. A single one-line comment in the file explains why.
- **Validator: unit- + derivation-aware** — the v1 substring check produced false positives on legitimate AI transformations:
  - Decimal → percent (source `0.166` → output `16.6%`) — bridged with `× 100` candidate
  - Compact scaling (source `740_000_000_000` → output `$740B`) — bridged with `× 10⁶/10⁹/10¹²` candidates
  - Pairwise derivations (source target=$294, current=$215 → output "36.6% upside") — checked against every pair (a, b) for sum, diff, ratio, % change
  - Skips bare integers under 100 (ordinal counts) — only traces explicit currency, percent, or large numeric figures
  - 0.5% relative tolerance / 0.01 absolute for rounding
- **Anti-overwrite on `validation_failed`** — only `status` and `errorMessage` are updated; the prior `content` field is preserved. The user keeps seeing the last-validated version with an amber warning banner. This is the "fall back to previous analysis" behavior the success criterion demands.
- **System prompt cache_control** — single shared `SYSTEM_PROMPT` is marked `cache_control: { type: 'ephemeral' }`. Sonnet 4.6's 2048-token cacheable minimum is intentionally cleared (the prompt is verbose by design) so the second-and-later sections for the same user/ticker get cache reads at ~10% of input cost.
- **Server-side data fetch in the route handler** — the SSE endpoint calls `fetchPrice` + `fetchEarnings` + `fetchAnalyst` + `fetchProfile` directly via the Phase 2 adapters (server-side, no HTTP round-trip), reusing the Phase 2 cache and the Phase 4 hooks' Tanstack Query cache via shared `['finance', ticker, type]` keys.

## Known follow-ups (deferred)

- **No Vitest unit tests for the validator or generate flow** — UI-heavy phase; the validator's correctness was driven by real-data probing during UI verification (AAPL 16.6% case, NVDA 36.6% case). Phase 7 will add a Vitest suite covering:
  - direct match, decimal↔percent, compact scaling, derivation pairs
  - schema parse failure
  - traceability failure preserves prior content
  - rate-limit and API error handling
- **Per-section model override** — currently all 3 sections use the same `ANTHROPIC_MODEL`. Phase 6 will add Haiku for scheduled regeneration; that'll naturally introduce per-call model selection.
- **Prompt caching telemetry** — Anthropic returns `cache_read_input_tokens` in `usage`; we log it via `aiLogger` but don't surface it anywhere user-facing yet. Phase 7 observability will plot cache-hit rate per section.
- **AnalysisHistory model** — the `Analysis` row stores only the LATEST per (user, ticker, sectionType). Phase 6 ships the history view; that'll either add an `AnalysisHistory` table or version `Analysis` rows.
