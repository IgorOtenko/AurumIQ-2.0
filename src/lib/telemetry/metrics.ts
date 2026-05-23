// Custom OpenTelemetry metrics for AurumIQ.
//
// These four instruments cover the CLAUDE.md observability target:
//   - skill (AI section) duration histogram
//   - daily token usage per skill
//   - finance cache hit rate
//   - cron schedule success rate
//
// We use the @opentelemetry/api meter directly. Note that until a MeterProvider
// is wired (currently the NodeSDK only exports traces), these instruments
// record into a no-op meter — the API still validates the calls, and adding a
// MeterProvider later (CloudWatch / OTLP / Prometheus) requires zero changes
// at the call sites.
import {
  metrics,
  type Counter,
  type Histogram,
  type Meter,
} from '@opentelemetry/api';

const meter: Meter = metrics.getMeter('aurumiq', '0.1.0');

// AI section generation duration, tagged by sectionType + model + outcome.
// Histogram lets us derive p50/p95/p99 latency per skill in the future.
export const aiSkillDuration: Histogram = meter.createHistogram(
  'ai.skill.duration',
  {
    description: 'AI section generation duration (ms)',
    unit: 'ms',
  },
);

// Claude API token usage, tagged by section, model, and direction
// (input | output | cache_read | cache_creation). Summed daily for cost
// dashboards.
export const aiTokens: Counter = meter.createCounter('ai.tokens', {
  description: 'Total Claude API tokens consumed',
});

// Finance adapter cache outcomes (hit | miss), tagged by dataType.
// Span-per-call would be too noisy for cache lookups — a counter is the right
// shape for hit-rate calculations.
export const financeCacheEvents: Counter = meter.createCounter(
  'finance.cache.events',
  {
    description: 'Finance adapter cache hit vs miss',
  },
);

// Cron job ticks, tagged by job and outcome (success | error). Powers the
// "schedule success rate" target metric.
export const cronRuns: Counter = meter.createCounter('cron.runs', {
  description: 'Cron job execution count',
});
