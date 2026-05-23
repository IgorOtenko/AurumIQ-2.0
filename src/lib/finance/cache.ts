import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { financeLogger } from '@/lib/logger';
import type { DataType } from './types';

export async function getCache(
  ticker: string,
  dataType: DataType,
  ttlMs: number,
): Promise<unknown | null> {
  const normalizedTicker = ticker.toUpperCase();
  // Infinity TTL = no time floor — used for stale-fallback after a fetch failure.
  const cutoff =
    ttlMs === Infinity ? new Date(0) : new Date(Date.now() - ttlMs);

  const row = await db.rawData.findFirst({
    where: {
      ticker: normalizedTicker,
      dataType,
      fetchedAt: { gte: cutoff },
    },
    orderBy: { fetchedAt: 'desc' },
  });

  if (!row) {
    financeLogger.debug({ ticker: normalizedTicker, dataType }, 'cache miss');
    return null;
  }

  financeLogger.debug(
    { ticker: normalizedTicker, dataType, fetchedAt: row.fetchedAt },
    'cache hit',
  );
  return row.data;
}

export async function setCache(
  ticker: string,
  dataType: DataType,
  data: unknown,
): Promise<void> {
  const normalizedTicker = ticker.toUpperCase();
  const now = new Date();
  const payload = data as Prisma.InputJsonValue;

  await db.rawData.upsert({
    where: {
      ticker_dataType: {
        ticker: normalizedTicker,
        dataType,
      },
    },
    update: {
      data: payload,
      fetchedAt: now,
    },
    create: {
      ticker: normalizedTicker,
      dataType,
      data: payload,
      fetchedAt: now,
    },
  });

  financeLogger.debug({ ticker: normalizedTicker, dataType }, 'cache write');
}
