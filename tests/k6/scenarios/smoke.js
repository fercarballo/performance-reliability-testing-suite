// Smoke test — "is the system healthy enough to continue?"
// Tiny, fast, and a BLOCKING gate on every pull request. All SLO thresholds
// apply: if smoke is red, nothing else matters.
import { selfCareFlow } from '../helpers/flow.js';
import { baseThresholds } from '../helpers/thresholds.js';
import { makeSummary } from '../helpers/summary.js';

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 3,
      duration: '30s',
    },
  },
  thresholds: baseThresholds,
  tags: { test_type: 'smoke' },
};

export default function () {
  selfCareFlow({ think: 1 });
}

export const handleSummary = makeSummary('smoke');
