import { z } from 'zod';

/**
 * Centralised, validated configuration.
 *
 * Everything the app needs comes from the environment so the same image runs
 * identically in `local`, `ci` and (hypothetically) a deployed environment.
 * Invalid configuration fails fast at boot instead of surfacing as a runtime
 * surprise under load.
 */
const boolean = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['local', 'ci', 'test', 'production']).default('local'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  POSTGRES_HOST: z.string().default('postgres'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_USER: z.string().default('telco'),
  POSTGRES_PASSWORD: z.string().default('telco'),
  POSTGRES_DB: z.string().default('telco'),

  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  JWT_SECRET: z.string().min(8).default('dev-only-secret-change-me'),
  JWT_EXPIRES_IN: z.coerce.number().int().positive().default(3600),

  SEED_ON_START: boolean.default('true'),
  SEED_CUSTOMERS: z.coerce.number().int().positive().max(5000).default(100),

  ENABLE_FAULTS: boolean.default('true'),

  OTEL_ENABLED: boolean.default('true'),
  OTEL_SERVICE_NAME: z.string().default('telco-api'),
  OTEL_SERVICE_VERSION: z.string().default('1.0.0'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://otel-collector:4317'),
  DEPLOYMENT_ENVIRONMENT: z.string().default('local'),

  LOKI_ENABLED: boolean.default('true'),
  LOKI_URL: z.string().default('http://loki:3100'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    'Invalid environment configuration:',
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
  );
  process.exit(1);
}

export const config = parsed.data;
export type AppConfig = typeof config;

/**
 * Fault injection is a deliberate foot-gun: it is only ever wired up in
 * non-production environments. This single source of truth keeps the guard
 * consistent across the app.
 */
export const faultsAllowed =
  config.ENABLE_FAULTS && config.NODE_ENV !== 'production';
