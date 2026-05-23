import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { EarningsAlert } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { updateEarningsAlertSchema } from '@/lib/alerts/schemas';
import type { SerializedEarningsAlert } from '@/lib/alerts/types';

const idSchema = z.string().uuid();

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
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

    const parsed = updateEarningsAlertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      );
    }

    const existing = await db.earningsAlert.findUnique({
      where: { id: parsedId.data },
    });

    // Anti-enumeration: 404 (not 403) when the alert exists but belongs to
    // another user so attackers cannot probe for valid ids.
    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { error: 'Earnings alert not found' },
        { status: 404 },
      );
    }

    const payload: {
      daysBefore?: number;
      active?: boolean;
      lastNotifiedDate?: Date | null;
    } = {};
    if (parsed.data.daysBefore !== undefined) {
      payload.daysBefore = parsed.data.daysBefore;
    }
    if (parsed.data.active !== undefined) {
      payload.active = parsed.data.active;
      // Reactivating after a notification: clear lastNotifiedDate so the
      // scheduler treats the next upcoming earnings event as un-notified
      // and the alert can fire again.
      if (parsed.data.active === true && existing.lastNotifiedDate !== null) {
        payload.lastNotifiedDate = null;
      }
    }

    const updated = await db.earningsAlert.update({
      where: { id: parsedId.data },
      data: payload,
    });

    return NextResponse.json({ data: serialize(updated) }, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, 'earnings alert update failed');
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
    const userId = session?.user?.id;
    if (!userId) {
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

    const existing = await db.earningsAlert.findUnique({
      where: { id: parsedId.data },
    });

    // Anti-enumeration: 404 instead of 403 on cross-user access.
    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { error: 'Earnings alert not found' },
        { status: 404 },
      );
    }

    await db.earningsAlert.delete({ where: { id: parsedId.data } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, 'earnings alert delete failed');
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
