# Performance Testing Strategy

> The thesis: a single "load test" answers no question well. Different risks
> need different shapes of load, different durations and different pass criteria.

## The six profiles

| Profile | Question it answers | Executor | Pass criteria | When it runs |
|---|---|---|---|---|
| **Smoke** | Is the system healthy enough to continue? | `constant-vus` (3 VUs, 30s) | All SLO thresholds | Every pull request (**blocking**) |
| **Load** | Do we meet SLOs under expected traffic? | `ramping-arrival-rate` → 50 rps | All SLO thresholds | main / manual |
| **Stress** | Where does it break? | `ramping-arrival-rate` → 300 rps | Relaxed (observation) | manual / scheduled |
| **Spike** | How does it behave during and after a surge? | `ramping-arrival-rate`, abrupt jump | Relaxed (observation) | manual / scheduled |
| **Soak** | Does it degrade over time? | `constant-arrival-rate`, 30m | SLO thresholds | scheduled |
| **Degradation** | Can we *see and diagnose* a fault? | `constant-arrival-rate` + fault injection | Relaxed (observation) | manual / demo |

## Why separate them

Mixing objectives produces a test that proves nothing. A smoke test that ramps
to 300 rps is no longer a smoke test. Each profile fixes load shape, duration
and thresholds to isolate one question:

- **Smoke** = a fast tripwire. Small, deterministic, and the only profile wired
  as a hard CI gate.
- **Load** = the SLO check. Realistic arrival rate, hard thresholds.
- **Stress** = find the cliff. Push past expected load and *document* the first
  journey to degrade and the rough rps at which it happens. It is expected to
  break thresholds — that is the finding, not a failure.
- **Spike** = elasticity and recovery. The signal is the recovery curve after
  the surge drops, watched in Grafana.
- **Soak** = slow killers. Memory leaks, connection-pool exhaustion and creeping
  latency only appear over time.
- **Degradation** = observability proof. Inject a known fault and show it
  surfaces coherently across k6, Prometheus, Tempo and Loki.

## Closed vs open models

Smoke uses a **closed model** (`constant-vus`): a fixed number of virtual users,
each waiting for a response before the next request. Load/stress/spike/soak use
an **open model** (`arrival-rate`): requests arrive at a target rate regardless
of how fast the system responds. The open model is the honest one for capacity
work — if the system slows down, requests pile up exactly as real traffic would,
instead of politely backing off.

## Blocking vs non-blocking gates

| Gate | Profiles | Rationale |
|---|---|---|
| **Blocking** (fails the build) | smoke | Cheap, fast, deterministic. A red smoke means a real regression. |
| **Non-blocking** (evidence only) | stress, spike, soak, degradation | Their purpose is to find limits and characterise behaviour. A stress test that "fails" its latency budget is doing its job. |

See [slo-definition.md](slo-definition.md) for the exact thresholds and
[reliability-testing.md](reliability-testing.md) for the fault catalogue.

## Running them

```bash
docker compose up -d --build          # bring up the stack
npm run k6:smoke                      # blocking gate
npm run k6:load                       # SLO check under expected load
npm run k6:stress                     # find the saturation point
npm run k6:spike                      # surge + recovery
npm run k6:soak                       # SOAK_DURATION=5m for a quick run
npm run k6:degradation                # inject a fault and observe

# Feed the "k6 Test Run" Grafana dashboard (Prometheus remote write):
npm run k6:smoke:prom
npm run k6:load:prom
```

Each run writes a JSON summary and a self-contained HTML report to
`tests/k6/reports/`.
