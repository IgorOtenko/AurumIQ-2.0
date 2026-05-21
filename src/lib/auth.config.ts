import type { NextAuthConfig } from 'next-auth';

// Edge-compatible auth config (no Prisma, no Node.js APIs).
// Used by middleware for route protection. The full auth.ts extends
// this with the Credentials provider that needs Prisma + bcryptjs.
export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    // Controls access to protected routes via middleware.
    // Unauthenticated requests to /dashboard/* are redirected to /login.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');

      if (isOnDashboard) {
        return isLoggedIn; // false => redirect to signIn page
      }

      return true; // allow all other routes
    },
  },
  providers: [], // extended in auth.ts with Credentials provider
} satisfies NextAuthConfig;
