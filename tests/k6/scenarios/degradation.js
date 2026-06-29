// Degradation test — "when something breaks, can we SEE it and DIAGNOSE it?"
// This is the reliability centrepiece: it injects a controlled fault, drives
// steady load through the degraded system, then cleans up. The pass/fail is not
// the point — the point is that the degradation shows up coherently across k6,
// Prometheus, Tempo and Loki (see docs/incident-analysis-example.md).
import http from 'k6/http';
import { selfCareFlow } from '../helpers/flow.js';
import { exploratoryThresholds } from '../helpers/thresholds.js';
import { makeSummary } from '../helpers/summary.js';
import { BASE_URL, JSON_HEADERS } from '../helpers/config.js';

const FAULT = {
  target: __ENV.FAULT_TARGET || 'payments',
  fault: __ENV.FAULT_TYPE || 'latency',
  rate: Number(__ENV.FAULT_RATE || 0.3),
  latencyMs: Number(__ENV.FAULT_LATENCY_MS || 2000),
  durationSec: Number(__ENV.FAULT_DURATION_SEC || 600),
};

export const options = {
  scenarios: {
    degradation: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: __ENV.DEGRADATION_DURATION || '5m',
      preAllocatedVUs: 60,
      maxVUs: 200,
    },
  },
  thresholds: exploratoryThresholds,
  tags: { test_type: 'degradation' },
};

export function setup() {
  const res = http.post(`${BASE_URL}/admin/faults`, JSON.stringify(FAULT), {
    headers: JSON_HEADERS,
  });
  console.log(`[degradation] fault injected -> ${res.status} ${res.body}`);
  return { injected: res.status === 201 };
}

export default function () {
  selfCareFlow({ think: 0 });
}

export function teardown() {
  const res = http.del(`${BASE_URL}/admin/faults`);
  console.log(`[degradation] faults cleared -> ${res.status}`);
}

export const handleSummary = makeSummary('degradation');
