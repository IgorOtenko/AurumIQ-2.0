---
phase: 2
slug: data-layer-api-ingestion
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-22
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm vitest run --reporter=verbose` |
| **Full suite command** | `pnpm vitest run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --reporter=verbose`
- **After every plan wave:** Run `pnpm vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | INFRA-04 | T-02-01 | Ticker input validated via Zod tickerSchema | unit | `pnpm vitest run src/lib/finance/__tests__/` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | INFRA-04 | — | N/A | unit+integration | `pnpm vitest run src/lib/finance/__tests__/price-pipeline.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | INFRA-04 | — | N/A | unit | `pnpm vitest run src/lib/finance/__tests__/adapters.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | INFRA-04 | — | N/A | unit+edge | `pnpm vitest run src/lib/finance/__tests__/cache.test.ts src/lib/finance/__tests__/edge-cases.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest configuration if not already present
- [ ] `src/lib/finance/__tests__/` — test directory for data adapters
- [ ] Test fixtures for Yahoo Finance API responses (partial, complete, error)

*Existing infrastructure covers Vitest config from Phase 1.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cache TTL prevents external API call | INFRA-04 | Requires timing verification with real DB | Fetch ticker, wait < TTL, fetch again, verify no network call in logs |

---

## SC-2 Coverage Note

SC-2 (NaN/null fallback with structured warning log) is covered by:
- `price-pipeline.test.ts` (Plan 01) — Zod safeParse partial response + financeLogger.warn assertion for price adapter
- `edge-cases.test.ts` (Plan 02) — partial ADR/ETF responses across multiple adapters
- `adapters.test.ts` (Plan 02) — per-adapter NaN/null field handling

No separate `validation.test.ts` is needed — SC-2 is distributed across adapter-specific test files.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
