# Incident Analysis — a worked example

> This is the document that turns the project from "I ran a load test" into
> "I diagnosed an incident from evidence". It walks a single, real degradation
> from symptom to root cause to recommendation. The numbers and ids below come
> from an actual run on this stack.

## Scenario

A reliability drill: a partial degradation of the **payments** journey is
injected (30% of payments delayed by ~2000 ms) while steady load runs. The job
is to investigate it as if it were a production incident — without being told
the cause up front.

```bash
docker compose run --rm \
  -e DEGRADATION_DURATION=60s \
  -e FAULT_TARGET=payments -e FAULT_TYPE=latency -e FAULT_RATE=0.3 -e FAULT_LATENCY_MS=2000 \
  k6 run /scripts/scenarios/degradation.js
```

## 1. Symptom (metric)

On **SLO Overview**, payment p95 jumps from its baseline of ~30 ms to **2.63 s**,
breaching the 1500 ms SLO. Critically, the other journeys are unaffected:

| Journey | p95 before | p95 during |
|---|---:|---:|
| payment | ~30 ms | **2.63 s** ❌ |
| login | ~10 ms | ~10 ms ✅ |
| invoice_lookup | ~6 ms | ~6 ms ✅ |

PromQL used:

```promql
histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{route="/payments"}[2m])))
```

**Reading:** this is a *partial* degradation isolated to payments — not a
system-wide outage. That alone rules out shared infrastructure (DB down, host
CPU) and points at something specific to the payment path.

## 2. Scope and window (metric)

On **Reliability & Degradation**, the `fault_injection_active{target="payments",
fault="latency"}` series reads `1`, and `fault_injection_requests_affected_total`
climbs to **335**. The error-rate-by-route panel stays flat: requests are
**slow, not failing** — consistent with latency, not errors or timeouts.

## 3. Find a slow trace (trace)

Query Tempo (Explore → Tempo) for service `telco-api`, sorted by duration. Open
a slow payment trace. Its waterfall:

```
POST /payments                                  2.0 s
├─ request handler - paymentRoutes
├─ pg.query:SELECT telco         (idempotency check)   ~1 ms
├─ pg.query:SELECT telco         (invoice lookup)       ~1 ms
├─ payment-gateway-simulator     ███████████████████   ~2.0 s   ← the time is HERE
├─ pg.query:INSERT telco         (payment row)          ~1 ms
└─ pg.query:UPDATE telco         (invoice -> paid)       ~1 ms
```

**Reading:** the database spans are all sub-millisecond. The entire delay sits in
the **`payment-gateway-simulator`** span. The problem is the (simulated)
downstream payment gateway, not our own persistence layer. An example trace id
from a real run: `b25fe8f2f2bf95b4c8be1f10b39c2313`.

## 4. Confirm in the logs (log)

Copy the `trace_id` from the slow span. In Loki:

```logql
{service_name="telco-api"} |= "b25fe8f2f2bf95b4c8be1f10b39c2313"
```

The JSON log line for that request shows the `payment processed` event with the
same `trace_id` and `span_id`, confirming we are looking at the exact request the
trace described. (In Grafana this is one click: the trace's *Trace to logs* link,
or a log's *View trace* derived field.)

## 5. Root cause

A latency fault is active on the payments journey, injecting ~2000 ms into the
gateway call for ~30% of requests. Because it is *partial* and *latency-only*,
the symptoms are: payment p95/p99 spike, payment error rate stays near zero,
every other journey is healthy, and the time is localised to one span.

In a real incident the equivalent root cause would be "the payment gateway / a
downstream dependency is slow", and the evidence trail would be identical.

## 6. Recommended actions

- **Immediate:** if the gateway is the bottleneck, shed or queue payment load,
  surface a "payments are slow" status, and protect the rest of self-care
  (login/billing are unaffected and should stay up).
- **Short term:** add a timeout + circuit breaker around the gateway call so a
  slow dependency fails fast instead of inflating p95 and exhausting workers.
- **Detection:** alert on payment p95 > 1.5 s for 5 minutes (the SLO), not on
  error rate — this incident produced almost no errors.
- **Verification:** clearing the fault (`DELETE /admin/faults`, run teardown)
  returns payment p95 to ~30 ms within one scrape interval — the recovery is
  visible on the same dashboard.

## Why this matters in an interview

It demonstrates the full loop a quality/SRE engineer owns: **detect (metric) →
locate (trace) → confirm (log) → explain (root cause) → recommend (action)** —
and that the tooling was built to make that loop fast, not just to draw graphs.
