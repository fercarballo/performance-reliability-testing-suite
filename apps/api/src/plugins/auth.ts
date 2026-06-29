import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { config } from '../config/env';
import { unauthorized } from '../errors';

/**
 * Registers JWT support and an `authenticate` pre-handler. Protected routes opt
 * in with `{ preHandler: [app.authenticate] }`.
 */
export default fp(async (app) => {
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRES_IN },
  });

  app.decorate(
    'authenticate',
    async (req: Parameters<typeof app.authenticate>[0]) => {
      try {
        await req.jwtVerify();
      } catch {
        throw unauthorized('invalid or missing token');
      }
    },
  );
});
