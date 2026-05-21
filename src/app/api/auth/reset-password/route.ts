import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';

const resetRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

// T-01-07: Always return the same 200 response regardless of whether the
// email exists in our system. This prevents email enumeration attacks —
// an attacker cannot determine which emails are registered.
const GENERIC_MESSAGE =
  'If an account with that email exists, a reset link has been sent';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resetRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase();
    const user = await db.user.findUnique({ where: { email } });

    if (!user) {
      // Return identical response to prevent enumeration (T-01-07).
      return NextResponse.json({ message: GENERIC_MESSAGE });
    }

    // Clean up any previous unused tokens for this email.
    // Prevents token accumulation and ensures only one active reset at a time.
    await db.passwordResetToken.deleteMany({
      where: { email, usedAt: null },
    });

    // T-01-08: crypto.randomUUID() provides 128-bit entropy — sufficient
    // for a time-limited, single-use token.
    const token = randomUUID();
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

    await db.passwordResetToken.create({
      data: {
        token,
        email,
        expiresAt: oneHourFromNow,
      },
    });

    await sendPasswordResetEmail(email, token);

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
