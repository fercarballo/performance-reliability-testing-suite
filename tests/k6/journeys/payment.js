// Journey: Payment
// Criticality: critical — money movement + idempotency under concurrency.
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, JSON_HEADERS } from '../helpers/config.js';
import {
  paymentDuration,
  paymentSuccess,
  paymentIdempotencyConflicts,
} from '../helpers/metrics.js';

export function paymentJourney(token, user) {
  const n = user.customerId.split('_')[1];
  const invoiceId = `invoice_${n}_2`;
  const idempotencyKey = `k6-${user.customerId}-${__VU}-${__ITER}`;
  const headers = {
    ...JSON_HEADERS,
    Authorization: `Bearer ${token}`,
    'Idempotency-Key': idempotencyKey,
  };
  const body = JSON.stringify({
    customerId: user.customerId,
    invoiceId,
    amount: 1,
    method: 'credit_card',
  });

  // First charge.
  const res1 = http.post(`${BASE_URL}/payments`, body, {
    headers,
    tags: { journey: 'payment', name: 'POST /payments' },
  });
  paymentDuration.add(res1.timings.duration);
  const created = check(
    res1,
    {
      'payment: status 200/201': (r) => r.status === 200 || r.status === 201,
      'payment: paymentId present': (r) => typeof r.json('paymentId') === 'string',
      'payment: invoice marked paid': (r) => r.json('invoiceStatus') === 'paid',
    },
    { journey: 'payment' },
  );

  // Replay with the SAME idempotency key: must return the original payment and
  // must NOT create a second charge. This is the core reliability guarantee.
  const res2 = http.post(`${BASE_URL}/payments`, body, {
    headers,
    tags: { journey: 'payment', name: 'POST /payments (replay)' },
  });
  const idempotent = check(
    res2,
    {
      'payment replay: status 200': (r) => r.status === 200,
      'payment replay: same paymentId': (r) =>
        r.json('paymentId') === res1.json('paymentId'),
    },
    { journey: 'payment' },
  );
  if (idempotent) paymentIdempotencyConflicts.add(1);

  paymentSuccess.add(created && idempotent);
}
