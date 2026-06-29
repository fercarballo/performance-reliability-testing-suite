import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../../database/pool';
import { pingRedis } from '../../redis/client';
import { config } from '../../config/env';

/**
 * Liveness/readiness. PostgreSQL is the only hard dependency: if it is down the
 * API cannot serve, so we return 503. Redis being down is a *degraded* state,
 * not an outage, because invoice lookups fall back to the database.
 */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_req, reply) => {
    let database = 'ok';
    try {
      await pool.query('SELECT 1');
    } catch {
      database = 'down';
    }

    const redisOk = await pingRedis();
    const observability = config.OTEL_ENABLED ? 'ok' : 'disabled';
    const healthy = database === 'ok';

    return reply.code(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      database,
      redis: redisOk ? 'ok' : 'down',
      observability,
    });
  });
};
