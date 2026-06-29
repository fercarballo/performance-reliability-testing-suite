import { trace, SpanStatusCode, type Span } from '@opentelemetry/api';

/**
 * Thin wrapper around the OpenTelemetry tracer. When OTEL is disabled this is a
 * no-op (the global tracer returns inert spans), so business code can always
 * call `withSpan(...)` without guarding for telemetry being on.
 */
const tracer = trace.getTracer('telco-api');

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes: Record<string, string | number | boolean> = {},
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    span.setAttributes(attributes);
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
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

export function currentTraceId(): string | undefined {
  return trace.getActiveSpan()?.spanContext().traceId;
}
