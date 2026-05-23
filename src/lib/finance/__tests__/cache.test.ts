import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirstMock = vi.fn();
const upsertMock = vi.fn();

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
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    child: () => child,
  };
  return {
    logger: child,
    financeLogger: child,
  };
});

// Import after mocks so the cache module picks up mocked db/logger.
const { getCache, setCache } = await import('@/lib/finance/cache');

beforeEach(() => {
  findFirstMock.mockReset();
  upsertMock.mockReset();
  upsertMock.mockResolvedValue(undefined);
});

describe('getCache', () => {
  it('returns null when no matching record', async () => {
    findFirstMock.mockResolvedValueOnce(null);

    const result = await getCache('AAPL', 'price', 900_000);

    expect(result).toBeNull();
    expect(findFirstMock).toHaveBeenCalledTimes(1);
  });

  it('returns data within TTL window', async () => {
    const payload = { regularMarketPrice: 189.43 };
    findFirstMock.mockResolvedValueOnce({
      data: payload,
      fetchedAt: new Date(),
    });

    const result = await getCache('AAPL', 'price', 900_000);

    expect(result).toEqual(payload);
  });

  it('returns null for expired cache', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    const ttlMs = 900_000;
    const expectedCutoffTime = Date.now() - ttlMs;

    const result = await getCache('AAPL', 'price', ttlMs);

    expect(result).toBeNull();
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ticker: 'AAPL',
          dataType: 'price',
          fetchedAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );

    const callArgs = findFirstMock.mock.calls[0]?.[0] as {
      where: { fetchedAt: { gte: Date } };
    };
    const actualCutoffTime = callArgs.where.fetchedAt.gte.getTime();
    expect(Math.abs(actualCutoffTime - expectedCutoffTime)).toBeLessThan(100);
  });
});

describe('setCache', () => {
  it('upserts with uppercased ticker', async () => {
    await setCache('aapl', 'price', { foo: 'bar' });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ticker_dataType: expect.objectContaining({
            ticker: 'AAPL',
            dataType: 'price',
          }),
        }),
      }),
    );
  });

  it('updates fetchedAt on existing record', async () => {
    await setCache('AAPL', 'price', { v: 1 });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          data: { v: 1 },
          fetchedAt: expect.any(Date),
        }),
        create: expect.objectContaining({
          ticker: 'AAPL',
          dataType: 'price',
          data: { v: 1 },
          fetchedAt: expect.any(Date),
        }),
      }),
    );
  });
});
