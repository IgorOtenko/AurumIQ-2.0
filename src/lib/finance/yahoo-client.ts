import YahooFinance from 'yahoo-finance2';
import { financeLogger } from '@/lib/logger';

// yahoo-finance2 v3 ships the default export as a constructor. We
// instantiate once with validation.logErrors disabled because Yahoo's
// response shape drifts constantly — its internal Zod warnings drown
// out our own structured logs. We validate ourselves at the adapter
// layer instead.
const globalForYahoo = globalThis as unknown as {
  yahooFinance: InstanceType<typeof YahooFinance> | undefined;
};

export const yahooFinance =
  globalForYahoo.yahooFinance ??
  new YahooFinance({
    validation: { logErrors: false },
    suppressNotices: ['yahooSurvey'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForYahoo.yahooFinance = yahooFinance;
}

const AUTH_ERROR_HINTS = ['crumb', 'cookie', '401'] as const;

export async function withRetry<T>(
  fn: () => Promise<T>,
  context: { ticker: string; module: string },
  retries = 2,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message =
        error instanceof Error ? error.message.toLowerCase() : String(error);
      const isAuthError = AUTH_ERROR_HINTS.some((hint) =>
        message.includes(hint),
      );

      if (isAuthError && attempt < retries) {
        const delayMs = 1000 * (attempt + 1);
        financeLogger.warn(
          { ...context, attempt, delayMs, err: message },
          'yahoo cookie/crumb error, retrying',
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('withRetry exhausted');
}
