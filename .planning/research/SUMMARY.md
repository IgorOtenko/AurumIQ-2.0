# Project Research Summary

**Project:** AurumIQ
**Domain:** Financial Analysis Platform (AI-powered)
**Researched:** 2026-05-07
**Confidence:** HIGH

---

## Executive Summary

AurumIQ is a web-based financial analysis platform combining portfolio tracking with AI-generated research reports. No current free-tier competitor combines structured financial data (earnings estimates, analyst ratings, price history, options chain) with full-section LLM-generated narrative prose. Seeking Alpha has depth but paywalls it; TipRanks has quantitative signals but they are rules-based; Koyfin has excellent visualization but no AI layer. AurumIQ fills this gap for retail investors preparing for earnings calls by generating per-section analysis via the Claude API across 11 modular dashboard sections, each independently refreshable and pre-generated on a schedule.

The recommended architecture is a Next.js 15 full-stack application (frontend + API routes) backed by PostgreSQL on AWS RDS free tier with Claude API for analysis generation. The 11 dashboard sections follow a Skill/Plugin pattern -- each section is both a self-contained frontend React component and a corresponding backend skill executor sharing a skill_id. They handle their own data fetching, prompt construction, and rendering independently. This modular design is an engineering showcase for interviews and a practical necessity to avoid thundering herd problems with 11 concurrent API calls.

The most significant delivery risks are: (1) Yahoo Finance API instability silently corrupting data before it reaches AI prompts, (2) LLM hallucination of financial figures when context data is incomplete, (3) rate limit cascades from 11 sections fetching simultaneously on free-tier APIs, and (4) the render avalanche from mounting all 11 chart-heavy sections at once. All four are addressable with deliberate architectural decisions made before writing feature code -- but become expensive to retrofit if deferred.

---

## Key Findings

### Recommended Stack

The stack is aligned to AWS free-tier constraints, interview-quality code standards, and the modular dashboard architecture.

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 15 + React 19 | App Router + RSC; API routes replace separate backend |
| Language | TypeScript 5.x | Full-stack type safety; catches financial data shape mismatches |
| Styling | Tailwind CSS 4.x + shadcn/ui | Class-based dark mode; Radix UI accessibility primitives |
| Database | PostgreSQL 16 on AWS RDS t3.micro | Free 12 months; JSONB for AI analysis output |
| ORM | Prisma 5.x | Type-safe queries; migration tooling |
| Auth | NextAuth.js (Auth.js) v5 | JWT in httpOnly cookies; App Router middleware |
| AI | Claude API (Haiku scheduled / Sonnet on-demand) | User-provided API key model |
| Hosting | AWS EC2 t3.micro + PM2 + Nginx | 750 hrs/month free; Node.js process |
| Price Charts | Lightweight Charts (TradingView) | OHLCV candlestick/line; 40kb; purpose-built financial |
| Portfolio Charts | Recharts 2.x | Pie/area/bar for allocation metrics; simpler API |
| Data Fetching | Tanstack Query v5 + RSC | Independent loading per section; stale-while-revalidate |
| Client State | Zustand 5.x | Portfolio selection, UI state; no Redux boilerplate |
| Validation | Zod 3.x | API response shapes; AI output post-generation validation |
| Scheduling | node-cron 3.x (in-process custom server) | Pre-market + post-close analysis runs |
| Observability | OpenTelemetry + Pino | Traces to CloudWatch; structured JSON logs |
| Tables | Tanstack Table 8.x | Holdings, alerts, analysis history |

**Key version constraints:** Next.js 15 requires Auth.js v5 (NOT NextAuth v4); Tanstack Query v5 required for React 19 RSC compatibility; Tailwind v4 requires shadcn/ui 2025+ with CSS-first config; node-cron requires custom Next.js server (not next start).

---

### Expected Features

**Must Have (P0 - MVP Launch):**
- User auth (signup / login / logout / password reset)
- Portfolio CRUD (add/remove stocks with quantity and cost basis)
- Stock Ticker Bar (portfolio navigation strip)
- Stock Header (price, YTD%, earnings date, market cap, sector)
- Numbers Going In (consensus estimates + last 4 quarters revenue/EPS)
- QoQ/YoY Trend Charts (revenue + EPS visual trajectory)
- Analyst Setup (ratings breakdown, price targets, revisions)
- Bull vs Bear cards (AI-generated -- core differentiator, highest wow factor)
- Catalysts and Risks (AI bullet list)
- Live on the Call (AI pre-earnings listening agenda -- unique to market)
- Sources section (data provenance for trust)
- On-demand analysis refresh (single click)
- Dark theme UI
- Price alerts (email)
- Earnings alerts (email)
- Settings page (password, email, alert management)

**Should Have (v1.x - After Core Validation):**
- Segment Expectations (AI per-segment narrative) -- defer until API coverage confirmed
- Expected Move and Options section -- defer until options chain fetch is stable
- Scheduled daily AI generation -- add after on-demand pipeline proven stable and cost-managed
- Per-section independent refresh
- Analysis history / changelog
- CSV portfolio import
- Browser push notifications

**Defer to v2+:** Comparison view, watchlist, social layer, PWA/mobile app, international stocks, multi-portfolio support.

**Anti-features (never build):** Real-time price streaming, brokerage integration/order routing, AI price predictions, backtesting, full earnings transcripts.

**Critical path for MVP:** Auth -> Portfolio -> Yahoo Finance data -> Stock Header + Numbers Going In -> AI Pipeline -> Bull/Bear + Catalysts -> basic dashboard usable.

---

### Architecture Approach

The architecture is a Next.js full-stack modular monolith -- not microservices, not a separate Python/FastAPI backend. All API logic lives in Next.js Route Handlers. The 11 sections follow a Skill/Plugin pattern with a shared SkillBase interface.

**Major components:**

| Component | Responsibility |
|---|---|
| Next.js App Router | Dashboard routing, RSC for initial SSR data, auth middleware |
| Next.js Route Handlers | All API endpoints: stocks, analysis, alerts, auth, SSE streams |
| Skill Executor pattern | Per-section: fetchRawData() -> buildPrompt() -> callClaude() -> store() |
| Skill Registry | Dynamic skill loading; maps skill_id to executor class |
| PostgreSQL via Prisma | Users, watchlist, raw_data (JSONB), analysis (JSONB), alerts, schedules |
| node-cron scheduler | Pre-market (8:30 AM ET) and post-close (4:30 PM ET) analysis runs |
| Yahoo Finance adapter | Price, earnings, quarterly fundamentals, options chain |
| News API adapter | Recent headlines for ticker and sector context |
| Claude API client | Analysis generation; Haiku scheduled, Sonnet on-demand |
| OpenTelemetry | Traces per skill execution; token usage metrics |

**Five key architectural decisions:**

1. CQRS-lite: Write path (scheduler -> skill -> store result) fully decoupled from read path (GET analysis endpoint -> returns latest stored result). Dashboard never blocks on AI generation.

2. Skills never call external APIs directly. Raw data is pre-fetched and stored in the raw_data table. Skills read from DB -- testable and resilient when external APIs are down.

3. One focused prompt per skill. Never one giant prompt for all 11 sections -- context bloat degrades quality and prevents targeted section retry.

4. Tiered cache strategy: Browser cache (60s) -> in-memory (6h TTL analysis, 5m prices) -> PostgreSQL (authoritative) -> External APIs (last resort).

5. SSE for on-demand regeneration: User clicks Refresh -> backend enqueues task -> SSE stream notifies when complete -> frontend re-fetches. Never block UI on Claude API latency.

**Database schema essentials:**
- stocks (ticker PK, name, sector, exchange)
- users (id UUID, email, hashed_password)
- raw_data (ticker, data_type, payload JSONB, fetched_at)
- analysis (ticker, skill_id, payload JSONB, model_used, token_counts, generated_at) -- INDEX on (ticker, skill_id, generated_at DESC)
- watchlist (user_id FK, ticker, added_at)
- alerts (user_id FK, ticker, alert_type, threshold, triggered_at, enabled)
- schedules (user_id FK, ticker, skills[], run_time, timezone, enabled)

---

### Critical Pitfalls

**Pitfall 1: Yahoo Finance API Instability and Silent Data Corruption**
- Risk: HIGH -- blocks all data sections; fields return None/NaN without raising exceptions
- Prevention: Validate all field presence with .get() + fallbacks before passing to AI prompts or charts. Store raw API responses in raw_data table (dashboard shows stale-but-labeled data when API is down). Pin yfinance version. Build fallback for critical fields (Finnhub free tier).
- Phase: Backend integration -- before writing any AI prompt logic

**Pitfall 2: LLM Hallucination of Financial Figures**
- Risk: HIGH -- core value prop destroyed if discovered by users or interviewers
- Prevention: Always inject actual fetched data into every prompt. Strict system prompt: "Only reference numbers explicitly provided in the context." Post-generation validation: every number in AI output must appear in source data fed to the prompt. Display data source + timestamp with every analysis.
- Phase: AI integration phase -- before any user-facing output

**Pitfall 3: Free-Tier Rate Limit Cascades**
- Risk: HIGH -- 11 sections x concurrent fetches exhausts News API (100 req/day free) and Claude token limits immediately
- Prevention: Centralized request queue with per-API rate limiting (token bucket). Priority ordering: price/core data first, AI analysis last. Aggressive caching (1-min prices, 24h fundamentals, 6h AI). Track daily API budget with graceful degradation near limits.
- Phase: Backend architecture phase

**Pitfall 4: Render Avalanche -- 11 Chart-Heavy Sections**
- Risk: MEDIUM-HIGH -- 3-8s TTI on mid-range hardware; recovery cost HIGH if retrofitted
- Prevention: Intersection Observer lazy mounting (only render sections in viewport). React.lazy() + Suspense per section boundary. Memoize chart data transforms with useMemo. Skeleton screens for all sections. Never mount charts before data resolves.
- Phase: Frontend architecture phase -- before building all 11 sections

**Pitfall 5: API Key Exposure in Frontend Builds**
- Risk: CRITICAL -- irreversible if deployed; immediate key theft; rotate any key that ever touches git history
- Prevention: ALL financial API calls and Claude API go through backend Route Handlers only. No API key ever in frontend bundle. Use @t3-oss/env-nextjs for server-side-only env var validation. Run git-secrets pre-commit hook.
- Phase: Project setup -- Day 1, non-negotiable

**Additional pitfalls to monitor:**
- Stale AI analysis displayed without timestamps -- always show generated_at; flag analysis older than 12h visually
- NewsAPI free tier returns only headlines (~200 chars) -- design prompts for truncated data from day one
- OpenTelemetry trace volume creating unexpected CloudWatch cost -- use 1-5% sampling in production
- Prompt injection via ticker names -- sanitize all user inputs before prompt interpolation
- Cache stampede under concurrent requests -- use cache locking patterns

---

## Implications for Roadmap

This section is the primary input for roadmap construction. Phase order follows the dependency tree from FEATURES.md with risk mitigation layered in from PITFALLS.md.

### Phase 1: Foundation and Security Hardening
**Rationale:** API key exposure is catastrophic and irreversible. Auth is the dependency gate for every user-facing feature. Zero user-visible features in this phase but non-negotiable.
**Delivers:**
- Next.js 15 scaffolding (TypeScript, Tailwind v4, ESLint, Prettier, pnpm)
- @t3-oss/env-nextjs typed environment validation (server-side-only keys enforced at startup)
- git-secrets pre-commit hook for key pattern scanning
- NextAuth.js v5 auth (signup, login, logout, password reset) with JWT in httpOnly cookies
- Route protection middleware
- AWS EC2 + RDS provisioning (free tier); PM2 + Nginx setup
- Prisma schema: users table + initial migration
- Vitest + Playwright test harness configured
- Dark theme CSS tokens in globals.css (financial color palette: green/red/amber/slate)
**Addresses:** Pitfall 5 (API key exposure -- Day 1), auth as critical path gate for all user-facing features.
**Avoids:** JWT localStorage trap; dotenv without type validation; building features on insecure foundation.

### Phase 2: Data Layer and API Ingestion
**Rationale:** Every subsequent feature depends on reliable financial data. Building data adapters in isolation -- validated and cached -- prevents rate limit issues and data corruption from contaminating feature development. AI prompts must never be designed against unvalidated data shapes.
**Delivers:**
- Yahoo Finance data adapter with defensive field validation (.get() with fallbacks, NaN/None detection)
- News API adapter (headline-only design from day one -- prompts sized for truncated data)
- Prisma schema: stocks, raw_data tables
- Raw data storage pipeline (fetch -> validate -> store in raw_data JSONB)
- Centralized request queue with per-API rate limiting (token bucket per data source)
- In-memory cache layer (price: 1-min TTL, fundamentals: 24h, news: 6h)
- Unit tests covering partial responses, None/NaN fields, ETF vs stock vs ADR, missing options chain
- Fallback strategy documentation for critical fields (Finnhub free tier)
**Addresses:** Pitfall 1 (Yahoo Finance instability), Pitfall 3 (rate limit cascades), Pitfall 2 partial (no AI without validated data).
**Avoids:** Skills calling external APIs directly; building AI prompts against unvalidated data shapes.

### Phase 3: Portfolio Management and Dashboard Shell
**Rationale:** Portfolio CRUD is the user entry point driving all downstream sections. The URL-driven state pattern (/dashboard/[ticker]) and shared SectionWrapper loading/error/stale pattern must be established before 11 sections are built. Retrofitting these patterns has HIGH recovery cost per PITFALLS.md.
**Delivers:**
- Portfolio CRUD (add/remove stocks, quantities, cost basis)
- Watchlist/portfolio DB table (Prisma migration)
- Stock Ticker Bar (navigation strip showing portfolio holdings)
- Dashboard shell with 11 skeleton section placeholders
- useSectionData(ticker, skillId) shared hook pattern
- SectionWrapper component (loading skeleton, error boundary, stale indicator with generated_at)
- Dashboard route /dashboard/[ticker] -- ticker change triggers all section refetches
- Settings page shell (password change, email management)
- Error boundary per section (section failure never crashes full dashboard)
**Addresses:** Feature dependency tree (portfolio is prerequisite for all sections), Pitfall 4 partial (skeletons established), stale analysis UX from the start.
**Avoids:** Tight coupling between sections; prop drilling; missing error boundaries.

### Phase 4: Non-AI Dashboard Sections
**Rationale:** Build all data-only sections before adding AI complexity. Validates the data layer end-to-end with real financial data flowing through. Establishes the section component pattern before multiplying it across all 11 sections. Debugging is dramatically easier without LLM non-determinism.
**Delivers:**
- Stock Header section (price, YTD%, earnings date, market cap, sector)
- Numbers Going In section (consensus revenue + EPS estimates, last 4 quarters history table)
- QoQ/YoY Trend Charts (Recharts revenue bar + EPS line, memoized transforms)
- Analyst Setup section (Buy/Hold/Sell count, consensus PT, high/low PT range)
- All sections using Intersection Observer lazy mounting (render only when in viewport)
- React.lazy() + Suspense per section boundary
- Lightweight Charts integration for price history (dark theme configured)
- Tanstack Table for holdings and quarterly data tables
- Responsive table patterns (card layout mobile / table desktop)
**Addresses:** Pitfall 4 (render avalanche -- lazy mounting before all 11 chart sections exist), validates Pitfall 1 mitigations with real API data.
**Avoids:** Architectural refactor of loading patterns after all 11 sections are built.

### Phase 5: AI Pipeline and Core Analysis Sections
**Rationale:** Highest-risk, highest-value phase. Skill/Plugin pattern, prompt design, output validation, and CQRS-lite all land here. Hallucination mitigation must be built into the first skill -- not retrofitted. Recovery cost for hallucination discovered by reviewers: MEDIUM-HIGH (1-3 days plus trust damage).
**Delivers:**
- SkillBase abstract class (fetchRawData(), buildPrompt(), execute() methods)
- Skill registry (maps skill_id to executor class for dynamic loading)
- Claude API client wrapper (@anthropic-ai/sdk) with streaming support and retry/backoff logic
- Post-generation output validation (every number in AI output verified against source data in prompt context)
- System prompt anti-hallucination instruction: only reference numbers explicitly provided in context
- Prisma schema: analysis table (JSONB payload, token counts, generated_at) with composite index
- Bull vs Bear skill + section component (core differentiator)
- Catalysts and Risks skill + section component
- Live on the Call skill + section component
- On-demand analysis refresh (POST trigger -> async task -> SSE progress stream -> re-fetch on complete)
- Haiku for on-demand cost efficiency; Sonnet available as deep analysis upgrade
- Prompt caching on shared system prompt preamble (saves ~60-80% on repeated prompts)
- Token usage tracking per skill (cost visibility in settings)
- OpenTelemetry spans per skill execution (duration, token counts, model, cache hit/miss)
**Addresses:** Pitfall 2 (LLM hallucination -- built-in from first skill), CQRS-lite (no blocking on AI generation), Pitfall 3 (AI calls queued through rate-limited pipeline).
**Avoids:** One giant prompt for all 11 sections; synchronous Claude call on request path; structured DB columns for AI output (use JSONB).

### Phase 6: Alerts, Scheduling, and Retention Features
**Rationale:** Alerts bring users back. Scheduled analysis generation is the auto-refresh differentiator no competitor offers -- but must only be built after on-demand pipeline is proven stable and cost is understood.
**Delivers:**
- Price alert CRUD (create, list, delete; email notification via AWS SES)
- Earnings alert CRUD (email reminder N days before earnings date)
- Alert evaluation job (node-cron, every 5 min during market hours)
- Scheduled analysis generation (node-cron: 8:30 AM ET + 4:30 PM ET, Mon-Fri)
- Custom Next.js server (server.ts) to host scheduler in Node.js environment
- Schedule CRUD API (per-user, per-ticker, configurable run time and timezone)
- Prisma schema: alerts, schedules tables
- Alert management UI in Settings page
- Daily API budget tracking with graceful degradation warning near limits
**Addresses:** User retention (alerts), scheduled analysis differentiator, Pitfall 3 partial (budget tracking prevents surprise API exhaustion).
**Avoids:** Scheduled generation before on-demand is stable; node-cron in Edge Runtime (must use custom server).

### Phase 7: Polish, Observability, and Interview Readiness
**Rationale:** Closes the gap between working and impressive. OpenTelemetry traces make the AI pipeline a glass box -- a genuine engineering differentiator for interviewers. Error handling, accessibility, and mobile responsiveness transform a prototype into a portfolio-quality showcase.
**Delivers:**
- OpenTelemetry full integration: HTTP traces, skill execution traces, external API call traces
- Custom metrics: skill duration histogram, cache hit rate gauge, token usage counter per skill, schedule success rate
- Pino structured logging replacing all console.log
- Sampling config: 1-5% routine calls, 100% errors (prevents CloudWatch cost overrun)
- Specific actionable error messages per failure mode (not generic "Error loading data")
- Data freshness indicators on every section (generated_at timestamp; visual warning when >12h old)
- Mobile-responsive layout for holdings table (card layout on mobile)
- Color + symbol encoding for gain/loss (accessibility -- not color-only)
- Empty state designs for all charts with reason text
- E2E Playwright tests: auth flow, portfolio CRUD, dashboard render, analysis refresh
- Performance audit: Lighthouse TTI < 3s; Chrome DevTools long task profiling
**Addresses:** Pitfall 8 (OTel cost overrun -- sampling configured), Pitfall 6 (stale analysis display), all UX pitfalls in PITFALLS.md.
**Avoids:** OTEL trace volume creating surprise AWS costs; color-only gain/loss encoding.

### Phase 8: Depth Sections and Stretch Features (v1.x)
**Rationale:** Add data-quality-gated sections after confirming API coverage and core pipeline stability. High-value but dependent on empirical validation of yfinance data coverage.
**Delivers:**
- Expected Move and Options section (yfinance options chain; graceful hide when data unavailable for thin tickers)
- Segment Expectations section (per-segment AI narrative; only if coverage confirmed reliable)
- Per-section independent refresh (run single skill without full-refresh)
- Analysis history / changelog (compare AI output across time for same ticker)
- CSV portfolio import (reduce new-user friction)
**Addresses:** P1 features deferred pending data validation; per-section refresh for power users.
**Avoids:** Building options/segment sections before confirming yfinance data coverage across target ticker universe.

### Phase Ordering Rationale

Phase order derived from the dependency tree in FEATURES.md with PITFALLS.md risk mitigation layered in:

1. Security first (Phase 1): API key exposure is catastrophic and irreversible. Auth is the gate for all user-facing features.
2. Data before AI (Phase 2 before Phase 5): Building AI pipeline on unvalidated data is the primary hallucination source. Data layer must be isolated and tested first.
3. Shell before content (Phase 3 before Phase 4): useSectionData hook, SectionWrapper, and lazy loading patterns must exist before 11 sections are built. Retrofitting has HIGH recovery cost.
4. Non-AI sections before AI sections (Phase 4 before Phase 5): Validates data adapters with real API data before Claude is in the loop. Debugging without LLM non-determinism is dramatically easier.
5. On-demand before scheduled (Phase 5 before Phase 6): FEATURES.md explicitly flags this -- scheduled generation launches only after on-demand pipeline is stable and cost-managed.
6. Core loop before polish (Phase 7 last among core phases): Observability and showcase polish depends on full pipeline being complete.

### Research Flags

| Phase | Flag | Research Needed |
|---|---|---|
| Phase 2 | Yahoo Finance field coverage | Empirically test yfinance on 10-15 representative tickers (large-cap, mid-cap, ETF, ADR) to map actual field availability before designing adapters |
| Phase 2 | Finnhub vs Alpha Vantage fallback | Compare free-tier rate limits and field coverage for fields Yahoo Finance most often fails on |
| Phase 5 | Claude API cost modeling | Estimate tokens per skill x 11 skills x N tickers x 2 runs/day to project monthly cost before committing to scheduled generation |
| Phase 5 | Prompt caching eligibility | Confirm which prompt portions qualify for Anthropic prompt caching and measure actual cost savings |
| Phase 8 | yfinance options chain coverage | Audit options chain availability across representative ticker sample before building Expected Move section |
| Phase 8 | Segment data API coverage | Yahoo Finance segment data is inconsistent; audit coverage before building Segment Expectations skill |

---

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack selection | HIGH | Next.js 15 + PostgreSQL + Prisma well-validated for this scale; version compatibility documented in STACK.md |
| Feature scope (MVP) | HIGH | P0 features conservative and well-bounded; dependency tree is clear |
| Architecture pattern | HIGH | Skill/Plugin + CQRS-lite proven for async AI pipelines; modular monolith appropriate for free-tier constraints |
| Pitfall identification | HIGH | All major categories based on documented failure modes in financial SaaS |
| Yahoo Finance API stability | MEDIUM | Unofficial API; behavior must be empirically tested before finalizing data adapter design |
| Claude API cost estimates | MEDIUM | Token counts per skill vary by ticker and market conditions; model real costs in Phase 5 planning |
| Options chain data coverage | MEDIUM-LOW | yfinance options data sparse for smaller tickers; requires empirical audit before Phase 8 |
| Segment data coverage | LOW | Most inconsistent field in Yahoo Finance; defer Segment Expectations until coverage confirmed |
| News quality impact on AI output | MEDIUM | NewsAPI headline-only is a known limitation; actual AI output quality impact needs testing |
| AWS free tier adequacy | HIGH | t3.micro + RDS t3.micro well-documented as sufficient for solo/demo traffic; 12-month RDS expiry is a known planning item |

---

## Sources

Consolidated from all four research documents. Web search was unavailable during research sessions. All findings are based on direct knowledge of documented APIs, frameworks, and platforms as of August 2025 training cutoff.

**Frameworks and Libraries:**
- Next.js 15 official documentation and release notes (nextjs.org)
- React 19 release documentation
- Auth.js v5 documentation (authjs.dev)
- Prisma 5.x documentation (prisma.io)
- Tanstack Query v5 migration guide
- Tailwind CSS v4 release notes
- shadcn/ui documentation and changelog (ui.shadcn.com)
- Lightweight Charts documentation (tradingview.github.io/lightweight-charts)
- node-cron documentation (npmjs.com/package/node-cron)
- OpenTelemetry Node.js documentation (opentelemetry.io)
- Anthropic Claude API documentation: prompt caching, rate limits, streaming (docs.anthropic.com)

**Data Sources:**
- yfinance GitHub (github.com/ranaroussi/yfinance) -- known issues, schema instability history
- News API documentation (newsapi.org/docs) -- free tier limitations
- SEC EDGAR documentation (free, no key required)
- FRED API (Federal Reserve Economic Data)

**Platforms Analyzed for Feature Research:**
- Seeking Alpha, TipRanks, MarketBeat, Simply Wall St, Koyfin, Bloomberg Terminal, Yahoo Finance

**Infrastructure and Security:**
- AWS free tier specifications (aws.amazon.com/free)
- OWASP API Security Top 10
- LLM hallucination research in domain-specific applications
- Financial SaaS dashboard post-mortems and technical debt retrospectives

> Note: Re-run competitor feature research with live web access before any major product pivot. Seeking Alpha and TipRanks shipped significant AI features in 2024-2025 and may have narrowed AurumIQ differentiators since training cutoff.
