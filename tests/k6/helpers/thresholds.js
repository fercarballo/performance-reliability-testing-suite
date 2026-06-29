// Thresholds are SLOs expressed as code: if a run breaks one, k6 exits non-zero
// and a CI gate fails. They are intentionally tagged per journey so a slow
// payment flow does not hide behind a fast login. See docs/slo-definition.md
// for the justification of each number.
export const baseThresholds = {
  // Global reliability budget.
  http_req_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
  http_req_duration: ['p(95)<1200'],

  // Per-journey latency SLOs.
  'http_req_duration{journey:login}': ['p(95)<600'],
  'http_req_duration{journey:invoice_lookup}': ['p(95)<800'],
  'http_req_duration{journey:plan_change}': ['p(95)<1200'],
  'http_req_duration{journey:payment}': ['p(95)<1500'],

  // Per-journey success SLOs (custom metrics).
  login_success_rate: ['rate>0.99'],
  invoice_lookup_success_rate: ['rate>0.99'],
  plan_change_success_rate: ['rate>0.98'],
  payment_success_rate: ['rate>0.99'],
};

/**
 * Stress / spike / soak care about *observing* behaviour, not passing a gate,
 * so they relax the hard latency thresholds while still flagging outright
 * errors. This keeps "the system bent" distinct from "the test is broken".
 */
export const exploratoryThresholds = {
  http_req_failed: ['rate<0.10'],
  checks: ['rate>0.90'],
};
