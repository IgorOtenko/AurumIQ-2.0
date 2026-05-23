import type { ScheduledTask } from 'node-cron';
import { logger } from '@/lib/logger';
import { register as registerEarningsAlerts } from './earnings-alerts';
import { register as registerPriceAlerts } from './price-alerts';
import { register as registerScheduledAi } from './scheduled-ai';

// In-process job registry — single Node.js process means one source of
// truth for cron state. If we ever scale beyond a single t3.micro this
// moves to a distributed scheduler (EventBridge, BullMQ), but for the
// free-tier deploy a singleton avoids the operational overhead.
const globalForCron = globalThis as unknown as {
  cronStarted: boolean | undefined;
  cronTasks: ScheduledTask[] | undefined;
};

export function startCronJobs(): () => void {
  if (globalForCron.cronStarted) {
    logger.warn({ module: 'cron' }, 'cron jobs already started, skipping');
    return () => stopTasks(globalForCron.cronTasks ?? []);
  }

  const tasks: ScheduledTask[] = [
    registerPriceAlerts(),
    registerEarningsAlerts(),
    registerScheduledAi(),
  ];

  globalForCron.cronStarted = true;
  globalForCron.cronTasks = tasks;
  logger.info({ module: 'cron', jobs: tasks.length }, 'cron jobs registered');

  return () => stopTasks(tasks);
}

function stopTasks(tasks: ScheduledTask[]): void {
  for (const task of tasks) task.stop();
  globalForCron.cronStarted = false;
  globalForCron.cronTasks = undefined;
}
