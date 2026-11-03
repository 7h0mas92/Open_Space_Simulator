import { MissionCompletionSchema, StoryProgressResponseSchema } from '@oss/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Prisma } from '../generated/prisma/client.js';
import { errorResponses } from '../lib/schemas.js';
import { unlockForUser } from '../services/achievement.service.js';
import { cardSetByVersion } from '../services/cards.service.js';
import { verifyCampaignGoal, verifyMission } from '../services/replay.service.js';
import { storyProgressOf } from '../services/story.service.js';

/** Taille maximale d'un journal de commandes envoyé (une mission est plus courte qu'une partie). */
const MISSION_BODY_LIMIT = 4 * 1024 * 1024;

/** Mode Histoire : /api/story */
export const storyRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['story'],
        summary: 'Progression du mode Histoire du joueur (missions réussies, récompenses)',
        security: [{ cookieAuth: [] }],
        response: { 200: StoryProgressResponseSchema, ...errorResponses },
      },
    },
    async (request) => storyProgressOf(app.prisma, request.user.sub),
  );

  app.post(
    '/complete',
    {
      preHandler: app.authenticate,
      bodyLimit: MISSION_BODY_LIMIT,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['story'],
        summary: 'Enregistrer une mission réussie (rejouée et vérifiée par le serveur)',
        description:
          'Le serveur rejoue la graine et les commandes de la mission avec la simulation du jeu. Seule une mission réussie au rejeu est gardée sur le compte. Avec `campaign`, il rejoue la longue partie en actes et vérifie que l’objectif de la mission y est rempli.',
        security: [{ cookieAuth: [] }],
        body: MissionCompletionSchema,
        response: { 200: StoryProgressResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      const { missionId, seed, commands, cardsVersion, campaign } = request.body;
      const userId = request.user.sub;
      const { cards } = await cardSetByVersion(app.prisma, cardsVersion);
      // Objectif de la longue partie : rejeu de l'histoire jusqu'à la dernière commande.
      const state = campaign
        ? verifyCampaignGoal({ missionId, seed, commands, cards })
        : verifyMission({ missionId, seed, commands, cards }).state;
      const data = {
        seed,
        cardsVersion,
        commandsLog: commands as Prisma.InputJsonValue,
        completedAt: new Date(),
      };
      // Rejouer une mission déjà réussie garde la dernière victoire.
      await app.prisma.storyMission.upsert({
        where: { userId_missionId: { userId, missionId } },
        update: data,
        create: { userId, missionId, ...data },
      });
      await unlockForUser(app.prisma, userId, state.achievements);
      request.log.info({ missionId }, 'Mission vérifiée et enregistrée');
      return storyProgressOf(app.prisma, userId);
    },
  );
};
