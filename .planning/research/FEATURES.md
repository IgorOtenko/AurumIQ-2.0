# Feature Research

**Domain:** Financial Analysis Platform (AI-powered)
**Researched:** 2026-05-07
**Confidence:** HIGH (based on direct knowledge of Seeking Alpha, TipRanks, MarketBeat, Simply Wall St, Koyfin, and Bloomberg Terminal as of training cutoff Aug 2025)

---

## Feature Landscape

### Table Stakes (Users Expect These)

These are features that users arriving from any competing platform will immediately look for. Absence causes churn before value is demonstrated.

| Feature | Why Expected | Complexity | Notes |
|---------|-------------|------------|-------|
| Portfolio holdings list | Every finance app has this; it's the entry point | Low | Simple CRUD — ticker, shares, cost basis |
| Current price + % change | Real-time or near-real-time price display | Low | Yahoo Finance free tier covers this |
| YTD / 52-week performance | Standard "how is this stock doing" metric | Low | Derivable from price history |
| Earnings date display | Pre-earnings prep is a core use case for retail investors | Low | Available from Yahoo Finance |
| Revenue + EPS estimates (consensus) | Users need forward-looking numbers to form a view | Medium | Yahoo Finance provides this; data quality varies |
| Historical financials (4–8 quarters) | Context for trends; no chart means no story | Medium | Yahoo Finance covers quarterly data |
| Analyst ratings summary | Buy/Hold/Sell breakdown is a staple | Low | Yahoo Finance provides count + price target |
| Price target (consensus + range) | Anchor for fundamental upside/downside | Low | Part of analyst data package |
| News feed for the stock | Recent news shapes sentiment | Low | News API covers this adequately |
| Dark mode / dark theme | Standard in financial UIs; bright white is jarring | Low | CSS/Tailwind design choice |
| Search by ticker | Users navigate by ticker; name search is secondary | Low | Client-side filter on portfolio |
| Revenue/EPS trend charts | Visual communication of growth trajectory | Medium | Recharts or Chart.js, data from Yahoo Finance |
| Mobile-responsive layout | Most retail investors check on phone at some point | Medium | Tailwind responsive classes |
| Loading states / skeletons | Data takes time; perceived performance matters | Low | Component-level loading UX |
| Error handling / stale data indicators | APIs fail; users need to know what's fresh | Medium | Timestamp + fallback messaging |

---

### Differentiators (Competitive Advantage)

These features separate AurumIQ from aggregator platforms. The AI-synthesis angle is the core differentiator — no platform currently generates the depth of per-section narrative analysis that AurumIQ proposes.

| Feature | Value Proposition | Complexity | Notes |
|---------|------------------|------------|-------|
| Per-segment revenue breakdown with AI narrative | Seeking Alpha/TipRanks show segment data but no AI prose explanation of what it means for the upcoming quarter | High | Requires structured segment data (inconsistent across free APIs) + LLM prompt per segment |
| "Live on the Call" watchlist | No platform generates a pre-earnings listening agenda from structured analysis | Medium | Unique LLM output; high perceived value for active investors |
| Bull vs Bear cards (AI-generated) | Simply Wall St has point/counterpoint but it's rules-based and generic; LLM reasoning is contextual | High | Core differentiator; needs good prompt engineering |
| Implied move vs historical average comparison | Options-informed implied move shown alongside historical actual moves; rare outside Bloomberg | High | Requires options chain data — yfinance provides this |
| Scheduled daily AI refresh | No free-tier tool auto-regenerates analysis on a schedule | High | Background job infrastructure; significant engineering |
| On-demand single-click full refresh | Koyfin/Seeking Alpha require manual navigation per section; AurumIQ refreshes everything in one action | Medium | Orchestration layer across 11 sections |
| Sources section with cited data | AI outputs without sourcing are distrusted; showing the data backing the analysis builds credibility | Low | Metadata collection during data fetch |
| Earnings call catalyst list | "What to listen for" framing helps users engage with calls actively | Medium | High LLM value-add from fundamentals + news |
| Per-section independent refresh | Granular control; user can re-run just the bull/bear section after a news event | Medium | Section-level state management |
| Modular AI pipeline (section-level) | Engineering showcase; demonstrates clean architecture to interviewers | Medium | Architectural choice, not user-facing per se |
| OpenTelemetry traces visible in dashboard | Developer-forward "glass box" AI — shows latency per section | High | Engineering differentiator for interview showcase |
| Configurable API key (user's own Claude key) | Power users prefer control; avoids per-seat LLM cost for AurumIQ | Low | Settings page field |

---

### Anti-Features (Commonly Requested, Often Problematic)

These features are frequently requested on competing platforms' feedback boards but create significant problems when implemented naively.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|--------------|-----------------|-------------|
| Real-time price streaming (WebSocket) | Users want to see live ticks | Free APIs don't offer real-time; Yahoo Finance delays 15 min; implementing proper streaming requires paid feed and significant infra complexity | 60-second polling with timestamp shown; label clearly as "delayed" |
| Brokerage integration (Robinhood, Schwab, Fidelity) | Users want P&L from real account | OAuth flows per broker, liability concerns, regulatory surface area, maintenance burden as broker APIs change | Manual entry of shares + cost basis; CSV import as v2 |
| Options trading / order routing | Natural extension of options analysis section | Brokerage API required; FINRA/SEC regulatory complexity; liability for bad trades; entirely different product | Display options data for analysis only; never suggest specific trades |
| AI price prediction / targets | Extremely desirable UX pattern | LLMs are confidently wrong on price predictions; creates legal/regulatory risk ("investment advice"); damages trust when wrong | Frame all AI output as "analysis framework" and "questions to consider"; include disclaimer |
| Social feed / ideas sharing | Seeking Alpha's core moat | Network effects require scale; moderation overhead; spam and pump-and-dump risk; entirely different product | Out of scope for v1; potential v3 feature with significant design thought |
| Push notifications (mobile) | "Alert me when my stock moves" | Requires mobile app or PWA service workers; iOS restrictions on web push; significant infra (FCM/APNs) | Email alerts only for v1; browser notification API as v1.5 |
| Backtesting strategies | Power users want to validate hypotheses | Requires historical OHLCV data store, order simulation engine, slippage modeling — entirely separate product surface | Out of scope; link to free backtesting tools (Quantconnect, Backtrader docs) |
| Competitor comparison side-by-side | "Show me AAPL vs MSFT" | Doubles the data fetch and display complexity; layout breaks at 3+ comparisons; LLM context window bloat | Single-stock focus for v1; comparison could be a v2 "compare" modal |
| DCF / valuation models | Users want intrinsic value calculation | DCF requires assumptions (WACC, terminal growth rate) users don't understand; small input changes cause wild swings; creates false precision | Surface analyst price targets instead; note implied upside/downside vs current price |
| Auto-trading / algorithmic execution | The logical extension of recommendations | Extremely high regulatory risk; significant liability; requires broker integration; out of scope by definition | Never implement; explicitly state in docs/UI that AurumIQ is analysis-only |
| Full earnings transcript | Users want to read/search the call | Transcripts require paid licensing (Motley Fool, Seeking Alpha charge for this); raw audio transcription via Whisper is high latency | Surface key quotes via news API; "Live on the Call" section covers the pre-call prep angle |
| International stocks (non-US) | Global portfolios are common | Yahoo Finance data quality drops sharply for non-US; LLM training data on international companies is thinner; currency complexity | US-listed stocks only for v1; ADRs acceptable; note limitation clearly |

---

## Feature Dependencies

This tree shows which features must exist before others can be built.

```
User Auth
└── Portfolio Management
    ├── Stock Ticker Bar (display)
    ├── Stock Selection (drives all sections below)
    │   ├── [Data Layer] Yahoo Finance ingestion
    │   │   ├── Stock Header (price, YTD, earnings date)
    │   │   ├── Numbers Going In (consensus estimates, last 4Q)
    │   │   ├── QoQ/YoY Trend charts
    │   │   ├── Analyst Setup (ratings, targets, revisions)
    │   │   └── [Options Data] yfinance options chain
    │   │       └── Expected Move & Options section
    │   ├── [Data Layer] News API ingestion
    │   │   └── (feeds into AI context for all sections)
    │   └── [AI Pipeline] Claude API integration
    │       ├── Segment Expectations (data + AI prose)
    │       ├── Bull vs Bear (AI cards)
    │       ├── Catalysts & Risks (AI bullets)
    │       ├── Live on the Call (AI list)
    │       └── Sources (metadata from all above)
    └── [Job Scheduler] Scheduled analysis generation
        └── depends on AI Pipeline being stable

Settings Page
├── depends on User Auth
└── Price Alerts
    └── Earnings Alerts
        └── depends on Earnings Date data from Stock Header
```

**Critical path for MVP:** Auth → Portfolio → Yahoo Finance data → Stock Header + Numbers Going In → AI Pipeline → Bull/Bear + Catalysts → basic dashboard usable.

---

## MVP Definition

### Launch With (v1) — Core Value Demonstrable

These features together deliver the core promise: "select a stock, get a comprehensive AI research report."

| Feature | Rationale |
|---------|-----------|
| User auth (signup/login/logout/password reset) | Required gate; no multi-user system works without it |
| Portfolio CRUD (add/remove stocks, quantities) | Entry point; drives everything |
| Stock Ticker Bar | Navigation; portfolio at a glance |
| Stock Header (price, YTD, earnings date, implied move) | First thing user sees; must be right |
| Numbers Going In (consensus estimates + 4Q history) | Core fundamental data; sets context for AI |
| QoQ/YoY Trend charts (revenue + EPS) | Visual validation of growth story |
| Analyst Setup (ratings, targets, revisions) | Social proof / crowd wisdom layer |
| Bull vs Bear cards (AI-generated) | Core differentiator; highest wow factor |
| Catalysts & Risks (AI bullets) | Highly actionable; easy to validate quality |
| Live on the Call (AI list) | Unique; high perceived value |
| Sources section | Trust signal; shows data provenance |
| On-demand analysis refresh | Essential for user control |
| Dark theme UI | Table stakes for financial dashboard |
| Price alerts (email) | Utility feature; keeps users returning |
| Earnings alerts (email) | High-value reminder; minimal implementation |
| Settings page (password, email, alert management) | Required for a real account system |

### Add After Validation (v1.x) — Depth and Polish

These add depth once the core loop is proven valuable.

| Feature | Trigger for Addition |
|---------|---------------------|
| Segment Expectations (AI per-segment analysis) | Add when segment data API coverage is confirmed reliable |
| Expected Move & Options section | Add when options chain data fetch is stable |
| Scheduled daily AI generation | Add when on-demand pipeline is stable and cost-managed |
| Per-section independent refresh | Add when users express frustration with full-refresh cost/latency |
| Browser push notifications | Add if email alert engagement is high |
| CSV portfolio import | Add when users request it; reduces friction for new signups |
| Analysis history / changelog | Add when users want to compare today's AI output vs last week |

### Future Consideration (v2+) — Scale Features

Only relevant if the product grows beyond solo/small-group use.

| Feature | Notes |
|---------|-------|
| Comparison view (2 stocks side-by-side) | Significant layout complexity |
| Watchlist (non-portfolio stocks) | Separate data pipeline from portfolio |
| Sector / macro overlay | Requires additional data sources |
| Social layer (shared notes, public portfolios) | Different product entirely; major moderation surface |
| International stocks | Data quality gating requirement |
| PWA / mobile app | After web product is stable |
| Custom LLM prompt templates | Power user feature; prompt management UI |
| Multi-portfolio support | Multiple watchlists / sub-accounts |

---

## Feature Prioritization Matrix

Scoring: User Value (1–5), Implementation Cost (1–5, higher = more expensive). Priority = Value ÷ Cost ratio, qualitative.

| Feature | User Value | Implementation Cost | Priority |
|---------|-----------|---------------------|----------|
| Bull vs Bear AI cards | 5 | 3 | **P0 — Core differentiator** |
| Catalysts & Risks AI | 5 | 2 | **P0 — High value, moderate cost** |
| Live on the Call AI | 4 | 2 | **P0 — Unique, high signal** |
| Numbers Going In (estimates) | 5 | 2 | **P0 — Table stakes + data** |
| Stock Header (price, YTD) | 5 | 1 | **P0 — Must have** |
| Analyst Setup | 4 | 2 | **P0 — Table stakes** |
| QoQ/YoY charts | 4 | 2 | **P0 — Visual trust signal** |
| Portfolio CRUD | 5 | 1 | **P0 — Entry point** |
| User auth | 5 | 2 | **P0 — Required gate** |
| Price/earnings alerts | 4 | 2 | **P1 — Retention driver** |
| Expected Move & Options | 4 | 3 | **P1 — Differentiator; options data complexity** |
| Segment Expectations AI | 4 | 4 | **P1 — High value; data coverage risk** |
| Scheduled AI generation | 3 | 4 | **P2 — Nice to have; infra complexity** |
| Per-section refresh | 3 | 3 | **P2 — Polish feature** |
| Analysis history | 3 | 3 | **P2 — Add post-validation** |
| CSV import | 2 | 2 | **P2 — Convenience** |
| Comparison view | 3 | 5 | **P3 — Future** |
| Social features | 2 | 5 | **P3 — Different product** |
| Real-time streaming | 2 | 5 | **Anti-feature — don't build** |
| Backtesting | 2 | 5 | **Anti-feature — different product** |

---

## Competitor Feature Analysis

This matrix compares what each major competitor offers vs AurumIQ's planned approach. Useful for identifying gaps and articulating differentiation.

| Feature | Seeking Alpha | TipRanks | MarketBeat | Simply Wall St | Koyfin | **AurumIQ Approach** |
|---------|--------------|----------|------------|----------------|--------|----------------------|
| **Portfolio tracking** | Yes (Premium) | Yes | Yes (free) | Yes | Yes | Yes — free, core UX |
| **Consensus estimates** | Yes (Premium) | Yes | Yes (free) | Yes | Yes | Yes — Yahoo Finance free |
| **Historical financials** | Yes (Premium) | Yes | Yes | Yes | Yes | Yes — 4–8 quarters, Yahoo Finance |
| **Analyst ratings + PT** | Yes (Premium) | Yes (core) | Yes (free) | Limited | Yes | Yes — Yahoo Finance aggregate |
| **Earnings date** | Yes | Yes | Yes | Yes | Yes | Yes — Yahoo Finance |
| **Revenue/EPS charts** | Yes | Yes | Yes | Yes | Yes | Yes — Recharts |
| **Sentiment analysis** | Article-based (SA authors) | Blogger/analyst crowd | News sentiment | Rules-based | Limited | AI synthesis from news |
| **Bull / Bear framing** | Author articles | Smart Score reasoning | Limited | Yes (rules-based) | No | AI-generated cards — richer than rules-based |
| **Options / implied move** | Premium | Premium (Smart Score) | Limited | No | No | Yes — yfinance options chain |
| **Earnings call prep** | Transcript (Premium) | Limited | No | No | No | "Live on the Call" AI list — unique framing |
| **Segment breakdown** | Premium | Limited | No | No | Partial | AI per-segment narrative — differentiator |
| **AI-generated narrative** | Limited (SA Alpha Picks) | Smart Score (rules-based) | No | Limited (rules-based) | No | Full LLM prose per section — major differentiator |
| **Auto-refresh / scheduled** | No | No | No | No | No | Yes (v1.x) — unique |
| **On-demand refresh** | Partial (re-load page) | Partial | No | Partial | No | Yes — single-click full re-analysis |
| **Data provenance / sources** | Article citations | Some | Limited | Limited | No | Explicit Sources section — trust signal |
| **Free tier depth** | Very limited (paywalled heavily) | Moderate | Good | Moderate | Good | Comparable to best free tiers |
| **Dark theme** | Yes | Yes | Yes | Yes | Yes | Yes — design-first |
| **Price alerts** | Yes (Premium) | Yes | Yes (free) | No | No | Yes — free |
| **Earnings alerts** | Yes (Premium) | Yes | Yes (free) | No | No | Yes — free |
| **Mobile app** | Yes | Yes | Yes | Yes | No | Web-only (v1) |
| **Social / community** | Yes (core) | Yes (crowd ratings) | Yes | No | Limited | Out of scope v1 |
| **Backtesting** | No | No | No | No | No | Out of scope |
| **Brokerage integration** | No | No | No | No | No | Out of scope |

**Key Insight:** No competitor combines free-tier accessibility with full-section LLM narrative generation. Seeking Alpha has the best content depth but it is human-authored at scale and heavily paywalled. TipRanks has the most sophisticated quantitative signals (Smart Score) but is rules-based, not generative. Koyfin has excellent data visualization but no AI layer. AurumIQ's combination of structured financial data + per-section Claude-generated prose is genuinely differentiated in the free/prosumer tier.

---

## Risk Notes for Feature Delivery

| Risk | Impact | Mitigation |
|------|--------|------------|
| Yahoo Finance API instability / rate limits | High — blocks all data sections | Cache aggressively; implement retry with backoff; store fetched data in DB so dashboard can show stale-but-labeled data |
| Options chain data gaps (smaller caps, low-volume stocks) | Medium — Expected Move section degrades | Gracefully hide section when data unavailable; show "options data not available for this ticker" |
| LLM output quality inconsistency | High — core value prop | Structured prompts with explicit output format; temperature tuning; section-level re-generation without full refresh |
| Claude API cost overrun | Medium — per-user API key model shifts cost to user | Surface estimated token usage in settings; allow users to disable individual sections; scheduled generation off by default |
| Segment data unavailability for many tickers | Medium — Segment Expectations section | Mark section as "data unavailable" gracefully; do not block MVP on this |
| Free-tier AWS limits hit at demo time | Medium — demo fails | Monitor Lambda invocations, DynamoDB RCUs/WCUs closely; implement caching to stay within limits |

---

## Sources

Web search was unavailable in this research session. This analysis is derived from direct knowledge of the following platforms as of training cutoff (August 2025):

- **Seeking Alpha** — seekingalpha.com (Premium tier features, paywalled analysis, SA Alpha Picks AI feature)
- **TipRanks** — tipranks.com (Smart Score system, analyst tracking, blogger ratings, options data)
- **MarketBeat** — marketbeat.com (free analyst consensus, earnings calendar, alert system)
- **Simply Wall St** — simplywall.st (visual fundamental analysis, snowflake scoring, rules-based bull/bear)
- **Koyfin** — koyfin.com (data terminal for prosumer, strong charting, no AI layer)
- **Bloomberg Terminal** — reference point for professional-grade feature completeness
- **Yahoo Finance** — finance.yahoo.com (primary free data source; understood deeply for API coverage)
- General knowledge of retail investor workflow patterns, earnings prep behavior, and options analysis UX conventions

> Note: Re-run this research with live web access before any major product pivot. Competitor features change quickly — TipRanks and Seeking Alpha both shipped significant AI features in 2024–2025.
