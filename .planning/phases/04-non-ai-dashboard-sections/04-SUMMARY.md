# Phase 04 — Execution Summary

**Plan:** `04-PLAN.md` (Non-AI Dashboard Sections)
**Executed:** 2026-05-23
**Status:** Complete — build green, 34/34 tests passing, UI verified.

## What shipped

Five data-driven dashboard sections rendering real financial data through the validated Phase 2 data layer: **Stock Header**, **Numbers Going In**, **QoQ / YoY Trend** (with TradingView lightweight-charts), **Analyst Setup**, **Sources**. Plus the lazy-mount infrastructure so sections only fetch when scrolled into view.

**Requirements delivered:** DASH-02, DASH-03, DASH-04, DASH-05, DASH-06.

## Execution model

Wave 4A foundation (1 agent, sequential) → 4B 5 parallel section agents (strict file ownership) → 4C orchestrator wired sections into the per-ticker dashboard page. Wiring gates (tsc + lint + vitest + build) between every wave.

| Wave | Pattern | Files | Outcome |
|------|---------|-------|---------|
| 4A | 1 agent | finance api-client, 6 finance hooks, useInView, LazySection, lightweight-charts | ✅ |
| 4B | 5 parallel | StockHeader, NumbersGoingIn, QoQYoYTrend, AnalystSetup, Sources | ✅ |
| 4C | Orchestrator | `/dashboard/[ticker]/page.tsx` wiring | ✅ |

## Files

### New (foundation)
- `src/lib/finance/api-client.ts` — `fetchFinanceData<T>(ticker, type)` typed wrapper. Returns the unwrapped `AdapterResult<T>` (the server already wraps in `{ data: ... }`).
- `src/lib/finance/hooks.ts` — 6 Tanstack Query hooks: `usePrice`, `useEarnings`, `useAnalyst`, `useOptions`, `useProfile`, `useNews`. Query key `['finance', ticker, type]`. `staleTime: 1h`. Each accepts `(ticker, enabled = true)` so observer-only consumers (like the Sources section) can attach to the cache without triggering a fetch.
- `src/hooks/useInView.ts` — small IntersectionObserver hook. Default `rootMargin: 200px` so sections start loading just before they enter the viewport (feels instant). `once: true` by default — don't unmount after scroll-away.
- `src/components/dashboard/LazySection.tsx` — combines `useInView` + `SectionWrapper`. Until visible, renders the `SectionSkeleton`; once visible, mounts the children. Composed with Phase 3's existing SectionWrapper class-component error boundary.

### New (5 section components)
- `src/components/sections/StockHeader.tsx` (203 lines) — Identity + price summary. Renders ticker, company name (longName → shortName fallback), current price, signed change/% (color-coded), market cap (compact USD), sector, industry, currency, next earnings date (best-effort: parses the first future-dated `earningsChart.quarterly.date`). Handles Yahoo's percent-encoding ambiguity (`|value| < 1` treated as decimal fraction, otherwise pre-scaled).
- `src/components/sections/NumbersGoingIn.tsx` (245 lines) — 3-column metric strip (Revenue Growth, EPS Estimate this quarter, Analyst Target) + last-4-quarters earnings table with Estimate / Actual / Surprise / Surprise %. Handles Yahoo's mixed quarter-label formats (fiscal `4Q2024` vs ISO date) — sorts and renders both correctly.
- `src/components/sections/QoQYoYTrend.tsx` (348 lines) — Two charts using lightweight-charts v4. Chart 1: EPS Actual vs Estimate histograms. Chart 2: EPS trend line with a dashed forward estimate appended from `currentQuarterEstimate`. Includes `quarterLabelToDate` helper (e.g., `4Q2024 → 2024-12-31`) since lightweight-charts requires a parseable time value. ResizeObserver + chart.remove() teardown on unmount.
- `src/components/sections/AnalystSetup.tsx` (210 lines) — Two blocks: (1) Horizontal stacked rating-mix bar (Strong Buy → Strong Sell with emerald→rose color gradient) for the current month (`period === '0m'`). (2) Consensus price target with implied upside %. Recent revisions block skipped — `AnalystData.upgradeDowngradeHistory` is not in the typed interface even though the raw cache contains it. Phase 7 will widen the type.
- `src/components/sections/Sources.tsx` (167 lines) — Observer pattern: subscribes to all 6 finance hooks with `enabled: false` so it reads from the shared Tanstack Query cache without triggering its own fetches. Renders a 6-row table (Source, Data, Status, Last Refreshed). Status pill mapping: Live (emerald) / Cached (muted) / Cached–stale (amber) / Failed (rose) / Loading (muted). Relative time auto-updates every 30s.

### Modified (Wave 4C integration)
- `src/app/(dashboard)/dashboard/[ticker]/page.tsx` — replaced 5 of the 10 SectionSkeleton placeholders with their real components, each wrapped in `<LazySection>`. The 5 still-pending sections (Segments, Options, Bull vs Bear, Catalysts & Risks, Live on the Call) remain as `<SectionSkeleton>` inside `<SectionWrapper>` until Phases 5 + 8.

### Modified (dependencies)
- `package.json` / `pnpm-lock.yaml` — added `lightweight-charts@^4`.

## Verification

| Check | Result |
|-------|--------|
| `pnpm exec tsc --noEmit` | ✅ silent |
| `pnpm lint` | ✅ no warnings or errors |
| `pnpm vitest run` | ✅ 34/34 (no new tests — UI-heavy phase, validated via browser) |
| `pnpm build` | ✅ all routes register; `/dashboard/[ticker]` now 57.4 kB / 180 kB First Load JS (was 1.88 kB — now includes lightweight-charts + 5 section components) |
| Browser verification | ✅ user confirmed all 5 sections render with real data, lazy mount works, no console errors |

## Phase 4 success criteria

1. ✅ Stock Header renders live price, day change, market cap, sector, currency, next earnings (best-effort).
2. ✅ Numbers Going In renders revenue growth + EPS estimate + analyst target + last-4-quarters table.
3. ✅ QoQ/YoY Trend renders EPS actual/estimate bar chart + EPS line trend with forward estimate.
4. ✅ Analyst Setup renders Buy/Hold/Sell stacked breakdown + consensus target + implied upside.
5. ✅ Sources lists all 6 providers with status badges + relative timestamps; lazy mount confirmed.

## Notable design decisions

- **Lazy mount via custom 30-line `useInView`** instead of pulling in `react-intersection-observer`. CLAUDE.md "avoid premature abstraction" — the standard `IntersectionObserver` API is tiny.
- **Sources uses `enabled: false` observer pattern** so it doesn't double-fetch anything other sections already loaded. Tanstack Query's shared cache + query keys (`['finance', ticker, type]`) make this clean.
- **YTD performance omitted from Stock Header** — Yahoo's `quoteSummary` modules don't expose YTD directly; computing it requires historical-prices time series (yahoo-finance2 `historical` API), which would need a new adapter type. Listed as Phase 7 follow-up.
- **Recent analyst revisions block omitted from Analyst Setup** — `upgradeDowngradeHistory` is in the raw cache but not in the typed `AnalystData` interface. Could have cast with `as any` but preferred to defer to Phase 7 type widening.
- **Quarter labels handled robustly** — Yahoo returns both fiscal labels (`4Q2024`) and ISO dates depending on the security and time range. Each section that consumes `earningsChart.quarterly` has its own small adapter; `QoQYoYTrend` needs ISO dates for chart positioning while `NumbersGoingIn` just needs sort-and-display.

## Known follow-ups (deferred to later phases)

- YTD performance field on Stock Header (needs historical-prices adapter — Phase 8 or as part of Phase 7 polish).
- Recent analyst revisions block on Analyst Setup (needs `AnalystData` type widening for `upgradeDowngradeHistory` — Phase 7).
- Per-section refresh button (Phase 5 introduces refresh for the AI sections; could extend to the data sections too in Phase 7).
- Playwright e2e tests covering the dashboard render and section-error isolation (Phase 7).
