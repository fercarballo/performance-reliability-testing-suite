// Spike test — "how does it behave during, and recover after, a sudden surge?"
// Models a billing-day traffic spike: a calm baseline, an abrupt jump, then a
// drop. The interesting signal is the RECOVERY curve in Grafana once load falls.
import { selfCareFlow } from '../helpers/flow.js';
import { exploratoryThresholds } from '../helpers/thresholds.js';
import { makeSummary } from '../helpers/summary.js';

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '30s', target: 300 },
        { duration: '2m', target: 300 },
        { duration: '30s', target: 20 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: exploratoryThresholds,
  tags: { test_type: 'spike' },
};

export default function () {
  selfCareFlow({ think: 0 });
}

export const handleSummary = makeSummary('spike');
