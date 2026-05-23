import cron, { type ScheduledTask } from 'node-cron';
import { db } from '@/lib/db';
import { sendPriceAlert } from '@/lib/email';
import { fetchPrice } from '@/lib/finance/adapters/price.adapter';
import { logger } from '@/lib/logger';

const SCHEDULE = '*/5 * * * *';
const log = logger.child({ module: 'cron', job: 'price-alerts' });

async function tick(): Promise<void> {
  const alerts = await db.priceAlert.findMany({
    where: { active: true },
    include: { user: { select: { email: true } } },
  });

  if (alerts.length === 0) {
    log.debug('no active price alerts');
    return;
  }

  // De-dupe ticker fetches so 50 alerts on AAPL hit Yahoo once per tick.
  const tickers = Array.from(new Set(alerts.map((a) => a.ticker)));
  const prices = new Map<string, number | null>();
  for (const ticker of tickers) {
    try {
      const result = await fetchPrice(ticker);
      prices.set(ticker, result.data?.regularMarketPrice ?? null);
    } catch (err) {
      log.warn({ err, ticker }, 'failed to fetch price for alert evaluation');
      prices.set(ticker, null);
    }
  }

  let triggered = 0;
  for (const alert of alerts) {
    try {
      const current = prices.get(alert.ticker);
      if (current == null) continue;

      const threshold = alert.threshold.toNumber();
      const crossed =
        (alert.direction === 'above' && current >= threshold) ||
        (alert.direction === 'below' && current <= threshold);
      if (!crossed) continue;

      await sendPriceAlert({
        to: alert.user.email,
        ticker: alert.ticker,
        direction: alert.direction as 'above' | 'below',
        threshold,
        currentPrice: current,
      });

      await db.priceAlert.update({
        where: { id: alert.id },
        data: { active: false, triggeredAt: new Date() },
      });
      triggered++;
    } catch (err) {
      log.error({ err, alertId: alert.id }, 'price alert evaluation failed');
    }
  }

  log.info({ evaluated: alerts.length, triggered }, 'price alert tick complete');
}

export function register(): ScheduledTask {
  return cron.schedule(SCHEDULE, () => {
    tick().catch((err) => log.error({ err }, 'price alert tick crashed'));
  });
}
