import { PrismaClient } from '@prisma/client';

// Singleton pattern prevents connection exhaustion during Next.js
// hot-reload in development. In production, only one instance exists
// per Node.js process. The globalThis approach is the Prisma-recommended
// pattern for Next.js.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
