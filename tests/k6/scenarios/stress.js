// Stress test — "where does it break?"
// Pushes arrival rate well past expected load to find the saturation point.
// It uses RELAXED thresholds on purpose: failing SLOs is the expected outcome,
// and the value is the observation (which journey degrades first, at what RPS),
// not a green checkmark.
import { selfCareFlow } from '../helpers/flow.js';
import { exploratoryThresholds } from '../helpers/thresholds.js';
import { makeSummary } from '../helpers/summary.js';

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-arrival-rate',
      startRate: 20,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 500,
      stages: [
        { duration: '3m', target: 50 },
        { duration: '3m', target: 100 },
        { duration: '3m', target: 200 },
        { duration: '3m', target: 300 },
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds: exploratoryThresholds,
  tags: { test_type: 'stress' },
};

export default function () {
  selfCareFlow({ think: 0 });
}

export const handleSummary = makeSummary('stress');
