import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Schedule } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { updateScheduleSchema } from '@/lib/scheduling/schemas';
import type { SectionType } from '@/lib/ai/types';
import type { SerializedSchedule } from '@/lib/scheduling/types';

const idSchema = z.string().uuid();

function serialize(schedule: Schedule): SerializedSchedule {
  return {
    id: schedule.id,
    userId: schedule.userId,
    ticker: schedule.ticker,
    sectionType: schedule.sectionType as SectionType,
    hour: schedule.hour,
    minute: schedule.minute,
    timezone: schedule.timezone,
    active: schedule.active,
    lastRunAt: schedule.lastRunAt ? schedule.lastRunAt.toISOString() : null,
    lastRunDate: schedule.lastRunDate ? schedule.lastRunDate.toISOString() : null,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
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
        { error: 'Invalid schedule id' },
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

    const parsed = updateScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      );
    }

    const existing = await db.schedule.findUnique({
      where: { id: parsedId.data },
    });

    // Anti-enumeration: 404 (not 403) when the schedule belongs to another
    // user. Mirrors the portfolio route so attackers cannot probe for valid ids.
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 },
      );
    }

    const payload: {
      hour?: number;
      minute?: number;
      timezone?: string;
      active?: boolean;
      lastRunDate?: Date | null;
    } = {};
    if (parsed.data.hour !== undefined) payload.hour = parsed.data.hour;
    if (parsed.data.minute !== undefined) payload.minute = parsed.data.minute;
    if (parsed.data.timezone !== undefined)
      payload.timezone = parsed.data.timezone;
    if (parsed.data.active !== undefined) {
      payload.active = parsed.data.active;
      // Re-activating: clear lastRunDate so today's tick can still fire even
      // if a run already happened earlier today while the schedule was off.
      if (parsed.data.active === true && existing.active === false) {
        payload.lastRunDate = null;
      }
    }

    const updated = await db.schedule.update({
      where: { id: parsedId.data },
      data: payload,
    });

    return NextResponse.json({ data: serialize(updated) }, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, 'schedule update failed');
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
        { error: 'Invalid schedule id' },
        { status: 400 },
      );
    }

    const existing = await db.schedule.findUnique({
      where: { id: parsedId.data },
    });

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 },
      );
    }

    await db.schedule.delete({ where: { id: parsedId.data } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, 'schedule delete failed');
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
