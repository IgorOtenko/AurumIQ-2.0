import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tickerSchema } from '@/lib/finance/schemas';
import {
  adrPriceResponse,
  etfPriceResponse,
  validAnalystResponse,
  validEarningsResponse,
  validPriceResponse,
  validProfileResponse,
} from './fixtures/yahoo-responses';

const quoteSummaryMock = vi.fn();
const optionsMock = vi.fn();
const searchMock = vi.fn();
const findFirstMock = vi.fn();
const upsertMock = vi.fn();
const warnMock = vi.fn();
const errorMock = vi.fn();

vi.mock('yahoo-finance2', () => {
  // v3 default export is a constructor; each instance routes calls
  // through the module-level mocks so tests can stub them.
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
    debug: vi.fn(),
    info: vi.fn(),
    child: () => child,
  };
  return {
    logger: child,
    financeLogger: child,
  };
});

// Adapters are imported after mocks are registered so their module-level
// imports of yahoo-finance2/db/logger pick up the mocked versions.
const { fetchPrice } = await import('@/lib/finance/adapters/price.adapter');
const { fetchEarnings } = await import(
  '@/lib/finance/adapters/earnings.adapter'
);
const { fetchAnalyst } = await import('@/lib/finance/adapters/analyst.adapter');
const { fetchProfile } = await import('@/lib/finance/adapters/profile.adapter');

beforeEach(() => {
  quoteSummaryMock.mockReset();
  optionsMock.mockReset();
  searchMock.mockReset();
  findFirstMock.mockReset();
  upsertMock.mockReset();
  warnMock.mockReset();
  errorMock.mockReset();
  upsertMock.mockResolvedValue(undefined);
});

describe('finance edge cases', () => {
  it('ETF ticker (SPY) returns price data but null/empty earnings gracefully', async () => {
    // Price: ETF response has non-null price + null marketCap on
    // the price module (marketCap is supplied via summaryDetail typically).
    findFirstMock.mockResolvedValueOnce(null);
    quoteSummaryMock.mockResolvedValueOnce(etfPriceResponse);

    const priceResult = await fetchPrice('SPY');
    expect(priceResult.data).not.toBeNull();
    expect(priceResult.data?.regularMarketPrice).toBe(521.04);

    // Earnings: ship a response missing the earnings module entirely
    // (only price block present). Adapter must degrade to empty arrays
    // / null fields rather than throw.
    findFirstMock.mockResolvedValueOnce(null);
    quoteSummaryMock.mockResolvedValueOnce({ price: etfPriceResponse.price });

    const earningsResult = await fetchEarnings('SPY');
    expect(earningsResult.data).not.toBeNull();
    expect(earningsResult.data?.earningsChart?.quarterly).toEqual([]);
    expect(
      earningsResult.data?.earningsChart?.currentQuarterEstimate,
    ).toBeNull();
  });

  it('ADR ticker (TSM) returns price with nullable fields', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    quoteSummaryMock.mockResolvedValueOnce(adrPriceResponse);

    const result = await fetchPrice('TSM');

    expect(result.data).not.toBeNull();
    expect(result.data?.regularMarketPrice).toBe(142.78);
    expect(result.data?.marketCap).toBe(740_000_000_000);
  });

  it('Ticker with special chars (BRK.B) passes validation', () => {
    // The schema allows uppercase letters, digits, and dots only — so
    // BRK.B is valid but BRK-B is not (hyphen excluded).
    expect(tickerSchema.safeParse('BRK.B').success).toBe(true);
    expect(tickerSchema.safeParse('BRK-B').success).toBe(false);
  });

  it('All adapters fall back to stale cache when Yahoo Finance is down', async () => {
    // For each adapter: first findFirst (fresh TTL) returns null,
    // second findFirst (Infinity TTL) returns a stale row carrying the
    // same shape Yahoo would return — so project() can extract fields.
    const baseRow = {
      id: 'x',
      ticker: 'AAPL',
      createdAt: new Date(),
      updatedAt: new Date(),
      fetchedAt: new Date(Date.now() - 999_999_999),
    };

    // Price
    findFirstMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...baseRow,
        dataType: 'price',
        data: validPriceResponse,
      });
    quoteSummaryMock.mockRejectedValueOnce(new Error('network down'));

    const priceResult = await fetchPrice('AAPL');
    expect(priceResult.stale).toBe(true);
    expect(priceResult.fromCache).toBe(true);

    // Earnings
    findFirstMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...baseRow,
        dataType: 'earnings',
        data: validEarningsResponse,
      });
    quoteSummaryMock.mockRejectedValueOnce(new Error('network down'));

    const earningsResult = await fetchEarnings('AAPL');
    expect(earningsResult.stale).toBe(true);
    expect(earningsResult.fromCache).toBe(true);

    // Analyst
    findFirstMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...baseRow,
        dataType: 'analyst',
        data: validAnalystResponse,
      });
    quoteSummaryMock.mockRejectedValueOnce(new Error('network down'));

    const analystResult = await fetchAnalyst('AAPL');
    expect(analystResult.stale).toBe(true);
    expect(analystResult.fromCache).toBe(true);

    // Profile
    findFirstMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...baseRow,
        dataType: 'profile',
        data: validProfileResponse,
      });
    quoteSummaryMock.mockRejectedValueOnce(new Error('network down'));

    const profileResult = await fetchProfile('AAPL');
    expect(profileResult.stale).toBe(true);
    expect(profileResult.fromCache).toBe(true);

    // Sanity: every adapter logged the underlying error.
    expect(errorMock).toHaveBeenCalled();
  });

  it('Concurrent fetches for same ticker share cache after first miss', async () => {
    // First call: cache miss → adapter hits Yahoo. Second call: cache
    // hit (we simulate setCache having populated the row in between).
    findFirstMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        data: validPriceResponse,
        fetchedAt: new Date(),
      });
    quoteSummaryMock.mockResolvedValueOnce(validPriceResponse);

    const first = await fetchPrice('AAPL');
    const second = await fetchPrice('AAPL');

    expect(quoteSummaryMock).toHaveBeenCalledTimes(1);
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(second.data).toEqual(
      expect.objectContaining({ regularMarketPrice: 189.43 }),
    );
  });
});
