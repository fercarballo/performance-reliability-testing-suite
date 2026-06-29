// Load test — "does the system meet its SLOs under expected traffic?"
// Ramps to a sustained, realistic arrival rate. Hard SLO thresholds apply, so
// this can act as a (non-blocking by default) gate on main.
import { selfCareFlow } from '../helpers/flow.js';
import { baseThresholds } from '../helpers/thresholds.js';
import { makeSummary } from '../helpers/summary.js';

export const options = {
  scenarios: {
    load: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 150,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds: baseThresholds,
  tags: { test_type: 'load' },
};

export default function () {
  // Arrival-rate executors control pacing; no client think time needed.
  selfCareFlow({ think: 0 });
}

export const handleSummary = makeSummary('load');
