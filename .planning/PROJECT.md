# AurumIQ

## What This Is

AurumIQ is a web-based financial analysis platform that combines portfolio tracking with AI-powered stock research. Users manage a stock portfolio and get deep, LLM-generated analysis for each holding — covering earnings, fundamentals, options flow, catalysts, risks, and analyst sentiment. The dashboard presents this analysis in modular sections, each independently generated and refreshable.

## Core Value

When a user selects a stock from their portfolio, they see a comprehensive, AI-generated research report that synthesizes real financial data with LLM reasoning — replacing hours of manual research with one dashboard view.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User authentication and account management (signup, login, logout, password reset)
- [ ] Portfolio management — add/remove stocks, update quantities, view holdings
- [ ] AI-powered dashboard with 11 modular analysis sections per stock
- [ ] Scheduled AI analysis generation (configurable per-stock daily schedule, cancellable)
- [ ] On-demand AI analysis generation (manual refresh button)
- [ ] Financial data ingestion from free APIs (Yahoo Finance, News API, others)
- [ ] Data storage and caching layer for financial data and generated analyses
- [ ] Price alerts — notify when a stock hits a user-defined price target
- [ ] Earnings alerts — notify before upcoming earnings dates
- [ ] Settings page — change password, update email, manage alerts
- [ ] Dark-themed UI matching the provided dashboard design screenshots
- [ ] OpenTelemetry observability integration
- [ ] Clean, well-documented codebase suitable for portfolio showcase

### Out of Scope

- Brokerage integration — this is a tracking tool, not connected to real accounts
- Real-time streaming data — batch/on-demand is sufficient for v1
- Mobile app — web-first, responsive design only
- Social features — no sharing, comments, or multi-user collaboration in v1
- Paid data sources — free APIs only for now
- Options trading features — display options data for analysis, no trading

## Context

**Purpose:** Solo project built for personal use and as a job interview portfolio piece. The codebase needs to demonstrate strong software engineering practices — clean architecture, modularity, testing, documentation, and observability. Future potential to expand into a shared product for a small group, and eventually a public platform.

**Dashboard Architecture:** Each of the 11 dashboard sections is a self-contained component ("skill") with its own data fetching logic, analysis generation pipeline, and rendering. This modular design supports independent development, testing, and future extensibility.

**Dashboard Sections:**
1. **Stock Ticker Bar** — horizontal scrollable bar showing portfolio stocks with performance indicators
2. **Stock Header** — selected stock's name, last price, YTD performance, implied move, earnings date
3. **Numbers Going In** — consensus estimates (revenue, EPS), company guidance, sentiment, last 4 quarters table
4. **QoQ/YoY Trend** — revenue trend bar chart + EPS trend line chart (last 4 quarters + estimate)
5. **Segment Expectations** — business segments with revenue estimates, growth %, and AI-written analysis per segment
6. **Expected Move & Options** — implied move, historical average, last quarter comparison, options setup analysis
7. **Bull vs Bear** — side-by-side AI-generated bull case and bear case cards
8. **Catalysts & Risks** — split view with bullet-pointed key catalysts and key risks
9. **Live on the Call** — numbered list of key items to listen for during earnings calls
10. **Analyst Setup** — analyst ratings, price targets, and recent revisions
11. **Sources** — references and data sources backing the analysis

**AI Pipeline:** Claude API (user's API key) generates analysis content. The LLM receives structured financial data fetched from free APIs and stored in the database, then produces the narrative sections. Two generation modes: configurable scheduled generation (daily, per-stock, cancellable) and on-demand generation triggered by a button on the dashboard.

**Data Sources:** Free-tier external APIs — Yahoo Finance for market data, News API for news sentiment, and additional free sources identified during research. All fetched data is stored in a database to reduce API calls and provide historical context to the LLM.

**Infrastructure:** AWS free-tier services for compute, storage, and deployment. Specific service choices (Lambda vs EC2, DynamoDB vs RDS PostgreSQL, etc.) to be determined during research phase. OpenTelemetry for observability across the full stack.

**Design Reference:** Screenshots in `Screenshots/` folder show the target dashboard design — dark theme, card-based layout, financial data visualization with charts and tables, green/red color coding for positive/negative values.

## Constraints

- **Budget**: AWS free tier only — no paid infrastructure services for v1
- **Data Sources**: Free APIs only — no Bloomberg, Refinitiv, or paid financial data
- **LLM**: Claude API via user's API key — budget-conscious prompt design
- **Auth**: Must support proper user management (signup, login, password reset, session management)
- **Documentation**: Interview-quality — README, architecture docs, inline comments, API docs
- **Modularity**: Each dashboard section must be an independent component with its own data/logic layer

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Modular dashboard sections | Each section is a self-contained skill with own data pipeline — supports independent development, testing, and future API extensibility | — Pending |
| Claude API for LLM | User has existing API key, consistent with tooling ecosystem | — Pending |
| Free-tier AWS | Budget constraint for solo project; sufficient for personal use and demo | — Pending |
| Tracking-only portfolio | Reduces complexity, avoids brokerage API integration; can add later | — Pending |
| Dark theme | Matches provided design screenshots; standard for financial dashboards | — Pending |
| OpenTelemetry | Production-grade observability demonstrates engineering maturity for interviews | — Pending |
| Dual generation modes | Scheduled (daily) + on-demand covers both passive monitoring and active research | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-07 after initialization*
