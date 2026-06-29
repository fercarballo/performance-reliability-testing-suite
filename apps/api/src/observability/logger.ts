import pino from 'pino';
import { trace } from '@opentelemetry/api';
import { config } from '../config/env';

/**
 * Injects the active trace/span id into every log line. This is the glue that
 * makes "metric -> trace -> log" correlation possible: a slow request in Tempo
 * carries a trace_id, and the very same trace_id appears here so it can be
 * grep'd in Loki.
 */
function traceMixin(): Record<string, string> {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const ctx = span.spanContext();
  if (!ctx.traceId) return {};
  return { trace_id: ctx.traceId, span_id: ctx.spanId };
}

function buildLogger(): pino.Logger {
  // Unit tests want a silent, transport-free logger (no worker threads).
  if (config.NODE_ENV === 'test') {
    return pino({ level: 'silent' });
  }

  const targets: pino.TransportTargetOptions[] = [];

  // Human-friendly logs when attached to a terminal (local dev), JSON otherwise.
  if (config.NODE_ENV === 'local' && process.stdout.isTTY) {
    targets.push({
      target: 'pino-pretty',
      level: config.LOG_LEVEL,
      options: { colorize: true, translateTime: 'SYS:standard' },
    });
  } else {
    targets.push({
      target: 'pino/file',
      level: config.LOG_LEVEL,
      options: { destination: 1 }, // stdout
    });
  }

  // Ship structured logs to Loki. `silenceErrors` keeps the API alive even if
  // the log backend is unreachable (e.g. running the API without the stack).
  if (config.LOKI_ENABLED) {
    targets.push({
      target: 'pino-loki',
      level: config.LOG_LEVEL,
      options: {
        host: config.LOKI_URL,
        batching: true,
        interval: 5,
        silenceErrors: true,
        labels: {
          service_name: config.OTEL_SERVICE_NAME,
          env: config.DEPLOYMENT_ENVIRONMENT,
        },
      },
    });
  }

  return pino({
    level: config.LOG_LEVEL,
    base: {
      service: config.OTEL_SERVICE_NAME,
      version: config.OTEL_SERVICE_VERSION,
    },
    // Default epoch-millis timestamp: pino-loki reads this `time` field to
    // derive the Loki nanosecond timestamp. (An ISO string here makes
    // pino-loki emit a malformed timestamp that Loki rejects.)
    mixin: traceMixin,
    // Never leak secrets into logs, no matter how an object is shaped.
    redact: {
      paths: [
        'password',
        '*.password',
        'req.body.password',
        'accessToken',
        '*.accessToken',
        'token',
        '*.token',
        'req.headers.authorization',
      ],
      remove: true,
    },
    transport: { targets },
  });
}

export const logger = buildLogger();
