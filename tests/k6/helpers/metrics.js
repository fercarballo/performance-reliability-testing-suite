// Custom, business-named metrics. These live alongside k6's built-in
// http_req_* metrics and make the test results readable in business terms:
// "login_duration", "payment_success_rate", etc.
import { Trend, Rate, Counter } from 'k6/metrics';

export const loginDuration = new Trend('login_duration', true);
export const loginSuccess = new Rate('login_success_rate');

export const invoiceLookupDuration = new Trend('invoice_lookup_duration', true);
export const invoiceLookupSuccess = new Rate('invoice_lookup_success_rate');

export const planChangeDuration = new Trend('plan_change_duration', true);
export const planChangeSuccess = new Rate('plan_change_success_rate');

export const paymentDuration = new Trend('payment_duration', true);
export const paymentSuccess = new Rate('payment_success_rate');
export const paymentIdempotencyConflicts = new Counter(
  'payment_idempotency_conflicts',
);
