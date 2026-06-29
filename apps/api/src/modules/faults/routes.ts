import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { clearFaults, listFaults, setFault } from './service';
import { badRequest } from '../../errors';

/**
 * Admin surface for fault injection. This plugin is ONLY registered when
 * `faultsAllowed` is true (never in production) — see app.ts.
 */
const faultSchema = z.object({
  target: z.enum(['auth', 'billing', 'plans', 'payments', 'global']),
  fault: z.enum(['latency', 'error', 'timeout']),
  rate: z.number().min(0).max(1).optional(),
  latencyMs: z.number().int().positive().optional(),
  durationSec: z.number().int().positive().max(3600).optional(),
});

export const faultRoutes: FastifyPluginAsync = async (app) => {
  app.get('/admin/faults', async (_req, reply) =>
    reply.send({ faults: listFaults() }),
  );

  app.post('/admin/faults', async (req, reply) => {
    const parsed = faultSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('invalid fault rule');
    const rule = setFault({ ...parsed.data, createdBy: 'admin-api' });
    return reply.code(201).send(rule);
  });

  app.delete('/admin/faults', async (_req, reply) => {
    clearFaults();
    return reply.code(204).send();
  });
};
