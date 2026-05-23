---
phase: 06-alerts-scheduling-settings
plan: 06
type: execute
waves:
  - id: 6A
    name: Foundation (data layer + scheduler + email infra)
    parallel: false
    status: in-progress
  - id: 6B
    name: Feature surfaces (5 parallel agents)
    parallel: true
    depends_on: [6A]
    status: pending
  - id: 6C
    name: Integration & verification
    parallel: false
    depends_on: [6B]
    status: pending
files_modified:
  - package.json
  - prisma/schema.prisma
  - src/lib/email.ts
  - src/lib/ai/generate.ts
  - src/lib/cron/**
  - src/lib/alerts/**
  - src/lib/scheduling/**
  - src/instrumentation.ts
autonomous: true
---

# Phase 6 — Alerts, Scheduling, Settings, History

Add user-facing automation and history to AurumIQ: price-cross and
earnings-date alerts, daily scheduled AI regeneration, an account
settings surface, and a history view for past analyses.

## Wave 6A — Foundation (this work)

Shared contracts and infrastructure that the parallel surface work
depends on. No UI, no API routes — just the data layer + scheduler.

- `node-cron` added; `@types/node-cron` dev-dep.
- Prisma: `PriceAlert`, `EarningsAlert`, `Schedule`, `AnalysisHistory`
  models with cascade-delete via `User`; matching reverse relations.
- `src/lib/ai/generate.ts` extended: optional `model` override for cron
  Haiku runs, and a write to `AnalysisHistory` on every `completed` run.
- `src/lib/email.ts` extended: `sendPriceAlert`, `sendEarningsReminder`
  (dev = console; production throws until SES wires up in Phase 7).
- `src/lib/cron/{price-alerts,earnings-alerts,scheduled-ai,index}.ts`
  registers three jobs. `src/instrumentation.ts` boots them via
  Next.js 15 `instrumentation` hook inside the Node.js runtime only.
- `src/lib/alerts/{types,schemas,api-client,hooks}.ts` and
  `src/lib/scheduling/{types,schemas,api-client,hooks}.ts` expose the
  Zod-validated wire contracts the 5 surface agents will bind to.

Design decisions:
- Cron singleton via `globalThis` keeps HMR from registering duplicate
  jobs in dev.
- Price alerts de-dupe ticker fetches inside a tick — 50 alerts on AAPL
  hit Yahoo once. Each alert is wrapped in try/catch so one bad row
  cannot kill the loop.
- Scheduled-AI converts local `(hour, minute, timezone)` to UTC with
  `Intl.DateTimeFormat` (no `date-fns-tz` dependency). A ±60s window
  plus a `lastRunDate` date-stamp gates re-firing if the minute-cron
  fires twice the same minute.
- `AnalysisHistory` is append-only and writes inside the existing
  `generateSection` completed branch; the latest row stays on
  `Analysis` so reads remain a single-row lookup.
- Scheduled runs use `claude-haiku-4-5` (env-overridable via the
  existing `ANTHROPIC_MODEL`, but pinned in cron for cost). Sonnet
  remains the default for interactive POSTs.

## Wave 6B — Five parallel agents

1. Price-alerts API + UI surface.
2. Earnings-alerts API + UI surface.
3. Schedules API + Settings page UI.
4. Analysis history API + history view UI.
5. Account settings (profile, password change, timezone preference).

Each agent builds against the locked types/schemas/clients from 6A and
adds only its own route handlers + components.

## Wave 6C — Integration & verification

- Wire surfaces into the dashboard + settings page navigation.
- End-to-end test: arm an alert, drive a price tick, see email log.
- Update README and STATE.md.
