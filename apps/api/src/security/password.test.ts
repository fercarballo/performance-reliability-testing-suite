import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('is deterministic for the same input', () => {
    expect(hashPassword('password123')).toBe(hashPassword('password123'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashPassword('a')).not.toBe(hashPassword('b'));
  });

  it('verifies a correct password', () => {
    const hash = hashPassword('password123');
    expect(verifyPassword('password123', hash)).toBe(true);
  });

  it('rejects an incorrect password', () => {
    const hash = hashPassword('password123');
    expect(verifyPassword('wrong', hash)).toBe(false);
  });
});
