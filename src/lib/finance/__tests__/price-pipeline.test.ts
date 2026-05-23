import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tickerSchema } from '@/lib/finance/schemas';
import {
  partialPriceResponse,
  validPriceResponse,
} from './fixtures/yahoo-responses';

const quoteSummaryMock = vi.fn();
const findFirstMock = vi.fn();
const upsertMock = vi.fn();
const warnMock = vi.fn();
const errorMock = vi.fn();

vi.mock('yahoo-finance2', () => {
  // v3 default export is a constructor. The adapter calls
  // yahooFinance.quoteSummary, so each instance must expose the
  // shared mock.
  class YahooFinance {
    quoteSummary = (...args: unknown[]) => quoteSummaryMock(...args);
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
    debug: vi.fn(),
    info: vi.fn(),
    child: () => child,
  };
  return {
    logger: child,
    financeLogger: child,
  };
});

// Adapter is imported after mocks are registered so its module-level
// imports of yahoo-finance2/db/logger pick up the mocked versions.
const { fetchPrice } = await import('@/lib/finance/adapters/price.adapter');

beforeEach(() => {
  quoteSummaryMock.mockReset();
  findFirstMock.mockReset();
  upsertMock.mockReset();
  warnMock.mockReset();
  errorMock.mockReset();
  upsertMock.mockResolvedValue(undefined);
});

describe('fetchPrice', () => {
  it('returns fresh data on cache miss', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    quoteSummaryMock.mockResolvedValueOnce(validPriceResponse);

    const result = await fetchPrice('AAPL');

    expect(quoteSummaryMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(result.fromCache).toBe(false);
    expect(result.stale).toBe(false);
    expect(result.data?.regularMarketPrice).toBe(189.43);
  });

  it('returns cached data on cache hit', async () => {
    findFirstMock.mockResolvedValueOnce({
      data: validPriceResponse,
      fetchedAt: new Date(),
    });

    const result = await fetchPrice('AAPL');

    expect(quoteSummaryMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
    expect(result.fromCache).toBe(true);
    expect(result.stale).toBe(false);
    expect(result.data?.regularMarketPrice).toBe(189.43);
  });

  it('handles partial Yahoo Finance response gracefully', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    // Force a Zod-visible failure by shipping a wrong-typed field
    // (regularMarketPrice as string) on the price module.
    quoteSummaryMock.mockResolvedValueOnce({
      ...partialPriceResponse,
      price: {
        ...partialPriceResponse.price,
        regularMarketPrice: 'not-a-number',
      },
    });

    const result = await fetchPrice('SPY');

    expect(result.data).not.toBeNull();
    expect(result.data?.marketCap).toBeNull();
    expect(warnMock).toHaveBeenCalled();
    const warnArgs = warnMock.mock.calls[0]?.[0] as { issues?: unknown };
    expect(warnArgs.issues).toBeDefined();
  });

  it('falls back to stale cache on fetch error', async () => {
    findFirstMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        data: validPriceResponse,
        fetchedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
    quoteSummaryMock.mockRejectedValueOnce(new Error('network down'));

    const result = await fetchPrice('AAPL');

    expect(result.stale).toBe(true);
    expect(result.fromCache).toBe(true);
    expect(result.data?.regularMarketPrice).toBe(189.43);
    expect(errorMock).toHaveBeenCalled();
  });

  it('returns null when no cache and fetch fails', async () => {
    findFirstMock.mockResolvedValue(null);
    quoteSummaryMock.mockRejectedValueOnce(new Error('network down'));

    const result = await fetchPrice('AAPL');

    expect(result.data).toBeNull();
    expect(result.fromCache).toBe(false);
    expect(result.stale).toBe(false);
  });
});

describe('tickerSchema', () => {
  it('rejects invalid tickers', () => {
    expect(tickerSchema.safeParse('AAPL').success).toBe(true);
    expect(tickerSchema.safeParse('BRK.B').success).toBe(true);
    expect(tickerSchema.safeParse('aapl').success).toBe(false);
    expect(tickerSchema.safeParse('A'.repeat(11)).success).toBe(false);
    expect(tickerSchema.safeParse('AAPL;DROP').success).toBe(false);
    expect(tickerSchema.safeParse('').success).toBe(false);
  });
});
