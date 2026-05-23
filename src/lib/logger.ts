import pino, { type Logger } from 'pino';
import pinoPretty from 'pino-pretty';

// Singleton via globalThis prevents duplicate streams during HMR.
const globalForLogger = globalThis as unknown as {
  logger: Logger | undefined;
};

const isProd = process.env.NODE_ENV === 'production';

// pino-pretty as a synchronous destination (main thread) rather than
// a worker-thread transport. Turbopack HMR kills transport workers
// between reloads, surfacing as uncaughtException noise on every log
// call; running pretty inline trades a small perf cost for stability.
const devDestination = isProd
  ? undefined
  : pinoPretty({
      colorize: true,
      translateTime: 'HH:MM:ss.l',
      ignore: 'pid,hostname',
    });

export const logger: Logger =
  globalForLogger.logger ??
  pino(
    {
      level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
      base: { service: 'aurumiq' },
    },
    devDestination,
  );

if (!isProd) {
  globalForLogger.logger = logger;
}

export const financeLogger: Logger = logger.child({ module: 'finance' });

export const aiLogger: Logger = logger.child({ module: 'ai' });
