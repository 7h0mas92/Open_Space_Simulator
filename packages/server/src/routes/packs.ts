import { CharacterPacksResponseSchema } from '@oss/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { errorResponses } from '../lib/schemas.js';
import { listCharacterPacks } from '../services/packs.service.js';

/** Packs de personnages : /api/character-packs (publique, mise en cache par le client). */
export const packsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    {
      schema: {
        tags: ['packs'],
        summary: 'Packs de personnages thématiques et leur état (activé ou non)',
        response: { 200: CharacterPacksResponseSchema, ...errorResponses },
      },
    },
    async () => ({ packs: await listCharacterPacks(app.prisma) }),
  );
};
