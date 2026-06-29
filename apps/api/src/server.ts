import { buildApp } from './app';
import { config } from './config/env';
import { logger } from './observability/logger';
import { pool, waitForDatabase } from './database/pool';
import { runMigrations } from './database/migrate';
import { seedIfEmpty } from './database/seed';
import { redis } from './redis/client';

async function start(): Promise<void> {
  await waitForDatabase();
  await runMigrations();
  if (config.SEED_ON_START) {
    await seedIfEmpty(config.SEED_CUSTOMERS);
  }

  const app = await buildApp();
  await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
  logger.info({ port: config.API_PORT, env: config.NODE_ENV }, 'telco-api listening');

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    try {
      await app.close();
      await pool.end();
      redis.disconnect();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error({ err }, 'failed to start telco-api');
  process.exit(1);
});
