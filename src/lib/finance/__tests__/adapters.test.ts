import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validEarningsResponse,
  validAnalystResponse,
  validOptionsResponse,
  validProfileResponse,
  validNewsResponse,
} from './fixtures/yahoo-responses';

// yahoo-finance2 v3's default export is a class. Each adapter calls a
// different instance method, so we share a single mock fn per method
// across all instances. This mirrors price-pipeline.test.ts.
const quoteSummaryMock = vi.fn();
const optionsMock = vi.fn();
const searchMock = vi.fn();
const findFirstMock = vi.fn();
const upsertMock = vi.fn();
const warnMock = vi.fn();
const errorMock = vi.fn();
const infoMock = vi.fn();

vi.mock('yahoo-finance2', () => {
  class YahooFinance {
    quoteSummary = (...args: unknown[]) => quoteSummaryMock(...args);
    options = (...args: unknown[]) => optionsMock(...args);
    search = (...args: unknown[]) => searchMock(...args);
  }
  return { default: YahooFinance };
});

vi.mock('@/lib/db', () => ({
  db: {
    rawData: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      upsert: (...args: unknown[]) => upsertMock(...args),
    },
  },
}));

vi.mock('@/lib/logger', () => {
  const child = {
    warn: (...args: unknown[]) => warnMock(...args),
    error: (...args: unknown[]) => errorMock(...args),
    info: (...args: unknown[]) => infoMock(...args),
    debug: vi.fn(),
    child: () => child,
  };
  return {
    logger: child,
    financeLogger: child,
  };
});

// Import adapters after mocks register so their module-level imports
// (yahoo-finance2, db, logger) resolve to the mocked versions.
const { fetchEarnings } = await import(
  '@/lib/finance/adapters/earnings.adapter'
);
const { fetchAnalyst } = await import(
  '@/lib/finance/adapters/analyst.adapter'
);
const { fetchOptions } = await import(
  '@/lib/finance/adapters/options.adapter'
);
const { fetchProfile } = await import(
  '@/lib/finance/adapters/profile.adapter'
);
const { fetchNews } = await import('@/lib/finance/adapters/news.adapter');

// Reusable upsert return shape — setCache only awaits the promise, but
// resolving with a row keeps it realistic for any future consumers.
function makeUpsertReturn(dataType: string) {
  const now = new Date();
  return {
    id: 'mock',
    ticker: 'AAPL',
    dataType,
    data: {},
    fetchedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

beforeEach(() => {
  quoteSummaryMock.mockReset();
  optionsMock.mockReset();
  searchMock.mockReset();
  findFirstMock.mockReset();
  upsertMock.mockReset();
  warnMock.mockReset();
  errorMock.mockReset();
  infoMock.mockReset();
});

describe('fetchEarnings', () => {
  it('returns quarterly earnings data on cache miss', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    quoteSummaryMock.mockResolvedValueOnce(validEarningsResponse);
    upsertMock.mockResolvedValueOnce(makeUpsertReturn('earnings'));

    const result = await fetchEarnings('AAPL');

    expect(quoteSummaryMock).toHaveBeenCalledTimes(1);
    expect(quoteSummaryMock).toHaveBeenCalledWith('AAPL', {
      modules: ['earnings', 'earningsTrend', 'financialData'],
    });
    expect(result.fromCache).toBe(false);
    expect(result.stale).toBe(false);
    expect(result.data?.earningsChart?.quarterly.length).toBe(4);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const upsertArgs = upsertMock.mock.calls[0]?.[0] as {
      create: { dataType: string };
    };
    expect(upsertArgs.create.dataType).toBe('earnings');
  });
});

describe('fetchAnalyst', () => {
  it('returns recommendation trend on cache miss', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    quoteSummaryMock.mockResolvedValueOnce(validAnalystResponse);
    upsertMock.mockResolvedValueOnce(makeUpsertReturn('analyst'));

    const result = await fetchAnalyst('AAPL');

    expect(quoteSummaryMock).toHaveBeenCalledWith('AAPL', {
      modules: ['recommendationTrend', 'upgradeDowngradeHistory'],
    });
    expect(result.fromCache).toBe(false);
    expect(result.data?.recommendationTrend?.trend.length).toBe(4);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const upsertArgs = upsertMock.mock.calls[0]?.[0] as {
      create: { dataType: string };
    };
    expect(upsertArgs.create.dataType).toBe('analyst');
  });
});

describe('fetchOptions', () => {
  it('returns calls and puts on cache miss', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    optionsMock.mockResolvedValueOnce(validOptionsResponse);
    upsertMock.mockResolvedValueOnce(makeUpsertReturn('options'));

    const result = await fetchOptions('AAPL');

    expect(optionsMock).toHaveBeenCalledTimes(1);
    expect(optionsMock).toHaveBeenCalledWith('AAPL');
    expect(result.fromCache).toBe(false);
    expect(result.data).not.toBeNull();
    expect(result.data?.expirationDates?.length).toBe(2);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const upsertArgs = upsertMock.mock.calls[0]?.[0] as {
      create: { dataType: string };
    };
    expect(upsertArgs.create.dataType).toBe('options');
  });

  it('returns null for ticker without options chain', async () => {
    // The adapter has two no-chain branches; we exercise the thrown-
    // error branch (e.g. "No options found") which yahoo-finance2
    // raises for tickers with no listed options.
    findFirstMock.mockResolvedValueOnce(null);
    optionsMock.mockRejectedValueOnce(new Error('No options found'));

    const result = await fetchOptions('SPY');

    expect(result.data).toBeNull();
    expect(result.fromCache).toBe(false);
    expect(result.stale).toBe(false);
  });
});

describe('fetchProfile', () => {
  it('returns sector and key stats on cache miss', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    quoteSummaryMock.mockResolvedValueOnce(validProfileResponse);
    upsertMock.mockResolvedValueOnce(makeUpsertReturn('profile'));

    const result = await fetchProfile('AAPL');

    expect(quoteSummaryMock).toHaveBeenCalledWith('AAPL', {
      modules: ['assetProfile', 'defaultKeyStatistics'],
    });
    expect(result.fromCache).toBe(false);
    expect(result.data?.sector).toBe('Technology');
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const upsertArgs = upsertMock.mock.calls[0]?.[0] as {
      create: { dataType: string };
    };
    expect(upsertArgs.create.dataType).toBe('profile');
  });
});

describe('fetchNews', () => {
  it('returns articles on cache miss', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    searchMock.mockResolvedValueOnce(validNewsResponse);
    upsertMock.mockResolvedValueOnce(makeUpsertReturn('news'));

    const result = await fetchNews('AAPL');

    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock).toHaveBeenCalledWith('AAPL', { newsCount: 20 });
    expect(result.fromCache).toBe(false);
    // The fixture has 4 news items; the null-title spam item must be
    // filtered out by the news adapter, leaving 3 renderable articles.
    expect(result.data?.articles.length).toBeGreaterThanOrEqual(3);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const upsertArgs = upsertMock.mock.calls[0]?.[0] as {
      create: { dataType: string };
    };
    expect(upsertArgs.create.dataType).toBe('news');
  });
});
