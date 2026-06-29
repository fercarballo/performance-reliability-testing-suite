// Journey: Invoice lookup
// Criticality: high — most frequent read, sensitive to DB + cache health.
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../helpers/config.js';
import {
  invoiceLookupDuration,
  invoiceLookupSuccess,
} from '../helpers/metrics.js';

export function invoiceLookupJourney(token, user) {
  const res = http.get(`${BASE_URL}/customers/${user.customerId}/invoices`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { journey: 'invoice_lookup', name: 'GET /customers/:id/invoices' },
  });

  invoiceLookupDuration.add(res.timings.duration);
  const ok = check(
    res,
    {
      'invoices: status 200': (r) => r.status === 200,
      'invoices: list present': (r) => Array.isArray(r.json('invoices')),
      'invoices: well-formed': (r) => {
        const list = r.json('invoices');
        if (!Array.isArray(list) || list.length === 0) return false;
        const first = list[0];
        return (
          typeof first.invoiceId === 'string' &&
          typeof first.status === 'string' &&
          typeof first.amount === 'number'
        );
      },
    },
    { journey: 'invoice_lookup' },
  );

  invoiceLookupSuccess.add(ok);
  return ok ? res.json('invoices') : [];
}
