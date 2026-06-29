import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createPlanChange, listPlans } from './service';
import { applyFault } from '../faults/service';
import { businessPlanChanges } from '../../observability/metrics';
import { badRequest, forbidden } from '../../errors';

const planChangeSchema = z.object({
  targetPlanId: z.string().min(1),
});

export const planRoutes: FastifyPluginAsync = async (app) => {
  // Public catalogue (used by the demo web app).
  app.get('/plans', async (_req, reply) => {
    const plans = await listPlans();
    return reply.send({ plans });
  });

  app.post<{ Params: { customerId: string } }>(
    '/customers/:customerId/plan-changes',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { customerId } = req.params;
      if (req.user.customerId !== customerId) {
        businessPlanChanges.inc({ status: 'forbidden' });
        throw forbidden('cannot change plan of another customer');
      }

      const parsed = planChangeSchema.safeParse(req.body);
      if (!parsed.success) {
        businessPlanChanges.inc({ status: 'invalid' });
        throw badRequest('targetPlanId is required');
      }

      if ((await applyFault('plans')) === 'error') {
        businessPlanChanges.inc({ status: 'fault' });
        return reply.code(500).send({ error: 'injected fault' });
      }

      const result = await createPlanChange(customerId, parsed.data.targetPlanId);
      businessPlanChanges.inc({ status: 'success' });
      req.log.info(
        { customerId, changeId: result.changeId },
        'plan change scheduled',
      );

      return reply.code(202).send(result);
    },
  );
};
