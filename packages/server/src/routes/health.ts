import { HealthResponseSchema } from '@oss/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

/** Sonde de santé utilisée par Render / Railway et par le client. */
export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      config: { rateLimit: false },
      schema: {
        tags: ['system'],
        summary: 'État du serveur et de la base',
        response: { 200: HealthResponseSchema },
      },
    },
    async () => {
      let database: 'up' | 'down' = 'up';
      try {
        await app.prisma.$queryRaw`SELECT 1`;
      } catch {
        database = 'down';
      }
      return {
        status: 'ok' as const,
        version: process.env.npm_package_version ?? '0.1.0',
        database,
      };
    },
  );
};
