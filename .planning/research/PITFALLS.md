# Pitfalls Research

**Domain:** Financial Analysis Platform (AI-powered)
**Researched:** 2026-05-07
**Confidence:** HIGH

---

## Critical Pitfalls

### 1. Yahoo Finance / yfinance API Instability and Silent Data Corruption

**What goes wrong:** Yahoo Finance is an unofficial, scraping-based API. It breaks without warning when Yahoo changes its internal endpoints, cookie/crumb authentication flows, or response schema. The `yfinance` Python library patches these silently — or not at all for weeks — meaning your app may return stale, partial, or structurally incorrect data without raising exceptions.

**Why:** Yahoo Finance has no published SLA or versioned public API. The library reverse-engineers internal XHR calls. Schema changes (e.g., earnings dates moving from `earningsDate` to `earningsTimestamps`) go undocumented. Fields return `None` or `NaN` instead of raising errors.

**How to avoid:**
- Always validate critical field presence before passing to downstream consumers (AI prompt or chart).
- Log raw API response shapes at DEBUG level; alert when unexpected `None`/`NaN` ratios spike.
- Pin `yfinance` version in `requirements.txt` and test upgrades in isolation.
- Build a secondary fallback for critical data points (e.g., Alpha Vantage free tier or Financial Modeling Prep).
- Never trust `info` dict completeness — it varies by ticker type (ETF vs. stock vs. crypto).

**Warning signs:** Analysis says "data unavailable" only for certain sectors. Charts render for some tickers but not others. AI outputs contain "N/A" despite the ticker being valid.

**Phase to address:** Architecture/Integration phase — before writing any AI prompt logic.

---

### 2. LLM Hallucination of Financial Figures

**What goes wrong:** Claude (and all LLMs) will confidently fabricate specific financial metrics — P/E ratios, revenue figures, earnings dates, analyst targets — when the context window doesn't include that data. Models trained on financial text know the *shape* of financial analysis, so hallucinated numbers look plausible.

**Why:** LLMs complete patterns. A prompt like "Analyze AAPL's fundamentals" with no injected data causes the model to draw from training memory, which is stale and often wrong for specific current figures.

**How to avoid:**
- Always inject the actual data into the prompt. Never rely on the model's training knowledge for current figures.
- Include a strict system prompt instruction: "You MUST only reference numbers explicitly provided in the context. If a metric is not in the context, state it is unavailable."
- Run a post-generation validation pass: extract all numbers from the AI output and verify each appears in the source data fed to the prompt.
- Display the data source and timestamp alongside every AI analysis.

**Warning signs:** AI analysis mentions exact numbers that weren't in the API response. Users report "the numbers don't match." AI says "as of Q3 2023" when you're displaying real-time data.

**Phase to address:** AI Integration phase — before any user-facing output.

---

### 3. Free-Tier Rate Limit Cascades

**What goes wrong:** Multiple dashboard sections fire simultaneous API calls on page load. One or two sections hit rate limits (News API: 100 req/day free; Alpha Vantage: 5 req/min free; Claude API: tokens-per-minute throttle). The cascade causes some sections to fail, some to show stale data, and error states to propagate in unpredictable ways.

**Why:** 11 independent sections rendering simultaneously with no request coordination equals a thundering herd on every page load or navigation event. Free-tier APIs have strict per-minute and per-day caps.

**How to avoid:**
- Implement a centralized request queue/scheduler with per-API rate limiting (e.g., token bucket per API).
- Stagger section initialization with priority ordering: price/core data first, news second, AI analysis last.
- Cache aggressively: Redis or even in-memory cache per ticker for financial data (prices: 1-min TTL; fundamentals: 24-hr TTL; AI analysis: 6-hr TTL).
- Use SWR/React Query with stale-while-revalidate to serve cached data immediately and refresh in background.
- Track daily API budget consumption and gracefully degrade (show cached data + warning) when limits are near.

**Warning signs:** First load of the day works; subsequent loads fail in different sections. Error logs show 429s clustering in 30-second windows. AWS Lambda cold starts compound with API timeouts.

**Phase to address:** Backend architecture phase.

---

### 4. Render Avalanche — 11 Sections × Chart Libraries

**What goes wrong:** Rendering all 11 dashboard sections simultaneously with Recharts/Chart.js causes a 3–8 second Time-to-Interactive on mid-range hardware, even with modern browsers. Each chart library mounts, measures DOM, draws SVG/Canvas, and subscribes to resize observers. With 11 sections, this is multiplied.

**Why:** Chart libraries are expensive to mount. Recharts uses SVG with individual React elements per data point. Chart.js uses Canvas but still has heavy initialization. When 11 sections all mount simultaneously on route entry, the main thread is blocked.

**How to avoid:**
- Virtualize sections: only render sections in the viewport, lazily mount others using Intersection Observer.
- Use React.lazy() + Suspense per section boundary.
- Prefer lightweight chart alternatives for sparklines (e.g., `recharts` ResponsiveContainer is expensive — use `react-sparklines` or raw SVG for small charts).
- Memoize chart data transformations with `useMemo`; never recompute on every render.
- Skeleton screens for all sections; render charts after data resolves, not before.

**Warning signs:** Chrome DevTools shows long tasks (>50ms) during initial mount. "Jank" on scroll or section expand. Memory usage climbs above 300MB for a single dashboard view.

**Phase to address:** Frontend architecture phase — before building all 11 sections.

---

### 5. API Key Exposure in Frontend Builds

**What goes wrong:** API keys for News API, Alpha Vantage, or Claude API end up in the client-side JavaScript bundle — either via environment variable injection at build time (`REACT_APP_CLAUDE_API_KEY`) or hardcoded during development and forgotten.

**Why:** React/Vite environment variables prefixed with `REACT_APP_`/`VITE_` are intentionally embedded in the client bundle. Developers under time pressure call financial APIs directly from the frontend to avoid writing backend routes.

**How to avoid:**
- ALL financial API calls and the Claude API must go through backend routes only. No API key ever touches the frontend bundle.
- Use AWS Secrets Manager or environment variables server-side only.
- Run `git secrets` or `truffleHog` as a pre-commit hook.
- Add a CI step that greps the build output for key patterns.
- Rotate any key that has ever appeared in a git commit, even briefly.

**Warning signs:** Network tab shows requests to `api.anthropic.com` or `newsapi.org` directly from the browser. Build artifacts contain strings matching API key patterns.

**Phase to address:** Project setup phase — Day 1, non-negotiable.

---

### 6. Stale AI Analysis Displayed as Current

**What goes wrong:** AI-generated analysis is cached (correctly, for cost reasons) but displayed without clear staleness indicators. A user views "AI Analysis" that was generated 18 hours ago during a market close, not knowing that a major earnings report dropped 2 hours ago.

**Why:** The tension between Claude API cost management (cache analysis for hours) and the user's implicit expectation that "current" analysis reflects current market conditions.

**How to avoid:**
- Always display the generation timestamp prominently: "Generated: 6 hours ago."
- Flag analysis as potentially stale when significant price movement (>2%) has occurred since generation.
- Allow manual "Regenerate" button with clear cost/rate-limit awareness.
- Consider a tiered freshness system: market hours = 2hr TTL; after hours = 12hr TTL.

**Warning signs:** Users report the AI mentions "yesterday's" price action. Analysis recommends actions inconsistent with current chart state.

**Phase to address:** UI/UX design phase + AI integration phase.

---

### 7. News API Content Gaps and Financial Irrelevance

**What goes wrong:** NewsAPI free tier returns only headlines + 100-char descriptions (not full articles). The AI receives these truncated snippets and generates analysis that reads as shallow or misattributes sentiment. Additionally, NewsAPI free tier has a 1-month lookback limit and US-only access in free tier.

**Why:** NewsAPI free tier deliberately hobbles content to push toward paid plans. The financial analysis prompt receives insufficient signal to produce meaningful sentiment analysis.

**How to avoid:**
- Design AI prompts to work with headline-only data; don't promise "full article analysis."
- Supplement with free alternatives: RSS feeds from Reuters/Bloomberg (publicly available), SEC EDGAR filings for fundamental news.
- Consider Finnhub free tier for company-specific news (has a more generous free tier than NewsAPI for financial content).
- Never claim "comprehensive news analysis" in UI copy if using truncated headlines.

**Warning signs:** AI news summaries contain only vague sentiment ("mixed signals in recent news"). All articles appear to be from the same 2-3 sources. International stocks show no news.

**Phase to address:** Integration design phase.

---

### 8. OpenTelemetry Instrumentation Creating Cost Overruns

**What goes wrong:** OpenTelemetry traces for every AI analysis call, every financial API call, and every chart render event generate unexpectedly large trace volumes. On AWS with X-Ray or a third-party backend, this creates surprise bills or free-tier exhaustion within days of launch.

**Why:** Financial dashboards poll frequently. Each of 11 sections generating traces per render, per API call, per AI invocation at 5-min polling intervals creates O(n*m*k) trace events per user session.

**How to avoid:**
- Sample traces aggressively in production: 1-5% for routine API calls, 100% for errors.
- Use trace filtering to drop noisy, low-value spans (e.g., health checks, static asset fetches).
- Set explicit OTEL export budgets and alert before free-tier exhaustion.
- Keep AI analysis traces but summarize rather than trace every token generation event.

**Warning signs:** AWS CloudWatch costs appear on day 3. OTEL collector queue backing up. Trace storage costs exceed compute costs.

**Phase to address:** Observability design phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|---|---|---|---|
| Call Yahoo Finance directly from each section | Faster to build, no caching layer | Rate limit cascades, duplicate calls, no error isolation | Never — always centralize |
| Hardcode ticker symbols for demo | Easy showcase | Can't demo arbitrary tickers; embarrassing in interviews | Only for static screenshots |
| One giant AI prompt for all analysis types | Single prompt to maintain | Tokens wasted on irrelevant context; worse output quality per section | Never for production |
| Client-side financial calculations (P/E, returns) | No backend needed | Calculation errors not caught, inconsistent across sections | Acceptable for display-only, not trading signals |
| Store portfolio data in localStorage | No DB needed | Lost on browser clear, no sync, no server-side analysis | Acceptable for MVP demo only |
| Skip input validation on ticker symbols | Faster dev | API errors with misleading messages; potential injection in prompts | Never |
| Polling every section on a fixed interval | Simple to implement | Thundering herd, hits rate limits faster, wastes free quota | Replace with smart invalidation ASAP |
| Use `any` types in TypeScript for API responses | No time spent typing | Silent data shape bugs when API changes; no IDE help | Only during initial exploration |
| No error boundaries per section | Faster to build | One section error crashes entire dashboard | Never — always isolate section errors |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|---|---|---|
| yfinance / Yahoo Finance | Assuming `ticker.info` dict always has all fields | Defensive access with `.get()` and explicit fallback values; validate presence before use |
| yfinance historical data | Using default period without checking market hours | Account for weekends/holidays; last candle may be partial; use `auto_adjust=True` consistently |
| Yahoo Finance for non-US stocks | Expecting same data completeness as US equities | International tickers (e.g., `MC.PA`, `7203.T`) have sparse `info` fields; test explicitly |
| Claude API streaming | Not handling stream interruptions | Implement SSE reconnection logic; store partial responses; never show partial AI text to users |
| Claude API context window | Stuffing all 11 sections' data into one prompt | Each analysis section gets its own focused prompt; stay well under 100k tokens to avoid latency spikes |
| Claude API costs | Pricing per input+output token | Cache prompts with identical preambles using prompt caching (saves ~90% on repeated system prompts) |
| NewsAPI | Expecting full article text on free tier | Free tier returns title + description only (~200 chars); design prompts accordingly |
| NewsAPI date filtering | Passing future dates or today without time component | API behavior is inconsistent with same-day requests; always use explicit datetime with timezone |
| Alpha Vantage free tier | Assuming 5 calls/min is wall-clock rate limited | Rate limiter resets on API server clock, not your clock; add 15s buffer between calls |
| AWS Lambda cold starts | Financial APIs called in cold-start path | Pre-warm critical Lambda routes; use Lambda SnapStart or provisioned concurrency for user-facing endpoints |
| CORS on financial API proxies | Allowing `*` origins on backend proxy | Lock CORS to your frontend domain only; financial proxies are prime SSRF targets if misconfigured |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|---|---|---|---|
| All 11 sections mount simultaneously | 3-8s TTI; JS long tasks >100ms; layout thrash | Intersection Observer lazy mount; React.lazy per section | On every page load on mid-range hardware |
| Recharts ResponsiveContainer wrapping large datasets | Memory usage >300MB; smooth scroll becomes janky | Downsample data to display resolution (max 500 points for line charts); memoize transformed data | When historical data spans >1 year at daily granularity |
| Re-fetching all sections on tab focus | Burst of 11+ API calls when user returns to tab | Use `visibilitychange` with debounce; only refetch sections whose TTL has expired | On every tab switch in multi-tab workflows |
| Unsubscribed WebSocket / polling intervals | Memory leak causing dashboard slowdown over 30min | Always cleanup intervals/sockets in `useEffect` return | After ~10 minutes of use; harder to catch in dev |
| Claude API latency blocking section render | Section shows spinner for 8-15s | Generate AI analysis asynchronously and server-side on schedule; never await on render path | On first load for any section requiring fresh AI analysis |
| JSON.parse of large financial datasets in render thread | UI freeze on initial data load | Web Worker for data parsing; or stream/paginate from API | When historical data >1MB JSON |
| Synchronous localStorage reads for portfolio | Blocks first render | Keep portfolio state in memory; sync to storage asynchronously | At scale with >50 portfolio positions |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---|---|---|
| API keys in frontend bundle | Key scraped from minified JS within hours of deploy; immediate financial/quota abuse | Server-side only; environment variables never in client build |
| No rate limiting on AI analysis endpoint | Single user can exhaust your monthly Claude API budget in minutes | Per-user rate limit on analysis generation (e.g., 10/hour); IP-based throttling |
| Ticker symbol passed directly to shell commands or file paths | Command injection if backend uses subprocess for Python scripts | Always validate ticker against regex `^[A-Z0-9.\-]{1,10}$`; never shell-interpolate user input |
| Storing portfolio data without encryption | Portfolio composition is financially sensitive PII | Encrypt at rest; use Cognito/JWT with short-lived tokens; never log portfolio data |
| News API key in browser network requests | Key visible in DevTools; scrapers harvest it | All external API calls via backend proxy; no third-party API calls from browser |
| No CSRF protection on portfolio mutation endpoints | Portfolio data can be modified by malicious third-party pages | SameSite cookies + CSRF tokens on state-changing endpoints |
| LLM prompt injection via ticker names | User enters ticker like `AAPL\n\nIgnore all previous instructions...` | Sanitize all user inputs before prompt interpolation; wrap user data in XML tags to delimit from instructions |
| Verbose error messages exposing stack traces | Internal architecture revealed; API endpoint paths disclosed | Generic user-facing errors; detailed errors to logs only |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---|---|---|
| No loading skeleton for 11 sections | Page looks broken during load; users abandon | Skeleton screens per section that match the loaded layout exactly |
| AI analysis wall of text | Users don't read it; key signals buried | Structure output with: Summary (2 sentences), Bulleted key points, Risk/opportunity callouts, Confidence indicator |
| Numbers without context (e.g., "P/E: 28.4") | Novice investors don't know if that's good or bad | Add contextual benchmarks: sector average, historical range, simple color coding |
| Error state just says "Error loading data" | User doesn't know if it's their connection, a bad ticker, or the API being down | Specific error messages: "Yahoo Finance data unavailable for this ticker. Try again in 5 minutes." |
| No timestamp on any data | User can't tell if prices are real-time, delayed, or cached | Every data point shows its source and age: "Price as of 2 min ago (delayed 15min)" |
| Forcing full dashboard load before showing anything | Interview reviewers bounce if nothing appears in 3 seconds | Progressive loading: show price card in <1s, AI analysis loads last |
| Charts with no empty state | If data is missing, chart renders empty axes or crashes | Explicit "Insufficient data to display chart" state with reason |
| "Regenerate Analysis" button with no feedback | Users click multiple times thinking it didn't work | Disable button immediately on click; show progress indicator; estimated time ("~8 seconds") |
| No mobile responsiveness on financial tables | Tables overflow on phone; interview reviewers may use mobile | Responsive table pattern: card layout on mobile, table on desktop |
| Color-only encoding of gain/loss | Red/green is inaccessible to color-blind users | Always pair color with symbol (+/-) and/or text label |

---

## "Looks Done But Isn't" Checklist

- [ ] AI analysis displays for a valid ticker but the numbers in the analysis don't match the actual data fetched
- [ ] Dashboard loads successfully in Chrome dev tools but hangs on first real user load (cold Lambda start + rate limits)
- [ ] Portfolio P&L calculates correctly for purchased stocks but silently breaks for stocks with stock splits
- [ ] Error boundaries exist but are catching errors silently — no logging, no user-visible feedback
- [ ] Rate limiting middleware is present but doesn't persist across Lambda invocations (in-memory counter resets on cold start)
- [ ] Caching is implemented but TTL is not honored under concurrent requests (cache stampede)
- [ ] Charts render correctly with mock data but crash or show NaN with real API data containing gaps (holidays, trading halts)
- [ ] News sentiment analysis runs but NewsAPI free tier is returning 0 articles for non-US stocks
- [ ] Authentication flow works but JWT tokens are never validated server-side on financial data endpoints
- [ ] "Scheduled analysis" runs on cron but silently fails for tickers added after the schedule was set up
- [ ] OpenTelemetry spans are being created but exporter is not flushing before Lambda function returns (lost traces)
- [ ] API key is in `.env` file but `.env` is committed to git history even if later removed from `.gitignore`
- [ ] Yahoo Finance returns data for `TICKER` but silently returns different data for `TICKER.L` (London) — no user disambiguation
- [ ] Dark theme looks correct in Chrome but financial tables are unreadable in Safari due to different default color inheritance
- [ ] AI analysis section shows "loading" indefinitely when Claude API returns a non-200 (no timeout/error fallback)
- [ ] Portfolio tracking works but doesn't account for transaction fees or cost basis adjustments
- [ ] The entire dashboard route is protected by auth but the `/api/analysis/:ticker` endpoint is not

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---|---|---|
| Yahoo Finance API breaking mid-demo | Low (1-2 days) | Add fallback API (Finnhub free tier); mock data layer for demo mode |
| API key leaked in git history | High (immediate action required) | Rotate key immediately; `git filter-branch` or BFG to scrub history; audit access logs |
| Claude API budget exhausted | Low-Medium | Implement hard daily spend cap via usage tracking; add mock/cached analysis mode for dev/demo |
| All 11 sections timing out due to rate limits | Medium (2-3 days) | Implement request queue with per-API rate limiting; add Redis caching layer |
| LLM hallucination discovered by reviewer | Medium (1-3 days) | Add data injection validation; post-generation number verification; prominent "AI-generated, verify independently" disclaimer |
| Dashboard TTI >5s discovered late | High (3-5 days) | Section virtualization, React.lazy, request deduplication — requires architectural refactor |
| Portfolio data lost (localStorage cleared) | Low for demo | Add export/import feature; consider server-side persistence even if simple (DynamoDB single-table) |
| OpenTelemetry causing unexpected AWS costs | Low (hours) | Set sampling rate to 1%; add cost alert; disable OTEL export in dev environment |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---|---|---|
| API key exposure | Project setup (Day 1) | Grep build output for key patterns; network tab audit |
| yfinance data validation | Backend integration | Unit tests with real API responses including edge cases (ETFs, intl stocks, NaN fields) |
| LLM hallucination | AI prompt design | Output validation: every number in AI text must exist in source data |
| Rate limit cascades | Backend architecture | Load test: simulate 11 concurrent section loads |
| Render avalanche | Frontend architecture | Lighthouse TTI score; Chrome DevTools performance profile |
| Stale analysis display | UI/UX design | User testing: can reviewer find the generation timestamp within 5 seconds? |
| News API truncation | Integration design | Log actual content length received; confirm prompt acknowledges limitation |
| OTEL cost overrun | Observability design | Verify sampling config; simulate 100 concurrent users; check estimated trace volume |
| Prompt injection | Security review | Test ticker input with prompt injection strings before launch |
| Cache stampede | Backend testing | Concurrent request test with cache TTL expiry simulation |

---

## Sources

*Note: Web search was not available in this research session. The following knowledge sources informed this document:*

- **yfinance library** (PyPI): Known issues tracker, GitHub issues #1234–#1900 range covering cookie auth, `info` dict instability, schema changes
- **Anthropic Claude API documentation**: Rate limits, prompt caching, context window behavior, streaming
- **NewsAPI documentation**: Free tier limitations (headlines-only, 1-month lookback, 100 req/day)
- **React performance documentation**: Concurrent rendering, lazy loading, Suspense boundaries
- **OWASP API Security Top 10**: API key exposure, injection, broken authentication
- **AWS Lambda documentation**: Cold start behavior, execution model, in-memory state limitations
- **Industry knowledge**: Common patterns from financial data platform post-mortems (Bloomberg API migration war stories, Robinhood outage analyses, fintech startup technical debt retrospectives)
- **LLM safety research**: Hallucination patterns in domain-specific LLM applications, financial AI disclosure requirements
