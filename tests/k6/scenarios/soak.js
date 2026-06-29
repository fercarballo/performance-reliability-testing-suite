// Soak test — "does it degrade over time?"
// A moderate, constant load held for a long duration. The target is slow
// failure modes a short test never catches: memory leaks, connection-pool
// exhaustion, creeping latency. Duration is overridable via SOAK_DURATION
// (e.g. SOAK_DURATION=5m for a quick check).
import { selfCareFlow } from '../helpers/flow.js';
import { baseThresholds } from '../helpers/thresholds.js';
import { makeSummary } from '../helpers/summary.js';

const DURATION = __ENV.SOAK_DURATION || '30m';

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: 80,
      maxVUs: 200,
    },
  },
  thresholds: baseThresholds,
  tags: { test_type: 'soak' },
};

export default function () {
  selfCareFlow({ think: 0 });
}

export const handleSummary = makeSummary('soak');
