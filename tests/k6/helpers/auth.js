import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, JSON_HEADERS } from './config.js';
import { loginDuration, loginSuccess } from './metrics.js';

/**
 * Logs a synthetic user in and returns a JWT (or null). Used both as a journey
 * in its own right and as a prerequisite step for the other journeys.
 */
export function login(user) {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ username: user.username, password: user.password }),
    { headers: JSON_HEADERS, tags: { journey: 'login', name: 'POST /auth/login' } },
  );

  loginDuration.add(res.timings.duration);
  const ok = check(
    res,
    {
      'login: status 200': (r) => r.status === 200,
      'login: token present': (r) => typeof r.json('accessToken') === 'string',
      'login: customerId matches': (r) => r.json('customerId') === user.customerId,
    },
    { journey: 'login' },
  );

  loginSuccess.add(ok);
  return ok ? res.json('accessToken') : null;
}
