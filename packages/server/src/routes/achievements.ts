import {
  AchievementsResponseSchema,
  UnlockAchievementsBodySchema,
  UnlockAchievementsResponseSchema,
} from '@oss/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { errorResponses } from '../lib/schemas.js';
import { achievementsFor, unlockForUser } from '../services/achievement.service.js';

/** Succès : /api/achievements */
export const achievementsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    {
      schema: {
        tags: ['achievements'],
        summary: 'Catalogue des succès (avec ceux du joueur s’il est connecté)',
        response: { 200: AchievementsResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      const user = await app.optionalUser(request);
      return { achievements: await achievementsFor(app.prisma, user?.sub ?? null) };
    },
  );

  app.post(
    '/unlock',
    {
      preHandler: app.authenticate,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['achievements'],
        summary: 'Synchroniser des succès débloqués hors ligne',
        description:
          'Les succès d’une partie publiée sont débloqués par le rejeu de POST /scores ; cette route sert aux parties jouées hors ligne ou abandonnées.',
        security: [{ cookieAuth: [] }],
        body: UnlockAchievementsBodySchema,
        response: { 200: UnlockAchievementsResponseSchema, ...errorResponses },
      },
    },
    async (request) => ({
      unlocked: await unlockForUser(app.prisma, request.user.sub, request.body.ids),
    }),
  );
};
