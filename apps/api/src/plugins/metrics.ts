import fp from 'fastify-plugin';
import {
  httpRequestDuration,
  httpRequestErrors,
  httpRequestsTotal,
} from '../observability/metrics';

/**
 * RED metrics for every request, recorded on response. We label by the route
 * *template* (e.g. `/customers/:customerId/invoices`) rather than the raw URL
 * to keep Prometheus cardinality bounded.
 */
export default fp(async (app) => {
  app.addHook('onResponse', async (req, reply) => {
    const route = req.routeOptions?.url ?? 'unmatched';
    const method = req.method;
    const status = String(reply.statusCode);
    const seconds = reply.elapsedTime / 1000;

    const labels = { route, method, status };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, seconds);
    if (reply.statusCode >= 500) httpRequestErrors.inc(labels);
  });
});
