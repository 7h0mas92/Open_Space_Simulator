import {
  AdminCardBodySchema,
  AdminCardListResponseSchema,
  AdminCardSchema,
  AdminStatsResponseSchema,
  CardIdSchema,
  OUTCOMES,
  PHASES,
  type AdminStatsResponse,
  type LocalizedText,
} from '@oss/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
import { errorResponses } from '../lib/schemas.js';
import { cardData, toAdminCard, toEventCard } from '../services/cards.service.js';

const IdParamsSchema = z.object({ id: CardIdSchema });

/**
 * Back-office : /api/admin/* (rôle ADMIN obligatoire). Gestion des cartes d'événements
 * et statistiques de jeu.
 */
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireRole('ADMIN'));
  const security = [{ cookieAuth: [] }];

  app.get(
    '/ping',
    {
      schema: {
        tags: ['admin'],
        summary: 'Vérifie l’accès administrateur',
        security,
        response: { 200: z.object({ ok: z.literal(true) }), ...errorResponses },
      },
    },
    async () => ({ ok: true as const }),
  );

  app.get(
    '/events',
    {
      schema: {
        tags: ['admin'],
        summary: 'Toutes les cartes, actives ou non',
        security,
        response: { 200: AdminCardListResponseSchema, ...errorResponses },
      },
    },
    async () => {
      const rows = await app.prisma.eventCard.findMany({ orderBy: { id: 'asc' } });
      return { cards: rows.map(toAdminCard) };
    },
  );

  app.get(
    '/events/:id',
    {
      schema: {
        tags: ['admin'],
        summary: 'Une carte',
        security,
        params: IdParamsSchema,
        response: { 200: AdminCardSchema, ...errorResponses },
      },
    },
    async (request) => {
      const row = await app.prisma.eventCard.findUnique({ where: { id: request.params.id } });
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Carte introuvable');
      return toAdminCard(row);
    },
  );

  app.post(
    '/events',
    {
      schema: {
        tags: ['admin'],
        summary: 'Créer une carte',
        security,
        body: AdminCardBodySchema,
        response: { 201: AdminCardSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      try {
        const row = await app.prisma.eventCard.create({
          data: { id: request.body.id, ...cardData(request.body) },
        });
        return reply.status(201).send(toAdminCard(row));
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
          throw new AppError(409, 'CONFLICT', 'Une carte porte déjà cet identifiant');
        throw error;
      }
    },
  );

  app.put(
    '/events/:id',
    {
      schema: {
        tags: ['admin'],
        summary: 'Modifier une carte (les parties en cours gardent leur version)',
        security,
        params: IdParamsSchema,
        body: AdminCardBodySchema,
        response: { 200: AdminCardSchema, ...errorResponses },
      },
    },
    async (request) => {
      if (request.body.id !== request.params.id)
        throw new AppError(400, 'VALIDATION_ERROR', 'L’identifiant d’une carte ne change pas');
      const exists = await app.prisma.eventCard.findUnique({ where: { id: request.params.id } });
      if (!exists) throw new AppError(404, 'NOT_FOUND', 'Carte introuvable');
      const row = await app.prisma.eventCard.update({
        where: { id: request.params.id },
        data: cardData(request.body),
      });
      return toAdminCard(row);
    },
  );

  app.delete(
    '/events/:id',
    {
      schema: {
        tags: ['admin'],
        summary: 'Désactiver une carte (elle reste en base pour les statistiques et les replays)',
        security,
        params: IdParamsSchema,
        response: { 200: AdminCardSchema, ...errorResponses },
      },
    },
    async (request) => {
      const exists = await app.prisma.eventCard.findUnique({ where: { id: request.params.id } });
      if (!exists) throw new AppError(404, 'NOT_FOUND', 'Carte introuvable');
      const row = await app.prisma.eventCard.update({
        where: { id: request.params.id },
        data: { active: false },
      });
      return toAdminCard(row);
    },
  );

  app.get(
    '/stats',
    {
      schema: {
        tags: ['admin'],
        summary: 'Cartes les plus tirées, choix les plus fréquents, faillites par phase',
        security,
        response: { 200: AdminStatsResponseSchema, ...errorResponses },
      },
    },
    async (): Promise<AdminStatsResponse> => {
      const [users, games, cardRows, stats, byPhase, byOutcome] = await Promise.all([
        app.prisma.user.count(),
        app.prisma.score.count(),
        app.prisma.eventCard.findMany(),
        app.prisma.eventStat.findMany(),
        app.prisma.score.groupBy({ by: ['phaseReached', 'outcome'], _count: { _all: true } }),
        app.prisma.score.groupBy({ by: ['outcome'], _count: { _all: true } }),
      ]);
      const cards = new Map(cardRows.map((row) => [row.id, toEventCard(row)]));
      const perCard = new Map<string, number>();
      for (const stat of stats)
        perCard.set(stat.cardId, (perCard.get(stat.cardId) ?? 0) + stat.count);
      const fallbackTitle = (id: string): LocalizedText => ({ fr: id, en: id });

      const topCards = [...perCard.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([cardId, count]) => ({
          cardId,
          title: cards.get(cardId)?.title ?? fallbackTitle(cardId),
          count,
        }));

      const topChoices = [...stats]
        .sort((a, b) => b.count - a.count)
        .slice(0, 15)
        .map(({ cardId, choiceIndex, count }) => {
          const card = cards.get(cardId);
          return {
            cardId,
            choiceIndex,
            title: card?.title ?? fallbackTitle(cardId),
            label: card?.choices[choiceIndex]?.label ?? {
              fr: `#${choiceIndex}`,
              en: `#${choiceIndex}`,
            },
            count,
            share: count / (perCard.get(cardId) ?? count),
          };
        });

      const bankruptcyByPhase = PHASES.filter((phase) => phase !== 'END').map((phase) => {
        const rows = byPhase.filter((row) => row.phaseReached === phase);
        const phaseGames = rows.reduce((sum, row) => sum + row._count._all, 0);
        const bankruptcies = rows
          .filter((row) => row.outcome === 'BANKRUPTCY')
          .reduce((sum, row) => sum + row._count._all, 0);
        return {
          phase,
          games: phaseGames,
          bankruptcies,
          rate: phaseGames ? bankruptcies / phaseGames : 0,
        };
      });

      const outcomes = Object.fromEntries(
        OUTCOMES.map((outcome) => [
          outcome,
          byOutcome.find((row) => row.outcome === outcome)?._count._all ?? 0,
        ]),
      ) as AdminStatsResponse['outcomes'];

      return {
        totals: { users, games, cards: cardRows.length },
        topCards,
        topChoices,
        bankruptcyByPhase,
        outcomes,
      };
    },
  );
};
