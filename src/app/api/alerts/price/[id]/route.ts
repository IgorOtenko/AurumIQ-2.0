import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { PriceAlert } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { updatePriceAlertSchema } from '@/lib/alerts/schemas';
import type { AlertDirection, SerializedPriceAlert } from '@/lib/alerts/types';

const idSchema = z.string().uuid();

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
        { error: 'Invalid alert id' },
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

    const parsed = updatePriceAlertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      );
    }

    const existing = await db.priceAlert.findUnique({
      where: { id: parsedId.data },
    });

    // Anti-enumeration: return 404 (not 403) when the alert exists but
    // belongs to another user, so attackers cannot probe for valid ids.
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Price alert not found' },
        { status: 404 },
      );
    }

    const payload: {
      direction?: AlertDirection;
      threshold?: number;
      active?: boolean;
      triggeredAt?: Date | null;
    } = {};
    if (parsed.data.direction !== undefined) {
      payload.direction = parsed.data.direction;
    }
    if (parsed.data.threshold !== undefined) {
      payload.threshold = parsed.data.threshold;
    }
    if (parsed.data.active !== undefined) {
      payload.active = parsed.data.active;
      // Re-arm semantics: reactivating a previously-triggered alert clears
      // triggeredAt so the cron evaluator treats it as a fresh alert and can
      // fire again on the next threshold cross.
      if (parsed.data.active === true && existing.triggeredAt !== null) {
        payload.triggeredAt = null;
      }
    }

    const updated = await db.priceAlert.update({
      where: { id: parsedId.data },
      data: payload,
    });

    return NextResponse.json({ data: serialize(updated) }, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, 'price alert update failed');
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
        { error: 'Invalid alert id' },
        { status: 400 },
      );
    }

    const existing = await db.priceAlert.findUnique({
      where: { id: parsedId.data },
    });

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Price alert not found' },
        { status: 404 },
      );
    }

    await db.priceAlert.delete({ where: { id: parsedId.data } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, 'price alert delete failed');
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
