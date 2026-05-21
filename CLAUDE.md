<!-- GSD:project-start source:PROJECT.md -->
## Project

**AurumIQ**

AurumIQ is a web-based financial analysis platform that combines portfolio tracking with AI-powered stock research. Users manage a stock portfolio and get deep, LLM-generated analysis for each holding — covering earnings, fundamentals, options flow, catalysts, risks, and analyst sentiment. The dashboard presents this analysis in modular sections, each independently generated and refreshable.

**Core Value:** When a user selects a stock from their portfolio, they see a comprehensive, AI-generated research report that synthesizes real financial data with LLM reasoning — replacing hours of manual research with one dashboard view.

### Constraints

- **Budget**: AWS free tier only — no paid infrastructure services for v1
- **Data Sources**: Free APIs only — no Bloomberg, Refinitiv, or paid financial data
- **LLM**: Claude API via user's API key — budget-conscious prompt design
- **Auth**: Must support proper user management (signup, login, password reset, session management)
- **Documentation**: Interview-quality — README, architecture docs, inline comments, API docs
- **Modularity**: Each dashboard section must be an independent component with its own data/logic layer
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|---|---|---|---|
| Next.js | 15.x | Full-stack framework (frontend + API routes) | App Router + React Server Components reduce client bundle; API routes eliminate need for separate backend service; built-in SSR/SSG for fast initial load; Vercel-compatible but deploys fine on AWS; industry standard for interview-quality code |
| React | 19.x | UI rendering | Ships with Next.js 15; concurrent features, transitions, and use() hook needed for 11 independently-fetched dashboard sections |
| TypeScript | 5.x | Type safety across full stack | Required for interview-quality code; excellent Next.js integration; catches financial data shape mismatches at compile time |
| Tailwind CSS | 4.x | Styling | JIT engine produces minimal CSS; dark mode via `dark:` variants or class strategy; financial dashboard color tokens easy to define; no runtime overhead; v4 drops config file for CSS-first config |
| shadcn/ui | latest (2025) | Component primitives | Built on Radix UI (accessible) + Tailwind; copy-paste ownership model (no version lock-in); dark theme works out of box; DataTable, Card, Dialog, Select all needed for this project |
| PostgreSQL | 16.x (on RDS free tier) | Primary database | Relational model fits portfolio holdings, alerts, analysis history; free tier: db.t3.micro, 20 GB SSD, 750 hrs/month; JSONB columns for flexible analysis output storage; far superior query flexibility vs DynamoDB for this use case |
| Prisma ORM | 5.x | Database access layer | Type-safe queries generated from schema; migrations built-in; excellent Next.js integration; schema doubles as documentation |
| NextAuth.js (Auth.js) | 5.x (v5 beta stable) | Authentication | Credentials provider for email/password; JWT sessions stored in httpOnly cookies; zero infra cost; integrates with Next.js App Router middleware for route protection |
| AWS EC2 | t3.micro (free tier) | Hosting | 750 hrs/month free; runs Next.js as Node.js process via PM2; sufficient for solo dev + demo traffic |
| AWS RDS | db.t3.micro (free tier) | Managed PostgreSQL | 750 hrs/month, 20 GB storage free for 12 months |
| Claude API (Anthropic) | claude-3-5-haiku / claude-3-7-sonnet | AI analysis generation | User has API key; haiku for fast/cheap scheduled analysis; sonnet for on-demand deep analysis |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---|---|---|---|
| Lightweight Charts (TradingView) | 4.x | Stock price candlestick/line charts | Primary charting for price history; purpose-built for financial time-series; 40kb gzipped; far better performance than Recharts for OHLCV data |
| Recharts | 2.x | Portfolio composition / allocation charts | Pie charts, area charts, bar charts for portfolio metrics where financial precision < visual clarity; simpler API than Lightweight Charts for non-OHLCV data |
| Tanstack Table (React Table) | 8.x | Data tables | Holdings table, analysis history, alerts list; server-side sorting/pagination support; headless (styled with Tailwind) |
| Tanstack Query (React Query) | 5.x | Server state / data fetching | Independent fetching for 11 dashboard sections; stale-while-revalidate; background refetch; loading/error states per section; pairs with Next.js App Router fetch cache |
| Zustand | 5.x | Client state management | Portfolio selections, UI state, user preferences; lighter than Redux; no boilerplate; sufficient for this scale |
| Zod | 3.x | Schema validation | Validate financial API responses (Yahoo Finance/News API shapes can change); validate Claude API output; validate user inputs (portfolio entries, alert thresholds) |
| date-fns | 3.x | Date manipulation | Financial date ranges, earnings calendar formatting, analysis timestamps; tree-shakeable; no moment.js overhead |
| Axios | 1.x | HTTP client (external APIs) | Calling Yahoo Finance, News API from API routes; interceptors for rate limiting and error normalization |
| node-cron | 3.x | Task scheduling | Scheduled analysis generation inside Next.js custom server; cron syntax for market-hours-aware scheduling (pre-market, post-close) |
| OpenTelemetry SDK | 0.x (1.x API) | Observability | `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`; traces for AI analysis pipeline, API response times, scheduled job runs |
| Pino | 9.x | Structured logging | Fast JSON logger; integrates with OpenTelemetry; replaces console.log in production |
| bcryptjs | 2.x | Password hashing | Credentials auth password storage; pure JS (no native bindings issue on EC2) |
| nuqs | 2.x | URL state management | Dashboard filter state (date range, selected symbols) synced to URL; enables shareable dashboard views |
| clsx + tailwind-merge | 2.x / 2.x | Conditional class names | Component class composition without conflicts; standard pattern with shadcn/ui |
### Development Tools
| Tool | Purpose | Notes |
|---|---|---|
| pnpm | 9.x — Package manager | Faster installs, strict dependency resolution, less disk space than npm; monorepo-ready if needed later |
| ESLint | 9.x | Linting | Next.js includes eslint-config-next; add `@typescript-eslint/eslint-plugin` |
| Prettier | 3.x | Code formatting | `prettier-plugin-tailwindcss` for automatic class sorting |
| Vitest | 2.x | Unit/integration testing | Vite-based test runner; faster than Jest; compatible with TypeScript; test Zod schemas, utility functions, API response parsers |
| Playwright | 1.x | E2E testing | Test auth flow, dashboard render, portfolio CRUD |
| Prisma Studio | (bundled) | DB GUI | Visual database browser during development |
| PM2 | 5.x | Process manager on EC2 | Keep Next.js server alive; auto-restart on crash; cluster mode; log rotation |
| AWS CLI | 2.x | Infrastructure management | EC2, RDS, S3 management from terminal |
| dotenv / @t3-oss/env-nextjs | latest | Environment variable validation | Type-safe env vars; fail fast at startup if required vars missing |
## Installation
# Bootstrap project
# Database
# Auth
# UI Components (shadcn/ui - run component adds individually as needed)
# Then per component: pnpm dlx shadcn@latest add button card table dialog select badge
# State & Data Fetching
# Validation
# Charts
# HTTP & Scheduling
# Utilities
# OpenTelemetry
# AI
# Dev tools
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|---|---|---|
| Next.js 15 | React + Vite (SPA) | Use Vite if you need zero server infrastructure (pure static + separate REST API); Vite is faster DX for SPAs but loses SSR, API routes, and middleware — more moving parts on AWS |
| Next.js 15 | Remix v2 | Use Remix if you prefer nested routing / loader patterns; both are valid but Next.js has broader ecosystem and more financial dashboard examples |
| PostgreSQL on RDS | DynamoDB | Use DynamoDB if access patterns are pure key-value (get user by ID, get holding by symbol); PostgreSQL wins for ad-hoc queries, aggregates, JOIN across holdings+alerts+analysis |
| PostgreSQL on RDS | SQLite + Turso | Use Turso (LibSQL) if you want zero-cost global edge DB; excellent for solo projects but RDS is more interview-appropriate and teaches production patterns |
| NextAuth.js v5 | Clerk | Use Clerk if you want a hosted auth UI with zero code; Clerk free tier (10k MAU) is generous but adds vendor dependency and is overkill for a solo demo project |
| NextAuth.js v5 | AWS Cognito | Use Cognito if company policy requires AWS-only stack; Cognito free tier (50k MAU) is fine but DX is poor and complexity is high for solo dev |
| node-cron (in-process) | AWS EventBridge + Lambda | Use EventBridge if you need serverless scheduling with retry logic; for a t3.micro deployment, in-process node-cron is simpler and sufficient |
| Lightweight Charts | D3.js | Use D3 if you need fully custom financial visualizations; Lightweight Charts covers 90% of financial chart needs with 10% the complexity |
| Recharts | Victory / Nivo | Recharts has better TypeScript support and React 18+ compatibility; Victory is fine but heavier; Nivo is beautiful but bundle-heavy |
| Tanstack Query | SWR | Both are valid; Tanstack Query v5 has better DevTools, more cache control, and supports mutations cleanly — preferred for complex dashboard with 11 independent sections |
| Pino | Winston | Pino is 5–10x faster than Winston for JSON logging; Winston is fine but Pino is industry standard for high-throughput Node.js |
| pnpm | npm / yarn | pnpm is faster and saves disk space; npm works fine but pnpm is the modern default for serious projects |
## What NOT to Use
| Avoid | Why | Use Instead |
|---|---|---|
| Create React App (CRA) | Deprecated since 2023; no active maintenance; slow build tooling; no SSR | Next.js 15 or Vite |
| Material UI (MUI) | Heavy bundle (~300kb); opinionated design fights against custom dark financial theme; hard to customize without CSS specificity wars | shadcn/ui + Tailwind |
| Moment.js | Deprecated; 67kb minified; mutable API; poor tree-shaking | date-fns 3.x |
| Redux + Redux Toolkit | Overkill for solo dashboard; significant boilerplate; slower DX | Zustand (global state) + Tanstack Query (server state) |
| Mongoose / MongoDB | Schema flexibility is a liability for financial data; no free Atlas tier has enough storage for historical price data | Prisma + PostgreSQL |
| Express.js (standalone) | Next.js API routes replace Express for this scale; running two servers complicates deployment | Next.js API routes / Route Handlers |
| Serverless (Lambda) for primary API | Cold starts degrade user experience for dashboard that loads 11 sections; free tier Lambda has 1M requests/month but latency is unpredictable | EC2 t3.micro with PM2 |
| Firebase / Firestore | Google vendor lock-in; complex pricing at scale; Firestore querying limitations for financial aggregates | PostgreSQL on RDS |
| Chart.js (react-chartjs-2) | Not optimized for financial time-series; repaints entire canvas on data update; worse performance than Lightweight Charts for OHLCV | Lightweight Charts for price data |
| Axios in browser (for external financial APIs) | Yahoo Finance and News API block CORS from browsers; all external API calls MUST go through Next.js API routes | Server-side Axios in Next.js Route Handlers |
| JWT in localStorage | XSS vulnerable; store JWT in httpOnly cookies via NextAuth.js session strategy | NextAuth.js with httpOnly cookie sessions |
| dotenv directly | No type safety; missing vars cause runtime failures | @t3-oss/env-nextjs for validated, typed env vars |
## Stack Patterns by Variant
### Dashboard Section Architecture (11 independent sections)
### AI Analysis Pipeline
### Dark Theme Implementation
### AWS Free Tier Deployment
### Scheduled Analysis (node-cron)
## Version Compatibility
| Dependency Pair | Compatibility Note |
|---|---|
| Next.js 15 + React 19 | Next.js 15 ships with React 19 RC; fully stable as of Next.js 15.1+. Do NOT mix React 18 with Next.js 15's App Router — RSC types differ |
| NextAuth.js v5 + Next.js 15 | Auth.js v5 is the version that supports Next.js 15 App Router. Do NOT use NextAuth v4 — its middleware API is incompatible with Next.js 15 |
| Tanstack Query v5 + React 19 | v5 supports React 19 concurrent features. v4 has hydration mismatches with RSC |
| Tailwind CSS v4 + shadcn/ui | shadcn/ui supports Tailwind v4 as of 2025. Run `pnpm dlx shadcn@latest init` and select v4 — the CSS config format changed significantly from v3 |
| Prisma 5.x + PostgreSQL 16 | Fully compatible. Use `postgresql` provider. Enable `driverAdapters` preview feature for edge compatibility if needed later |
| Lightweight Charts 4.x + React | No official React wrapper; use `useEffect` + `useRef` pattern for chart lifecycle management. Community package `lightweight-charts-react-wrapper` exists but adds a layer — raw integration is cleaner |
| node-cron 3.x + Next.js 15 custom server | Must use `next build && node server.js` deployment, NOT `next start` — custom server replaces the default Next.js server |
| OpenTelemetry + Next.js 15 | Use `instrumentation.ts` file in project root (Next.js 15 stable feature) for OTel initialization — no custom server required for observability |
## Sources
- Next.js 15 official documentation and release notes (nextjs.org)
- React 19 release documentation
- Auth.js v5 documentation (authjs.dev)
- Prisma 5.x documentation (prisma.io)
- Tanstack Query v5 migration guide
- Tailwind CSS v4 release notes
- shadcn/ui documentation and changelog (ui.shadcn.com)
- Lightweight Charts documentation (tradingview.github.io/lightweight-charts)
- AWS free tier specifications (aws.amazon.com/free)
- Anthropic Claude API documentation (docs.anthropic.com)
- OpenTelemetry Node.js documentation (opentelemetry.io)
- node-cron documentation (npmjs.com/package/node-cron)
- General 2025 ecosystem knowledge: State of JS 2024 survey trends, ThePrimeagen/Theo ecosystem commentary, Fireship content
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

## Presentation-Grade Documentation

This project will be presented. Every session must:
- **Commit messages**: Descriptive, conventional-commit style — they tell the project story
- **GSD artifacts**: Keep STATE.md, ROADMAP.md, and phase plans current after every meaningful change
- **Code comments**: Explain _why_, not _what_ — especially for architectural decisions and non-obvious tradeoffs
- **Decision log**: Record key decisions in PROJECT.md's Key Decisions table with rationale
- **Session handoffs**: Use `/gsd-pause-work` at session end to create explicit context documents
- **PR descriptions**: Detailed summaries when shipping phases — these become presentation material
- **Architecture docs**: Update as the system evolves — diagrams, data flows, component responsibilities

Do NOT skip documentation steps to save time. The documentation IS the deliverable alongside the code.

## Skill-First Protocol

**MANDATORY:** Before starting ANY task, scan `.claude/skill-registry.md` for matching skills. Invoke matched skill(s) via the Skill tool before doing any work. If no skill matches, brainstorm whether to execute directly or create a new skill via `skill-creator:skill-creator` (and add it to the registry). This rule is non-negotiable and applies to every task regardless of size.

Registry location: `.claude/skill-registry.md`

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
