import cron, { type ScheduledTask } from 'node-cron';
import { db } from '@/lib/db';
import { sendEarningsReminder } from '@/lib/email';
import { withRetry, yahooFinance } from '@/lib/finance/yahoo-client';
import { logger } from '@/lib/logger';
import { cronRuns } from '@/lib/telemetry/metrics';
import { withSpan } from '@/lib/telemetry/spans';

const SCHEDULE = '0 * * * *';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const JOB_NAME = 'earnings-alerts';
const log = logger.child({ module: 'cron', job: JOB_NAME });

// Yahoo's `calendarEvents.earnings.earningsDate` is an array of Date/number
// candidates; we coerce to a single Date or return null when no upcoming
// event is published yet (common for less-followed tickers).
async function fetchNextEarningsDate(ticker: string): Promise<Date | null> {
  const summary = (await withRetry(
    () =>
      yahooFinance.quoteSummary(ticker, { modules: ['calendarEvents'] }),
    { ticker, module: 'calendarEvents' },
  )) as { calendarEvents?: { earnings?: { earningsDate?: unknown } } };

  const raw = summary.calendarEvents?.earnings?.earningsDate;
  const candidates = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  const now = Date.now();
  let next: Date | null = null;
  for (const value of candidates) {
    const date =
      value instanceof Date
        ? value
        : typeof value === 'number'
          ? new Date(value * 1000)
          : typeof value === 'string'
            ? new Date(value)
            : null;
    if (!date || Number.isNaN(date.getTime())) continue;
    if (date.getTime() < now) continue;
    if (!next || date.getTime() < next.getTime()) next = date;
  }
  return next;
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

async function tickImpl(): Promise<void> {
  const alerts = await db.earningsAlert.findMany({
    where: { active: true },
    include: { user: { select: { email: true } } },
  });

  if (alerts.length === 0) {
    log.debug('no active earnings alerts');
    return;
  }

  const tickers = Array.from(new Set(alerts.map((a) => a.ticker)));
  const nextDates = new Map<string, Date | null>();
  for (const ticker of tickers) {
    try {
      nextDates.set(ticker, await fetchNextEarningsDate(ticker));
    } catch (err) {
      log.warn({ err, ticker }, 'failed to fetch next earnings date');
      nextDates.set(ticker, null);
    }
  }

  const todayUtc = startOfUtcDay(new Date());
  let triggered = 0;
  for (const alert of alerts) {
    try {
      const next = nextDates.get(alert.ticker);
      if (!next) continue;

      const nextDayUtc = startOfUtcDay(next);
      const daysUntil = Math.round(
        (nextDayUtc.getTime() - todayUtc.getTime()) / MS_PER_DAY,
      );
      if (daysUntil < 0 || daysUntil > alert.daysBefore) continue;

      // Skip if we already notified for this exact earnings event.
      if (
        alert.lastNotifiedDate &&
        startOfUtcDay(alert.lastNotifiedDate).getTime() === nextDayUtc.getTime()
      ) {
        continue;
      }

      await sendEarningsReminder({
        to: alert.user.email,
        ticker: alert.ticker,
        earningsDate: nextDayUtc.toISOString().slice(0, 10),
        daysBefore: daysUntil,
      });

      await db.earningsAlert.update({
        where: { id: alert.id },
        data: { lastNotifiedDate: nextDayUtc },
      });
      triggered++;
    } catch (err) {
      log.error({ err, alertId: alert.id }, 'earnings alert evaluation failed');
    }
  }

  log.info(
    { evaluated: alerts.length, triggered },
    'earnings alert tick complete',
  );
}

// One span per tick (not per alert) — the tick is the meaningful unit of work.
async function tick(): Promise<void> {
  await withSpan('cron.earnings-alerts', { 'cron.job': JOB_NAME }, async () => {
    try {
      await tickImpl();
      cronRuns.add(1, { job: JOB_NAME, outcome: 'success' });
    } catch (err) {
      cronRuns.add(1, { job: JOB_NAME, outcome: 'error' });
      throw err;
    }
  });
}

export function register(): ScheduledTask {
  return cron.schedule(SCHEDULE, () => {
    tick().catch((err) => log.error({ err }, 'earnings alert tick crashed'));
  });
}
