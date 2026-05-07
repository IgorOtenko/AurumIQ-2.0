# Architecture Research

**Domain:** Financial Analysis Platform (AI-powered)
**Researched:** 2026-05-07
**Confidence:** HIGH

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AURUMIQ SYSTEM                                 │
│                                                                             │
│  ┌──────────────────────────────────────────────────────┐                  │
│  │                    FRONTEND (Next.js)                 │                  │
│  │                                                       │                  │
│  │  ┌──────────┐  ┌──────────────────────────────────┐  │                  │
│  │  │ Auth /   │  │     Dashboard (per-ticker)        │  │                  │
│  │  │ Settings │  │                                   │  │                  │
│  │  └──────────┘  │  ┌────────┐ ┌────────┐ ┌──────┐  │  │                  │
│  │                │  │Section │ │Section │ │ ...  │  │  │                  │
│  │  ┌──────────┐  │  │  S01   │ │  S02   │ │ S11  │  │  │                  │
│  │  │Portfolio │  │  └────────┘ └────────┘ └──────┘  │  │                  │
│  │  │  Page    │  └──────────────────────────────────┘  │                  │
│  │  └──────────┘                                         │                  │
│  └─────────────────────────┬────────────────────────────┘                  │
│                             │ HTTPS / REST + SSE                            │
│  ┌──────────────────────────▼────────────────────────────┐                 │
│  │                   BACKEND API (FastAPI)                │                 │
│  │                                                        │                 │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │                 │
│  │  │ /api/stocks  │  │ /api/analysis│  │ /api/alerts │  │                 │
│  │  │ /api/skills  │  │ /api/schedule│  │ /api/auth   │  │                 │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │                 │
│  │         │                 │                  │          │                 │
│  │  ┌──────▼─────────────────▼──────────────────▼──────┐  │                 │
│  │  │              Service Layer                        │  │                 │
│  │  │  StockService  AnalysisService  AlertService      │  │                 │
│  │  │  SkillOrchestrator  SchedulerService              │  │                 │
│  │  └──────┬─────────────────┬──────────────────────────┘  │                 │
│  └─────────┼─────────────────┼──────────────────────────────┘                │
│            │                 │                                                │
│  ┌─────────▼──────┐  ┌───────▼──────────────────────────────┐               │
│  │   PostgreSQL   │  │         AI PIPELINE                   │               │
│  │   (RDS free)   │  │                                       │               │
│  │                │  │  ┌────────────────────────────────┐   │               │
│  │  - stocks      │  │  │  Skill Executor                │   │               │
│  │  - analysis    │  │  │  (one per section type)        │   │               │
│  │  - raw_data    │  │  │  fetch_data() → build_prompt() │   │               │
│  │  - schedules   │  │  │  → call_claude() → store()     │   │               │
│  │  - alerts      │  │  └────────────────────────────────┘   │               │
│  │  - users       │  │                │                       │               │
│  └────────────────┘  │  ┌─────────────▼──────────────────┐   │               │
│                       │  │  Claude API (claude-3-5-sonnet)│   │               │
│  ┌────────────────┐   │  │  Prompt caching enabled        │   │               │
│  │   Redis        │   │  └────────────────────────────────┘   │               │
│  │  (ElastiCache) │   └───────────────────────────────────────┘               │
│  │                │                                                            │
│  │  - API cache   │   ┌────────────────────────────────────────────────────┐  │
│  │  - rate limits │   │         DATA INGESTION                             │  │
│  │  - job queue   │   │                                                    │  │
│  └────────────────┘   │  APScheduler / Celery Beat                         │  │
│                       │  ┌────────────┐  ┌──────────┐  ┌────────────────┐  │  │
│  ┌────────────────┐   │  │Yahoo Fin.  │  │News API  │  │ Other Free APIs│  │  │
│  │  OpenTelemetry │   │  │(yfinance)  │  │          │  │ (FRED, SEC)    │  │  │
│  │  Collector     │   │  └────────────┘  └──────────┘  └────────────────┘  │  │
│  │  → CloudWatch  │   └────────────────────────────────────────────────────┘  │
│  └────────────────┘                                                            │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|---------------|----------------------|
| **Next.js Frontend** | Dashboard rendering, routing, auth state, real-time updates via SSE | Next.js 14+ App Router, React Server Components for initial load, Client Components for interactive sections |
| **FastAPI Backend** | REST API, request validation, auth middleware, background task dispatch | FastAPI with Pydantic v2 models, JWT auth, async handlers throughout |
| **Skill Executor** | Per-section data fetch + prompt construction + Claude call + result storage | One Python class per skill type, implementing a common `SkillBase` interface |
| **PostgreSQL** | Persistent storage for stocks, analysis results, user settings, schedules, alerts | AWS RDS `db.t3.micro` (free tier), SQLAlchemy async ORM |
| **Redis** | Short-term API response caching, rate-limit counters, Celery task queue | AWS ElastiCache `cache.t3.micro`, TTL-based key expiry |
| **APScheduler / Celery** | Scheduled daily analysis runs per stock, configurable per-user | Celery Beat for distributed scheduling, APScheduler as simpler alternative for single-node |
| **Claude API** | LLM analysis generation from structured financial data | Anthropic Python SDK with prompt caching on shared system prompt |
| **OpenTelemetry** | Distributed tracing and metrics across frontend, backend, AI pipeline | OTLP collector sidecar → AWS CloudWatch |
| **Yahoo Finance / News API** | External financial data source (free tier) | `yfinance` Python library + News API REST client |

---

## Recommended Project Structure

```
aurumiq/
├── frontend/                          # Next.js application
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx             # Dark shell with ticker strip
│   │   │   ├── dashboard/
│   │   │   │   └── [ticker]/
│   │   │   │       └── page.tsx       # Composes all 11 sections
│   │   │   ├── portfolio/
│   │   │   │   └── page.tsx
│   │   │   └── settings/
│   │   │       └── page.tsx
│   │   └── api/                       # Next.js API routes (thin BFF layer)
│   │       └── stream/[ticker]/route.ts  # SSE proxy to backend
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TickerStrip.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── DashboardShell.tsx
│   │   ├── sections/                  # THE 11 MODULAR SKILL COMPONENTS
│   │   │   ├── _base/
│   │   │   │   ├── SectionWrapper.tsx    # Loading/error/stale states
│   │   │   │   └── useSectionData.ts     # Shared data-fetch hook
│   │   │   ├── NumbersGoingIn/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── ConsensusCard.tsx
│   │   │   │   ├── LastFourQuarters.tsx
│   │   │   │   └── types.ts
│   │   │   ├── QoQYoYTrend/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── RevenueTrendChart.tsx
│   │   │   │   ├── EPSTrendChart.tsx
│   │   │   │   └── types.ts
│   │   │   ├── SegmentExpectations/
│   │   │   ├── ExpectedMoveOptions/
│   │   │   ├── BullVsBear/
│   │   │   ├── CatalystsAndRisks/
│   │   │   ├── LiveOnTheCall/
│   │   │   ├── AnalystSetup/
│   │   │   ├── TechnicalSetup/        # (additional sections)
│   │   │   ├── MacroContext/
│   │   │   └── PositionSizing/
│   │   ├── ui/                        # Shared primitive components
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── Chart.tsx              # Recharts wrapper
│   │   └── alerts/
│   │       └── AlertBanner.tsx
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts              # Typed fetch wrapper
│   │   │   └── endpoints.ts
│   │   ├── store/
│   │   │   ├── dashboardStore.ts      # Zustand store
│   │   │   └── portfolioStore.ts
│   │   ├── hooks/
│   │   │   ├── useTickerData.ts
│   │   │   └── useAlerts.ts
│   │   └── utils/
│   │       ├── formatters.ts
│   │       └── constants.ts
│   ├── styles/
│   │   └── globals.css                # Tailwind + dark theme tokens
│   └── public/
│
├── backend/                           # FastAPI application
│   ├── app/
│   │   ├── main.py                    # FastAPI app factory
│   │   ├── config.py                  # Pydantic Settings (env-driven)
│   │   ├── deps.py                    # Dependency injection (DB, Redis, auth)
│   │   │
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── router.py          # Aggregates all sub-routers
│   │   │   │   ├── stocks.py          # GET /stocks/{ticker}
│   │   │   │   ├── analysis.py        # GET /analysis/{ticker}/{skill_id}
│   │   │   │   ├── skills.py          # POST /skills/{ticker}/run
│   │   │   │   ├── schedule.py        # CRUD /schedule
│   │   │   │   ├── alerts.py          # CRUD /alerts
│   │   │   │   ├── auth.py            # POST /auth/login, /auth/register
│   │   │   │   └── stream.py          # GET /stream/{ticker} (SSE)
│   │   │
│   │   ├── models/                    # SQLAlchemy ORM models
│   │   │   ├── stock.py
│   │   │   ├── analysis.py
│   │   │   ├── raw_data.py
│   │   │   ├── schedule.py
│   │   │   ├── alert.py
│   │   │   └── user.py
│   │   │
│   │   ├── schemas/                   # Pydantic request/response schemas
│   │   │   ├── stock.py
│   │   │   ├── analysis.py
│   │   │   └── alert.py
│   │   │
│   │   ├── services/                  # Business logic layer
│   │   │   ├── stock_service.py
│   │   │   ├── analysis_service.py
│   │   │   ├── alert_service.py
│   │   │   ├── schedule_service.py
│   │   │   └── skill_orchestrator.py  # Runs skills, stores results
│   │   │
│   │   ├── skills/                    # THE 11 MODULAR SKILL EXECUTORS
│   │   │   ├── base.py                # SkillBase ABC
│   │   │   ├── registry.py            # SKILL_REGISTRY dict
│   │   │   ├── numbers_going_in.py
│   │   │   ├── qoq_yoy_trend.py
│   │   │   ├── segment_expectations.py
│   │   │   ├── expected_move_options.py
│   │   │   ├── bull_vs_bear.py
│   │   │   ├── catalysts_and_risks.py
│   │   │   ├── live_on_the_call.py
│   │   │   ├── analyst_setup.py
│   │   │   ├── technical_setup.py
│   │   │   ├── macro_context.py
│   │   │   └── position_sizing.py
│   │   │
│   │   ├── ingestion/                 # External data adapters
│   │   │   ├── yahoo_finance.py
│   │   │   ├── news_api.py
│   │   │   ├── sec_edgar.py
│   │   │   └── fred.py
│   │   │
│   │   ├── scheduler/
│   │   │   ├── celery_app.py          # Celery + Redis broker config
│   │   │   ├── tasks.py               # Task definitions
│   │   │   └── beat_schedule.py       # Periodic task registry
│   │   │
│   │   ├── ai/
│   │   │   ├── claude_client.py       # Anthropic SDK wrapper
│   │   │   └── prompt_cache.py        # Shared system prompt builder
│   │   │
│   │   ├── observability/
│   │   │   ├── tracer.py              # OTEL tracer setup
│   │   │   └── middleware.py          # Request tracing middleware
│   │   │
│   │   └── db/
│   │       ├── session.py             # Async SQLAlchemy engine
│   │       └── migrations/            # Alembic
│   │           └── versions/
│   │
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── test_skills/
│   │   │   └── test_services/
│   │   └── integration/
│   │
│   ├── pyproject.toml
│   └── Dockerfile
│
├── infra/                             # AWS infrastructure
│   ├── terraform/                     # Or CDK
│   │   ├── main.tf
│   │   ├── rds.tf
│   │   ├── elasticache.tf
│   │   ├── ecs.tf
│   │   └── cloudwatch.tf
│   └── docker-compose.yml             # Local dev
│
└── .planning/
    ├── research/
    │   └── ARCHITECTURE.md
    └── ROADMAP.md
```

---

## Architectural Patterns

### 1. Skill/Plugin Pattern for Dashboard Sections

Each of the 11 sections is both a **frontend component** and a **backend skill executor** that share the same `skill_id`. They are fully self-contained: the backend skill owns its data-fetch logic and prompt, the frontend component owns its rendering.

**Backend — `SkillBase` ABC:**
```python
# backend/app/skills/base.py
from abc import ABC, abstractmethod
from typing import Any

class SkillBase(ABC):
    skill_id: str                   # e.g. "bull_vs_bear"
    display_name: str               # e.g. "Bull vs Bear"
    required_data_sources: list[str]  # e.g. ["yahoo_finance", "news_api"]
    cache_ttl_hours: int = 6        # How stale is acceptable

    @abstractmethod
    async def fetch_raw_data(self, ticker: str) -> dict[str, Any]:
        """Pull structured data from external APIs / DB."""
        ...

    @abstractmethod
    def build_prompt(self, ticker: str, raw_data: dict) -> str:
        """Construct the Claude prompt from structured data."""
        ...

    async def execute(self, ticker: str) -> dict:
        raw = await self.fetch_raw_data(ticker)
        prompt = self.build_prompt(ticker, raw)
        analysis = await claude_client.generate(prompt)
        return {"raw_data": raw, "analysis": analysis}
```

**Registry pattern** enables dynamic skill loading:
```python
# backend/app/skills/registry.py
SKILL_REGISTRY: dict[str, type[SkillBase]] = {
    "numbers_going_in": NumbersGoingInSkill,
    "bull_vs_bear": BullVsBearSkill,
    # ... all 11
}
```

**Frontend — shared `useSectionData` hook:**
```typescript
// frontend/components/sections/_base/useSectionData.ts
export function useSectionData<T>(ticker: string, skillId: string) {
  return useSWR<SectionData<T>>(
    `/api/v1/analysis/${ticker}/${skillId}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
}
```

Each section component wraps itself in `SectionWrapper` which handles loading skeletons, error states, and stale-data indicators uniformly.

---

### 2. Backend: Modular Monolith (NOT microservices)

**Recommendation:** Start with a **modular monolith** inside a single FastAPI process.

Rationale:
- AWS free tier does not support multiple independent services economically
- All 11 skills share the same DB connection pool and Redis instance
- Skills are already decoupled via the SkillBase interface — can be extracted later
- Celery workers can run as a separate process on the same EC2 instance

The internal module boundaries (api / services / skills / ingestion / ai / scheduler) enforce separation of concerns without the operational overhead of microservices.

**Scale-out path:** When traffic demands it, extract the AI pipeline workers into separate Celery worker processes or ECS tasks, pointing at the same DB/Redis.

---

### 3. CQRS-Lite for Analysis Results

Analysis generation (write path) is fully decoupled from reading results (read path):

- **Write path:** Scheduler triggers Celery task → Skill executes → Result stored in `analysis` table
- **Read path:** Frontend calls `GET /analysis/{ticker}/{skill_id}` → returns latest stored result (< 1ms)

This means the frontend never blocks on AI generation. Results are pre-computed and served from DB.

**On-demand flow:** User clicks "Refresh" → POST `/skills/{ticker}/run` → Celery task enqueued → SSE stream notifies frontend when done → frontend re-fetches.

---

### 4. API Design: Resource-Oriented REST

```
GET  /api/v1/stocks/{ticker}                    → Stock metadata + price
GET  /api/v1/analysis/{ticker}                  → All 11 sections (latest)
GET  /api/v1/analysis/{ticker}/{skill_id}        → Single section (latest)
POST /api/v1/skills/{ticker}/run                 → Trigger on-demand regeneration
POST /api/v1/skills/{ticker}/run/{skill_id}      → Run single skill
GET  /api/v1/stream/{ticker}                     → SSE: live generation progress
GET  /api/v1/schedule                            → List schedules
POST /api/v1/schedule                            → Create schedule
PATCH /api/v1/schedule/{id}                      → Update (enable/disable, time)
GET  /api/v1/alerts                              → List alerts
POST /api/v1/alerts                              → Create alert
DELETE /api/v1/alerts/{id}
POST /api/v1/auth/login
POST /api/v1/auth/register
POST /api/v1/auth/refresh
```

All responses include a `generated_at` timestamp so the frontend can show staleness.

---

### 5. Prompt Engineering Pattern: Structured-Data-First

**Anti-pattern:** Sending raw HTML or unstructured text to Claude.
**Pattern:** Build a structured JSON blob from fetched data, then format it as a clean markdown prompt.

```python
def build_prompt(self, ticker: str, raw_data: dict) -> str:
    return f"""You are a professional equity analyst writing a pre-earnings brief.

## Company
Ticker: {ticker}
Name: {raw_data['name']}
Market Cap: {raw_data['market_cap']}

## Last 4 Quarters (Revenue, EPS, Beat/Miss)
{format_table(raw_data['quarterly_results'])}

## Consensus Estimates for Upcoming Quarter
Revenue Estimate: {raw_data['consensus']['revenue_est']}
EPS Estimate: {raw_data['consensus']['eps_est']}
Company Guide: {raw_data['consensus']['guidance_range']}

## Task
Write a Bull Case and Bear Case analysis. Each case should be 3-5 sentences.
Focus on the most material risks and catalysts for the upcoming earnings print.

Return JSON: {{"bull_case": "...", "bear_case": "..."}}"""
```

**Prompt caching:** The static system-level instruction block is cached using Anthropic's prompt caching feature (cache_control: ephemeral on the system message). This cuts token costs significantly when regenerating multiple skills for the same ticker in a batch.

---

## Data Flow

### Request Flow (Dashboard Load)

```
Browser                   Next.js              FastAPI              DB/Cache
  │                         │                     │                    │
  │ GET /dashboard/PLTR     │                     │                    │
  │────────────────────────►│                     │                    │
  │                         │ GET /api/v1/        │                    │
  │                         │ analysis/PLTR       │                    │
  │                         │────────────────────►│                    │
  │                         │                     │ SELECT * WHERE     │
  │                         │                     │ ticker='PLTR'      │
  │                         │                     │ AND generated_at   │
  │                         │                     │ > NOW()-6h         │
  │                         │                     │───────────────────►│
  │                         │                     │◄───────────────────│
  │                         │◄────────────────────│ {11 section blobs} │
  │◄────────────────────────│ SSR HTML + data      │                    │
  │                         │                     │                    │
  │ [Section renders with   │                     │                    │
  │  stored AI text]        │                     │                    │
```

### On-Demand Regeneration Flow

```
Browser              FastAPI         Redis/Celery         Skill Executor      Claude API
  │                    │                  │                     │                  │
  │ POST /skills/      │                  │                     │                  │
  │ PLTR/run/bull_vs_  │                  │                     │                  │
  │ bear               │                  │                     │                  │
  │───────────────────►│                  │                     │                  │
  │                    │ enqueue task     │                     │                  │
  │                    │─────────────────►│                     │                  │
  │ 202 Accepted       │                  │                     │                  │
  │◄───────────────────│                  │                     │                  │
  │                    │                  │                     │                  │
  │ GET /stream/PLTR   │                  │ dequeue + run       │                  │
  │ (SSE)              │                  │────────────────────►│                  │
  │───────────────────►│                  │                     │ fetch_raw_data() │
  │                    │                  │                     │─────────────────►│
  │                    │                  │                     │ (yfinance, etc.) │
  │                    │                  │                     │◄─────────────────│
  │                    │                  │                     │ build_prompt()   │
  │                    │                  │                     │ call Claude API  │
  │                    │                  │                     │──────────────────►│
  │                    │                  │                     │ stream tokens    │
  │                    │                  │                     │◄──────────────────│
  │                    │                  │                     │ store result     │
  │                    │                  │◄────────────────────│ (DB)             │
  │ event: complete    │◄─────────────────│                     │                  │
  │◄───────────────────│                  │                     │                  │
  │ [refetch section]  │                  │                     │                  │
```

### Scheduled Analysis Flow

```
APScheduler/Celery Beat          Skill Orchestrator             DB
        │                               │                        │
        │ Trigger (daily, per ticker)   │                        │
        │──────────────────────────────►│                        │
        │                               │ For each ticker in     │
        │                               │ user schedules:        │
        │                               │ run all 11 skills      │
        │                               │ (parallel, async)      │
        │                               │───────────────────────►│
        │                               │ Store 11 results       │
        │                               │◄───────────────────────│
        │◄──────────────────────────────│ Done                   │
```

### State Management

**Frontend state is split by concern:**

| Store | Library | Scope | Content |
|-------|---------|-------|---------|
| **Server state** | SWR or TanStack Query | Per-component | API data, loading/error states, cache invalidation |
| **UI state** | Zustand | Global | Active ticker, expanded sections, theme prefs |
| **URL state** | Next.js router | Page-level | Selected ticker (`/dashboard/PLTR`), tab state |
| **Form state** | React Hook Form | Local | Alert creation, schedule config, settings |

**Key principle:** Dashboard section components do NOT share state with each other. Each section fetches its own data slice independently via `useSectionData(ticker, skillId)`. The ticker is the only shared parameter, passed via URL.

**SWR key pattern:**
```typescript
const key = `/api/v1/analysis/${ticker}/${skillId}`;
// On ticker change (user clicks UBER in strip), all 11 sections
// automatically refetch because their SWR keys all change.
```

---

## Key Data Flows

### External Data Ingestion Flow

```
Yahoo Finance (yfinance)
  → price, earnings dates, quarterly financials, segment data
  → raw_data table (JSON blob keyed by ticker + data_type + fetched_at)

News API
  → recent headlines for ticker + sector
  → raw_data table

SEC EDGAR (free, no key required)
  → 10-K/10-Q filings (optional, for deeper fundamentals)
  → raw_data table

FRED (Federal Reserve Economic Data, free)
  → macro indicators (interest rates, CPI, etc.)
  → raw_data table
```

Raw data is stored in a `raw_data` table as JSONB. Skills read from this table rather than hitting external APIs directly during AI generation. This separation means:
1. Rate limit failures don't block analysis generation
2. Historical raw data is retained for future re-analysis
3. External API calls can be cached and deduplicated

### Alert Evaluation Flow

```
Celery Beat (every 5 min)
  → AlertEvaluator.run()
  → Fetch current prices from Yahoo Finance
  → Compare against user alert thresholds
  → Trigger notification (email / in-app SSE) if threshold crossed
  → Mark alert as triggered in DB
```

---

## Scheduling Architecture

### Schedule Data Model

```sql
CREATE TABLE schedules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    ticker      VARCHAR(10) NOT NULL,
    skills      TEXT[] NOT NULL DEFAULT ARRAY['all'],  -- or specific skill IDs
    run_time    TIME NOT NULL DEFAULT '06:00',          -- local time
    timezone    VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Celery Task Design

```python
# backend/app/scheduler/tasks.py
@celery_app.task(bind=True, max_retries=3, default_retry_delay=300)
async def run_scheduled_analysis(self, ticker: str, skill_ids: list[str]):
    try:
        orchestrator = SkillOrchestrator()
        results = await orchestrator.run_skills(ticker, skill_ids)
        await store_results(results)
    except ExternalAPIError as exc:
        raise self.retry(exc=exc)
```

**Key scheduling decisions:**
- Daily schedule runs at user-configured time (default: 6 AM ET, before market open)
- Skills for a single ticker run in parallel (asyncio.gather)
- Multiple tickers are processed serially to avoid hammering Claude API rate limits
- Celery retry logic handles transient external API failures

---

## Scaling Considerations

### Within AWS Free Tier

| Resource | Free Tier Limit | AurumIQ Usage Pattern | Mitigation |
|----------|----------------|----------------------|------------|
| EC2 t3.micro | 750 hrs/month | Backend + Celery worker on same instance | Use gunicorn with 2 workers |
| RDS t3.micro | 750 hrs/month | PostgreSQL, ~100MB for typical use | Index `(ticker, skill_id, generated_at)` |
| ElastiCache | 750 hrs/month | Redis for cache + Celery broker | Keep TTLs tight; use DB as fallback |
| Claude API | Pay per token | ~11 skills × N tickers × 1/day | Prompt caching saves ~60-80% on repeated system prompts |

### Optimization Strategies

**Prompt caching (most impactful):**
```python
# Cache the static instruction block across all runs
messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": SHARED_ANALYST_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"}  # Cached by Anthropic
            },
            {
                "type": "text",
                "text": dynamic_data_prompt  # Unique per ticker/skill/time
            }
        ]
    }
]
```

**Tiered cache strategy:**
```
L1: SWR browser cache (60s dedup interval) — zero network
L2: Redis cache (6h TTL for analysis, 5m TTL for prices) — sub-ms
L3: PostgreSQL (authoritative store) — indexed reads < 5ms
L4: External APIs (yfinance, News API) — 100-500ms, rate-limited
```

**Stale-while-revalidate pattern:**
- Frontend always shows the last-stored result immediately (no spinners for returning users)
- Background re-generation is triggered if result is older than `cache_ttl_hours`
- `generated_at` timestamp shows users how fresh the analysis is

### When to Break Out of the Monolith

| Trigger | Action |
|---------|--------|
| > 50 tickers tracked by users | Move Celery workers to separate ECS task |
| Claude API latency > 30s per skill | Implement streaming response with SSE to frontend |
| > 1000 active users | Add read replica for PostgreSQL |
| Analysis generation > 5 min/ticker | Shard skill execution across multiple worker processes |

---

## Anti-Patterns

| Anti-Pattern | Why It's a Problem | Correct Approach |
|---|---|---|
| **Calling external APIs during HTTP request** | Blocks the response thread, hits rate limits, adds latency | Pre-fetch to `raw_data` table; serve from DB |
| **Generating AI analysis synchronously on demand** | Claude API calls take 5-30s; frontend times out | Always async via Celery; use SSE for progress |
| **One giant dashboard component** | Impossible to add sections independently; rerenders everything | 11 independent section components with isolated SWR keys |
| **Sharing state between sections via prop drilling** | Tight coupling, prevents independent section data loading | Ticker in URL; each section fetches its own slice via shared hook |
| **Storing analysis as structured DB columns** | Adding a new section requires schema migration | Store AI output as JSONB blob; each skill schema is self-contained |
| **Polling for job completion** | Hammers the backend; poor UX | SSE stream from backend; event-driven state update |
| **One monolithic Claude prompt for all 11 sections** | Context bloat, poor quality, impossible to retry one section | One focused prompt per skill; results composed on frontend |
| **No staleness indicators** | User doesn't know if they're looking at 3-day-old analysis | Always show `generated_at`; visual indicator when > 12h old |
| **Fetching all sections before rendering any** | Slow perceived load; sections appear to hang together | Parallel independent fetches; sections render as they resolve |

---

## Integration Points

### External Services

| Service | Integration Method | Auth | Rate Limits | Fallback |
|---------|------------------|------|-------------|----------|
| **Yahoo Finance** | `yfinance` Python lib (unofficial API) | None required | Soft; add 0.5s delay between requests | Use cached `raw_data` table |
| **News API** | REST (`newsapi.org`) | API key (free: 100 req/day) | 100/day on free tier | Store last N articles in DB |
| **SEC EDGAR** | REST (free, no key) | None | Generous | Cache 10-Q/10-K raw JSON |
| **FRED** | REST (`fredapi` or direct) | API key (free) | 120/min | Macro data changes slowly; cache 24h |
| **Claude API** | Anthropic Python SDK | API key | 60k tokens/min (Sonnet) | Queue + retry with exponential backoff |
| **AWS SES / SNS** | Boto3 | IAM role | - | Log to DB; retry queue |

### Internal Boundaries

```
Frontend ←→ Backend:     REST JSON over HTTPS; SSE for streaming
Backend ←→ DB:           SQLAlchemy async (asyncpg driver)
Backend ←→ Redis:        aioredis (async)
Backend ←→ Celery:       Redis as broker; task results in Redis
Celery workers ←→ DB:    Direct SQLAlchemy (shared connection pool)
Skills ←→ Claude API:    Anthropic SDK; all calls go through claude_client.py
Skills ←→ Ingestion:     Ingestion adapters return typed Pydantic models
```

**Critical boundary: Skills never call external APIs directly.** They read from `raw_data` table. The ingestion layer is solely responsible for populating that table. This makes skills testable (mock the DB) and resilient (can re-run even if APIs are down).

### Auth Boundary

```
Frontend: JWT stored in httpOnly cookie (not localStorage)
Backend: FastAPI Depends(get_current_user) on all protected routes
Celery tasks: System-level (no user context needed for scheduled jobs)
User-owned data: schedules, alerts, portfolio watchlist scoped to user_id FK
```

---

## Database Schema (Key Tables)

```sql
-- Core tables
stocks          (ticker PK, name, sector, exchange, updated_at)
users           (id UUID PK, email, hashed_password, created_at)
raw_data        (id, ticker, data_type, payload JSONB, fetched_at)
analysis        (id, ticker, skill_id, payload JSONB, model_used,
                 prompt_tokens, completion_tokens, generated_at)
                 INDEX: (ticker, skill_id, generated_at DESC)
schedules       (id, user_id FK, ticker, skills TEXT[], run_time,
                 timezone, enabled, last_run_at)
alerts          (id, user_id FK, ticker, alert_type, threshold,
                 triggered_at, enabled)
watchlist       (user_id FK, ticker, added_at, notes)
```

---

## OpenTelemetry Integration

```python
# backend/app/observability/tracer.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

# Each Celery task and HTTP handler gets auto-instrumented spans.
# Skill execution adds custom attributes:
with tracer.start_as_current_span("skill.execute") as span:
    span.set_attribute("skill.id", skill_id)
    span.set_attribute("ticker", ticker)
    span.set_attribute("claude.model", model)
    span.set_attribute("claude.prompt_tokens", usage.input_tokens)
    span.set_attribute("claude.completion_tokens", usage.output_tokens)
```

Key metrics to track:
- `skill.execution.duration` (histogram, by skill_id)
- `claude.tokens.used` (counter, by skill_id — cost tracking)
- `external_api.fetch.duration` (histogram, by source)
- `analysis.cache.hit_rate` (gauge)
- `schedule.run.success_rate` (gauge, by ticker)

---

## Sources

*Web search was unavailable during this research session. The following documents and resources informed this architecture:*

- Anthropic Documentation — Prompt Caching: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- Anthropic Documentation — Claude API Python SDK: https://docs.anthropic.com/en/api/getting-started
- FastAPI Documentation — Async SQL: https://fastapi.tiangolo.com/tutorial/sql-databases/
- Celery Documentation — Periodic Tasks: https://docs.celeryq.dev/en/stable/userguide/periodic-tasks.html
- Next.js Documentation — App Router Data Fetching: https://nextjs.org/docs/app/building-your-application/data-fetching
- SWR Documentation: https://swr.vercel.app/docs/getting-started
- OpenTelemetry Python SDK: https://opentelemetry.io/docs/languages/python/
- AWS Free Tier Limits: https://aws.amazon.com/free/
- yfinance GitHub: https://github.com/ranaroussi/yfinance
- News API Documentation: https://newsapi.org/docs

*Architecture patterns are based on established practices for financial SaaS dashboards, CQRS-lite for read-heavy systems, and modular monolith design as documented in domain-driven design literature.*
