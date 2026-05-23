import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Holding } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fetchPrice } from '@/lib/finance/adapters/price.adapter';
import { logger } from '@/lib/logger';
import { updateHoldingSchema } from '@/lib/portfolio/schemas';
import type {
  EnrichedHolding,
  SerializedHolding,
} from '@/lib/portfolio/types';

const idSchema = z.string().uuid();

function serialize(holding: Holding): SerializedHolding {
  return {
    id: holding.id,
    userId: holding.userId,
    ticker: holding.ticker,
    quantity: holding.quantity.toNumber(),
    costBasis: holding.costBasis !== null ? holding.costBasis.toNumber() : null,
    addedAt: holding.addedAt.toISOString(),
    updatedAt: holding.updatedAt.toISOString(),
  };
}

async function enrich(holding: Holding): Promise<EnrichedHolding> {
  const serialized = serialize(holding);
  let currentPrice: number | null = null;

  try {
    const result = await fetchPrice(serialized.ticker);
    currentPrice = result.data?.regularMarketPrice ?? null;
  } catch (error) {
    logger.warn(
      { err: error, ticker: serialized.ticker },
      'price enrichment failed for holding',
    );
  }

  const { quantity, costBasis } = serialized;
  const currentValue = currentPrice !== null ? currentPrice * quantity : null;
  const gainLoss =
    currentPrice !== null && costBasis !== null
      ? (currentPrice - costBasis) * quantity
      : null;
  const gainLossPercent =
    currentPrice !== null && costBasis !== null && costBasis > 0
      ? ((currentPrice - costBasis) / costBasis) * 100
      : null;

  return {
    ...serialized,
    currentPrice,
    currentValue,
    gainLoss,
    gainLossPercent,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { error: 'Invalid holding id' },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);
    if (body === null) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const parsed = updateHoldingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      );
    }

    const existing = await db.holding.findUnique({
      where: { id: parsedId.data },
    });

    // Anti-enumeration: return 404 (not 403) when the holding exists but
    // belongs to another user. Distinguishing the two cases lets attackers
    // probe for valid holding ids; mirroring Phase 1's auth pattern keeps
    // unauthorized reads indistinguishable from non-existent records.
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Holding not found' },
        { status: 404 },
      );
    }

    const payload: { quantity?: number; costBasis?: number | null } = {};
    if (parsed.data.quantity !== undefined) {
      payload.quantity = parsed.data.quantity;
    }
    if (parsed.data.costBasis !== undefined) {
      payload.costBasis = parsed.data.costBasis;
    }

    const updated = await db.holding.update({
      where: { id: parsedId.data },
      data: payload,
    });

    const enriched = await enrich(updated);

    return NextResponse.json({ data: enriched }, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, 'portfolio update failed');
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { error: 'Invalid holding id' },
        { status: 400 },
      );
    }

    const existing = await db.holding.findUnique({
      where: { id: parsedId.data },
    });

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Holding not found' },
        { status: 404 },
      );
    }

    await db.holding.delete({ where: { id: parsedId.data } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, 'portfolio delete failed');
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
