import pino, { type Logger } from 'pino';

// Singleton via globalThis prevents duplicate transport workers
// during Next.js hot-reload (pino-pretty spawns a worker thread
// that lingers across HMR cycles without this guard).
const globalForLogger = globalThis as unknown as {
  logger: Logger | undefined;
};

const isProd = process.env.NODE_ENV === 'production';

export const logger: Logger =
  globalForLogger.logger ??
  pino({
    level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
    base: { service: 'aurumiq' },
    transport: isProd
      ? undefined
      : {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l' },
        },
  });

if (!isProd) {
  globalForLogger.logger = logger;
}

export const financeLogger: Logger = logger.child({ module: 'finance' });
