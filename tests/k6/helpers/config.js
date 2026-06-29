// Single place for run-wide configuration. BASE_URL is injected by the
// docker-compose `k6` service (http://api:3000) and falls back to localhost so
// the scripts also run against a locally started API.
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// JSON bodies everywhere.
export const JSON_HEADERS = { 'Content-Type': 'application/json' };
