import type { FastifyPluginAsync } from 'fastify';
import { getInvoices } from './service';
import { applyFault } from '../faults/service';
import { businessInvoiceLookups } from '../../observability/metrics';
import { forbidden } from '../../errors';

export const billingRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { customerId: string } }>(
    '/customers/:customerId/invoices',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { customerId } = req.params;

      // A customer may only read their own invoices.
      if (req.user.customerId !== customerId) {
        businessInvoiceLookups.inc({ status: 'forbidden' });
        throw forbidden('cannot access invoices of another customer');
      }

      if ((await applyFault('billing')) === 'error') {
        businessInvoiceLookups.inc({ status: 'fault' });
        return reply.code(500).send({ error: 'injected fault' });
      }

      const invoices = await getInvoices(customerId);
      businessInvoiceLookups.inc({ status: 'success' });

      return reply.send({ customerId, invoices });
    },
  );
};
