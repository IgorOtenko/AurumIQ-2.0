import { NextResponse } from 'next/server';
import { Prisma, type Holding } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fetchPrice } from '@/lib/finance/adapters/price.adapter';
import { logger } from '@/lib/logger';
import { addHoldingSchema } from '@/lib/portfolio/schemas';
import type {
  EnrichedHolding,
  SerializedHolding,
} from '@/lib/portfolio/types';

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

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const holdings = await db.holding.findMany({
      where: { userId },
      orderBy: { addedAt: 'desc' },
    });

    const enriched = await Promise.all(holdings.map((h) => enrich(h)));

    return NextResponse.json({ data: enriched }, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, 'portfolio list failed');
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (body === null) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const parsed = addHoldingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      );
    }

    const ticker = parsed.data.ticker.toUpperCase();
    const { quantity, costBasis } = parsed.data;

    let created: Holding;
    try {
      created = await db.holding.create({
        data: {
          userId,
          ticker,
          quantity,
          costBasis: costBasis ?? null,
        },
      });
    } catch (error) {
      // P2002 = Prisma unique-constraint violation; surfaces as 409 so
      // the client can prompt the user to update the existing holding
      // instead of treating it as a generic server error.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return NextResponse.json(
          { error: 'Holding already exists for this ticker' },
          { status: 409 },
        );
      }
      throw error;
    }

    const enriched = await enrich(created);

    return NextResponse.json({ data: enriched }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'portfolio create failed');
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
