# Reliability Testing & Fault Injection

Performance testing asks "is it fast?". Reliability testing asks "what happens
when something goes wrong, and can we tell?". This project answers the second
question with **controlled fault injection**.

## The fault module

The API exposes an admin surface (`/admin/faults`) that injects degradations
into a single journey, for a fraction of requests, with automatic expiry.

```http
POST /admin/faults
{ "target": "payments", "fault": "latency", "rate": 0.3, "latencyMs": 2000, "durationSec": 300 }

DELETE /admin/faults        # clear everything
GET    /admin/faults        # list active rules
```

### Fault catalogue

| Fault | Behaviour | What it lets you test |
|---|---|---|
| `latency` | Adds artificial delay to a fraction of requests | p95/p99 inflation, SLO breaches, slow spans in Tempo |
| `error` | Returns HTTP 500 for a fraction of requests | Error-rate handling, alerting, business `*_total{status="fault"}` |
| `timeout` | Holds the request far beyond the client timeout | Client-side timeouts, resilience, hung-dependency diagnosis |

`target` can be `auth`, `billing`, `plans`, `payments` (per-journey, i.e.
*partial* degradation) or `global` (everything).

### Safety rails (this matters)

Fault injection is a deliberate foot-gun. The controls:

- **Environment-guarded.** The routes are only mounted when
  `ENABLE_FAULTS=true` **and** `NODE_ENV !== 'production'` (`faultsAllowed` in
  [`config/env.ts`](../apps/api/src/config/env.ts)). They cannot exist in a
  production build.
- **Always expires.** Every rule carries `durationSec` and auto-clears; a
  forgotten fault heals itself.
- **Audited.** Activating a fault logs `target`, `fault`, `rate`, `latencyMs`,
  `durationSec` and `createdBy`.
- **Observable.** `fault_injection_active` and
  `fault_injection_requests_affected_total` expose exactly what is degraded.

See [SECURITY.md](../SECURITY.md) for the threat-model view of this endpoint.

## Why partial, per-journey degradation

Real incidents are rarely "everything is down". They are "payments are slow but
login is fine". Targeting a single journey reproduces that shape, which is much
harder — and more valuable — to diagnose than a total outage.

## The degradation test

[`tests/k6/scenarios/degradation.js`](../tests/k6/scenarios/degradation.js)
injects a fault in `setup()`, drives steady load through the degraded system,
and clears the fault in `teardown()`. It is parameterised by environment:

```bash
docker compose run --rm \
  -e DEGRADATION_DURATION=60s \
  -e FAULT_TARGET=payments -e FAULT_TYPE=latency \
  -e FAULT_RATE=0.3 -e FAULT_LATENCY_MS=2000 \
  k6 run /scripts/scenarios/degradation.js
```

### Observed result (real run)

| Signal | Healthy | During fault |
|---|---:|---:|
| Payment p95 (server, Prometheus) | ~30 ms | **2.63 s** |
| Payment p99 | ~40 ms | **2.93 s** |
| Login p95 (unaffected journey) | ~10 ms | **10 ms** |
| Requests affected (`fault_injection_requests_affected_total`) | 0 | **335** |
| k6 `payment_duration` p95 | ~31 ms | **2026 ms** |

Payment latency goes through the roof while login is untouched — a textbook
partial degradation, visible simultaneously in the API's own metrics and in
k6's client-side view.

## From symptom to root cause

The degradation is not just *measured*, it is *diagnosable*. The full
metric → trace → log walk-through is in
[incident-analysis-example.md](incident-analysis-example.md).

## Idempotency under concurrency

A second reliability guarantee, independent of fault injection: replaying a
payment with the same `Idempotency-Key` must never double-charge. The payment
journey proves this on every iteration (first call `201`, replay `200` with the
**same** `paymentId`), and the API enforces it with a `UNIQUE` constraint plus
`INSERT ... ON CONFLICT DO NOTHING` — correct even when duplicates arrive
concurrently, because PostgreSQL serialises them on the unique index. A smoke run
records ~87 prevented conflicts via the `payment_idempotency_conflicts` metric.
