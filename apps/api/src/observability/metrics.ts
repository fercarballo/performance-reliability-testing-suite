import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

/**
 * Prometheus metrics. We deliberately keep two families:
 *  - RED metrics (Rate, Errors, Duration) for every HTTP route.
 *  - Business metrics for the journeys that matter to a telco (logins,
 *    invoice lookups, plan changes, payments).
 *
 * Keeping the set small and intentional avoids the "metric explosion" noise
 * that makes dashboards unreadable.
 */
export const registry = new Registry();
registry.setDefaultLabels({ app: 'telco-api' });
collectDefaultMetrics({ register: registry });

// Latency buckets tuned for web request durations (seconds).
const httpBuckets = [
  0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1, 1.5, 2, 3, 5, 10,
];

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests handled.',
  labelNames: ['route', 'method', 'status'] as const,
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['route', 'method', 'status'] as const,
  buckets: httpBuckets,
  registers: [registry],
});

export const httpRequestErrors = new Counter({
  name: 'http_request_errors_total',
  help: 'Total HTTP requests that resulted in a 5xx response.',
  labelNames: ['route', 'method', 'status'] as const,
  registers: [registry],
});

// --- Business metrics ------------------------------------------------------
export const businessLogins = new Counter({
  name: 'business_logins_total',
  help: 'Login attempts by outcome.',
  labelNames: ['status'] as const,
  registers: [registry],
});

export const businessInvoiceLookups = new Counter({
  name: 'business_invoice_lookups_total',
  help: 'Invoice lookups by outcome.',
  labelNames: ['status'] as const,
  registers: [registry],
});

export const businessPlanChanges = new Counter({
  name: 'business_plan_changes_total',
  help: 'Plan change requests by outcome.',
  labelNames: ['status'] as const,
  registers: [registry],
});

export const businessPayments = new Counter({
  name: 'business_payments_total',
  help: 'Payment attempts by outcome.',
  labelNames: ['status'] as const,
  registers: [registry],
});

export const businessPaymentIdempotencyConflicts = new Counter({
  name: 'business_payment_idempotency_conflicts_total',
  help: 'Payment requests short-circuited by an existing idempotency key.',
  registers: [registry],
});

// --- Fault injection metrics ----------------------------------------------
export const faultInjectionActive = new Gauge({
  name: 'fault_injection_active',
  help: 'Whether a fault is currently active (1) or not (0).',
  labelNames: ['target', 'fault'] as const,
  registers: [registry],
});

export const faultInjectionAffected = new Counter({
  name: 'fault_injection_requests_affected_total',
  help: 'Requests altered by an active fault rule.',
  labelNames: ['target', 'fault'] as const,
  registers: [registry],
});
