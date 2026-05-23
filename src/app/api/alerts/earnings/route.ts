import { NextResponse } from 'next/server';
import type { EarningsAlert } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { addEarningsAlertSchema } from '@/lib/alerts/schemas';
import type { SerializedEarningsAlert } from '@/lib/alerts/types';

function serialize(alert: EarningsAlert): SerializedEarningsAlert {
  return {
    id: alert.id,
    userId: alert.userId,
    ticker: alert.ticker,
    daysBefore: alert.daysBefore,
    lastNotifiedDate:
      alert.lastNotifiedDate !== null
        ? alert.lastNotifiedDate.toISOString()
        : null,
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

    const alerts = await db.earningsAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      { data: alerts.map(serialize) },
      { status: 200 },
    );
  } catch (error) {
    logger.error({ err: error }, 'earnings alerts list failed');
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

    const parsed = addEarningsAlertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      );
    }

    const ticker = parsed.data.ticker.toUpperCase();
    const { daysBefore } = parsed.data;

    const created = await db.earningsAlert.create({
      data: {
        userId,
        ticker,
        daysBefore,
      },
    });

    return NextResponse.json({ data: serialize(created) }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'earnings alert create failed');
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
