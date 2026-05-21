# AurumIQ

AI-Powered Financial Analysis Platform

AurumIQ is a web-based financial analysis platform that combines portfolio tracking with AI-powered stock research. Users manage a stock portfolio and receive comprehensive, LLM-generated analysis for each holding -- covering earnings, fundamentals, options flow, catalysts, risks, and analyst sentiment. The dashboard presents this analysis in modular sections, each independently generated and refreshable.

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 15.x | Full-stack framework with App Router and API Route Handlers |
| React | 19.x | UI rendering with concurrent features and Server Components |
| TypeScript | 5.x | Type safety across the full stack |
| Tailwind CSS | 4.x | Utility-first CSS with dark financial theme tokens |
| shadcn/ui | latest | Accessible component primitives (Radix UI + Tailwind) |
| PostgreSQL | 16.x | Primary database on AWS RDS free tier |
| Prisma | 5.x | Type-safe ORM with migration support |
| Auth.js (NextAuth v5) | 5.x beta | Credentials auth with JWT sessions in httpOnly cookies |
| Vitest | 3.x | Unit and integration testing |
| Playwright | 1.x | End-to-end testing |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- PostgreSQL 16 (local or remote)

### Installation

```bash
git clone https://github.com/your-username/aurumiq.git
cd aurumiq
pnpm install
```

### Environment Setup

Copy the example environment file and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g., `postgresql://user:pass@localhost:5432/aurumiq`) |
| `NEXTAUTH_SECRET` | Random string for JWT signing (generate with `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Application URL (e.g., `http://localhost:3000`) |

### Database Setup

Push the Prisma schema to your database:

```bash
npx prisma db push
```

To inspect and manage data visually:

```bash
npx prisma studio
```

### Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
  app/
    (auth)/           # Auth pages: login, signup, password reset
    (dashboard)/      # Protected dashboard pages
    api/
      auth/           # Auth API routes: signup, reset-password, NextAuth handlers
  components/
    ui/               # shadcn/ui primitives (Button, Card, Input, Label)
  lib/
    auth.ts           # Auth.js v5 config with Credentials provider
    auth.config.ts    # Edge-compatible auth config for middleware
    db.ts             # Prisma client singleton
    env.ts            # Type-safe environment validation (@t3-oss/env-nextjs)
    email.ts          # Email abstraction (console in dev, SES planned)
    utils.ts          # cn() utility for Tailwind class merging
prisma/
  schema.prisma       # Database models: User, PasswordResetToken
tests/
  unit/               # Vitest unit tests
  e2e/                # Playwright end-to-end tests
docs/
  architecture.md     # Architecture documentation
```

## Authentication

AurumIQ uses Auth.js v5 with the Credentials provider for email/password authentication:

- **Signup:** Zod-validated input, bcrypt(12) password hashing, case-insensitive email storage
- **Login:** JWT sessions stored in httpOnly cookies, generic error messages to prevent enumeration
- **Route Protection:** Edge middleware on `/dashboard/*` with server-side `auth()` check as defense-in-depth
- **Password Reset:** Token-based flow with 1-hour expiry, single-use enforcement, anti-enumeration responses
- **Split Config Pattern:** `auth.config.ts` (edge-safe) and `auth.ts` (Node.js with Prisma/bcryptjs)

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start development server on port 3000 |
| `pnpm build` | Create production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint checks |
| `pnpm test` | Run Vitest unit tests |
| `pnpm test:e2e` | Run Playwright end-to-end tests |
| `pnpm format` | Format code with Prettier |
| `pnpm format:check` | Check code formatting without changes |
| `npx prisma studio` | Open Prisma database browser |
| `npx prisma db push` | Push schema changes to database |

## Architecture

See [docs/architecture.md](docs/architecture.md) for detailed architecture documentation covering authentication flow, database design, security measures, and deployment strategy.

## Security

- Passwords hashed with bcrypt (cost factor 12)
- JWT sessions in httpOnly cookies (not localStorage)
- Server-only environment validation prevents secret leakage to client bundle
- Anti-enumeration responses on login and password reset endpoints
- Edge middleware for route protection
- Recommended: install [git-secrets](https://github.com/awslabs/git-secrets) to prevent accidental credential commits

## License

MIT
