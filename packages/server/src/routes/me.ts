import {
  AuthResponseSchema,
  GameStatsSchema,
  OUTCOMES,
  ProfileResponseSchema,
  UpdateMeBodySchema,
  type ProfileResponse,
} from '@oss/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { Prisma } from '../generated/prisma/client.js';
import { AppError, unauthorized } from '../lib/errors.js';
import { errorResponses } from '../lib/schemas.js';
import { achievementsFor } from '../services/achievement.service.js';
import { toScoreDto } from '../services/score.service.js';
import { toUserDto } from '../services/user.service.js';

const PROFILE_STATS = [
  'featuresShipped',
  'prodOutages',
  'burnouts',
  'resignations',
  'hired',
  'fired',
  'meetings',
  'cardsResolved',
] as const;

/** Profil de l'utilisateur connecté : /api/me */
export const meRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/',
    {
      schema: {
        tags: ['me'],
        summary: 'Utilisateur connecté',
        security: [{ cookieAuth: [] }],
        response: { 200: AuthResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      const user = await app.prisma.user.findUnique({ where: { id: request.user.sub } });
      if (!user) throw unauthorized('Compte introuvable');
      return { user: toUserDto(user) };
    },
  );

  app.patch(
    '/',
    {
      schema: {
        tags: ['me'],
        summary: 'Modifier son pseudo ou sa langue',
        security: [{ cookieAuth: [] }],
        body: UpdateMeBodySchema,
        response: { 200: AuthResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      try {
        const user = await app.prisma.user.update({
          where: { id: request.user.sub },
          data: request.body,
        });
        return { user: toUserDto(user) };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new AppError(409, 'PSEUDO_TAKEN', 'Ce pseudo est déjà pris');
        }
        throw error;
      }
    },
  );

  app.get(
    '/profile',
    {
      schema: {
        tags: ['me'],
        summary: 'Profil : statistiques cumulées, meilleures parties, succès',
        security: [{ cookieAuth: [] }],
        response: { 200: ProfileResponseSchema, ...errorResponses },
      },
    },
    async (request): Promise<ProfileResponse> => {
      const userId = request.user.sub;
      const user = await app.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw unauthorized('Compte introuvable');
      const scores = await app.prisma.score.findMany({
        where: { userId },
        orderBy: { valuation: 'desc' },
        include: { user: { select: { pseudo: true } } },
      });
      const outcomes = Object.fromEntries(OUTCOMES.map((outcome) => [outcome, 0])) as Record<
        (typeof OUTCOMES)[number],
        number
      >;
      const stats = Object.fromEntries(PROFILE_STATS.map((key) => [key, 0])) as Record<
        (typeof PROFILE_STATS)[number],
        number
      >;
      for (const score of scores) {
        outcomes[score.outcome] += 1;
        const parsed = GameStatsSchema.safeParse(score.stats);
        if (parsed.success) for (const key of PROFILE_STATS) stats[key] += parsed.data[key];
      }
      return {
        user: toUserDto(user),
        totals: {
          gamesPlayed: scores.length,
          bestValuation: scores[0]?.valuation ?? 0,
          outcomes,
          stats,
        },
        bestGames: scores.slice(0, 5).map(toScoreDto),
        achievements: await achievementsFor(app.prisma, userId),
      };
    },
  );
};
