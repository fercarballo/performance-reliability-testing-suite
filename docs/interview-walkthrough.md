# Interview Walkthrough (5–7 minutes)

A script for demoing this project live or talking through it from memory. Adjust
depth to the interviewer.

## 30-second pitch

> "I built a Telco self-care platform — login, invoices, plan changes, payments —
> and wrapped it in a full performance *and reliability* testing suite. The point
> wasn't to automate happy-path load tests; it was to design a quality strategy:
> risk-based SLOs, six load profiles, fault injection, and metric–trace–log
> correlation so I can diagnose a degradation, not just detect it."

## The narrative (the order I'd present)

1. **Risk first, not scripts first.** "I started from the business: which
   journeys are critical and what happens if they're slow? Payments move money,
   login gates everything. That drove the SLOs." → show
   [slo-definition.md](slo-definition.md).

2. **The system under test is mine.** "It's a real Fastify/TypeScript API on
   Postgres and Redis, not a public sandbox — so I control its failure modes and
   instrument it deeply." → `docker compose up`, hit http://localhost:8080.

3. **Profiles answer different questions.** "Smoke is a blocking CI gate; load
   checks SLOs; stress finds the cliff; spike tests recovery; soak finds leaks;
   degradation proves observability. Same journeys, different shapes and pass
   criteria." → show the scenario files / [performance-strategy.md](performance-strategy.md).

4. **Run a smoke test live.** `npm run k6:smoke` → 100% checks, all thresholds
   green, and point out the per-journey p95 tags and the idempotency replay
   check (~87 prevented double-charges).

5. **Break it on purpose.** "Now the reliability part." `npm run k6:degradation`
   with a payment latency fault → on Grafana, payment p95 jumps to ~2.6 s while
   login stays at ~10 ms. Partial degradation, exactly like a real incident.

6. **Diagnose from evidence.** Walk metric → trace → log: the slow trace shows
   the time is in the `payment-gateway-simulator` span, the database is fine, and
   the log with the same `trace_id` confirms it. → [incident-analysis-example.md](incident-analysis-example.md).

7. **It's all gated and reproducible.** "Smoke runs on every PR in GitHub Actions
   and GitLab CI; dashboards, SLOs and the environment are all code. Anyone can
   `docker compose up` and get the same result."

## Questions I'm ready for

- **"Why p95 and not average?"** Averages hide the tail; p95/p99 describe what
  the slow slice of users actually feels.
- **"Why an open (arrival-rate) model for load?"** If the system slows, requests
  pile up like real traffic, instead of VUs politely waiting — the honest model
  for capacity testing.
- **"Why isn't login using bcrypt?"** Deliberate: a slow KDF would dominate the
  login SLO and I'd be measuring the hash, not the system. Documented as a
  trade-off, and production guidance is in SECURITY.md.
- **"How do you keep Prometheus cardinality sane?"** Label by route *template*
  (`/customers/:customerId/invoices`), never the raw URL.
- **"Is the fault injection dangerous?"** It's environment-guarded to
  local/ci, auto-expires, is audited and is fully observable. It can't exist in
  a production build.
- **"What would you add next?"** Alertmanager + error-budget burn alerts,
  automatic run-over-run comparison, a kind/k6-operator setup, and an OpenAPI
  contract test in CI. (See the README roadmap.)

## One-liner for CV / LinkedIn

> Designed and implemented a full Performance & Reliability Testing Suite (k6,
> Prometheus, Grafana, OpenTelemetry, Tempo, Loki) over a Telco self-care demo,
> with SLO-based thresholds, controlled fault injection, CI/CD quality gates and
> metric–trace–log correlation for incident diagnosis.
