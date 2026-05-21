# Walking Skeleton: AurumIQ

**Phase:** 01-foundation-auth
**Created:** 2026-05-21

## Architectural Decisions

These decisions are locked for all subsequent phases. Do not renegotiate.

### Framework & Runtime

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js 15.x (App Router) | RSC + API routes = no separate backend; interview-standard |
| Language | TypeScript 5.x strict mode | Full-stack type safety |
| Package Manager | pnpm 9.x | Strict deps, fast installs |
| Node Version | 20.x LTS | Required for Next.js 15 |

### Database & ORM

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | PostgreSQL 16.x | Relational model fits portfolio + analysis; JSONB for flexible AI output |
| ORM | Prisma 5.x | Type-safe queries; migrations; schema-as-docs |
| Dev DB | Local PostgreSQL (Docker or native) | No AWS dependency for dev |
| Connection | DATABASE_URL env var via @t3-oss/env-nextjs | Server-only validation at startup |

### Authentication

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth Library | Auth.js v5 (NextAuth v5) | Native App Router support; JWT sessions |
| Session Strategy | JWT in httpOnly cookies | No session DB table needed; secure by default |
| Password Hashing | bcryptjs (pure JS) | No native bindings; works on any OS/EC2 |
| Provider | Credentials (email + password) | Simple; user-owned; no third-party OAuth dependency |

### Styling & UI

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CSS Framework | Tailwind CSS 4.x | JIT; dark mode via class strategy; minimal runtime |
| Component Library | shadcn/ui (latest 2025) | Copy-paste ownership; Radix accessibility; dark theme built-in |
| Theme | Dark financial theme | Slate/navy bg, green positive, red negative, cyan accent |

### Environment & Security

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Env Validation | @t3-oss/env-nextjs | Server-only keys enforced at startup; fail-fast |
| Secret Scanning | git-secrets pre-commit hook | Prevents API key commits |
| API Key Policy | ALL external calls through Route Handlers only | No key ever in frontend bundle |

### Testing

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Unit/Integration | Vitest 2.x | Vite-based; faster than Jest; TS native |
| E2E | Playwright 1.x | Auth flow, dashboard render, portfolio CRUD |
| Linting | ESLint 9.x + @typescript-eslint | Next.js config included |
| Formatting | Prettier 3.x + prettier-plugin-tailwindcss | Class sorting |

### Deployment (Production)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Compute | AWS EC2 t3.micro (free tier) | 750 hrs/month; runs Node.js via PM2 |
| Database | AWS RDS db.t3.micro (free tier) | 750 hrs/month; 20GB; managed PG |
| Process Manager | PM2 5.x | Auto-restart; cluster mode; log rotation |
| Reverse Proxy | Nginx | SSL termination; static asset caching |

### Directory Layout

```
aurumiq/
  src/
    app/
      (auth)/
        login/page.tsx
        signup/page.tsx
        reset-password/page.tsx
      (dashboard)/
        dashboard/
          [ticker]/page.tsx
        layout.tsx              # Protected layout with auth check
      api/
        auth/[...nextauth]/route.ts
      layout.tsx                # Root layout (dark theme, fonts)
      page.tsx                  # Landing/redirect
    components/
      ui/                       # shadcn/ui components
    lib/
      auth.ts                   # Auth.js config
      db.ts                     # Prisma client singleton
      env.ts                    # @t3-oss/env-nextjs schema
    types/
  prisma/
    schema.prisma
  public/
  tests/
    e2e/
    unit/
```

### Local Run Command

```bash
# Prerequisites: Node 20+, pnpm, PostgreSQL running locally
pnpm install
cp .env.example .env.local    # Fill in DATABASE_URL, NEXTAUTH_SECRET
npx prisma db push
pnpm dev                      # http://localhost:3000
```

## Skeleton Verification

The walking skeleton is complete when:

1. `pnpm dev` starts without errors
2. Visiting `/signup` renders a form
3. Submitting signup creates a row in the `users` table
4. After signup, user is redirected to `/dashboard` (protected route)
5. Refreshing `/dashboard` maintains session (JWT cookie persists)
6. Visiting `/dashboard` while logged out redirects to `/login`
7. Dark theme renders (dark background, not white)

---
*Skeleton created: 2026-05-21*
