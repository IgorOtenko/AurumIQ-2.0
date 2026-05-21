import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcryptjs from 'bcryptjs';
import { db } from '@/lib/db';
import { authConfig } from '@/lib/auth.config';

// Full Auth.js v5 configuration with Credentials provider.
// This file cannot run in Edge runtime (Prisma + bcryptjs need Node.js),
// so middleware uses auth.config.ts instead. API routes and server
// components use this file for session checks and sign-in/sign-out.
export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user) return null;

        // bcryptjs.compare is timing-safe — prevents timing attacks
        // that could reveal whether an email exists in the database.
        const isValid = await bcryptjs.compare(password, user.hashedPassword);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    ...authConfig.callbacks,
    // Persist user.id into the JWT on initial sign-in so it's
    // available in the session without a DB lookup on every request.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    // Expose user.id on the client-side session object.
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
