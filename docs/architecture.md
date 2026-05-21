# AurumIQ Architecture

## Overview

AurumIQ is a full-stack monolith built on Next.js 15 with the App Router. All frontend rendering, API endpoints, and authentication run within a single Next.js process. This keeps the deployment footprint within AWS free tier (single EC2 t3.micro) while maintaining clear separation of concerns through the file-system-based routing convention.

**Runtime:** Node.js 20+ with Next.js 15 App Router
**Database:** PostgreSQL 16 via Prisma ORM 5.x
**Authentication:** Auth.js v5 (NextAuth) with Credentials provider
**Styling:** Tailwind CSS v4 with shadcn/ui components and a dark financial theme

## Authentication Architecture

### Split Config Pattern

Auth.js v5 uses a split-config pattern to support both Edge and Node.js runtimes:

- **`auth.config.ts`** -- Edge-compatible configuration used by middleware. Contains the `authorized()` callback for route protection. No Prisma or bcryptjs imports (these require Node.js APIs unavailable in Edge runtime).

- **`auth.ts`** -- Full Node.js configuration that extends `auth.config.ts` with the Credentials provider. Handles user lookup via Prisma and password verification via bcryptjs. Used in API routes and server components.

### Session Strategy

- **JWT sessions** stored in httpOnly cookies (Auth.js default for Credentials provider)
- Tokens signed with `NEXTAUTH_SECRET` environment variable
- No session data in localStorage -- eliminates XSS token theft vector
- Session accessible server-side via `auth()` and client-side via `useSession()`

### Route Protection

Two layers of protection for `/dashboard/*` routes:

1. **Edge Middleware** (`src/middleware.ts`): Intercepts requests before they reach the route handler. Redirects unauthenticated users to `/login`. Runs on every navigation.

2. **Server-side auth() check** (`src/app/(dashboard)/layout.tsx`): Defense-in-depth. Even if middleware is bypassed (misconfiguration, direct API call), the layout verifies the session and redirects to `/login`.

### Password Security

- **Hashing:** bcryptjs with cost factor 12. Pure JavaScript implementation avoids native binding issues on EC2.
- **Comparison:** `bcryptjs.compare()` is timing-safe, preventing timing-based password inference.
- **Reset Flow:** Token-based with 128-bit entropy (`crypto.randomUUID()`), 1-hour expiry, single-use enforcement via `usedAt` timestamp, atomic password update + token consumption via Prisma `$transaction`.
- **Anti-enumeration:** Login returns generic "Invalid email or password" for all failure modes. Password reset returns identical 200 response regardless of email existence.

### Auth Flow

```
Signup:  Client -> POST /api/auth/signup -> Zod validate -> bcrypt hash -> Prisma create -> 201
Login:   Client -> signIn("credentials") -> auth.ts authorize -> Prisma lookup -> bcrypt compare -> JWT cookie
Logout:  Client -> signOut() -> cookie cleared -> redirect /login
Reset:   Client -> POST /api/auth/reset-password -> generate token -> store in DB -> send email (console in dev)
Confirm: Client -> POST /api/auth/reset-password/confirm -> validate token -> bcrypt hash -> $transaction update
```

## Database

### Provider

PostgreSQL 16 on AWS RDS free tier (db.t3.micro, 20 GB SSD, 750 hrs/month for 12 months).

### ORM

Prisma 5.x provides type-safe database access with generated TypeScript types from the schema. A singleton pattern (`src/lib/db.ts`) prevents connection pool exhaustion during hot module reloading in development.

### Current Models

**User**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key, auto-generated |
| email | String | Unique, stored lowercase |
| hashedPassword | String | bcrypt hash |
| name | String? | Optional display name |
| createdAt | DateTime | Auto-set on creation |
| updatedAt | DateTime | Auto-updated by Prisma |

**PasswordResetToken**
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| token | String | Unique, 128-bit UUID |
| email | String | Target user email |
| expiresAt | DateTime | 1 hour from creation |
| usedAt | DateTime? | Null until consumed |
| createdAt | DateTime | Auto-set on creation |

### Future Models (Planned)

- **Portfolio / Holding:** Stock positions with entry price, quantity, sector
- **AnalysisResult:** JSONB column for flexible AI-generated analysis output per stock
- **Alert:** User-configured price/event notifications

## Security

### Environment Validation

`@t3-oss/env-nextjs` (`src/lib/env.ts`) validates all required environment variables at application startup. Missing or malformed values cause an immediate crash with a descriptive error -- no silent fallbacks that could expose the application in an insecure state.

Server-only variables (`DATABASE_URL`, `NEXTAUTH_SECRET`) are restricted to server-side code. Attempting to access them from client components triggers a build-time error.

### Secret Prevention

- `.gitignore` excludes `.env`, `.env.local`, `.env.*.local`, `*.pem`, and `*.key`
- Recommended: [git-secrets](https://github.com/awslabs/git-secrets) pre-commit hook to block commits containing AWS key patterns or hardcoded secrets
- No API keys or secrets in the frontend bundle -- all external API calls route through Next.js API Route Handlers

### Auth Security Summary

| Measure | Implementation |
|---|---|
| Password storage | bcryptjs, cost factor 12 |
| Session tokens | JWT in httpOnly cookies |
| Route protection | Edge middleware + server-side auth() check |
| Input validation | Zod schemas at every API boundary |
| Error messages | Generic -- no internal state leakage |
| Password reset | 128-bit token, 1-hour expiry, single-use, atomic update |
| Email handling | Case-normalized, anti-enumeration responses |

## Directory Layout

```
aurumiq/
  src/
    app/
      (auth)/                  # Route group: login, signup, reset-password
      (dashboard)/             # Route group: protected pages
      api/auth/                # Auth API routes
    components/ui/             # shadcn/ui primitives
    lib/                       # Shared utilities and config
  prisma/
    schema.prisma              # Database schema (source of truth)
  tests/
    unit/                      # Vitest unit tests
    e2e/                       # Playwright E2E tests
  docs/                        # Architecture and API documentation
  public/                      # Static assets
```

Route groups `(auth)` and `(dashboard)` use Next.js parenthesized naming to share layouts without affecting URL paths. The auth group uses a centered card layout; the dashboard group applies the authenticated layout with navigation.

## Deployment Strategy

**Target:** AWS EC2 t3.micro (free tier) with PM2 process manager

```
Build:  pnpm build (produces .next/ output)
Run:    pm2 start "node_modules/.bin/next start" --name aurumiq
DB:     AWS RDS PostgreSQL db.t3.micro (free tier)
```

The entire application runs as a single Node.js process. PM2 provides automatic restart on crash, log rotation, and basic monitoring. No container orchestration or serverless complexity needed at this scale.

## Future Architecture (Planned)

- **AI Analysis Pipeline (Phase 5):** Claude API integration with modular analysis sections. Each dashboard section fetches independently via Tanstack Query with stale-while-revalidate.
- **Scheduled Analysis (Phase 6):** node-cron for market-hours-aware scheduled generation running in a Next.js custom server.
- **Observability (Phase 7):** OpenTelemetry SDK with Pino structured logging for tracing AI pipeline latency and API response times.
- **Email (Phase 6):** AWS SES replaces the current console-logging email abstraction for password reset delivery.
