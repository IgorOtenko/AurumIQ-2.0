# Requirements: AurumIQ

**Defined:** 2026-05-07
**Core Value:** When a user selects a stock from their portfolio, they see a comprehensive, AI-generated research report that synthesizes real financial data with LLM reasoning — replacing hours of manual research with one dashboard view.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can create an account with email and password
- [ ] **AUTH-02**: User can log in and session persists across browser refresh
- [ ] **AUTH-03**: User can log out from any page
- [ ] **AUTH-04**: User can reset password via email link

### Portfolio Management

- [ ] **PORT-01**: User can add stocks to portfolio with ticker symbol and quantity
- [ ] **PORT-02**: User can remove stocks from portfolio
- [ ] **PORT-03**: User can update quantity and cost basis for existing holdings
- [ ] **PORT-04**: User can view all portfolio holdings with current market values

### Dashboard — Data Sections

- [ ] **DASH-01**: User sees a horizontal Stock Ticker Bar showing all portfolio stocks with performance indicators
- [ ] **DASH-02**: User sees Stock Header with selected stock's name, last price, YTD performance, implied move, and earnings date
- [ ] **DASH-03**: User sees Numbers Going In with consensus revenue/EPS estimates, company guidance, sentiment, and last 4 quarters table
- [ ] **DASH-04**: User sees QoQ/YoY Trend with revenue bar chart and EPS line chart covering last 4 quarters plus estimate
- [ ] **DASH-05**: User sees Analyst Setup with analyst ratings breakdown, consensus price target, and recent revisions
- [ ] **DASH-06**: User sees Sources section listing all data sources and references backing the analysis
- [ ] **DASH-07**: User sees Segment Expectations with business segments, revenue estimates, growth percentages, and AI-written per-segment analysis
- [ ] **DASH-08**: User sees Expected Move & Options showing implied move, historical average, last quarter comparison, and options setup analysis

### Dashboard — AI Analysis Sections

- [ ] **AI-01**: User sees Bull vs Bear section with AI-generated bull case and bear case cards side by side
- [ ] **AI-02**: User sees Catalysts & Risks section with AI-generated bullet-pointed key catalysts and key risks
- [ ] **AI-03**: User sees Live on the Call section with AI-generated numbered list of key items to listen for during earnings calls
- [ ] **AI-04**: User can click a button to regenerate AI analysis on demand for the selected stock

### Scheduling & Generation

- [ ] **SCHED-01**: User can configure scheduled daily AI analysis generation per stock with customizable time
- [ ] **SCHED-02**: User can cancel or disable scheduled generation for any stock
- [ ] **SCHED-03**: User can view analysis history showing past AI-generated analyses for comparison

### Alerts & Notifications

- [ ] **ALRT-01**: User can create price alerts that notify when a stock hits a user-defined price target
- [ ] **ALRT-02**: User can create earnings alerts that notify before upcoming earnings dates

### Settings

- [ ] **SET-01**: User can change their account password
- [ ] **SET-02**: User can update their registered email address
- [ ] **SET-03**: User can manage alerts (create, edit, delete price and earnings alerts)
- [ ] **SET-04**: User can configure per-stock analysis schedule times and toggle schedules on/off

### Infrastructure & Quality

- [ ] **INFRA-01**: Application uses dark-themed UI matching the provided dashboard design screenshots
- [ ] **INFRA-02**: Application integrates OpenTelemetry for full-stack observability (traces, metrics, logs)
- [ ] **INFRA-03**: Codebase has interview-quality documentation (README, architecture docs, inline comments, API docs)
- [ ] **INFRA-04**: Each dashboard section is an independent modular component with its own data pipeline and logic

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Portfolio Enhancements

- **PORT-V2-01**: User can import portfolio from CSV file
- **PORT-V2-02**: User can manage multiple portfolios

### Notifications

- **NOTF-V2-01**: User receives browser push notifications for alerts
- **NOTF-V2-02**: User can configure notification delivery preferences (email vs push)

### Dashboard Enhancements

- **DASH-V2-01**: User can independently refresh individual dashboard sections
- **DASH-V2-02**: User can compare analysis across time periods for the same stock
- **DASH-V2-03**: User can view a watchlist separate from portfolio

### Platform

- **PLAT-V2-01**: PWA/mobile-responsive experience
- **PLAT-V2-02**: Multi-user sharing and collaboration
- **PLAT-V2-03**: International stock support

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time price streaming | Free APIs don't support it; delayed data labeled as such is sufficient |
| Brokerage integration | Regulatory surface area; tracking-only by design |
| AI price predictions/targets | Legal/regulatory risk; frame as analysis framework, not prediction |
| Order routing/trading | Out of scope — this is an analysis tool, not a trading platform |
| Backtesting | High complexity, not core to analysis value |
| Full earnings transcripts | Copyright concerns; use AI-generated summaries instead |
| Paid data sources | Free APIs only for v1; budget constraint |
| DCF/valuation models | False precision problem; use analyst consensus instead |
| Social features | No sharing, comments, or multi-user collaboration in v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| AUTH-04 | — | Pending |
| PORT-01 | — | Pending |
| PORT-02 | — | Pending |
| PORT-03 | — | Pending |
| PORT-04 | — | Pending |
| DASH-01 | — | Pending |
| DASH-02 | — | Pending |
| DASH-03 | — | Pending |
| DASH-04 | — | Pending |
| DASH-05 | — | Pending |
| DASH-06 | — | Pending |
| DASH-07 | — | Pending |
| DASH-08 | — | Pending |
| AI-01 | — | Pending |
| AI-02 | — | Pending |
| AI-03 | — | Pending |
| AI-04 | — | Pending |
| SCHED-01 | — | Pending |
| SCHED-02 | — | Pending |
| SCHED-03 | — | Pending |
| ALRT-01 | — | Pending |
| ALRT-02 | — | Pending |
| SET-01 | — | Pending |
| SET-02 | — | Pending |
| SET-03 | — | Pending |
| SET-04 | — | Pending |
| INFRA-01 | — | Pending |
| INFRA-02 | — | Pending |
| INFRA-03 | — | Pending |
| INFRA-04 | — | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 0
- Unmapped: 33

---
*Requirements defined: 2026-05-07*
*Last updated: 2026-05-07 after initial definition*
