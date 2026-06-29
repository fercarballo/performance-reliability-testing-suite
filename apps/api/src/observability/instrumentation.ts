/**
 * OpenTelemetry bootstrap.
 *
 * This file is loaded with `node --require` BEFORE any application code so the
 * auto-instrumentations can monkey-patch `http`, `pg` and `ioredis` as they are
 * required. Traces are exported over OTLP/gRPC to the OpenTelemetry Collector,
 * which fans them out to Tempo.
 *
 * Tracing is fully optional: with OTEL_ENABLED=false the app boots with zero
 * telemetry dependencies active, which keeps unit tests and "core only" runs
 * fast and self-contained.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

const enabled = (process.env.OTEL_ENABLED ?? 'true') !== 'false';

if (enabled) {
  const exporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4317',
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'telco-api',
      [ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION ?? '1.0.0',
      'deployment.environment': process.env.DEPLOYMENT_ENVIRONMENT ?? 'local',
    }),
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // File-system spans are extremely noisy and not useful for this lab.
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  // Flush remaining spans on shutdown. Process exit itself is orchestrated by
  // server.ts, so we only ask the SDK to flush here.
  const flush = () => {
    sdk.shutdown().catch(() => undefined);
  };

  process.on('SIGTERM', flush);
  process.on('SIGINT', flush);
}
