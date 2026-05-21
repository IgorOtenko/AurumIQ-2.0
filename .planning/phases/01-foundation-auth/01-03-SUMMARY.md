---
phase: 01-foundation-auth
plan: 03
subsystem: auth
tags: [password-reset, token-auth, email-abstraction, security]
dependency_graph:
  requires: [01-01, 01-02]
  provides: [password-reset-flow, email-abstraction, password-reset-token-model]
  affects: [01-04]
tech_stack:
  added: []
  patterns: [token-based-reset, anti-enumeration-response, atomic-transaction, suspense-search-params]
key_files:
  created:
    - prisma/schema.prisma (PasswordResetToken model added)
    - src/lib/email.ts
    - src/app/api/auth/reset-password/route.ts
    - src/app/api/auth/reset-password/confirm/route.ts
    - src/app/(auth)/reset-password/page.tsx
    - src/app/(auth)/reset-password/confirm/page.tsx
  modified:
    - pnpm-workspace.yaml
decisions:
  - "Atomic transaction for password update + token consumption prevents partial state"
  - "Email abstraction throws in production until Phase 6 SES — fail-loud over fail-silent"
  - "Anti-enumeration: identical 200 response whether email exists or not (T-01-07)"
metrics:
  duration: "351s"
  completed: "2026-05-22"
---

# Phase 01 Plan 03: Password Reset Flow Summary

Token-based password reset with anti-enumeration responses, 1-hour expiry, single-use enforcement, bcrypt(12) rehashing, and dev-mode console email delivery -- completing AUTH-04.

## What Was Built

### Task 1: PasswordResetToken model, reset API endpoints, and email abstraction (4d7aeb1)

Added PasswordResetToken model to Prisma schema with uuid primary key, unique token field, email, expiresAt, nullable usedAt for single-use tracking, and createdAt. Created email abstraction that logs reset URLs to console in dev and throws in production (Phase 6 wires SES). Built two API endpoints: POST /api/auth/reset-password generates a crypto.randomUUID() token, cleans up old unused tokens, stores with 1-hour expiry, and returns identical 200 response regardless of email existence (T-01-07). POST /api/auth/reset-password/confirm validates token as UUID via Zod, rejects expired/used tokens, hashes new password with bcrypt(12), and atomically updates password + marks token used via Prisma $transaction.

**Key files:** prisma/schema.prisma, src/lib/email.ts, src/app/api/auth/reset-password/route.ts, src/app/api/auth/reset-password/confirm/route.ts

### Task 2: Password reset UI pages (d9f362f)

Built reset request page with email input form that shows generic success message after submission (hiding the form to prevent re-submission). Built reset confirm page that reads token from URL search params, validates passwords match and meet min-length client-side, and POSTs to confirm endpoint. Wrapped useSearchParams() in Suspense boundary per Next.js 15 requirement. Shows distinct states for: no token in URL, form entry, success with login link, and error with link to request new reset. Both pages use identical Card/Input/Button/Label components as login and signup pages for visual consistency.

**Key files:** src/app/(auth)/reset-password/page.tsx, src/app/(auth)/reset-password/confirm/page.tsx

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm build` exits 0 | PASS |
| prisma/schema.prisma contains PasswordResetToken model | PASS |
| PasswordResetToken has @unique token field | PASS |
| src/lib/email.ts exports sendPasswordResetEmail | PASS |
| Email logs to console when NODE_ENV !== production | PASS |
| POST /api/auth/reset-password returns 200 for any email | PASS (by code inspection) |
| POST /api/auth/reset-password/confirm rejects expired tokens | PASS (by code inspection) |
| POST /api/auth/reset-password/confirm uses bcrypt(12) | PASS |
| Confirm page wrapped in Suspense boundary | PASS |
| Confirm page validates passwords match | PASS |
| /reset-password route in build output | PASS |
| /reset-password/confirm route in build output | PASS |

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-01-07 | Identical 200 response whether email exists or not; prevents enumeration |
| T-01-08 | crypto.randomUUID() for 128-bit entropy; 1-hour expiry; single-use enforcement |
| T-01-09 | Zod validates token as UUID format; password min 8 chars; bcrypt cost 12 |
| T-01-10 | usedAt checked before accepting; Prisma $transaction atomically updates password + marks used |
| T-01-11 | Console logging accepted as dev-only; production throws until SES integration |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] msw build scripts not approved in pnpm-workspace.yaml**
- **Found during:** Task 1 verification
- **Issue:** `pnpm build` failed because msw@2.14.6 postinstall script was not approved
- **Fix:** Set `msw: true` in pnpm-workspace.yaml allowBuilds
- **Files modified:** pnpm-workspace.yaml
- **Commit:** 4d7aeb1

**2. [Rule 2 - Missing functionality] Atomic transaction for password update**
- **Found during:** Task 1 implementation
- **Issue:** Plan described sequential update + mark-used; race condition possible if either fails
- **Fix:** Wrapped password update and token consumption in Prisma $transaction
- **Files modified:** src/app/api/auth/reset-password/confirm/route.ts
- **Commit:** 4d7aeb1

## Commit Log

| Task | Hash | Message |
|------|------|---------|
| 1 | 4d7aeb1 | feat(01-03): add PasswordResetToken model, reset API endpoints, and email abstraction |
| 2 | d9f362f | feat(01-03): add password reset UI pages (request and confirm forms) |

## Known Stubs

None -- all code is functional. The email abstraction intentionally throws in production; this is documented behavior, not a stub. Phase 6 replaces the production path with AWS SES.

## Self-Check: PASSED
