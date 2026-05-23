import { financeLogger } from '@/lib/logger';
import { getCache, setCache } from '../cache';
import { CACHE_TTL } from '../config';
import { OptionsDataSchema } from '../schemas';
import type { AdapterResult, OptionsData } from '../types';
import { withRetry, yahooFinance } from '../yahoo-client';

const DATA_TYPE = 'options' as const;

const NO_CHAIN_HINTS = [
  'no options',
  'not found',
  'no data',
  'quote not found',
] as const;

function isNoChainError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error);
  return NO_CHAIN_HINTS.some((hint) => message.includes(hint));
}

function hasChain(raw: unknown): boolean {
  const root = (raw ?? {}) as { options?: unknown[] };
  return Array.isArray(root.options) && root.options.length > 0;
}

function project(raw: unknown): OptionsData {
  const parsed = OptionsDataSchema.safeParse(raw);
  const root = parsed.success ? parsed.data : (raw as Record<string, unknown>);

  const rawExpirations = (root as { expirationDates?: unknown[] })
    .expirationDates;
  const expirationDates = Array.isArray(rawExpirations)
    ? rawExpirations
        .map((v) => {
          if (typeof v === 'number') return v;
          if (v instanceof Date) return Math.floor(v.getTime() / 1000);
          if (typeof v === 'string') {
            const n = Date.parse(v);
            return Number.isFinite(n) ? Math.floor(n / 1000) : null;
          }
          return null;
        })
        .filter((n): n is number => n !== null)
    : undefined;

  const rawStrikes = (root as { strikes?: unknown[] }).strikes;
  const strikes = Array.isArray(rawStrikes)
    ? rawStrikes.filter(
        (v): v is number => typeof v === 'number' && Number.isFinite(v),
      )
    : undefined;

  const rawMini = (root as { hasMiniOptions?: unknown }).hasMiniOptions;
  const hasMiniOptions = typeof rawMini === 'boolean' ? rawMini : undefined;

  return {
    expirationDates,
    strikes,
    hasMiniOptions,
  };
}

export async function fetchOptions(
  ticker: string,
): Promise<AdapterResult<OptionsData>> {
  const normalized = ticker.toUpperCase();

  const cached = await getCache(normalized, DATA_TYPE, CACHE_TTL.options);
  if (cached) {
    return hasChain(cached)
      ? { data: project(cached), fromCache: true, stale: false }
      : { data: null, fromCache: true, stale: false };
  }

  try {
    const raw = await withRetry(
      () => yahooFinance.options(normalized),
      { ticker: normalized, module: DATA_TYPE },
    );

    // Many tickers (ETFs without options, ADRs, small-caps) legitimately
    // have no options chain — yahoo-finance2 returns options:[] rather
    // than throwing. Treat as a successful empty result, not an error.
    if (!hasChain(raw)) {
      financeLogger.info(
        { ticker: normalized, dataType: DATA_TYPE },
        'no options chain available',
      );
      await setCache(normalized, DATA_TYPE, raw ?? {});
      return { data: null, fromCache: false, stale: false };
    }

    const parsed = OptionsDataSchema.safeParse(raw);
    if (!parsed.success) {
      financeLogger.warn(
        {
          ticker: normalized,
          dataType: DATA_TYPE,
          issues: parsed.error.issues,
        },
        'options response partially invalid — storing raw for downstream resilience',
      );
    }

    await setCache(normalized, DATA_TYPE, raw);
    return { data: project(raw), fromCache: false, stale: false };
  } catch (error) {
    if (isNoChainError(error)) {
      financeLogger.info(
        { ticker: normalized, dataType: DATA_TYPE },
        'no options chain available',
      );
      return { data: null, fromCache: false, stale: false };
    }

    financeLogger.error(
      { ticker: normalized, dataType: DATA_TYPE, err: error },
      'yahoo finance options fetch failed',
    );

    const stale = await getCache(normalized, DATA_TYPE, Infinity);
    if (stale) {
      financeLogger.warn(
        { ticker: normalized, dataType: DATA_TYPE },
        'serving stale options cache after fetch failure',
      );
      return hasChain(stale)
        ? { data: project(stale), fromCache: true, stale: true }
        : { data: null, fromCache: true, stale: true };
    }

    return { data: null, fromCache: false, stale: false };
  }
}
