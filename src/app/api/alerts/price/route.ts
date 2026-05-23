import { NextResponse } from 'next/server';
import type { PriceAlert } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { addPriceAlertSchema } from '@/lib/alerts/schemas';
import type { AlertDirection, SerializedPriceAlert } from '@/lib/alerts/types';

function serialize(alert: PriceAlert): SerializedPriceAlert {
  return {
    id: alert.id,
    userId: alert.userId,
    ticker: alert.ticker,
    direction: alert.direction as AlertDirection,
    threshold: alert.threshold.toNumber(),
    triggeredAt: alert.triggeredAt ? alert.triggeredAt.toISOString() : null,
    active: alert.active,
    createdAt: alert.createdAt.toISOString(),
    updatedAt: alert.updatedAt.toISOString(),
  };
}

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alerts = await db.priceAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      { data: alerts.map(serialize) },
      { status: 200 },
    );
  } catch (error) {
    logger.error({ err: error }, 'price alert list failed');
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

    const parsed = addPriceAlertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      );
    }

    const ticker = parsed.data.ticker.toUpperCase();
    const { direction, threshold } = parsed.data;

    const created = await db.priceAlert.create({
      data: {
        userId,
        ticker,
        direction,
        threshold,
      },
    });

    return NextResponse.json({ data: serialize(created) }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'price alert create failed');
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
