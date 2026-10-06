import { CardSetResponseSchema, CardsVersionSchema } from '@oss/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { errorResponses } from '../lib/schemas.js';
import { activeCardSet, cardSetByVersion } from '../services/cards.service.js';

/** Cartes d'événements : /api/events (publique, mise en cache par le client hors ligne). */
export const eventsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    {
      schema: {
        tags: ['events'],
        summary: 'Cartes d’événements actives (ou une version précise)',
        description:
          'Sans paramètre : les cartes actives et leur version. Avec `version` : le jeu de cartes exact d’une partie en cours ou d’un replay.',
        querystring: z.object({ version: CardsVersionSchema.optional() }),
        response: { 200: CardSetResponseSchema, ...errorResponses },
      },
    },
    async (request) =>
      request.query.version
        ? cardSetByVersion(app.prisma, request.query.version)
        : activeCardSet(app.prisma),
  );
};
