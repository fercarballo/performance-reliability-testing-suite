import { randomBytes } from 'node:crypto';

/** Readable, collision-resistant ids like `payment_a1b2c3d4e5f6`. */
export const newId = (prefix: string): string =>
  `${prefix}_${randomBytes(6).toString('hex')}`;
