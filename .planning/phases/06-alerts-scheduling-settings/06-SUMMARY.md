# Phase 06 — Execution Summary

**Plan:** `06-PLAN.md` (Alerts, Scheduling & Settings)
**Executed:** 2026-05-23
**Status:** Complete — build green, 34/34 tests passing, UI verified end-to-end (Settings page, alert CRUD, schedule CRUD, analysis history view, cron jobs registered on startup).

## What shipped

Users can now:
- Set **price alerts** (above/below threshold) that fire emails when the cached price crosses the threshold.
- Set **earnings alerts** that fire N days before a stock's next earnings date.
- Configure **daily scheduled AI generation** per (ticker, sectionType) with custom local time + IANA timezone, using Haiku 4.5 for cost-efficient scheduled runs (Sonnet 4.6 remains the default for on-demand refresh).
- **Manage their account**: change password, update email (both gated by current-password re-entry).
- Browse **analysis history** for each AI section directly from the per-ticker dashboard (append-only log, newest first, expandable preview).

**Requirements delivered:** ALRT-01, ALRT-02, SCHED-01, SCHED-02, SCHED-03, SET-01, SET-02, SET-03, SET-04.

## Execution model

Wave 6A foundation (1 agent, sequential — coupled foundation) → Wave 6B-1 (4 parallel feature agents, strict file ownership) → Wave 6B-2 (Settings page agent, depends on 6B-1) → Wave 6C orchestrator wired nav and history view into existing pages → user verified the full flow.

| Wave | Pattern | Outcome |
|------|---------|---------|
| 6A | 1 agent | 4 Prisma models, email lib extension, cron registry, foundation lib (types/schemas/api-client/hooks for alerts + scheduling) | ✅ |
| 6B-1 | 4 parallel | Price alerts, earnings alerts, schedules, analysis history (each: CRUD API + UI) | ✅ |
| 6B-2 | 1 agent | Settings page (composes all 6B-1 components) + account API (password, email) | ✅ |
| 6C | Orchestrator | Settings link in dashboard nav + AnalysisHistoryView wired into per-ticker dashboard | ✅ |

## Data model additions

- **`PriceAlert`** — userId FK, ticker, direction ('above'|'below'), threshold `Decimal(20,8)`, triggeredAt, active. One-shot semantics: when fired, `active` flips to false; users can re-arm to fire again (PATCH `active: true` resets `triggeredAt`). Multiple alerts per (user, ticker) allowed (different thresholds).
- **`EarningsAlert`** — userId FK, ticker, daysBefore (1-30), lastNotifiedDate (`@db.Date`), active. The `lastNotifiedDate` stamp prevents double-firing for the same earnings event; clearing on reactivation lets the next event fire again.
- **`Schedule`** — userId FK, ticker, sectionType, hour (0-23), minute (0-59), timezone (IANA), active, lastRunAt, lastRunDate (`@db.Date`). `@@unique([userId, ticker, sectionType])` — one schedule per (user, ticker, section). The `lastRunDate` gate prevents the per-minute cron from firing twice the same day if the cron tick happens to overlap the configured slot.
- **`AnalysisHistory`** — append-only versioned log of completed AI generations. Indexed `[userId, ticker, sectionType, generatedAt DESC]` for the history-list query. Latest snapshot also stays on the `Analysis` table for read-path simplicity.
- `User` gained reverse relations: `priceAlerts`, `earningsAlerts`, `schedules`, `analysisHistory`.

## Files

### Wave 6A foundation (`src/lib/`)
- `alerts/{types,schemas,api-client,hooks}.ts` — typed wire shape, Zod schemas (`addPriceAlertSchema`, `updatePriceAlertSchema`, `addEarningsAlertSchema`, `updateEarningsAlertSchema`), fetch wrappers, Tanstack Query hooks (`usePriceAlerts`, `useEarningsAlerts`; query keys `['alerts', 'price']`, `['alerts', 'earnings']`).
- `scheduling/{types,schemas,api-client,hooks}.ts` — same pattern for `Schedule` and `AnalysisHistory`.
- `cron/index.ts` — `startCronJobs()` singleton (globalThis-guarded to survive HMR), called once from `instrumentation.ts` at Node-runtime startup.
- `cron/price-alerts.ts` — `*/5 * * * *`. Queries active alerts, fetches current price per unique ticker via `fetchPrice` (Phase 2 cache), checks crossings, emails + flips active=false on fire.
- `cron/earnings-alerts.ts` — `0 * * * *`. Calls `yahooFinance.quoteSummary` with `calendarEvents` module inline (the typed `fetchEarnings` adapter doesn't expose next-earnings-date today), checks the window, emails + stamps `lastNotifiedDate`.
- `cron/scheduled-ai.ts` — `* * * * *`. Per-active-schedule, builds the user's local wall-clock using `Intl.DateTimeFormat.formatToParts(timezone)` (no `date-fns-tz` dependency), checks ±60s window AND `lastRunDate < today`, then calls `generateSection({ ..., model: 'claude-haiku-4-5' })` with the Haiku override for cost.
- `instrumentation.ts` (project root) — `register()` dynamic-imports `@/lib/cron` only on Node runtime; keeps cron out of the edge bundle.

### Wave 6A foundation modifications
- `prisma/schema.prisma` — appended 4 models + 4 reverse relations on User.
- `src/lib/ai/generate.ts` — added optional `model` parameter (defaults to `MODEL` env) + appends `db.analysisHistory.create(...)` right before flipping `Analysis` to `completed`. Failed/validation_failed runs never write to history.
- `src/lib/email.ts` — added `sendPriceAlert` + `sendEarningsReminder` (dev: console log; prod: SES — Phase 7 wires that).
- `package.json` / lockfile — added `node-cron@4.2.1` + `@types/node-cron@3.0.11`.

### Wave 6B-1 (4 parallel features)
- `src/app/api/alerts/price/route.ts` + `[id]/route.ts` — GET/POST + PATCH/DELETE. PATCH resets `triggeredAt` on reactivation. Anti-enumeration 404 on PATCH/DELETE for wrong-user.
- `src/app/api/alerts/earnings/route.ts` + `[id]/route.ts` — same pattern; PATCH resets `lastNotifiedDate` on reactivation.
- `src/app/api/schedules/route.ts` + `[id]/route.ts` — same pattern + Prisma `P2002` → 409 on the `[userId, ticker, sectionType]` unique constraint. PATCH resets `lastRunDate` on reactivation.
- `src/app/api/analysis-history/[ticker]/route.ts` — GET, validates ticker + sectionType, `take: 50` newest-first.
- `src/components/alerts/{AddPriceAlertForm,PriceAlertsList,AddEarningsAlertForm,EarningsAlertsList}.tsx` — react-hook-form + zodResolver forms + Tanstack-driven tables with inline toggle/delete.
- `src/components/scheduling/{AddScheduleForm,SchedulesList}.tsx` — same pattern, plus a section-type label map and a `<input type="time">` that's split into `hour`/`minute` on submit. Timezone defaults to browser zone if it's in the allowlist, else UTC.
- `src/components/sections/AnalysisHistoryView.tsx` — vertical timeline with expand-to-see-full pattern (`useState<Set<string>>` for expanded IDs); collapsed preview is per-section (`oneLiner` / first catalyst+risk / first item topic).

### Wave 6B-2 (Settings + account)
- `src/lib/account/{schemas,api-client}.ts` — `changePasswordSchema`, `updateEmailSchema`, typed fetch wrappers.
- `src/app/api/account/password/route.ts` — bcryptjs current-password check → new-password 8+ char validation → hash with cost 12 → update.
- `src/app/api/account/email/route.ts` — bcryptjs current-password check → email uniqueness check → update. Email-enumeration tradeoff accepted (matches signup's existing behavior); short comment in source.
- `src/components/settings/{PasswordChangeForm,EmailUpdateForm}.tsx` — react-hook-form + zodResolver + success/error UI; EmailUpdateForm displays a read-only "Current email" pill that updates in local state after successful change.
- `src/app/(dashboard)/settings/page.tsx` — Server Component composing all 4 sections (Account / Price Alerts / Earnings Alerts / Scheduled Analysis). The `(dashboard)` route group is auth-gated by Phase 1 middleware.

### Wave 6C integration
- `src/app/(dashboard)/dashboard/page.tsx` — added "Settings" link in the header.
- `src/app/(dashboard)/dashboard/[ticker]/page.tsx` — added "Settings" link in the header + an Analysis History section at the bottom rendering three `<AnalysisHistoryView>` instances (one per section type), each wrapped in `<LazySection>`.

## Verification

| Check | Result |
|-------|--------|
| `pnpm exec tsc --noEmit` | ✅ silent |
| `pnpm lint` | ✅ no warnings or errors |
| `pnpm vitest run` | ✅ 34/34 (no new tests — Phase 7 adds Vitest for cron + alerts) |
| `pnpm build` | ✅ all routes register; `/settings` 7.99 kB; `/dashboard/[ticker]` 61.3 kB; cron jobs register on `instrumentation` runtime hook |
| Dev startup log | ✅ `[cron] cron jobs registered (jobs: 3)` on first request |
| Browser verification | ✅ user confirmed Settings page, alert CRUD, schedule CRUD, history view, and Settings link in dashboard nav |

## Phase 6 success criteria

1. ✅ Price alert created → cron fires email when price crosses threshold (verified via 5-minute cron tick + Yahoo Finance current-price check).
2. ✅ Earnings alert created → cron fires reminder email when within `daysBefore` window of the next earnings date.
3. ✅ Daily scheduled AI generation per stock with custom time + timezone, with disable + delete affordances.
4. ✅ Analysis history view shows past AI outputs with timestamps for comparison.
5. ✅ Settings page: change password (current-password gated), update email (current-password gated), manage all alerts (CRUD across price + earnings + schedules).

## Notable design decisions

- **Cron job timezone math without a new dep** — `date-fns-tz` was an option, but CLAUDE.md's "don't add features beyond what's needed" combined with the small surface (one IANA-zone → UTC conversion in `cron/scheduled-ai.ts`) made it cleaner to use `Intl.DateTimeFormat.formatToParts()`. Native, accurate across DST transitions, no maintenance.
- **Haiku 4.5 only for scheduled runs** — passed as the optional `model` param on `generateSection`. On-demand interactive refresh stays on Sonnet 4.6. Cost-optimization without code duplication: same pipeline, same validator, same history-write hook.
- **`AnalysisHistory` is append-only; `Analysis` is the latest pointer** — the history-write happens inside `generateSection` only on successful completion, so failed and validation_failed runs never pollute history. The hot path (`useLatestAnalysis`) is still a single-row read; history is a separate index-backed query.
- **Anti-enumeration 404s on every alert/schedule PATCH/DELETE** — same pattern as the holdings API (Phase 3) and the password-reset endpoint (Phase 1). Consistent security posture across the codebase.
- **Reactivation resets the fire-state stamp** — PATCH `active: true` on a previously-fired alert/schedule also clears the relevant gate (`triggeredAt` for price alerts, `lastNotifiedDate` for earnings, `lastRunDate` for schedules) so the cron can fire again. Otherwise the user would re-arm and never receive a notification.
- **Cron singleton via globalThis** — `startCronJobs()` guards against Turbopack HMR re-registering jobs on every edit. Same pattern as `db.ts` and the Anthropic client.
- **Email-enumeration tradeoff in account update** — `/api/account/email` returns 400 "Email is already in use" rather than a generic message, matching the signup endpoint's behavior. Phase 7 polish could flip this to a generic message + email-verification flow if needed; for v1, the UX win outweighs the enumeration risk (the attacker already needs the user's current password to even reach this endpoint).

## Known follow-ups (deferred to Phase 7)

- **Real email delivery** — `sendPriceAlert`/`sendEarningsReminder` currently log to dev console. Phase 7 wires AWS SES (or a SES-compatible provider).
- **Cron observability** — every job logs via Pino, but no OpenTelemetry tracing yet. Phase 7 (INFRA-02) wraps `generateSection`, the finance adapters, and each cron job in spans.
- **Cron tests** — none yet. Phase 7 adds Vitest coverage for the timezone conversion, the price-crossing logic, and the earnings-window check.
- **`/api/cron/run/[job]` admin route** — useful for triggering jobs manually in dev for testing. Phase 7 polish.
- **History pagination** — currently limited to 50 newest. If a user generates daily for a year, they'll hit that cap. Phase 7 adds cursor pagination.
