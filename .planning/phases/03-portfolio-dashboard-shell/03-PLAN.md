---
phase: 03-portfolio-dashboard-shell
plan: 03
type: execute
waves:
  - id: 3A
    name: Foundation (shared infra)
    parallel: false
    status: in-progress
  - id: 3B
    name: CRUD API + UI (5 parallel agents)
    parallel: true
    depends_on: [3A]
    status: pending
  - id: 3C
    name: Integration & verification
    parallel: false
    depends_on: [3B]
    status: pending
files_modified:
  - prisma/schema.prisma
  - src/lib/portfolio/schemas.ts
  - src/lib/portfolio/types.ts
  - src/lib/portfolio/api-client.ts
  - src/components/providers/QueryProvider.tsx
  - src/app/layout.tsx
  - package.json
autonomous: true
requirements:
  - PORTFOLIO-01
  - DASHBOARD-SHELL-01
user_setup: []
---

<objective>
Deliver portfolio CRUD (add/list/update/delete holdings) plus the dashboard shell that
hosts the eventual 11 analysis sections. Wave 3A lays the shared foundation so Wave 3B
agents can build CRUD API, holdings table, add-holding form, dashboard layout, and
empty-state UX in parallel without conflicts. Wave 3C wires everything together and
adds integration tests.
</objective>

<wave id="3A">
Foundation work performed up-front by a single executor:

- Holding model on Prisma (+ User.holdings back-relation), schema pushed to PG
- Zod schemas (addHoldingSchema, updateHoldingSchema) under src/lib/portfolio/schemas.ts
- Shared types: SerializedHolding, EnrichedHolding under src/lib/portfolio/types.ts
- React Query provider mounted in app/layout.tsx (Client Component, devtools dev-only)
- Portfolio fetch client (listHoldings, addHolding, updateHolding, deleteHolding)
- Packages: @tanstack/react-query, @tanstack/react-query-devtools, react-hook-form, @hookform/resolvers
</wave>

<wave id="3B">
Five agents run in parallel against the locked contracts above:

1. CRUD API — GET/POST /api/portfolio + PATCH/DELETE /api/portfolio/[id]; auth-gated;
   enriches holdings by calling the existing /api/finance/[ticker]?type=price adapter
2. Holdings table component — Tanstack Table v8 + shadcn/ui Table, useQuery(listHoldings)
3. Add-holding form — react-hook-form + zodResolver(addHoldingSchema), useMutation(addHolding)
4. Dashboard shell layout — sidebar nav + ticker selector + section grid scaffold (no AI yet)
5. Empty-state + delete confirmation dialogs — shadcn/ui Dialog + AlertDialog
</wave>

<wave id="3C">
- Wire holdings table -> ticker selector -> dashboard section grid
- Playwright E2E: signup -> add holding -> see it in table -> delete it
- Vitest integration tests for portfolio API route handlers
- Update STATE.md, ROADMAP.md, PROJECT.md key decisions
</wave>

<verification>
Wave 3A: tsc --noEmit silent, vitest run green, pnpm build succeeds, prisma db push idempotent.
Wave 3B: each agent's slice unit-tested; no cross-file conflicts at merge.
Wave 3C: E2E green; manual UI walk-through; documentation updated.
</verification>
