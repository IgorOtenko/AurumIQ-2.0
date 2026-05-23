// Email abstraction layer for AurumIQ.
// In development: logs to console (sufficient for local testing).
// In production: placeholder for AWS SES integration (Phase 7).
// This pattern keeps user flows fully testable without external services.

import { logger } from './logger';

const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const emailLog = logger.child({ module: 'email' });

function logDev(subject: string, to: string, body: string): void {
  // Console output is the intended dev-mode delivery mechanism.
  // T-01-11: acceptable risk — dev-only behavior, never reaches production.
  console.log('─'.repeat(60));
  console.log(`[DEV EMAIL] To: ${to}`);
  console.log(`[DEV EMAIL] Subject: ${subject}`);
  console.log(`[DEV EMAIL] ${body}`);
  console.log('─'.repeat(60));
}

function notConfigured(kind: string): never {
  // Throwing here ensures production deploys don't silently swallow
  // notifications before AWS SES is wired up.
  throw new Error(
    `Email sending not configured (${kind}). AWS SES integration is planned for Phase 7.`,
  );
}

/**
 * Send a password reset email containing a tokenized link.
 * Dev mode logs the link to console; production will use AWS SES (Phase 7).
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password/confirm?token=${token}`;

  if (process.env.NODE_ENV !== 'production') {
    logDev('Password reset', email, resetUrl);
    return;
  }

  notConfigured('password-reset');
}

interface PriceAlertEmail {
  to: string;
  ticker: string;
  direction: 'above' | 'below';
  threshold: number;
  currentPrice: number;
}

/**
 * Notify a user that a price-cross alert has fired.
 */
export async function sendPriceAlert(params: PriceAlertEmail): Promise<void> {
  const { to, ticker, direction, threshold, currentPrice } = params;
  const subject = `Price alert: ${ticker} crossed $${threshold.toFixed(2)}`;
  const body =
    `${ticker} is now $${currentPrice.toFixed(2)}, which is ` +
    `${direction} your ${direction === 'above' ? 'upper' : 'lower'} ` +
    `threshold of $${threshold.toFixed(2)}.`;

  emailLog.info({ to, ticker, direction, threshold, currentPrice }, 'price alert');

  if (process.env.NODE_ENV !== 'production') {
    logDev(subject, to, body);
    return;
  }

  notConfigured('price-alert');
}

interface EarningsReminderEmail {
  to: string;
  ticker: string;
  earningsDate: string;
  daysBefore: number;
}

/**
 * Remind a user that a watched company reports earnings soon.
 */
export async function sendEarningsReminder(
  params: EarningsReminderEmail,
): Promise<void> {
  const { to, ticker, earningsDate, daysBefore } = params;
  const subject = `Reminder: ${ticker} reports in ${daysBefore} day${daysBefore === 1 ? '' : 's'}`;
  const body = `${ticker} is scheduled to report earnings on ${earningsDate}.`;

  emailLog.info({ to, ticker, earningsDate, daysBefore }, 'earnings reminder');

  if (process.env.NODE_ENV !== 'production') {
    logDev(subject, to, body);
    return;
  }

  notConfigured('earnings-reminder');
}
