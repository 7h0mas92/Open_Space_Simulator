import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { errorResponses } from '../lib/schemas.js';

/**
 * Back-office : /api/admin/* (rôle ADMIN obligatoire).
 * Le CRUD des cartes et les statistiques arrivent à l'étape « Back-office admin ».
 */
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireRole('ADMIN'));

  app.get(
    '/ping',
    {
      schema: {
        tags: ['admin'],
        summary: 'Vérifie l’accès administrateur',
        security: [{ cookieAuth: [] }],
        response: { 200: z.object({ ok: z.literal(true) }), ...errorResponses },
      },
    },
    async () => ({ ok: true as const }),
  );
};
