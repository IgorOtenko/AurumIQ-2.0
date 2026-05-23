// `withSpan` — small helper that wraps an async function in an active span.
//
// Why a helper instead of `tracer.startActiveSpan` at every call site:
//   - We always want exception capture + status setting + span.end() — easy to
//     forget at the call site, and forgetting span.end() leaks memory in the
//     exporter buffer.
//   - The helper keeps the call site readable: one line of intent, one block
//     of logic.
import { type Span, SpanStatusCode } from '@opentelemetry/api';
import { tracer } from './tracer';

export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      // recordException captures the message + stack as a span event so it
      // survives even if the calling code swallows the error after rethrow.
      span.recordException(err as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}
