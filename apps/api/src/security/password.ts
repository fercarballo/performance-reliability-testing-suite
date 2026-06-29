import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Deliberate trade-off: a fast SHA-256 hash, not bcrypt/argon2.
 *
 * In a real product you MUST use a slow, salted KDF (argon2id / bcrypt). Here
 * the system under test is a *performance lab*: a deliberately slow KDF would
 * dominate login latency and the load test would end up measuring the hashing
 * cost instead of the application + database behaviour we actually care about.
 * This choice is documented in docs/slo-definition.md so it never looks like an
 * accident.
 */
const SALT = 'telco-reliability-lab';

export function hashPassword(plain: string): string {
  return createHash('sha256').update(`${SALT}:${plain}`).digest('hex');
}

export function verifyPassword(plain: string, hash: string): boolean {
  const a = Buffer.from(hashPassword(plain));
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
