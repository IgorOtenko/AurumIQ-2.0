import { NextResponse } from 'next/server';
import { Prisma, type Schedule } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { addScheduleSchema } from '@/lib/scheduling/schemas';
import type { SectionType } from '@/lib/ai/types';
import type { SerializedSchedule } from '@/lib/scheduling/types';

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

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schedules = await db.schedule.findMany({
      where: { userId },
      orderBy: { ticker: 'asc' },
    });

    return NextResponse.json(
      { data: schedules.map(serialize) },
      { status: 200 },
    );
  } catch (error) {
    logger.error({ err: error }, 'schedules list failed');
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

    const parsed = addScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      );
    }

    const ticker = parsed.data.ticker.toUpperCase();
    const { sectionType, hour, minute, timezone } = parsed.data;

    let created: Schedule;
    try {
      created = await db.schedule.create({
        data: {
          userId,
          ticker,
          sectionType,
          hour,
          minute,
          timezone,
          active: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return NextResponse.json(
          { error: 'A schedule already exists for that ticker + section' },
          { status: 409 },
        );
      }
      throw error;
    }

    return NextResponse.json({ data: serialize(created) }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'schedule create failed');
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
