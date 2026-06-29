# SLOs, SLIs and Thresholds

## Vocabulary

| Term | Meaning here |
|---|---|
| **SLI** | A measured signal, e.g. p95 latency or error rate. |
| **SLO** | The target for an SLI, e.g. "login p95 < 600 ms". |
| **Threshold** | The SLO written as code in k6; breaking it fails the run. |
| **Error budget** | How much failure is allowed before the SLO is considered missed (e.g. a 1% error rate SLO ⇒ 99% of requests must succeed). |

## Global SLOs

| Indicator | Target |
|---|---:|
| Synthetic availability (non-5xx) | ≥ 99% |
| Global error rate | < 1% |
| Checks success rate | > 99% |
| Global latency p95 | < 1200 ms |

## Per-journey SLOs

| Journey | p95 target | Error-rate target | Why this number |
|---|---:|---:|---|
| **Login** | < 600 ms | < 1% | Gates every other flow; must feel instant. |
| **Invoice lookup** | < 800 ms | < 1% | Highest-volume read; sensitive to DB + cache. |
| **Plan change** | < 1200 ms | < 1.5% | More business logic + a simulated catalogue dependency, so a looser budget is honest. |
| **Payment** | < 1500 ms | < 1% | Tolerates a little more latency (gateway hop) but **must not** drop error budget — it moves money. |

## Why p95, not the average

An average hides the tail. If 95% of logins take 50 ms and 5% take 4 s, the mean
looks fine while one in twenty users has a terrible experience. p95 (and p99)
describe what the *slow* slice actually feels — which is what reliability is
about.

## The thresholds as code

From [`tests/k6/helpers/thresholds.js`](../tests/k6/helpers/thresholds.js):

```js
export const baseThresholds = {
  http_req_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
  http_req_duration: ['p(95)<1200'],
  'http_req_duration{journey:login}': ['p(95)<600'],
  'http_req_duration{journey:invoice_lookup}': ['p(95)<800'],
  'http_req_duration{journey:plan_change}': ['p(95)<1200'],
  'http_req_duration{journey:payment}': ['p(95)<1500'],
  login_success_rate: ['rate>0.99'],
  invoice_lookup_success_rate: ['rate>0.99'],
  plan_change_success_rate: ['rate>0.98'],
  payment_success_rate: ['rate>0.99'],
};
```

Per-journey thresholds are tagged so a fast login can never mask a slow payment:
each journey is judged on its own budget.

## A deliberate trade-off: password hashing

Login does **not** use bcrypt/argon2. A production system must; here a slow KDF
would dominate login latency and the load test would end up measuring the hash
function instead of the application and database. We use a fast SHA-256 hash so
the login SLO reflects the system under test. This is called out in
[`apps/api/src/security/password.ts`](../apps/api/src/security/password.ts) so it
never reads as an accident. See also [SECURITY.md](../SECURITY.md).

## Validating the SLOs hold

The smoke run on a healthy stack passes every threshold comfortably — observed
p95s are far inside budget (login ≈ 7 ms, payment ≈ 31 ms on a laptop). The
budgets are set where a *degraded* system would breach them, which is exactly
what the [degradation test](reliability-testing.md) demonstrates: a payment
latency fault pushes payment p95 from ~30 ms to ~2.6 s — through the roof of the
1500 ms SLO — while login stays at ~10 ms.
