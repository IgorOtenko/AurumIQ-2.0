import { financeLogger } from '@/lib/logger';
import { getCache, setCache } from '../cache';
import { CACHE_TTL } from '../config';
import { ProfileDataSchema } from '../schemas';
import type { AdapterResult, ProfileData } from '../types';
import { withRetry, yahooFinance } from '../yahoo-client';

const DATA_TYPE = 'profile' as const;
const YAHOO_MODULES = ['assetProfile', 'defaultKeyStatistics'] as const;

function project(raw: unknown): ProfileData {
  const parsed = ProfileDataSchema.safeParse(raw);
  const root = parsed.success ? parsed.data : (raw as Record<string, unknown>);

  // Yahoo returns company profile under `assetProfile` for equities but
  // `summaryProfile` for some ETFs/ADRs; coalesce both shapes.
  const assetProfile =
    (root as { assetProfile?: Record<string, unknown> }).assetProfile ?? {};
  const summaryProfile =
    (root as { summaryProfile?: Record<string, unknown> }).summaryProfile ?? {};

  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  const str = (v: unknown): string | null =>
    typeof v === 'string' ? v : null;

  return {
    longBusinessSummary:
      str(assetProfile.longBusinessSummary) ??
      str(summaryProfile.longBusinessSummary),
    sector: str(assetProfile.sector) ?? str(summaryProfile.sector),
    industry: str(assetProfile.industry) ?? str(summaryProfile.industry),
    fullTimeEmployees:
      num(assetProfile.fullTimeEmployees) ??
      num(summaryProfile.fullTimeEmployees),
    website: str(assetProfile.website) ?? str(summaryProfile.website),
  };
}

export async function fetchProfile(
  ticker: string,
): Promise<AdapterResult<ProfileData>> {
  const normalized = ticker.toUpperCase();

  const cached = await getCache(normalized, DATA_TYPE, CACHE_TTL.profile);
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

    const parsed = ProfileDataSchema.safeParse(raw);
    if (!parsed.success) {
      financeLogger.warn(
        {
          ticker: normalized,
          dataType: DATA_TYPE,
          issues: parsed.error.issues,
        },
        'profile response partially invalid — storing raw for downstream resilience',
      );
    }

    await setCache(normalized, DATA_TYPE, raw);
    return { data: project(raw), fromCache: false, stale: false };
  } catch (error) {
    financeLogger.error(
      { ticker: normalized, dataType: DATA_TYPE, err: error },
      'yahoo finance profile fetch failed',
    );

    const stale = await getCache(normalized, DATA_TYPE, Infinity);
    if (stale) {
      financeLogger.warn(
        { ticker: normalized, dataType: DATA_TYPE },
        'serving stale profile cache after fetch failure',
      );
      return { data: project(stale), fromCache: true, stale: true };
    }

    return { data: null, fromCache: false, stale: false };
  }
}
