import { NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';

// Zod schema validates untrusted input at the API boundary.
// Min 8 chars for password aligns with NIST SP 800-63B guidance.
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      );
    }

    const { email, password, name } = parsed.data;

    // Check for existing user before hashing to fail fast on duplicates.
    // T-01-03: 409 on duplicate email is an acceptable UX tradeoff.
    const existing = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 },
      );
    }

    // Cost factor 12 balances security vs. latency on a t3.micro instance.
    // bcryptjs is pure JS — no native bindings needed on EC2.
    const hashedPassword = await bcryptjs.hash(password, 12);

    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        hashedPassword,
        name: name || null,
      },
    });

    return NextResponse.json(
      { id: user.id, email: user.email },
      { status: 201 },
    );
  } catch (error) {
    // Never expose stack traces or internal error details to clients.
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
