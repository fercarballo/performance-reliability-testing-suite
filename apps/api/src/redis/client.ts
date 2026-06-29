import Redis from 'ioredis';
import { config } from '../config/env';
import { logger } from '../observability/logger';

/**
 * Redis is used as a read-through cache for invoice lookups (see the billing
 * module). It is a real internal dependency, which is exactly what makes it
 * interesting under load: cache hits should be fast, cache misses pay the
 * PostgreSQL cost, and a degraded Redis should not take the whole API down.
 */
export const redis = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  lazyConnect: false,
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
});

redis.on('error', (err) => {
  // Logged at warn (not error): the API is designed to degrade gracefully when
  // the cache is unavailable rather than fail the request.
  logger.warn({ err: err.message }, 'redis connection issue');
});

export async function pingRedis(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
