import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/lib/env';

// Singleton via globalThis prevents creating a new HTTP-pooled client
// on every Next.js HMR reload in development. Matches the db.ts pattern.
const globalForAnthropic = globalThis as unknown as {
  anthropic: Anthropic | undefined;
};

export const anthropic: Anthropic =
  globalForAnthropic.anthropic ??
  new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

if (process.env.NODE_ENV !== 'production') {
  globalForAnthropic.anthropic = anthropic;
}

export const MODEL = env.ANTHROPIC_MODEL;
