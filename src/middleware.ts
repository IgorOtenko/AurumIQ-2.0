import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

// Edge-compatible middleware using the split-config pattern.
// auth.config.ts has no Prisma/bcryptjs imports, so it runs in
// Edge runtime. The full auth.ts (with Credentials provider) is
// only used in Node.js API routes and server components.
//
// This middleware intercepts requests to /dashboard/* and redirects
// unauthenticated users to /login via the authorized() callback.
export default NextAuth(authConfig).auth;

export const config = {
  // Protect all dashboard routes. Static assets and API routes
  // are excluded by default (Next.js convention).
  matcher: ['/dashboard/:path*'],
};
