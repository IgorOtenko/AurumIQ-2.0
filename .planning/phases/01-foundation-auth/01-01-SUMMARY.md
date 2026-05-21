---
phase: 01-foundation-auth
plan: 01
subsystem: foundation
tags: [scaffold, next.js, prisma, dark-theme, env-validation]
dependency_graph:
  requires: []
  provides: [next-app, prisma-schema, dark-theme, env-validation, db-client]
  affects: [01-02, 01-03, 01-04]
tech_stack:
  added: [next.js-15, react-19, typescript-5, tailwind-4, prisma-5, nextauth-v5-beta, bcryptjs, zod, t3-env, vitest, playwright, prettier]
  patterns: [prisma-singleton, t3-env-validation, shadcn-css-vars, dark-only-theme]
key_files:
  created:
    - package.json
    - tsconfig.json
    - next.config.ts
    - postcss.config.mjs
    - .eslintrc.json
    - .prettierrc
    - .gitignore
    - .env.example
    - vitest.config.ts
    - playwright.config.ts
    - prisma/schema.prisma
    - src/lib/env.ts
    - src/lib/db.ts
    - src/app/globals.css
    - src/app/layout.tsx
    - src/app/page.tsx
  modified: []
decisions:
  - "Next.js 15.5.18 (not 16) per CLAUDE.md stack lock"
  - "Dark-only theme (no light mode toggle) — financial dashboards are always dark"
  - "Prisma singleton via globalThis for hot-reload safety"
  - "pnpm 11 with pnpm-workspace.yaml for build script approvals"
metrics:
  duration: "560s"
  completed: "2026-05-22"
---

# Phase 01 Plan 01: Next.js 15 Project Scaffold Summary

Next.js 15.5 project with Prisma User schema, dark financial theme CSS tokens, and @t3-oss/env-nextjs validation -- the typed, styled, database-aware foundation for all subsequent plans.

## What Was Built

### Task 1: Next.js 15 Scaffold (7a9b5ac)

Scaffolded Next.js 15 project from `create-next-app` template, downgraded from auto-installed v16 to locked v15.5.18 per CLAUDE.md. Installed all Phase 1 dependencies: Prisma 5, NextAuth v5 beta, bcryptjs, zod, @t3-oss/env-nextjs. Configured Vitest with React plugin and path aliases, Playwright with localhost baseURL, Prettier with Tailwind class sorting plugin, ESLint with next/core-web-vitals.

**Key files:** package.json, tsconfig.json (strict: true), next.config.ts (bcryptjs in serverExternalPackages), vitest.config.ts, playwright.config.ts, .prettierrc, .eslintrc.json

### Task 2: Prisma Schema, Env Validation, Dark Theme (43ff894)

Created Prisma User model (id, email, hashedPassword, name, createdAt, updatedAt) mapped to `users` table. Built type-safe env validation with @t3-oss/env-nextjs (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL). Created Prisma client singleton using globalThis pattern. Implemented dark financial theme with shadcn/ui CSS variable convention: navy background, cyan accent, green positive, red negative. Updated root layout with `dark` class and AurumIQ metadata.

**Key files:** prisma/schema.prisma, src/lib/env.ts, src/lib/db.ts, src/app/globals.css, src/app/layout.tsx, src/app/page.tsx, .env.example

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm build` exits 0 | PASS |
| package.json has next ^15 | PASS (15.5.18 installed) |
| tsconfig strict: true | PASS |
| Prisma schema has User model | PASS |
| env.ts validates DATABASE_URL, NEXTAUTH_SECRET | PASS |
| db.ts exports `db` PrismaClient | PASS |
| globals.css has --background, --positive, --negative | PASS |
| layout.tsx has className="dark" | PASS |
| .env.example has all keys | PASS |
| `npx prisma db push` | SKIPPED (no local PostgreSQL in worktree env) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Next.js 16 scaffolded instead of 15**
- **Found during:** Task 1
- **Issue:** `create-next-app@latest` installed Next.js 16.2.6, but CLAUDE.md mandates Next.js 15.x
- **Fix:** Rewrote package.json with `"next": "^15"`, replaced flat eslint config (v16) with .eslintrc.json (v15), reinstalled
- **Files modified:** package.json, eslint config
- **Commit:** 7a9b5ac

**2. [Rule 3 - Blocking] pnpm build scripts blocked by pnpm 11**
- **Found during:** Task 1
- **Issue:** pnpm 11 ignores build scripts by default; Prisma/esbuild/sharp need postinstall
- **Fix:** Used `pnpm approve-builds` which created pnpm-workspace.yaml with allowBuilds config
- **Files modified:** pnpm-workspace.yaml
- **Commit:** 7a9b5ac

**3. [Rule 2 - Missing functionality] .gitignore blocked .env.example**
- **Found during:** Task 2
- **Issue:** Scaffold's .gitignore had `.env*` which would prevent committing .env.example
- **Fix:** Changed to explicit ignore list (.env, .env.local, .env.*.local)
- **Files modified:** .gitignore
- **Commit:** 7a9b5ac

## Commit Log

| Task | Hash | Message |
|------|------|---------|
| 1 | 7a9b5ac | feat(01-01): scaffold Next.js 15 project with Phase 1 dependencies |
| 2 | 43ff894 | feat(01-01): add Prisma User schema, env validation, and dark financial theme |

## Known Stubs

None -- all code is functional, not placeholder.

## Self-Check: PASSED

All 16 key files verified present. Both commit hashes (7a9b5ac, 43ff894) confirmed in git log.
