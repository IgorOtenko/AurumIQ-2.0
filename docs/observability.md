# Observability

AurumIQ ships structured logging (Pino) and OpenTelemetry instrumentation (traces + custom metrics) from day one. This document is the reference for what is instrumented, where the names come from, and how to swap the v1 dev-friendly exporters for production targets.

## Why this exists

The app runs Claude API calls in the hot path and three `node-cron` jobs in the background. Two operational questions dominate:

- **Cost.** Every Claude call burns tokens. Without metrics tagged by section, model, and direction (input / output / cache_read / cache_creation), there is no way to know whether the prompt cache is paying off or which section is the most expensive.
- **Quality.** Two AI outcomes are not "completed" — `validation_failed` (model invented a number) and `failed` (schema parse or API error). Both must be visible to the operator. The cron jobs add a third operational axis: did the schedule actually fire? Did the alert email send?

A console.log per call won't answer either question at fleet scale. The OpenTelemetry instrumentation is real; only the exporter target is dev-friendly in v1.

## Stack

| Concern | Tool | Source file |
|---|---|---|
| Structured logging | Pino with `pino-pretty` (dev, synchronous destination) | `src/lib/logger.ts` |
| Trace / metric SDK | `@opentelemetry/sdk-node` + `@opentelemetry/api` | `src/lib/telemetry/tracer.ts`, `src/lib/telemetry/metrics.ts` |
| Span helper | `withSpan(name, attributes, fn)` (auto exception capture + status) | `src/lib/telemetry/spans.ts` |
| Trace exporter (v1) | `ConsoleSpanExporter` — JSON spans to stdout | `tracer.ts` |
| Trace exporter (prod swap) | `OTLPTraceExporter` from `@opentelemetry/exporter-trace-otlp-http` | `tracer.ts`, one-line change |
| Boot | `src/instrumentation.ts` → `initTelemetry()` runs before `startCronJobs()` | — |

**No auto-instrumentations.** The NodeSDK is configured with `instrumentations: []`. Default HTTP / Prisma / fs auto-instrumentations would bury the four hot-path spans in noise — every Next.js request would produce 10+ spans before our `ai.generate` even runs. Explicit `withSpan` calls give a curated, signal-dense trace stream.

## What's instrumented

### Spans

| Span | Where | Attributes | Outcome attribute |
|---|---|---|---|
| `ai.generate` | `src/lib/ai/generate.ts` wraps `generateSection` | `ai.ticker`, `ai.sectionType`, `ai.model`, `ai.outcome`, `ai.tokens.input`, `ai.tokens.output`, `ai.tokens.cache_read`, `ai.tokens.cache_creation` | `completed`, `validation_failed`, `failed` |
| `cron.price-alerts` | `src/lib/cron/price-alerts.ts` per tick | `cron.job=price-alerts`, `cron.alerts_checked`, `cron.alerts_fired` | `success`, `error` |
| `cron.earnings-alerts` | `src/lib/cron/earnings-alerts.ts` per tick | `cron.job=earnings-alerts`, `cron.alerts_checked`, `cron.alerts_fired` | `success`, `error` |
| `cron.scheduled-ai` | `src/lib/cron/scheduled-ai.ts` per tick | `cron.job=scheduled-ai`, `cron.schedules_checked`, `cron.schedules_fired` | `success`, `error` |

Spans are wrapped with `withSpan` so any thrown exception inside `fn` is automatically recorded (`span.recordException(err)` + `span.setStatus({ code: ERROR, message })`). The cron tick is the unit of work — one span per tick, not per alert/schedule row checked. N rows × N spans per tick would drown the trace stream.

### Counters

All four counters live in `src/lib/telemetry/metrics.ts`. They use the `@opentelemetry/api` Meter directly; the SDK does not yet wire a `MeterProvider`, so the instruments record into a no-op meter today. Adding a `MeterProvider` (CloudWatch / OTLP / Prometheus) is additive — zero changes at the call sites.

| Counter | Description | Labels (attributes) |
|---|---|---|
| `ai.tokens` | Total Claude API tokens consumed | `section`, `model`, `direction` (`input` / `output` / `cache_read` / `cache_creation`) |
| `finance.cache.events` | Finance adapter cache hits vs misses | `dataType` (`price` / `earnings` / `analyst` / `options` / `profile` / `news`), `outcome` (`hit` / `miss`) |
| `cron.runs` | Cron job execution count | `job` (`price-alerts` / `earnings-alerts` / `scheduled-ai`), `outcome` (`success` / `error`) |

Derived metrics worth knowing:

- **Prompt cache hit rate (per section)** = `ai.tokens{direction=cache_read} / ai.tokens{direction=cache_read + input}`. Drives the Phase 7 "is the system prompt earning its keep" question.
- **Finance cache hit rate** = `finance.cache.events{outcome=hit} / sum(finance.cache.events)`. Yahoo Finance rate limiting is the main risk this rate guards against.
- **Cron success rate** = `cron.runs{outcome=success} / sum(cron.runs)`. Fires a SEV-2 if any job's rate drops below 99% over 24h.

### Histogram

| Histogram | Unit | Labels |
|---|---|---|
| `ai.skill.duration` | ms | `section`, `model`, `outcome` |

One observation per `generateSection` call, regardless of outcome. Lets us derive p50 / p95 / p99 per section once a MeterProvider is wired.

## Pino conventions

All logging is structured JSON. **Never** `console.log`, never string-interpolated.

```ts
import { financeLogger } from '@/lib/logger';

// Good — structured fields
financeLogger.warn(
  { ticker, dataType, fetchedAt },
  'partial response from Yahoo Finance',
);

// Bad — string-interpolated
financeLogger.warn(`partial response for ${ticker}`);
```

Child loggers attach a `module` field for filtering:

| Child | Attached field | Source |
|---|---|---|
| `logger` (root) | `service: 'aurumiq'` (base) | `src/lib/logger.ts` |
| `financeLogger` | `module: 'finance'` | finance adapters + cache |
| `aiLogger` | `module: 'ai'` | AI pipeline + generate.ts |
| `logger.child({ module: 'cron' })` | `module: 'cron'` | cron jobs (inline) |

Levels:

- `debug` — local dev only (LOG_LEVEL default). Adapter cache hits, query keys, request bodies.
- `info` — expected operational events. Cron tick start/end, alert fired, schedule fired, AI completed.
- `warn` — degraded but recoverable. Yahoo partial response, no-options-chain (expected for ETFs), validation failed.
- `error` — unrecoverable in this call. Anthropic API error, Yahoo throw with no stale cache, Prisma error.

The dev environment uses `pino-pretty` as a **synchronous in-process destination**, not the worker-thread transport. Turbopack HMR repeatedly kills the transport worker between reloads, surfacing as `uncaughtException: Error: the worker has exited` on every log call. The trade is a small perf cost in dev (irrelevant) for full stderr cleanliness; production stays on raw JSON to stdout.

## Local debugging

```bash
pnpm dev
```

The first request triggers `instrumentation.ts → initTelemetry()` and `startCronJobs()`. From there:

- **Logs.** Pino-pretty JSON in stdout, colorized and time-prefixed. Filter by `service: aurumiq` or `module: ai` if grepping the raw stream.
- **Spans.** `ConsoleSpanExporter` dumps each finished span to stdout as JSON. Look for `name: 'ai.generate'` to see the AI pipeline trace with attribute set and any recorded exceptions.
- **Metrics.** No-op until a MeterProvider is wired. Adding one for local dev (e.g., `PeriodicExportingMetricReader` with `ConsoleMetricExporter`) is a 5-line addition in `tracer.ts`.

To watch the cron jobs without waiting:

- Adjust the schedule string in the relevant `src/lib/cron/*.ts` file (e.g., `*/1 * * * *` for every minute) and restart the dev server.

## Production swap

Three changes flip the v1 dev-friendly setup to a production-grade observability target:

1. **Trace exporter.** Replace `ConsoleSpanExporter` with `OTLPTraceExporter`:

   ```ts
   // src/lib/telemetry/tracer.ts
   import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

   traceExporter: new OTLPTraceExporter({
     url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
   }),
   ```

   Point at the AWS Distro for OpenTelemetry collector (writes to X-Ray + CloudWatch Metrics), Honeycomb, Tempo, or any OTLP-compatible backend.

2. **MeterProvider.** Add a `PeriodicExportingMetricReader` to the `NodeSDK` config wired to the same collector. This activates the four custom counters and the histogram.

3. **Log shipping.** Pino already emits raw JSON to stdout in production. Capture stdout into CloudWatch Logs (via the CloudWatch Agent or the EC2 instance's log group) and query with CloudWatch Logs Insights using the JSON field accessors:

   ```
   fields @timestamp, msg, ticker, sectionType
   | filter module = "ai" and level = 50  /* error */
   | sort @timestamp desc
   ```

Both `OTLP_EXPORTER_OTLP_TRACES_ENDPOINT` and any auth header config belong in `env.ts` so they go through `@t3-oss/env-nextjs` validation. No environment-conditional fallbacks — fail fast if the target is misconfigured in prod.
