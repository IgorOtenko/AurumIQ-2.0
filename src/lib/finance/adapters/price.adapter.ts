import { financeLogger } from '@/lib/logger';
import { getCache, setCache } from '../cache';
import { CACHE_TTL } from '../config';
import { PriceDataSchema } from '../schemas';
import type { AdapterResult, PriceData } from '../types';
import { withRetry, yahooFinance } from '../yahoo-client';

const DATA_TYPE = 'price' as const;
const YAHOO_MODULES = ['price', 'summaryDetail'] as const;

function project(raw: unknown): PriceData {
  const parsed = PriceDataSchema.safeParse(raw);
  const root = parsed.success ? parsed.data : (raw as Record<string, unknown>);
  const priceModule =
    (root as { price?: Record<string, unknown> }).price ?? {};
  const summary =
    (root as { summaryDetail?: Record<string, unknown> }).summaryDetail ?? {};

  // Yahoo splits marketCap between price and summaryDetail depending
  // on security type; coalesce so callers see a single field.
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  const str = (v: unknown): string | null =>
    typeof v === 'string' ? v : null;

  return {
    regularMarketPrice: num(priceModule.regularMarketPrice),
    regularMarketChange: num(priceModule.regularMarketChange),
    regularMarketChangePercent: num(priceModule.regularMarketChangePercent),
    regularMarketVolume: num(priceModule.regularMarketVolume),
    marketCap: num(priceModule.marketCap) ?? num(summary.marketCap),
    currency: str(priceModule.currency),
    shortName: str(priceModule.shortName),
    longName: str(priceModule.longName),
  };
}

export async function fetchPrice(
  ticker: string,
): Promise<AdapterResult<PriceData>> {
  const normalized = ticker.toUpperCase();

  const cached = await getCache(normalized, DATA_TYPE, CACHE_TTL.price);
  if (cached) {
    return { data: project(cached), fromCache: true, stale: false };
  }

  try {
    const raw = await withRetry(
      () =>
        yahooFinance.quoteSummary(normalized, {
          modules: [...YAHOO_MODULES],
        }),
      { ticker: normalized, module: DATA_TYPE },
    );

    const parsed = PriceDataSchema.safeParse(raw);
    if (!parsed.success) {
      financeLogger.warn(
        {
          ticker: normalized,
          dataType: DATA_TYPE,
          issues: parsed.error.issues,
        },
        'price response partially invalid — storing raw for downstream resilience',
      );
    }

    // Store the raw response (even when partial) so future schema
    // changes can re-extract fields without re-hitting Yahoo.
    await setCache(normalized, DATA_TYPE, raw);
    return { data: project(raw), fromCache: false, stale: false };
  } catch (error) {
    financeLogger.error(
      { ticker: normalized, dataType: DATA_TYPE, err: error },
      'yahoo finance price fetch failed',
    );

    const stale = await getCache(normalized, DATA_TYPE, Infinity);
    if (stale) {
      financeLogger.warn(
        { ticker: normalized, dataType: DATA_TYPE },
        'serving stale price cache after fetch failure',
      );
      return { data: project(stale), fromCache: true, stale: true };
    }

    return { data: null, fromCache: false, stale: false };
  }
}
