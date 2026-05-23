# AI Pipeline

The AI pipeline is what makes AurumIQ "AI-powered" rather than just a portfolio tracker. It takes a user, a ticker, and a section type, and produces a validated, structured analysis grounded in real financial data. This document is the engineering reference for that pipeline.

## Goal

Produce three modular analysis sections per stock:

- **Bull vs Bear** — side-by-side bull case and bear case cards (3-5 points each, one-liner summary).
- **Catalysts & Risks** — bullet-pointed near-term catalysts and risks.
- **Live on the Call** — numbered list of key items to listen for on the next earnings call.

### Design constraints

- **No hallucinated figures.** Every numeric claim in the output must trace to a number passed in the prompt context (or be derivable from one).
- **Structured output.** Sections render typed React components. Strings inside markdown won't do.
- **Configurable model.** Sonnet 4.6 for on-demand interactive refresh; Haiku 4.5 for scheduled cron runs (cost).
- **Streaming UX.** Generation takes 10-30 seconds; the user gets SSE progress events (`fetching_data` → `generating` → `validating`) so the page never feels stuck.
- **Validation-failure ≠ data loss.** If validation rejects a generation, the prior validated content stays on screen.

## Files at a glance

| File | Role |
|---|---|
| `src/lib/ai/types.ts` | `SectionType` union, per-section content interfaces, `SerializedAnalysis` wire shape, `ANALYSIS_STATUSES`. |
| `src/lib/ai/schemas.ts` | Zod v4 schemas for the 3 section types and a loose `sourcesSchema`. |
| `src/lib/ai/client.ts` | Anthropic SDK singleton + `MODEL` env constant. |
| `src/lib/ai/prompts/system.ts` | Shared `SYSTEM_PROMPT` (~3000 tokens, `cache_control: ephemeral`). |
| `src/lib/ai/prompts/{bullBear,catalystsRisks,liveOnCall}.ts` | Per-section `buildXMessages(sources)` builders. |
| `src/lib/ai/validation.ts` | `extractNumbers` + `validateTraceability` (unit + derivation aware). |
| `src/lib/ai/generate.ts` | The pipeline. Upsert → call SDK → validate → persist → append history. |
| `src/lib/ai/api-client.ts` | `fetchLatestAnalysis` + `generateAnalysisStream` (async-generator SSE parser). |
| `src/lib/ai/hooks.ts` | `useLatestAnalysis(ticker, sectionType)` Tanstack Query hook. |
| `src/app/api/ai/[ticker]/route.ts` | POST (SSE stream) + GET (latest row). |

## Prompts

### Shared `SYSTEM_PROMPT`

A single ~3000-token system prompt at `src/lib/ai/prompts/system.ts`. It commands:

- **JSON-only output.** Combined with `messages.parse()`, this gives the LLM no "natural language preamble" escape hatch.
- **Traceability.** "Every number must trace to source." This is reinforced by the validator's hard check downstream, but stating it in the prompt cuts the false-positive rate.
- **Section-quality bars.** What counts as a strong bull point, what counts as a real catalyst (event-driven, dated where possible), what makes an earnings-call listening item useful (specific to this quarter, not generic).

**Why intentionally long?** Sonnet 4.6's prompt cache has a 2048-token minimum for cacheable blocks. The system prompt is comfortably above that threshold so the second-and-later sections for the same (user, ticker) get cache reads at roughly 10% of input cost. The verbosity is a deliberate cost optimization, not bloat. See the [Anthropic prompt caching docs](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) for the threshold rules.

The system message is sent with `cache_control: { type: 'ephemeral' }` so the SDK marks it for the prompt cache.

### Per-section builders

Each section has a `buildXMessages(sources)` function that produces the **user-turn content**. The system prompt is the cacheable prefix shared across all three; the user turn is the per-section instructions plus the four source data blocks (price, earnings, analyst, profile) inlined as JSON. Keeping the system prompt constant maximizes cache hits.

## Model selection

| Use case | Model | Reason |
|---|---|---|
| On-demand refresh (user clicks "Refresh") | `claude-sonnet-4-6` (default, `ANTHROPIC_MODEL` env) | Better reasoning depth; user is waiting and watching. |
| Scheduled cron regeneration | `claude-haiku-4-5` (passed via `model` param to `generateSection`) | Cheap nightly runs across the user's whole portfolio. |

`generateSection({ ..., model? })` is a single optional parameter — same pipeline, same validator, same history append, just a different model id. This is how the cost-optimization stays cleanly separated from the application logic.

Older model strings from the original tech-stack table (`claude-3-5-haiku`, `claude-3-7-sonnet`) map to the current versions per Anthropic's migration guidance; we set Sonnet 4.6 as the default in code.

## Structured outputs

We use the Anthropic SDK's structured-output helper:

```ts
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

const response = await anthropic.messages.parse({
  model,
  thinking: { type: 'enabled', budget_tokens: 'adaptive' },
  effort: 'high',
  system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
  messages: BUILDERS[sectionType](sources),
  output_config: { format: zodOutputFormat(SCHEMAS[sectionType]) },
  max_tokens: 4096,
});
const content = response.parsed_output;  // typed via the Zod schema
```

Key points:

- **The SDK enforces the schema server-side.** Anthropic's tools API receives the schema and forces the model to emit conforming JSON. There is no "Model returned non-JSON" failure mode.
- **The SDK strips unsupported constraints.** Zod's `array().min(3).max(5)` becomes an unbounded array on the wire; the SDK still validates the bounds client-side via Zod after the model responds. We rely on this and use array length bounds liberally.
- **Adaptive thinking + `effort: high`.** Financial reasoning benefits from extended thinking. `effort: high` keeps quality predictable without going to `max` cost.
- **Zod v4 just for AI schemas.** `zod ^3.25` ships v4 at the `zod/v4` subpath. The Anthropic SDK helper requires v4 at the type level, so `src/lib/ai/schemas.ts` is the one file in the repo that imports from `zod/v4`; the rest of the project stays on v3.

## Validator

The output passing schema validation is necessary but not sufficient — the model can still invent numbers inside string fields. That's where `validateTraceability(content, sources)` comes in.

### Three layers

1. **`messages.parse` → Zod parse via the SDK.** Schema mismatch throws before we even reach the validator. Outcome: `status='failed'`.
2. **Structured outputs ensure shape, not truth.** Trustworthy JSON shape; still untrusted numeric claims.
3. **`validateTraceability` numeric trace.** The function:
   - Walks the AI output and extracts every currency, percent, and large bare number (`extractNumbers`).
   - Walks the sources passed to the prompt and extracts every number.
   - For each output number, looks for a match in the source set.
   - **Unit-aware.** Decimal↔percent (source `0.166` ≈ output `16.6%`), compact scaling (source `740_000_000_000` ≈ output `$740B`).
   - **Derivation-aware.** For every pair (a, b) of source numbers, tries sum, diff, ratio, and percent change. Catches the canonical "implied upside = (target − current) / current × 100" case that v1 substring validation would have rejected.
   - **Bounds the false-positive surface.** Skips bare integers under 100 (ordinal counts in lists, etc.). Only currency, percent, or numerics ≥ 100 trigger the trace.
   - **Tolerance.** 0.5% relative or 0.01 absolute, whichever is larger — covers rounding.

If validation rejects, `status='validation_failed'` is set on the `Analysis` row but the prior `content` field is **not overwritten**. The component renders the last-validated content with an amber warning banner.

### Why this matters

Two real cases drove the derivation-awareness:

- **AAPL Bull vs Bear, output `16.6%`.** Source had `revenueGrowth: 0.166`. v1 substring check rejected — we added unit-aware decimal↔percent matching.
- **NVDA Catalysts & Risks, output `$36.6% upside`.** Source had `targetMeanPrice: 294`, `currentPrice: 215`. Derivation: `(294 − 215) / 215 × 100 = 36.7%`. v1 substring rejected; v2 unit-aware also rejected; v3 derivation-aware accepted it because it's a legitimate computed claim.

The validator's job is to reject **invented** numbers, not to reject **derived** ones. The pairwise derivation pass is the line between the two.

## Failure modes

| Failure | What happens | What the user sees |
|---|---|---|
| `messages.parse` throws (schema mismatch, API error) | `status='failed'`, `errorMessage = err.message`, span set ERROR, `aiSkillDuration` observed with `outcome=failed` | Red error card with the error message; "Try again" button |
| Validator rejects (untraceable number) | `status='validation_failed'`, `errorMessage = 'Output failed traceability check'`, prior `content` preserved | Amber warning banner over the last-validated content |
| Anthropic API rate limit (HTTP 429) | `status='failed'`, error surfaced verbatim | Same as schema-failure UX |
| Anthropic API error (5xx or other) | `status='failed'`, error surfaced verbatim | Same |
| Yahoo Finance source fetch fails | The route returns 502 before generation even starts; client shows error toast | Toast + section unchanged |

## Streaming protocol (SSE)

The AI route handler streams progress events to the client over `text/event-stream`. The protocol is intentionally minimal — three progress steps then a terminal event:

```
event: progress
data: {"step":"fetching_data"}

event: progress
data: {"step":"generating"}

event: progress
data: {"step":"validating"}

event: complete
data: {"analysis": <SerializedAnalysis>}
```

On any caught error the terminal event is `event: error` with `{"message": <string>}` instead. The client (`src/lib/ai/api-client.ts`) consumes this via a 30-line inline parser exposed as an async generator — no extra SSE-client dependency for a protocol this small.

The client component (`BullBear` / `CatalystsRisks` / `LiveOnTheCall`) translates progress events into a UI status pill ("Fetching data…" → "Generating…" → "Validating…"). On `complete`, it invalidates the `['ai', ticker, sectionType]` query so `useLatestAnalysis` refetches the freshly persisted row and re-renders.

## History

Every **completed** generation also appends a row to the `AnalysisHistory` table (`db.analysisHistory.create({ ... })`). Schema parse failures and traceability failures never write history — the history table is for browsable validated outputs only.

The history view is a per-section vertical timeline (`src/components/sections/AnalysisHistoryView.tsx`) with expand-to-see-full pattern. Collapsed previews are section-specific: the bull/bear `oneLiner`, the first catalyst + risk, or the first listening item topic, whichever matches the section type. Three `AnalysisHistoryView` instances live at the bottom of `/dashboard/[ticker]`, one per section type, each wrapped in `<LazySection>` so the history queries don't fire until the user scrolls to them.

Current cap: `take: 50` newest-first per query. Cursor pagination is a known Phase 7 follow-up; see [`architecture.md`](architecture.md#tradeoffs-and-known-follow-ups).

## Telemetry hooks

The pipeline is fully instrumented. See [`observability.md`](observability.md) for the full inventory; the AI-relevant data:

- **Span.** `ai.generate` wraps `generateSection`. Attributes set as the run resolves: `ai.ticker`, `ai.sectionType`, `ai.model`, `ai.outcome` (`completed | validation_failed | failed`), and the four token counts.
- **Histogram.** `ai.skill.duration` observed once per run with the same tag set.
- **Counter.** `ai.tokens` incremented four times per successful run — once each for `input`, `output`, `cache_read`, `cache_creation`. Prompt-cache hit rate is `cache_read / (input + cache_read)` on a per-section basis.
