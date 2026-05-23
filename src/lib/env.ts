import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

// Type-safe environment variable validation.
// Fails fast at startup if required vars are missing — prevents
// runtime surprises in production. Server-only vars are never
// exposed to the client bundle.
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),
    NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
    NEXTAUTH_URL: z.string().url().optional(),
    ANTHROPIC_API_KEY: z
      .string()
      .min(20, 'ANTHROPIC_API_KEY appears malformed (too short)'),
    ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
  },
});
