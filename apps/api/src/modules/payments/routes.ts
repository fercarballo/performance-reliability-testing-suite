import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { processPayment } from './service';
import { businessPayments } from '../../observability/metrics';
import { HttpError, badRequest, forbidden } from '../../errors';

const paymentSchema = z.object({
  customerId: z.string().min(1),
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  method: z.string().min(1),
});

export const paymentRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/payments',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const parsed = paymentSchema.safeParse(req.body);
      if (!parsed.success) {
        businessPayments.inc({ status: 'invalid' });
        throw badRequest('invalid payment payload');
      }

      if (req.user.customerId !== parsed.data.customerId) {
        businessPayments.inc({ status: 'forbidden' });
        throw forbidden('cannot pay on behalf of another customer');
      }

      const idempotencyKey = req.headers['idempotency-key'];

      try {
        const result = await processPayment({
          ...parsed.data,
          idempotencyKey:
            typeof idempotencyKey === 'string' ? idempotencyKey : undefined,
        });

        businessPayments.inc({
          status: result.idempotent ? 'idempotent' : 'success',
        });
        req.log.info(
          {
            customerId: parsed.data.customerId,
            paymentId: result.paymentId,
            idempotent: result.idempotent,
          },
          'payment processed',
        );

        return reply.code(result.idempotent ? 200 : 201).send({
          paymentId: result.paymentId,
          status: result.status,
          invoiceStatus: result.invoiceStatus,
        });
      } catch (err) {
        if (err instanceof HttpError && err.code === 'injected_fault') {
          businessPayments.inc({ status: 'fault' });
        }
        throw err;
      }
    },
  );
};
