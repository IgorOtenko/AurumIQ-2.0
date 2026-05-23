import bcryptjs from 'bcryptjs';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { changePasswordSchema } from '@/lib/account/schemas';

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      );
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const valid = await bcryptjs.compare(
      parsed.data.currentPassword,
      user.hashedPassword,
    );
    if (!valid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 },
      );
    }

    const newHash = await bcryptjs.hash(parsed.data.newPassword, 12);
    await db.user.update({
      where: { id: userId },
      data: { hashedPassword: newHash },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    logger.error({ err }, 'change password failed');
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
