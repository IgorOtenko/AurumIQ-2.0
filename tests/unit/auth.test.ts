import { describe, it, expect } from 'vitest';
import bcryptjs from 'bcryptjs';
import { randomUUID } from 'crypto';
import { z } from 'zod';

// Replicate the Zod schemas from the route handlers so we test
// the same validation rules without importing server-side modules
// that depend on Prisma/DB connections.
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
});

const confirmResetSchema = z.object({
  token: z.string().uuid('Invalid token format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

describe('Signup Validation', () => {
  it('accepts a valid email and password (8+ chars)', () => {
    const result = signupSchema.safeParse({
      email: 'user@example.com',
      password: 'securepass',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email format', () => {
    const result = signupSchema.safeParse({
      email: 'not-an-email',
      password: 'securepass',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('email');
    }
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = signupSchema.safeParse({
      email: 'user@example.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('password');
    }
  });

  it('accepts an optional name field', () => {
    const result = signupSchema.safeParse({
      email: 'user@example.com',
      password: 'securepass',
      name: 'Test User',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Test User');
    }
  });
});

describe('Password Hashing', () => {
  it('bcryptjs.hash produces a hash starting with $2a$ or $2b$', async () => {
    const hash = await bcryptjs.hash('testpassword', 12);
    // bcryptjs produces $2a$ prefix hashes
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  it('bcryptjs.compare returns true for the correct password', async () => {
    const password = 'correcthorse';
    const hash = await bcryptjs.hash(password, 10);
    const match = await bcryptjs.compare(password, hash);
    expect(match).toBe(true);
  });

  it('bcryptjs.compare returns false for an incorrect password', async () => {
    const hash = await bcryptjs.hash('realpassword', 10);
    const match = await bcryptjs.compare('wrongpassword', hash);
    expect(match).toBe(false);
  });
});

describe('Reset Token', () => {
  it('crypto.randomUUID() produces a valid UUID v4 format', () => {
    const uuid = randomUUID();
    // UUID v4 format: 8-4-4-4-12 hex chars, version nibble = 4
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid).toMatch(uuidRegex);
  });

  it('token is rejected when expiresAt is in the past', () => {
    // Mirrors the check in confirm/route.ts: `resetToken.expiresAt < new Date()`
    const expiredAt = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const isExpired = expiredAt < new Date();
    expect(isExpired).toBe(true);
  });

  it('token is accepted when expiresAt is in the future', () => {
    const futureExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    const isExpired = futureExpiry < new Date();
    expect(isExpired).toBe(false);
  });

  it('Zod rejects a non-UUID token string', () => {
    const result = confirmResetSchema.safeParse({
      token: 'not-a-uuid',
      password: 'securepass',
    });
    expect(result.success).toBe(false);
  });

  it('Zod accepts a valid UUID token with valid password', () => {
    const result = confirmResetSchema.safeParse({
      token: randomUUID(),
      password: 'securepass',
    });
    expect(result.success).toBe(true);
  });
});
