import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser } from './service';
import { applyFault } from '../faults/service';
import { businessLogins } from '../../observability/metrics';
import { badRequest, unauthorized } from '../../errors';
import { config } from '../../config/env';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      businessLogins.inc({ status: 'invalid' });
      throw badRequest('username and password are required');
    }

    if ((await applyFault('auth')) === 'error') {
      businessLogins.inc({ status: 'fault' });
      return reply.code(500).send({ error: 'injected fault' });
    }

    const user = await authenticateUser(
      parsed.data.username,
      parsed.data.password,
    );
    if (!user) {
      businessLogins.inc({ status: 'failure' });
      throw unauthorized('invalid credentials');
    }

    const accessToken = await reply.jwtSign({
      sub: user.userId,
      customerId: user.customerId,
    });

    businessLogins.inc({ status: 'success' });
    req.log.info({ customerId: user.customerId }, 'login succeeded');

    return reply.send({
      accessToken,
      customerId: user.customerId,
      expiresIn: config.JWT_EXPIRES_IN,
    });
  });
};
