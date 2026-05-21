import { NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';

const confirmResetSchema = z.object({
  token: z.string().uuid('Invalid token format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = confirmResetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      );
    }

    const { token, password } = parsed.data;

    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
    });

    // T-01-08/T-01-10: Reject missing, expired, or already-used tokens.
    // Single error message for all cases prevents information leakage
    // about which specific condition failed.
    if (!resetToken || resetToken.expiresAt < new Date() || resetToken.usedAt) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 },
      );
    }

    // T-01-09: bcrypt cost 12 — same as signup, balances security vs latency.
    const hashedPassword = await bcryptjs.hash(password, 12);

    // Update password and mark token as used in sequence.
    // Both operations target different tables so a transaction ensures
    // atomicity — if the user update fails, the token stays unused.
    await db.$transaction([
      db.user.update({
        where: { email: resetToken.email },
        data: { hashedPassword },
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset confirm error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
