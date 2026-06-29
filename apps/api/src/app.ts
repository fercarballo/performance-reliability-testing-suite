import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config, faultsAllowed } from './config/env';
import { logger } from './observability/logger';
import { registry } from './observability/metrics';
import { newId } from './utils/id';
import { HttpError } from './errors';
import authPlugin from './plugins/auth';
import metricsPlugin from './plugins/metrics';
import { authRoutes } from './modules/auth/routes';
import { billingRoutes } from './modules/billing/routes';
import { planRoutes } from './modules/plans/routes';
import { paymentRoutes } from './modules/payments/routes';
import { healthRoutes } from './modules/health/routes';
import { faultRoutes } from './modules/faults/routes';

export async function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    // Per-request auto logging is disabled on purpose: under load it is both
    // expensive and noisy. Handlers log meaningful business events instead,
    // each carrying the trace_id for correlation.
    disableRequestLogging: true,
    genReqId: (req) =>
      (req.headers['x-request-id'] as string | undefined) ?? newId('req'),
    trustProxy: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: true });
  await app.register(metricsPlugin);
  await app.register(authPlugin);

  app.setErrorHandler((err: Error & { statusCode?: number }, req, reply) => {
    const statusCode =
      err instanceof HttpError ? err.statusCode : (err.statusCode ?? 500);
    const code = err instanceof HttpError ? err.code : 'error';

    if (statusCode >= 500) {
      req.log.error({ err }, err.message || 'unhandled error');
    }

    return reply.code(statusCode).send({
      error: statusCode >= 500 ? 'internal server error' : err.message,
      code,
    });
  });

  // Business routes
  await app.register(authRoutes);
  await app.register(billingRoutes);
  await app.register(planRoutes);
  await app.register(paymentRoutes);
  await app.register(healthRoutes);

  if (faultsAllowed) {
    await app.register(faultRoutes);
    logger.warn('fault injection endpoints ENABLED at /admin/faults');
  }

  // Prometheus scrape target
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', registry.contentType);
    return reply.send(await registry.metrics());
  });

  return app;
}
