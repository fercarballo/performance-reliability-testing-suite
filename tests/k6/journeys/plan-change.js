// Journey: Plan change
// Criticality: medium — more business logic + a simulated catalogue dependency.
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, JSON_HEADERS } from '../helpers/config.js';
import { planChangeDuration, planChangeSuccess } from '../helpers/metrics.js';

// Mirrors the order in the API's synthetic generator. A customer's current plan
// is PLAN_IDS[n % 5]; we target n+1 so the change is never a no-op (which would
// be a legitimate 400 and pollute the error rate).
const PLAN_IDS = [
  'mobile_5gb',
  'mobile_20gb',
  'fiber_300mb',
  'fiber_600mb',
  'fiber_1gb',
];

export function planChangeJourney(token, user) {
  const n = parseInt(user.customerId.split('_')[1], 10);
  const targetPlanId = PLAN_IDS[(n + 1) % PLAN_IDS.length];

  const res = http.post(
    `${BASE_URL}/customers/${user.customerId}/plan-changes`,
    JSON.stringify({ targetPlanId }),
    {
      headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` },
      tags: { journey: 'plan_change', name: 'POST /customers/:id/plan-changes' },
    },
  );

  planChangeDuration.add(res.timings.duration);
  const ok = check(
    res,
    {
      'plan change: status 202': (r) => r.status === 202,
      'plan change: changeId present': (r) =>
        typeof r.json('changeId') === 'string',
      'plan change: scheduled': (r) => r.json('status') === 'scheduled',
    },
    { journey: 'plan_change' },
  );

  planChangeSuccess.add(ok);
}
