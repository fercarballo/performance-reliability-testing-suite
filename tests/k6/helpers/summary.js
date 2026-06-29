// Shared end-of-test reporting. Every scenario writes:
//   - the default coloured console summary (so a human reading CI logs sees it)
//   - a machine-readable JSON summary (consumed by CI gates / evidence)
//   - a self-contained HTML report (portfolio evidence)
//
// The two remote imports are the standard k6 jslib modules; they require
// outbound network access when the script is parsed.
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/2.4.0/dist/bundle.js';

export function makeSummary(name) {
  return function handleSummary(data) {
    return {
      stdout: textSummary(data, { indent: ' ', enableColors: true }),
      [`/scripts/reports/${name}-summary.json`]: JSON.stringify(data, null, 2),
      [`/scripts/reports/${name}-report.html`]: htmlReport(data, {
        title: `Telco Reliability Lab — ${name}`,
      }),
    };
  };
}
