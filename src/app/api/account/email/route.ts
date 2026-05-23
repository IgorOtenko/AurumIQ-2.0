import bcryptjs from 'bcryptjs';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { updateEmailSchema } from '@/lib/account/schemas';

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    const parsed = updateEmailSchema.safeParse(body);
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

    const newEmail = parsed.data.newEmail.toLowerCase();

    if (newEmail === user.email) {
      return NextResponse.json(
        { error: 'New email is the same as current email' },
        { status: 400 },
      );
    }

    // Existence check leaks enumeration but matches the signup endpoint's
    // honest-UX tradeoff — a generic message here would be worse UX without
    // meaningfully closing the side-channel already present at signup.
    const existing = await db.user.findUnique({ where: { email: newEmail } });
    if (existing) {
      return NextResponse.json(
        { error: 'Email is already in use' },
        { status: 400 },
      );
    }

    await db.user.update({
      where: { id: userId },
      data: { email: newEmail },
    });

    return NextResponse.json({ data: { email: newEmail } }, { status: 200 });
  } catch (err) {
    logger.error({ err }, 'update email failed');
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
