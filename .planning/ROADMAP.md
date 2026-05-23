# Roadmap: AurumIQ

**Created:** 2026-05-07
**Granularity:** Standard
**Total phases:** 8
**Total v1 requirements:** 33

## Milestone 1: v1.0

### Phase 1: Foundation & Auth

**Goal:** Scaffold the full-stack project with security-hardened infrastructure, user authentication, and a deployable dark-themed shell.
**Mode:** mvp
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, INFRA-01, INFRA-03
**Plans:** 4 plans
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Next.js 15 scaffold, Prisma User model, dark theme, env validation *(completed 2026-05-22)*

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Auth vertical slice: signup, login, logout, session persistence, route protection *(completed 2026-05-22)*

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Password reset flow: request, token, confirm, new password *(completed 2026-05-22)*

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-04-PLAN.md — Security hardening (git-secrets), auth unit tests, README + architecture docs *(completed 2026-05-22)*

**Success Criteria:**

1. A new user can sign up with email and password, log in, and have their session persist after a browser refresh.
2. A logged-in user can log out from any page and is redirected to the login screen.
3. A user who has forgotten their password can request a reset email and set a new password.
4. All pages behind auth redirect unauthenticated users to login; no API key is ever visible in the frontend bundle.
5. The deployed application renders with the dark financial theme (dark background, green/red value coding) and passes a basic Lighthouse accessibility check.

---

### Phase 2: Data Layer & API Ingestion

**Goal:** Build validated, cached financial data adapters so every downstream feature reads from a reliable, tested data store rather than raw external APIs.
**Mode:** mvp
**Requirements:** INFRA-04
**Plans:** 2 plans
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — End-to-end vertical slice: Prisma RawData model, Pino logger, yahoo-finance2 client, JSONB cache, price adapter, API route, tests *(completed 2026-05-23)*

**Wave 2** *(parallelized: 5 adapter agents + orchestrator wiring + 3 test agents)*

- [x] 02-02-PLAN.md — Remaining 5 adapters (earnings, analyst, options, profile, news), full API route wiring, comprehensive test suite (34 tests across 5 files) *(completed 2026-05-23)*

**Success Criteria:**

1. Fetching data for a given ticker (e.g., AAPL) stores price, earnings estimates, analyst ratings, and news headlines in the raw_data table with a fetched_at timestamp.
2. When Yahoo Finance returns a None/NaN for a critical field, the adapter falls back gracefully and logs a structured warning — no unhandled exception surfaces.
3. Fetching the same ticker within the cache TTL returns the stored result without making an external API call (verified via request logs).
4. Unit tests cover partial API responses, missing options chain, ETF vs stock vs ADR, and the fallback path — all passing in CI.

---

### Phase 3: Portfolio Management & Dashboard Shell *(completed 2026-05-23)*

**Goal:** Deliver end-to-end portfolio CRUD, the Stock Ticker Bar, and the dashboard shell so users can navigate to any holding and see section skeletons.
**Mode:** mvp
**Requirements:** PORT-01, PORT-02, PORT-03, PORT-04, DASH-01
**Execution:** Wave 3A foundation (Holding model, packages, QueryProvider) → Wave 3B 5 parallel agents (portfolio CRUD API ×2, StockTickerBar, PortfolioTable + AddHoldingForm, dashboard shell) → Wave 3C orchestrator wired the two top-level pages → user browser-verified.
**Success Criteria:**

1. A logged-in user can add a stock by ticker symbol and quantity; it appears immediately in their portfolio list with current market value.
2. A user can update the quantity or cost basis of a holding and remove a holding entirely.
3. The Stock Ticker Bar displays all portfolio holdings with price and performance indicator; clicking a ticker navigates to `/dashboard/[ticker]`.
4. The dashboard shell renders 11 labeled skeleton placeholders for the selected ticker, with loading states and per-section error boundaries in place.
5. A section error never crashes the full dashboard — the failed section shows an error message while all other sections continue loading.

---

### Phase 4: Non-AI Dashboard Sections *(completed 2026-05-23)*

**Goal:** Build all four data-driven dashboard sections end-to-end so users see real financial data flowing through the validated data layer.
**Mode:** mvp
**Requirements:** DASH-02, DASH-03, DASH-04, DASH-05, DASH-06
**Execution:** Wave 4A foundation (finance hooks, useInView, LazySection, lightweight-charts) → Wave 4B 5 parallel agents (StockHeader, NumbersGoingIn, QoQYoYTrend, AnalystSetup, Sources) → Wave 4C orchestrator wired sections into `/dashboard/[ticker]` → user browser-verified.
**Success Criteria:**

1. Selecting a ticker shows the Stock Header with live price, YTD performance, earnings date, market cap, and sector — all sourced from the data layer.
2. The Numbers Going In section renders consensus revenue/EPS estimates, company guidance sentiment, and a last-4-quarters table populated with real data.
3. The QoQ/YoY Trend section renders a revenue bar chart and an EPS line chart covering last 4 quarters plus the forward estimate.
4. The Analyst Setup section displays the Buy/Hold/Sell ratings breakdown, consensus price target, and recent revisions.
5. The Sources section lists all data sources and their fetch timestamps; sections lazy-mount only when scrolled into the viewport (no render avalanche on page load).

---

### Phase 5: AI Pipeline & Core Analysis Sections

**Goal:** Implement the Skill/Plugin AI pipeline with hallucination mitigations and deliver the three core AI analysis sections plus on-demand refresh.
**Mode:** mvp
**Requirements:** AI-01, AI-02, AI-03, AI-04, INFRA-04
**Success Criteria:**

1. Clicking "Refresh Analysis" triggers async AI generation; an SSE progress indicator updates in real time and the section re-renders with new content on completion — the UI never blocks.
2. The Bull vs Bear section renders AI-generated bull and bear case cards; every number in the output can be traced to data explicitly passed in the prompt context.
3. The Catalysts & Risks section renders AI-generated bullet-pointed catalysts and risks for the selected stock.
4. The Live on the Call section renders an AI-generated numbered list of key earnings call listening points.
5. Post-generation validation rejects any AI output containing financial figures not present in the source data passed to the prompt, logging a structured warning and falling back to the previous analysis.

---

### Phase 6: Alerts, Scheduling & Settings

**Goal:** Add price and earnings alerts, configurable scheduled AI generation, and a fully functional Settings page so users have both retention triggers and account control.
**Mode:** mvp
**Requirements:** ALRT-01, ALRT-02, SCHED-01, SCHED-02, SCHED-03, SET-01, SET-02, SET-03, SET-04
**Success Criteria:**

1. A user can create a price alert for a stock; when the price crosses the threshold, they receive an email notification.
2. A user can create an earnings alert; they receive an email reminder a configurable number of days before the earnings date.
3. A user can configure a daily scheduled AI analysis run for any portfolio stock with a custom time and timezone, and can disable or delete the schedule.
4. A user can view analysis history for a stock, showing past AI-generated outputs with their generation timestamps for comparison.
5. From the Settings page, a user can change their password, update their email address, and manage (create, edit, delete) all their price and earnings alerts.

---

### Phase 7: Observability, Polish & Interview Readiness

**Goal:** Integrate OpenTelemetry full-stack observability, add production-grade error handling, and achieve interview-quality documentation and UX polish.
**Mode:** mvp
**Requirements:** INFRA-02, INFRA-03
**Success Criteria:**

1. Every AI skill execution produces an OpenTelemetry trace containing skill duration, token counts, model used, and cache hit/miss status — visible in CloudWatch.
2. Custom metrics track skill duration histogram, cache hit rate, daily token usage per skill, and schedule success rate — all queryable from the observability dashboard.
3. Every dashboard section displays a data freshness timestamp; sections with AI analysis older than 12 hours show a visual staleness warning.
4. Specific actionable error messages appear per failure mode (e.g., "Yahoo Finance returned incomplete data — showing cached result from [time]") rather than generic errors.
5. The README, architecture docs, and inline API comments meet interview-quality standard; Lighthouse TTI is under 3 seconds on the dashboard page.

---

### Phase 8: Depth Sections & Stretch Features

**Goal:** Add the data-quality-gated dashboard sections (Options, Segments) and stretch features (analysis history UI, CSV import) after confirming API coverage.
**Mode:** mvp
**Requirements:** DASH-07, DASH-08
**Success Criteria:**

1. The Expected Move & Options section renders implied move, historical average, last quarter comparison, and options setup analysis for tickers with available options chain data; it hides gracefully with an explanatory message for tickers without options data.
2. The Segment Expectations section renders per-segment revenue estimates, growth percentages, and AI-written per-segment narrative for tickers with reliable segment data from Yahoo Finance.
3. Both new sections respect the lazy-mounting and SectionWrapper patterns established in Phase 3, with no regression in dashboard TTI.
4. A user can view and navigate their full analysis history for any stock directly from the dashboard.

---

## Phase Dependencies

```
Phase 1 (Foundation & Auth)
  └── Phase 2 (Data Layer)
        └── Phase 3 (Portfolio & Shell)
              ├── Phase 4 (Non-AI Sections)
              │     └── Phase 5 (AI Pipeline)
              │           └── Phase 6 (Alerts & Scheduling)
              │                 └── Phase 7 (Polish & Observability)
              │                       └── Phase 8 (Depth Sections)
              └── Phase 5 (AI Pipeline) [also depends on Phase 4]
```

**Critical path:** Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8

All phases are strictly sequential. No phase can begin until its predecessor is complete. Phase 4 and Phase 5 share a dependency on Phase 3 (shell patterns must exist before sections are built), and Phase 5 depends on Phase 4 (data sections validate the data layer before AI is introduced).

---

## Coverage

| Requirement | Phase |
|-------------|-------|
| AUTH-01 | Phase 1 |
| AUTH-02 | Phase 1 |
| AUTH-03 | Phase 1 |
| AUTH-04 | Phase 1 |
| PORT-01 | Phase 3 |
| PORT-02 | Phase 3 |
| PORT-03 | Phase 3 |
| PORT-04 | Phase 3 |
| DASH-01 | Phase 3 |
| DASH-02 | Phase 4 |
| DASH-03 | Phase 4 |
| DASH-04 | Phase 4 |
| DASH-05 | Phase 4 |
| DASH-06 | Phase 4 |
| DASH-07 | Phase 8 |
| DASH-08 | Phase 8 |
| AI-01 | Phase 5 |
| AI-02 | Phase 5 |
| AI-03 | Phase 5 |
| AI-04 | Phase 5 |
| SCHED-01 | Phase 6 |
| SCHED-02 | Phase 6 |
| SCHED-03 | Phase 6 |
| ALRT-01 | Phase 6 |
| ALRT-02 | Phase 6 |
| SET-01 | Phase 6 |
| SET-02 | Phase 6 |
| SET-03 | Phase 6 |
| SET-04 | Phase 6 |
| INFRA-01 | Phase 1 |
| INFRA-02 | Phase 7 |
| INFRA-03 | Phase 1 |
| INFRA-04 | Phase 2 |

**Coverage:** 33/33 v1 requirements mapped

---
*Roadmap created: 2026-05-07*
