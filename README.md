# AurumIQ

AI-powered financial analysis platform — portfolio tracking with on-demand and scheduled Claude-generated research per holding.

## What it does

AurumIQ is a single Next.js app that gives a logged-in user a per-stock research dashboard. The user signs up, adds tickers to their portfolio, and clicks any holding to open a per-ticker dashboard. The dashboard is split into ten modular sections that each fetch independently — five data sections (Stock Header, Numbers Going In, QoQ/YoY Trend, Analyst Setup, Sources) backed by the validated Yahoo Finance adapter layer, three AI sections (Bull vs Bear, Catalysts & Risks, Live on the Call) backed by Claude with structured outputs and a traceability validator, plus the Stock Ticker Bar and three Analysis History views.

Sections lazy-mount as the user scrolls and are isolated by per-section error boundaries, so a single failing section never takes the page down. The three AI sections stream progress over SSE during generation. Every completed AI run is appended to an `AnalysisHistory` table for browsable per-ticker history.

From the Settings page the user can change their password, update their email (both gated by current-password re-entry), and CRUD all their price alerts, earnings alerts, and per-section daily AI schedules. Three in-process `node-cron` jobs (price alerts every 5 minutes, earnings alerts hourly, scheduled AI every minute) drive notifications and scheduled regeneration using the cheaper Haiku model.

## Tech stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | ^15 | App Router, Route Handlers, in-process cron host |
| React | ^19 | UI rendering with Server Components |
| TypeScript | ^5 | Type safety across the full stack |
| Tailwind CSS | ^4 | Utility-first styling, dark financial theme |
| shadcn/ui + @base-ui/react | latest | Component primitives |
| Prisma | ^5 | Type-safe ORM, migrations |
| PostgreSQL | 16 | Primary database (local Docker, RDS in prod) |
| Auth.js (NextAuth) | 5.0.0-beta.25 | Credentials auth with JWT in httpOnly cookies |
| Tanstack Query | ^5 | Per-section server state, shared cache |
| react-hook-form + Zod | ^7 / ^3 | Validated forms and API boundaries |
| Anthropic SDK | ^0.98 | Claude API client, structured outputs |
| yahoo-finance2 | ^3.14 | Financial data adapter source |
| lightweight-charts | ^4.2 | Financial time-series charts |
| node-cron | ^4.2 | In-process scheduling |
| Pino | ^9 | Structured JSON logging |
| OpenTelemetry SDK | 0.218 / API 1.9 | Traces and metrics |
| Vitest | ^3 | Unit / integration tests |
| Playwright | ^1 | E2E tests |
| bcryptjs | ^2 | Password hashing (pure JS, EC2-friendly) |
| @t3-oss/env-nextjs | ^0.11 | Type-safe env validation |

## Architecture at a glance

```
Browser
  ├── (auth)  signup, login, password reset
  └── (dashboard)                        [middleware-gated]
        ├── /dashboard                   portfolio CRUD + ticker bar
        ├── /dashboard/[ticker]          10 lazy-mounted sections
        └── /settings                    account, alerts, schedules

Next.js process (single Node.js runtime)
  ├── API Route Handlers   (auth / portfolio / finance / ai / alerts / schedules / account / analysis-history)
  ├── instrumentation.ts   initTelemetry() → startCronJobs()
  ├── node-cron jobs       price-alerts (5m), earnings-alerts (1h), scheduled-ai (1m)
  └── adapters             Yahoo Finance (6 data types, JSONB cache)

PostgreSQL 16
  users · password_reset_tokens · holdings · raw_data
  analyses · analysis_history · price_alerts · earnings_alerts · schedules
```

See [`docs/architecture.md`](docs/architecture.md) for the full system architecture, data flows, and tradeoffs.

## Getting started

### Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- Docker (for the local Postgres container)

### Install

```bash
pnpm install
```

### Database

The repo ships a `docker-compose.yml` with a Postgres 16 container pre-configured for local dev:

```bash
docker compose up -d
npx prisma db push
```

### Environment

Copy the example file and fill in the required values:

```bash
cp .env.example .env
```

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | `postgresql://aurumiq:...@localhost:5432/aurumiq` |
| `NEXTAUTH_SECRET` | JWT signing secret (≥32 chars) | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | App URL (required in prod) | `http://localhost:3000` |
| `ANTHROPIC_API_KEY` | Claude API key | `sk-ant-...` |
| `ANTHROPIC_MODEL` | (optional) Override default model | `claude-sonnet-4-6` |

Generate a secret with `openssl rand -base64 32`.

### Run

```bash
pnpm dev
```

The dev server starts at [http://localhost:3000](http://localhost:3000). The first request also boots OpenTelemetry and registers the three cron jobs (you'll see a `cron jobs registered (jobs: 3)` log line).

## Available scripts

| Command | Description |
|---|---|
| `pnpm dev` | Next.js dev server (Turbopack) on port 3000 |
| `pnpm build` | Production build |
| `pnpm start` | Production server (use `node server.js` if cron is wanted — see Deployment) |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest in watch mode |
| `pnpm vitest run` | Vitest single run (CI) |
| `pnpm test:e2e` | Playwright E2E suite |
| `pnpm format` | Prettier write |
| `pnpm format:check` | Prettier check |
| `npx prisma studio` | Database GUI |
| `npx prisma db push` | Sync schema to the database |

## Project structure

```
src/
  app/
    (auth)/                  login, signup, password reset
    (dashboard)/             portfolio, /dashboard/[ticker], settings
    api/                     auth, portfolio, finance, ai, alerts, schedules, account, analysis-history
  components/
    sections/                10 dashboard sections (5 data, 3 AI, history, ticker bar)
    portfolio/               table, ticker bar, add form
    alerts/ scheduling/      Settings sub-components
    dashboard/               LazySection, SectionWrapper, SectionSkeleton
    providers/               QueryProvider
    ui/                      shadcn primitives
  hooks/                     useInView
  lib/
    ai/                      prompts, schemas, generate, validation, client, hooks
    finance/                 adapters, schemas, cache, hooks, yahoo-client
    alerts/ scheduling/      types, schemas, api-client, hooks
    cron/                    price-alerts, earnings-alerts, scheduled-ai, index
    telemetry/               tracer, metrics, spans
    auth.ts, auth.config.ts, db.ts, env.ts, email.ts, logger.ts, utils.ts
  instrumentation.ts         OTel + cron boot
prisma/schema.prisma         9 models
docs/                        architecture, ai-pipeline, observability
tests/                       unit, e2e
```

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — system architecture, data flows, data model, tradeoffs
- [`docs/ai-pipeline.md`](docs/ai-pipeline.md) — prompts, structured outputs, validator, failure modes
- [`docs/observability.md`](docs/observability.md) — Pino + OpenTelemetry instrumentation, metric inventory

## Security notes

- Passwords hashed with bcryptjs cost factor 12 (pure JS — no native bindings to fight on EC2).
- JWT sessions in **httpOnly cookies** — no tokens in localStorage, no XSS theft vector.
- **Anti-enumeration responses** on login (`/api/auth/[...nextauth]`), password reset (`/api/auth/reset-password`), and every alert / schedule PATCH/DELETE (404 not 403 when the row exists but belongs to another user).
- Password reset tokens are 128-bit UUIDs, single-use (atomic `$transaction`), 1-hour expiry.
- Edge middleware protects every `(dashboard)` route; server-side `auth()` checks in layouts provide defense-in-depth.
- `@t3-oss/env-nextjs` validates env at startup — server-only secrets cannot leak into the client bundle.
- `.env`, `.env.local`, `*.pem`, `*.key` are gitignored. Recommended: install [`git-secrets`](https://github.com/awslabs/git-secrets) to block accidental credential commits.

## Deployment

Target topology is AWS free tier — EC2 t3.micro for the Next.js process, RDS db.t3.micro for Postgres. The in-process cron jobs require a long-lived Node server, so production runs as `node server.js` after `next build` (not `next start`). See [`docs/architecture.md`](docs/architecture.md#deployment-topology) for the deployment notes.

## License

MIT
