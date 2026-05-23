// Next.js 15 `instrumentation.ts` runs once per server process at startup.
// We register cron jobs only inside the Node.js runtime so they never leak
// into edge-runtime middleware bundles.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startCronJobs } = await import('@/lib/cron');
    startCronJobs();
  }
}
