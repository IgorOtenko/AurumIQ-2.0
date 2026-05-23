import { describe, it, expect, vi } from 'vitest';

// The timezone-conversion helper inside `scheduled-ai.ts` is intentionally
// kept module-private so the cron job remains a single cohesive unit. We
// don't punch a hole in its API just to test it directly — instead this
// suite ensures the module loads cleanly with all its dependencies stubbed,
// which exercises the import graph (Intl.DateTimeFormat usage, telemetry
// wiring, adapter wiring). The wall-clock conversion math itself is covered
// indirectly via Phase 5 verification and integration testing.
//
// If we later need granular timezone-window assertions, the right move is
// to extract the helper to `src/lib/cron/timezone.ts` and add a focused
// test there. Until then this smoke test is the documented limitation.

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn(() => ({ stop: vi.fn(), start: vi.fn() })),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    schedule: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
  },
}));

vi.mock('@/lib/ai/generate', () => ({
  generateSection: vi.fn(),
}));

vi.mock('@/lib/finance/adapters/analyst.adapter', () => ({
  fetchAnalyst: vi.fn().mockResolvedValue({ data: null }),
}));
vi.mock('@/lib/finance/adapters/earnings.adapter', () => ({
  fetchEarnings: vi.fn().mockResolvedValue({ data: null }),
}));
vi.mock('@/lib/finance/adapters/price.adapter', () => ({
  fetchPrice: vi.fn().mockResolvedValue({ data: null }),
}));
vi.mock('@/lib/finance/adapters/profile.adapter', () => ({
  fetchProfile: vi.fn().mockResolvedValue({ data: null }),
}));

vi.mock('@/lib/logger', () => {
  const child = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => child,
  };
  return { logger: child, financeLogger: child, aiLogger: child };
});

vi.mock('@/lib/telemetry/metrics', () => ({
  cronRuns: { add: vi.fn() },
}));

vi.mock('@/lib/telemetry/spans', () => ({
  withSpan: (_name: string, _attrs: unknown, fn: () => Promise<unknown>) =>
    fn(),
}));

describe('scheduled-ai cron module', () => {
  it('imports without crashing and exposes register()', async () => {
    const mod = await import('../scheduled-ai');
    expect(typeof mod.register).toBe('function');
    const task = mod.register();
    expect(task).toBeDefined();
  });

  it('register() schedules with the configured cron expression', async () => {
    const cron = await import('node-cron');
    const mod = await import('../scheduled-ai');
    mod.register();
    // The module schedules every minute ('* * * * *') so the tick can
    // evaluate per-schedule fire windows against the current wall clock.
    expect(cron.default.schedule).toHaveBeenCalled();
    const firstArg = (cron.default.schedule as unknown as {
      mock: { calls: unknown[][] };
    }).mock.calls[0]?.[0];
    expect(firstArg).toBe('* * * * *');
  });
});
