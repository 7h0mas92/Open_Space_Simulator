import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Env } from './config/env.js';
import { createPrismaClient, type PrismaClient } from './lib/prisma.js';
import { authPlugin } from './plugins/auth.js';
import { errorsPlugin } from './plugins/errors.js';
import { prismaPlugin } from './plugins/prisma.js';
import { securityPlugin } from './plugins/security.js';
import { swaggerPlugin } from './plugins/swagger.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { meRoutes } from './routes/me.js';
import { GithubService } from './services/github.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: Env;
  }
}

export interface AppDependencies {
  /** Client Prisma déjà créé (tests) ; sinon créé à partir de DATABASE_URL. */
  prisma?: PrismaClient;
  /** Implémentation de fetch utilisée pour GitHub (simulée dans les tests). */
  fetch?: typeof fetch;
}

/**
 * Construit l'application Fastify sans la démarrer.
 * Les tests l'utilisent directement avec `app.inject()`, sans ouvrir de port.
 */
export async function buildApp(env: Env, deps: AppDependencies = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
      ...(env.NODE_ENV === 'development' && {
        transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } },
      }),
    },
    // Derrière le proxy de Render / Vercel : IP réelle du client pour le rate limiting.
    trustProxy: env.NODE_ENV === 'production',
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('config', env);

  await app.register(errorsPlugin);
  await app.register(securityPlugin, { env });
  await app.register(prismaPlugin, { prisma: deps.prisma ?? createPrismaClient(env.DATABASE_URL) });
  await app.register(authPlugin, { env });
  await app.register(swaggerPlugin);

  const github = new GithubService(env, deps.fetch);
  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(authRoutes, { prefix: '/api/auth', github });
  await app.register(meRoutes, { prefix: '/api/me' });
  await app.register(adminRoutes, { prefix: '/api/admin' });

  return app;
}
