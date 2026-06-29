import { sleep } from '../../utils/sleep';
import {
  faultInjectionActive,
  faultInjectionAffected,
} from '../../observability/metrics';
import { logger } from '../../observability/logger';

/**
 * Controlled fault injection.
 *
 * This is the engine behind the reliability story: it lets us reproduce, on
 * demand, the kinds of partial degradations that are painful to debug in
 * production (a slow downstream, a flaky dependency, an endpoint that times
 * out) and then prove that our observability stack can pinpoint them.
 *
 * Rules live in-memory, are scoped to a single journey ("target"), apply only
 * to a configurable fraction of requests ("rate"), and ALWAYS auto-expire.
 */
export type FaultTarget = 'auth' | 'billing' | 'plans' | 'payments' | 'global';
export type FaultType = 'latency' | 'error' | 'timeout';

export interface FaultRule {
  target: FaultTarget;
  fault: FaultType;
  rate: number;
  latencyMs: number;
  durationSec: number;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
}

export interface FaultInput {
  target: FaultTarget;
  fault: FaultType;
  rate?: number;
  latencyMs?: number;
  durationSec?: number;
  createdBy?: string;
}

const rules = new Map<FaultTarget, FaultRule>();

function sweepExpired(): void {
  const now = Date.now();
  for (const [target, rule] of rules) {
    if (new Date(rule.expiresAt).getTime() <= now) {
      rules.delete(target);
      faultInjectionActive.set({ target: rule.target, fault: rule.fault }, 0);
      logger.info({ target, fault: rule.fault }, 'fault expired');
    }
  }
}

export function setFault(input: FaultInput): FaultRule {
  const now = Date.now();
  const durationSec = input.durationSec ?? 300;
  const rule: FaultRule = {
    target: input.target,
    fault: input.fault,
    rate: Math.min(Math.max(input.rate ?? 1, 0), 1),
    latencyMs: input.latencyMs ?? (input.fault === 'timeout' ? 15000 : 2000),
    durationSec,
    createdBy: input.createdBy ?? 'unknown',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + durationSec * 1000).toISOString(),
  };

  rules.set(rule.target, rule);
  faultInjectionActive.set({ target: rule.target, fault: rule.fault }, 1);
  logger.warn(
    {
      target: rule.target,
      fault: rule.fault,
      rate: rule.rate,
      latencyMs: rule.latencyMs,
      durationSec: rule.durationSec,
      createdBy: rule.createdBy,
    },
    'fault injected',
  );
  return rule;
}

export function clearFaults(): void {
  for (const rule of rules.values()) {
    faultInjectionActive.set({ target: rule.target, fault: rule.fault }, 0);
  }
  rules.clear();
  logger.info('all faults cleared');
}

export function listFaults(): FaultRule[] {
  sweepExpired();
  return [...rules.values()];
}

/**
 * Applies the active fault (if any) for a journey. Latency/timeout faults are
 * awaited here; an error fault returns the string 'error' so the caller can
 * translate it into a 5xx response with the right business metric.
 */
export async function applyFault(
  target: Exclude<FaultTarget, 'global'>,
): Promise<'error' | null> {
  sweepExpired();
  const rule = rules.get(target) ?? rules.get('global');
  if (!rule) return null;
  if (Math.random() > rule.rate) return null;

  faultInjectionAffected.inc({ target: rule.target, fault: rule.fault });

  switch (rule.fault) {
    case 'latency':
      await sleep(rule.latencyMs);
      return null;
    case 'timeout':
      // Sleep well beyond the client timeout so the caller observes a timeout.
      await sleep(rule.latencyMs);
      return null;
    case 'error':
      return 'error';
    default:
      return null;
  }
}
