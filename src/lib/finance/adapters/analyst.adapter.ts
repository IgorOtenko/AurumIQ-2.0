import { financeLogger } from '@/lib/logger';
import { getCache, setCache } from '../cache';
import { CACHE_TTL } from '../config';
import { AnalystDataSchema } from '../schemas';
import type { AdapterResult, AnalystData } from '../types';
import { withRetry, yahooFinance } from '../yahoo-client';

const DATA_TYPE = 'analyst' as const;
const YAHOO_MODULES = [
  'recommendationTrend',
  'upgradeDowngradeHistory',
] as const;

function project(raw: unknown): AnalystData {
  const parsed = AnalystDataSchema.safeParse(raw);
  const root = parsed.success ? parsed.data : (raw as Record<string, unknown>);
  const recommendationTrend =
    (root as { recommendationTrend?: Record<string, unknown> })
      .recommendationTrend ?? {};
  const rawTrend = Array.isArray(
    (recommendationTrend as { trend?: unknown }).trend,
  )
    ? ((recommendationTrend as { trend: unknown[] }).trend as Array<
        Record<string, unknown>
      >)
    : [];

  const num = (v: unknown): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : 0;
  const str = (v: unknown): string =>
    typeof v === 'string' ? v : '';

  return {
    recommendationTrend: {
      trend: rawTrend.map((item) => ({
        period: str(item.period),
        strongBuy: num(item.strongBuy),
        buy: num(item.buy),
        hold: num(item.hold),
        sell: num(item.sell),
        strongSell: num(item.strongSell),
      })),
    },
  };
}

export async function fetchAnalyst(
  ticker: string,
): Promise<AdapterResult<AnalystData>> {
  const normalized = ticker.toUpperCase();

  const cached = await getCache(normalized, DATA_TYPE, CACHE_TTL.analyst);
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

    const parsed = AnalystDataSchema.safeParse(raw);
    if (!parsed.success) {
      financeLogger.warn(
        {
          ticker: normalized,
          dataType: DATA_TYPE,
          issues: parsed.error.issues,
        },
        'analyst response partially invalid — storing raw for downstream resilience',
      );
    }

    await setCache(normalized, DATA_TYPE, raw);
    return { data: project(raw), fromCache: false, stale: false };
  } catch (error) {
    financeLogger.error(
      { ticker: normalized, dataType: DATA_TYPE, err: error },
      'yahoo finance analyst fetch failed',
    );

    const stale = await getCache(normalized, DATA_TYPE, Infinity);
    if (stale) {
      financeLogger.warn(
        { ticker: normalized, dataType: DATA_TYPE },
        'serving stale analyst cache after fetch failure',
      );
      return { data: project(stale), fromCache: true, stale: true };
    }

    return { data: null, fromCache: false, stale: false };
  }
}
