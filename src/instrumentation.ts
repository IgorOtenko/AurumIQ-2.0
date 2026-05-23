// Next.js 15 `instrumentation.ts` runs once per server process at startup.
// We initialize OpenTelemetry FIRST so any spans emitted during cron-job
// registration or first requests are captured. Cron jobs are registered next
// and gated to the Node.js runtime so they never leak into edge-runtime
// middleware bundles.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initTelemetry } = await import('@/lib/telemetry/tracer');
    initTelemetry();
    const { startCronJobs } = await import('@/lib/cron');
    startCronJobs();
  }
}
