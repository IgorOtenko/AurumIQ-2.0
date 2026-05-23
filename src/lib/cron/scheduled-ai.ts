import cron, { type ScheduledTask } from 'node-cron';
import { generateSection } from '@/lib/ai/generate';
import type { SectionType, SourcesData } from '@/lib/ai/types';
import { db } from '@/lib/db';
import { fetchAnalyst } from '@/lib/finance/adapters/analyst.adapter';
import { fetchEarnings } from '@/lib/finance/adapters/earnings.adapter';
import { fetchPrice } from '@/lib/finance/adapters/price.adapter';
import { fetchProfile } from '@/lib/finance/adapters/profile.adapter';
import { logger } from '@/lib/logger';
import { cronRuns } from '@/lib/telemetry/metrics';
import { withSpan } from '@/lib/telemetry/spans';

const SCHEDULE = '* * * * *';
const FIRE_WINDOW_MS = 60 * 1000;
const HAIKU_MODEL = 'claude-haiku-4-5';
const JOB_NAME = 'scheduled-ai';
const log = logger.child({ module: 'cron', job: JOB_NAME });

// Convert a (year, month, day, hour, minute) expressed in `timezone` into
// the UTC instant it corresponds to. We use Intl.DateTimeFormat to read
// the local parts of a candidate UTC instant and binary-search via
// offset adjustment — but for daily schedules a single direct pass works:
// format `now` in the target zone to get today's local date, then build
// an ISO string and let Date parse it back as UTC, then correct by the
// formatted offset.
function localTodayInTimezoneToUtc(
  hour: number,
  minute: number,
  timezone: string,
  reference: Date,
): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reference);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const year = get('year');
  const month = get('month');
  const day = get('day');

  // Build a UTC instant for the local wall-clock target, then read what
  // the target timezone thinks its wall-clock is at that instant and
  // subtract the difference. One iteration is sufficient for any IANA
  // zone (offset changes do not exceed 1h, and our second pass uses a
  // candidate already inside the correct day).
  const candidate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const tzParts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(candidate);
  const tz = (type: string) =>
    Number(tzParts.find((p) => p.type === type)?.value);
  const localAsUtc = Date.UTC(
    tz('year'),
    tz('month') - 1,
    tz('day'),
    tz('hour'),
    tz('minute'),
  );
  const offsetMs = localAsUtc - candidate.getTime();
  return new Date(candidate.getTime() - offsetMs);
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

async function buildSources(ticker: string): Promise<SourcesData> {
  const [price, earnings, analyst, profile] = await Promise.all([
    fetchPrice(ticker).then((r) => r.data ?? null),
    fetchEarnings(ticker).then((r) => r.data ?? null),
    fetchAnalyst(ticker).then((r) => r.data ?? null),
    fetchProfile(ticker).then((r) => r.data ?? null),
  ]);
  return { ticker, price, earnings, analyst, profile };
}

async function tickImpl(): Promise<void> {
  const now = new Date();
  const schedules = await db.schedule.findMany({ where: { active: true } });
  if (schedules.length === 0) return;

  let fired = 0;
  for (const schedule of schedules) {
    try {
      const todayUtc = startOfUtcDay(now);
      if (
        schedule.lastRunDate &&
        startOfUtcDay(schedule.lastRunDate).getTime() === todayUtc.getTime()
      ) {
        continue;
      }

      const expected = localTodayInTimezoneToUtc(
        schedule.hour,
        schedule.minute,
        schedule.timezone,
        now,
      );
      if (Math.abs(now.getTime() - expected.getTime()) > FIRE_WINDOW_MS) {
        continue;
      }

      const sources = await buildSources(schedule.ticker);
      await generateSection({
        userId: schedule.userId,
        ticker: schedule.ticker,
        sectionType: schedule.sectionType as SectionType,
        sources,
        model: HAIKU_MODEL,
      });
      await db.schedule.update({
        where: { id: schedule.id },
        data: { lastRunAt: now, lastRunDate: todayUtc },
      });
      fired++;
    } catch (err) {
      log.error({ err, scheduleId: schedule.id }, 'scheduled AI run failed');
    }
  }

  if (fired > 0) {
    log.info(
      { evaluated: schedules.length, fired },
      'scheduled AI tick complete',
    );
  }
}

// One span per tick. Nested `ai.generate` spans (from `generateSection`) will
// attach to this as children automatically thanks to `tracer.startActiveSpan`.
async function tick(): Promise<void> {
  await withSpan('cron.scheduled-ai', { 'cron.job': JOB_NAME }, async () => {
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
    tick().catch((err) => log.error({ err }, 'scheduled AI tick crashed'));
  });
}
