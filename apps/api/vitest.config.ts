import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      OTEL_ENABLED: 'false',
      LOKI_ENABLED: 'false',
      SEED_ON_START: 'false',
    },
  },
});
