// OpenTelemetry SDK bootstrap.
//
// We initialize the Node SDK once per process. The exporter target for v1 is
// stdout (`ConsoleSpanExporter`) because we run on the AWS free tier with no
// CloudWatch agent or OTLP collector. The instrumentation itself is real —
// swapping in an OTLP exporter later is a one-line change.
//
// We do NOT enable any auto-instrumentations (no HTTP, Prisma, fs, etc.). The
// goal is to keep the trace stream signal-dense: only the hot paths we wrap
// explicitly via `withSpan` produce spans. Auto-instrumentations would bury
// our AI/cron/finance spans in HTTP-request noise during development.
//
// `@opentelemetry/sdk-trace-node`, `@opentelemetry/resources`, and
// `@opentelemetry/semantic-conventions` are transitive dependencies of
// `@opentelemetry/sdk-node` and aren't hoisted by pnpm. We access them via
// the namespace re-exports on `sdk-node` and use literal attribute keys
// rather than the semantic-conventions constants.
import { NodeSDK, node, resources } from '@opentelemetry/sdk-node';
import { trace, type Tracer } from '@opentelemetry/api';

const globalForOtel = globalThis as unknown as {
  otelSdk: NodeSDK | undefined;
};

export function initTelemetry(): void {
  if (globalForOtel.otelSdk) return; // idempotent — Next.js hot-reload re-imports this module

  const sdk = new NodeSDK({
    resource: resources.resourceFromAttributes({
      // Literal keys — see comment above re: semantic-conventions not being hoisted.
      'service.name': 'aurumiq',
      'service.version': '0.1.0',
    }),
    traceExporter: new node.ConsoleSpanExporter(),
    // Empty list → no auto-instrumentations. See header comment.
    instrumentations: [],
  });

  sdk.start();
  globalForOtel.otelSdk = sdk;
}

// All app code grabs a tracer through this constant so the instrumentation
// scope name is consistent across spans.
export const tracer: Tracer = trace.getTracer('aurumiq', '0.1.0');

export async function shutdownTelemetry(): Promise<void> {
  if (globalForOtel.otelSdk) {
    await globalForOtel.otelSdk.shutdown();
    globalForOtel.otelSdk = undefined;
  }
}
