# Observability Guide

This stack is wired so you can start from a number on a dashboard and end on the
exact log line that explains it. Three signals, one `trace_id` tying them
together.

## The three signals

| Signal | Backend | Source in the API |
|---|---|---|
| **Metrics** | Prometheus | `prom-client` registry exposed at `/metrics`, scraped every 5 s |
| **Traces** | Tempo (via OTel Collector) | OpenTelemetry auto-instrumentation (HTTP, `pg`, `redis`) + manual spans |
| **Logs** | Loki | `pino` JSON logs shipped with `pino-loki`, each carrying `trace_id` |

## Opening Grafana

```bash
docker compose up -d --build
open http://localhost:3001        # anonymous admin, no login
```

Four dashboards are provisioned automatically under **Telco Reliability Lab**:

| Dashboard | Use it to… |
|---|---|
| **Telco API — RED** | See request rate, error rate and latency per route. |
| **Telco — SLO Overview** | Check SLO compliance and p95 per journey at a glance. |
| **Telco — Reliability & Degradation** | Watch faults, latency and a live log panel during a degradation test. |
| **Telco — k6 Test Run** | Inspect a load run (VUs, rps, per-journey p95). Needs a `:prom` run. |

## Querying each backend by hand

**Prometheus** (http://localhost:9090):

```promql
# p95 latency for payments
histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{route="/payments"}[5m])))

# global error rate
sum(rate(http_request_errors_total[5m])) / sum(rate(http_requests_total[5m]))
```

**Tempo** — search traces by service or open one by id:

```bash
curl "http://localhost:3200/api/search?q=%7B%7D&limit=5"     # recent traces
curl "http://localhost:3200/api/traces/<TRACE_ID>"            # one trace, all spans
```

**Loki** — query logs (note the `trace_id` in every line):

```bash
curl -G "http://localhost:3100/loki/api/v1/query_range" \
  --data-urlencode '{service_name="telco-api"} |= "payment processed"'
```

## The correlation, click by click

This is the headline capability — investigating like an on-call engineer would:

1. **Metric** — on *SLO Overview* you notice payment p95 has spiked.
2. **Narrow** — switch to *Reliability & Degradation*; the fault panel shows a
   `payments / latency` rule active and the log panel is filling up.
3. **Trace** — in Explore, query Tempo for service `telco-api` and open a slow
   trace. The waterfall shows a long **`payment-gateway-simulator`** span — the
   delay lives in the (simulated) gateway, not the database.
4. **Log** — every log line in Loki has a `trace_id`; Grafana renders it as a
   **"View trace"** link (a Loki *derived field*). Conversely, from the Tempo
   trace, *Trace to logs* jumps straight to the matching log lines.
5. **Root cause** — the log confirms the injected latency on the payments
   journey.

Both directions are configured in
[`datasources.yml`](../observability/grafana/provisioning/datasources/datasources.yml):
Loki's `derivedFields` (log → trace) and Tempo's `tracesToLogsV2` (trace → log).

A fully worked example with real ids is in
[incident-analysis-example.md](incident-analysis-example.md).

## What the API emits

**Metrics** — RED per route plus business metrics:

```
http_requests_total{route,method,status}
http_request_duration_seconds_bucket{route,method,status}
http_request_errors_total{route,method,status}
business_logins_total{status}
business_payments_total{status}
business_payment_idempotency_conflicts_total
fault_injection_active{target,fault}
fault_injection_requests_affected_total{target,fault}
```

**Logs** — structured JSON, secrets redacted (`password`, tokens, `authorization`
are stripped at the logger), each with `trace_id`, `span_id` and `reqId`.

**Traces** — HTTP server spans, `pg.query:*` spans, `redis` spans and the manual
`payment-gateway-simulator` / `plan-catalog-lookup` business spans.
