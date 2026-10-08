import { DecorThemesResponseSchema } from '@oss/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { errorResponses } from '../lib/schemas.js';
import { listDecorThemes } from '../services/decor.service.js';

/** Décorations de saison : /api/decor-themes (publique, mise en cache par le client). */
export const decorRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    {
      schema: {
        tags: ['decor'],
        summary: 'Thèmes de décoration de saison et leur réglage (désactivé, période, toujours)',
        response: { 200: DecorThemesResponseSchema, ...errorResponses },
      },
    },
    async () => ({ themes: await listDecorThemes(app.prisma) }),
  );
};
