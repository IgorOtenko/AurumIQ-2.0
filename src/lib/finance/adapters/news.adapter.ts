import { financeLogger } from '@/lib/logger';
import { getCache, setCache } from '../cache';
import { CACHE_TTL } from '../config';
import { NewsDataSchema } from '../schemas';
import type { AdapterResult, NewsData } from '../types';
import { withRetry, yahooFinance } from '../yahoo-client';

const DATA_TYPE = 'news' as const;
const NEWS_COUNT = 20;

function project(raw: unknown): NewsData {
  const parsed = NewsDataSchema.safeParse(raw);
  const root = parsed.success ? parsed.data : (raw as Record<string, unknown>);
  const items = Array.isArray((root as { news?: unknown }).news)
    ? ((root as { news: unknown[] }).news as Array<Record<string, unknown>>)
    : [];

  const str = (v: unknown): string | null =>
    typeof v === 'string' && v.length > 0 ? v : null;
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;

  const articles: NewsData['articles'] = [];
  for (const item of items) {
    const title = str(item.title);
    const link = str(item.link);
    // Items without a title or link are unrenderable downstream.
    if (!title || !link) continue;
    articles.push({
      title,
      publisher: str(item.publisher),
      link,
      providerPublishTime: num(item.providerPublishTime),
    });
  }

  return { articles };
}

export async function fetchNews(
  ticker: string,
): Promise<AdapterResult<NewsData>> {
  const normalized = ticker.toUpperCase();

  const cached = await getCache(normalized, DATA_TYPE, CACHE_TTL.news);
  if (cached) {
    return { data: project(cached), fromCache: true, stale: false };
  }

  try {
    // News uses Yahoo's search endpoint, not quoteSummary — the
    // quoteSummary modules do not expose article-level news.
    const raw = await withRetry(
      () => yahooFinance.search(normalized, { newsCount: NEWS_COUNT }),
      { ticker: normalized, module: DATA_TYPE },
    );

    const parsed = NewsDataSchema.safeParse(raw);
    if (!parsed.success) {
      financeLogger.warn(
        {
          ticker: normalized,
          dataType: DATA_TYPE,
          issues: parsed.error.issues,
        },
        'news response partially invalid — storing raw for downstream resilience',
      );
    }

    await setCache(normalized, DATA_TYPE, raw);
    return { data: project(raw), fromCache: false, stale: false };
  } catch (error) {
    financeLogger.error(
      { ticker: normalized, dataType: DATA_TYPE, err: error },
      'yahoo finance news fetch failed',
    );

    const stale = await getCache(normalized, DATA_TYPE, Infinity);
    if (stale) {
      financeLogger.warn(
        { ticker: normalized, dataType: DATA_TYPE },
        'serving stale news cache after fetch failure',
      );
      return { data: project(stale), fromCache: true, stale: true };
    }

    return { data: null, fromCache: false, stale: false };
  }
}
