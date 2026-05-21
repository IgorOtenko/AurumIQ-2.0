// Email abstraction layer for AurumIQ.
// In development: logs reset URL to console (sufficient for local testing).
// In production: placeholder for AWS SES integration (Phase 6).
// This pattern keeps the reset flow fully testable without external services.

const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

/**
 * Send a password reset email containing a tokenized link.
 * Dev mode logs the link to console; production will use AWS SES (Phase 6).
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password/confirm?token=${token}`;

  if (process.env.NODE_ENV !== 'production') {
    // Console output is the intended dev-mode delivery mechanism.
    // T-01-11: acceptable risk — dev-only behavior, never reaches production.
    console.log('─'.repeat(60));
    console.log(`[DEV] Password reset link for ${email}:`);
    console.log(`[DEV] ${resetUrl}`);
    console.log('─'.repeat(60));
    return;
  }

  // Phase 6 replaces this with real AWS SES email delivery.
  // Throwing here ensures production deploys don't silently swallow resets
  // before the email infrastructure is wired up.
  throw new Error(
    'Email sending not configured. AWS SES integration is planned for Phase 6.',
  );
}
