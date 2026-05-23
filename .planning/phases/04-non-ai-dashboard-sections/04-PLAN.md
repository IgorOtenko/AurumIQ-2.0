---
phase: 04-non-ai-dashboard-sections
plan: 04
type: execute
waves:
  - id: 4A
    name: Foundation (shared infra)
    parallel: false
    status: in-progress
  - id: 4B
    name: Five non-AI sections (5 parallel agents)
    parallel: true
    depends_on: [4A]
    status: pending
  - id: 4C
    name: Integration & verification
    parallel: false
    depends_on: [4B]
    status: pending
files_modified:
  - package.json
  - src/lib/finance/api-client.ts
  - src/lib/finance/hooks.ts
  - src/hooks/useInView.ts
  - src/components/dashboard/LazySection.tsx
autonomous: true
requirements:
  - DASHBOARD-SECTIONS-NON-AI
user_setup: []
---

<objective>
Replace five of the ten Phase 3 skeleton slots on the ticker dashboard with real,
data-driven, non-AI sections (Stock Header, Numbers Going In, QoQ/YoY Trend,
Analyst Setup, Sources). Wave 4A locks the shared finance-data client, lazy-mount
mechanism, and charting library so Wave 4B can run five agents in parallel
without conflict. Wave 4C integrates the sections into the dashboard page and
verifies the build end-to-end.
</objective>

<wave id="4A">
Foundation work performed up-front by a single executor:

- Add `lightweight-charts@^4` for the QoQ/YoY trend chart.
- `src/lib/finance/api-client.ts` — typed fetch wrapper mirroring portfolio/api-client.ts; returns `AdapterResult<T>` directly.
- `src/lib/finance/hooks.ts` — six Tanstack Query hooks (`usePrice`, `useEarnings`, `useAnalyst`, `useOptions`, `useProfile`, `useNews`) keyed on `['finance', ticker, type]` with 1h staleTime (server-side cache controls real freshness).
- `src/hooks/useInView.ts` — IntersectionObserver hook with 200px rootMargin so sections start fetching just before they enter the viewport.
- `src/components/dashboard/LazySection.tsx` — combines `useInView` + `SectionWrapper` + `SectionSkeleton` so off-screen sections don't burn API quota.
</wave>

<wave id="4B">
Five agents run in parallel against the locked Wave 4A contracts.
Each owns one component file under `src/components/dashboard/sections/` and
consumes only the hook(s) listed below — no shared mutable state.

1. Stock Header — `StockHeader.tsx`; uses `usePrice` + `useProfile`; renders symbol, name, price, change %, market cap, sector/industry. Full-width row.
2. Numbers Going In — `NumbersGoingIn.tsx`; uses `useEarnings`; renders current-quarter EPS estimate, revenue growth, analyst target.
3. QoQ / YoY Trend — `QoQYoYTrend.tsx`; uses `useEarnings`; renders lightweight-charts line chart of quarterly actual vs estimate EPS.
4. Analyst Setup — `AnalystSetup.tsx`; uses `useAnalyst`; renders recommendationTrend buckets (strongBuy/buy/hold/sell/strongSell) as a stacked bar.
5. Sources — `Sources.tsx`; uses `useNews`; renders top news articles with publisher + relative timestamp.
</wave>

<wave id="4C">
Single executor integrates and verifies:

- Replace the five corresponding `<SectionSkeleton />` slots in
  `src/app/(dashboard)/dashboard/[ticker]/page.tsx` with `<LazySection>` wrapping
  the new components, passing `symbol` as `ticker` prop.
- Keep the remaining five slots as skeletons (AI sections land in Phase 5).
- Verify: `pnpm exec tsc --noEmit`, `pnpm vitest run`, `pnpm build` all green.
- UI verification via Chrome automation on a known ticker.
</wave>
