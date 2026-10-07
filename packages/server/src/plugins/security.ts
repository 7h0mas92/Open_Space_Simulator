import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { Env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

/** En-têtes de sécurité (Helmet), CORS, cookies et limitation de débit. */
export const securityPlugin = fp(async (app: FastifyInstance, { env }: { env: Env }) => {
  await app.register(helmet, {
    // La CSP de l'API ne doit pas bloquer Swagger UI (scripts et styles inline).
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'validator.swagger.io'],
      },
    },
  });

  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  // Le secret sert aussi à signer le cookie d'état OAuth.
  await app.register(cookie, { secret: env.JWT_SECRET });

  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) =>
      new AppError(429, 'RATE_LIMITED', `Trop de tentatives, réessaie dans ${context.after}`),
  });
});
