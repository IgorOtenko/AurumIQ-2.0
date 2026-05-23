import { financeLogger } from '@/lib/logger';
import { getCache, setCache } from '../cache';
import { CACHE_TTL } from '../config';
import { EarningsDataSchema } from '../schemas';
import type { AdapterResult, EarningsData } from '../types';
import { withRetry, yahooFinance } from '../yahoo-client';

const DATA_TYPE = 'earnings' as const;
const YAHOO_MODULES = ['earnings', 'earningsTrend', 'financialData'] as const;

function project(raw: unknown): EarningsData {
  const parsed = EarningsDataSchema.safeParse(raw);
  const root = parsed.success ? parsed.data : (raw as Record<string, unknown>);

  const earningsModule =
    (root as { earnings?: Record<string, unknown> }).earnings ?? {};
  const earningsChartRaw =
    (earningsModule as { earningsChart?: Record<string, unknown> })
      .earningsChart ?? {};
  const financialDataRaw =
    (root as { financialData?: Record<string, unknown> }).financialData ?? {};

  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  const str = (v: unknown): string | null => {
    if (typeof v === 'string') return v;
    if (v instanceof Date) return v.toISOString();
    return null;
  };

  const quarterlyRaw = Array.isArray(
    (earningsChartRaw as { quarterly?: unknown }).quarterly,
  )
    ? ((earningsChartRaw as { quarterly: unknown[] }).quarterly as Array<
        Record<string, unknown>
      >)
    : [];

  const quarterly = quarterlyRaw.map((q) => ({
    date: str(q.date) ?? '',
    actual: num(q.actual),
    estimate: num(q.estimate),
  }));

  return {
    earningsChart: {
      quarterly,
      currentQuarterEstimate: num(
        (earningsChartRaw as { currentQuarterEstimate?: unknown })
          .currentQuarterEstimate,
      ),
    },
    financialData: {
      currentPrice: num(financialDataRaw.currentPrice),
      targetMeanPrice: num(financialDataRaw.targetMeanPrice),
      revenueGrowth: num(financialDataRaw.revenueGrowth),
    },
  };
}

export async function fetchEarnings(
  ticker: string,
): Promise<AdapterResult<EarningsData>> {
  const normalized = ticker.toUpperCase();

  const cached = await getCache(normalized, DATA_TYPE, CACHE_TTL.earnings);
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

    const parsed = EarningsDataSchema.safeParse(raw);
    if (!parsed.success) {
      financeLogger.warn(
        {
          ticker: normalized,
          dataType: DATA_TYPE,
          issues: parsed.error.issues,
        },
        'earnings response partially invalid — storing raw for downstream resilience',
      );
    }

    await setCache(normalized, DATA_TYPE, raw);
    return { data: project(raw), fromCache: false, stale: false };
  } catch (error) {
    financeLogger.error(
      { ticker: normalized, dataType: DATA_TYPE, err: error },
      'yahoo finance earnings fetch failed',
    );

    const stale = await getCache(normalized, DATA_TYPE, Infinity);
    if (stale) {
      financeLogger.warn(
        { ticker: normalized, dataType: DATA_TYPE },
        'serving stale earnings cache after fetch failure',
      );
      return { data: project(stale), fromCache: true, stale: true };
    }

    return { data: null, fromCache: false, stale: false };
  }
}
