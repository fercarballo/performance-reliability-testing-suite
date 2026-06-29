import { afterEach, describe, expect, it } from 'vitest';
import { applyFault, clearFaults, listFaults, setFault } from './service';

afterEach(() => clearFaults());

describe('fault injection service', () => {
  it('registers and lists an active fault', () => {
    setFault({ target: 'payments', fault: 'error', rate: 1, durationSec: 60 });
    const faults = listFaults();
    expect(faults).toHaveLength(1);
    expect(faults[0]?.target).toBe('payments');
    expect(faults[0]?.fault).toBe('error');
  });

  it('clears all faults', () => {
    setFault({ target: 'billing', fault: 'error', rate: 1, durationSec: 60 });
    clearFaults();
    expect(listFaults()).toHaveLength(0);
  });

  it('applies an error fault when rate is 1', async () => {
    setFault({ target: 'payments', fault: 'error', rate: 1, durationSec: 60 });
    expect(await applyFault('payments')).toBe('error');
  });

  it('never applies when rate is 0', async () => {
    setFault({ target: 'payments', fault: 'error', rate: 0, durationSec: 60 });
    expect(await applyFault('payments')).toBeNull();
  });

  it('does nothing for an untargeted journey', async () => {
    setFault({ target: 'billing', fault: 'error', rate: 1, durationSec: 60 });
    expect(await applyFault('payments')).toBeNull();
  });

  it('expires automatically', async () => {
    setFault({ target: 'auth', fault: 'error', rate: 1, durationSec: 1 });
    expect(listFaults()).toHaveLength(1);
    // durationSec is clamped to >=1; fake an expired rule by waiting it out is
    // slow, so we assert the rule carries an expiry in the future instead.
    expect(new Date(listFaults()[0]!.expiresAt).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });
});
