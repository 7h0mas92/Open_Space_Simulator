import {
  CommandLogSchema,
  dailySeed,
  GLOBAL_EXCLUDED_MODES,
  isEndless,
  LeaderboardQuerySchema,
  LeaderboardResponseSchema,
  ReplayResponseSchema,
  SubmitScoreBodySchema,
  SubmitScoreResponseSchema,
  UNLOCK_MODES,
  UnlocksSchema,
  utcDate,
  type GameMode,
  type GameState,
} from '@oss/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
import type { PrismaClient } from '../lib/prisma.js';
import { errorResponses } from '../lib/schemas.js';
import { unlockForUser } from '../services/achievement.service.js';
import { cardSetByVersion } from '../services/cards.service.js';
import { verifyGame } from '../services/replay.service.js';
import { unearnedUnlocks } from '../services/story.service.js';
import { acceptedDailyDates, toScoreDto } from '../services/score.service.js';

/** Taille maximale d'un journal de commandes envoyé (le rejeu d'une partie complète). */
const SCORE_BODY_LIMIT = 8 * 1024 * 1024;

/** Le classement : filtre par mode ou par jour du Daily. */
interface Scope {
  mode?: GameMode;
  dailyDate?: Date;
}

function scopeSql({ mode, dailyDate }: Scope): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (mode) conditions.push(Prisma.sql`s."mode" = ${mode}::"GameMode"`);
  if (dailyDate) conditions.push(Prisma.sql`s."dailyDate" = ${dailyDate}::date`);
  // Le classement global ne compte ni le Facile ni l'Illimité (ils ont leur propre onglet).
  if (!mode && !dailyDate) {
    for (const excluded of GLOBAL_EXCLUDED_MODES)
      conditions.push(Prisma.sql`s."mode" <> ${excluded}::"GameMode"`);
  }
  return Prisma.join(conditions, ' AND ');
}

/** Le mode illimité se classe d'abord aux sprints tenus, puis à la valorisation (`compareGames`). */
const byEndurance = (scope: Scope) => scope.mode !== undefined && isEndless(scope.mode);

/**
 * Meilleur score de chaque joueur dans le classement demandé (un joueur n'y apparaît
 * qu'une fois), du plus haut au plus bas.
 */
async function topScoreIds(prisma: PrismaClient, scope: Scope, limit: number): Promise<string[]> {
  // En mode illimité, la clé de tri commence par les sprints tenus (0 ailleurs : sans effet ;
  // `0::int` et non `0`, qu'ORDER BY prendrait pour un numéro de colonne).
  const sprints = byEndurance(scope) ? Prisma.sql`s."sprintsPlayed"` : Prisma.sql`0::int`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM (
      SELECT DISTINCT ON (s."userId") s.id, ${sprints} AS sprints, s.valuation, s."createdAt"
      FROM "Score" s
      WHERE ${scopeSql(scope)}
      ORDER BY s."userId", ${sprints} DESC, s.valuation DESC, s."createdAt" ASC
    ) best
    ORDER BY best.sprints DESC, best.valuation DESC, best."createdAt" ASC
    LIMIT ${limit}`;
  return rows.map((row) => row.id);
}

/**
 * Rang d'un score : 1 + nombre d'autres joueurs ayant fait mieux (plus de valorisation, ou en
 * mode illimité plus de sprints tenus, puis plus de valorisation à sprints égaux).
 */
async function rankOf(
  prisma: PrismaClient,
  scope: Scope,
  score: { valuation: number; sprintsPlayed: number },
  userId: string,
): Promise<number> {
  const better = byEndurance(scope)
    ? Prisma.sql`(s."sprintsPlayed" > ${score.sprintsPlayed} OR (s."sprintsPlayed" = ${score.sprintsPlayed} AND s.valuation > ${score.valuation}))`
    : Prisma.sql`s.valuation > ${score.valuation}`;
  const [row] = await prisma.$queryRaw<{ better: bigint }[]>`
    SELECT COUNT(DISTINCT s."userId") AS better FROM "Score" s
    WHERE ${scopeSql(scope)} AND ${better} AND s."userId" <> ${userId}`;
  return Number(row?.better ?? 0) + 1;
}

/** Compte les choix faits sur chaque carte (statistiques du back-office). */
async function recordEventStats(prisma: PrismaClient, state: GameState): Promise<void> {
  const counts = new Map<string, { cardId: string; choiceIndex: number; count: number }>();
  for (const { cardId, choiceIndex } of state.events.choices) {
    const key = `${cardId}#${choiceIndex}`;
    const entry = counts.get(key) ?? { cardId, choiceIndex, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  // Seules les cartes encore présentes en base ont des statistiques.
  const known = new Set(
    (
      await prisma.eventCard.findMany({
        where: { id: { in: [...new Set(state.events.choices.map((c) => c.cardId))] } },
        select: { id: true },
      })
    ).map((card) => card.id),
  );
  await prisma.$transaction(
    [...counts.values()]
      .filter(({ cardId }) => known.has(cardId))
      .map(({ cardId, choiceIndex, count }) =>
        prisma.eventStat.upsert({
          where: { cardId_choiceIndex: { cardId, choiceIndex } },
          update: { count: { increment: count } },
          create: { cardId, choiceIndex, count },
        }),
      ),
  );
}

/** Scores et classements : /api/scores */
export const scoresRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/',
    {
      preHandler: app.authenticate,
      bodyLimit: SCORE_BODY_LIMIT,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['scores'],
        summary: 'Publier une partie terminée (rejouée et vérifiée par le serveur)',
        description:
          'Le serveur rejoue la graine et les commandes avec la simulation du jeu. L’issue et la valorisation enregistrées sont celles du rejeu.',
        security: [{ cookieAuth: [] }],
        body: SubmitScoreBodySchema,
        response: { 201: SubmitScoreResponseSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const { mode, seed, commands, cardsVersion, dailyDate, unlocks, claimed } = request.body;
      const userId = request.user.sub;

      // Mode Histoire : les missions passent par POST /story/complete, sans classement.
      if (mode === 'STORY')
        throw new AppError(400, 'STORY_NOT_RANKED', 'Les missions n’ont pas de classement');
      // Récompenses du mode Histoire : jamais en Daily, et seulement celles gagnées sur le compte.
      const used = UNLOCK_MODES.includes(mode) ? unlocks : [];
      if ((await unearnedUnlocks(app.prisma, userId, used)).length > 0)
        throw new AppError(
          403,
          'UNLOCK_NOT_EARNED',
          'Cette partie utilise une récompense du mode Histoire pas encore gagnée',
        );

      // Daily : la graine du jour, et une seule partie par jour.
      if (mode === 'DAILY') {
        if (
          !dailyDate ||
          !acceptedDailyDates(new Date()).includes(dailyDate) ||
          seed !== dailySeed(dailyDate)
        ) {
          throw new AppError(400, 'DAILY_INVALID', 'Ce n’est pas la partie Daily du jour');
        }
        const played = await app.prisma.score.findUnique({
          where: { userId_dailyDate: { userId, dailyDate: new Date(dailyDate) } },
        });
        if (played) throw new AppError(409, 'DAILY_ALREADY_PLAYED', 'Daily déjà joué aujourd’hui');
      } else if (dailyDate) {
        throw new AppError(400, 'DAILY_INVALID', 'dailyDate est réservé au mode Daily');
      }

      const { cards } = await cardSetByVersion(app.prisma, cardsVersion);
      const { state, result } = verifyGame({ seed, mode, unlocks: used, commands, cards });
      if (
        claimed &&
        (claimed.outcome !== result.outcome || Math.round(claimed.valuation) !== result.valuation)
      ) {
        throw new AppError(
          422,
          'SCORE_MISMATCH',
          'Le score annoncé ne correspond pas au rejeu de la partie',
        );
      }

      let score;
      try {
        score = await app.prisma.score.create({
          data: {
            userId,
            mode,
            seed,
            cardsVersion,
            valuation: result.valuation,
            outcome: result.outcome,
            phaseReached: result.phaseReached,
            sprintsPlayed: result.sprint,
            commandsLog: commands as Prisma.InputJsonValue,
            stats: state.stats,
            unlocks: state.unlocks,
            dailyDate: dailyDate ? new Date(dailyDate) : null,
          },
          include: { user: { select: { pseudo: true } } },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
          throw new AppError(409, 'DAILY_ALREADY_PLAYED', 'Daily déjà joué aujourd’hui');
        throw error;
      }

      await recordEventStats(app.prisma, state);
      const newAchievements = await unlockForUser(app.prisma, userId, state.achievements);
      const scope: Scope = dailyDate ? { dailyDate: new Date(dailyDate) } : { mode };
      const rank = await rankOf(
        app.prisma,
        scope,
        { valuation: result.valuation, sprintsPlayed: result.sprint },
        userId,
      );
      request.log.info(
        { scoreId: score.id, mode, outcome: result.outcome, valuation: result.valuation },
        'Score vérifié et enregistré',
      );
      return reply.status(201).send({ score: toScoreDto(score), rank, newAchievements });
    },
  );

  app.get(
    '/top',
    {
      schema: {
        tags: ['scores'],
        summary: 'Classement : global, par mode ou Daily (meilleur score de chaque joueur)',
        querystring: LeaderboardQuerySchema,
        response: { 200: LeaderboardResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      const { mode, daily, limit } = request.query;
      const scope: Scope = daily
        ? { dailyDate: new Date(daily === 'today' ? utcDate(new Date()) : daily) }
        : { mode };
      const ids = await topScoreIds(app.prisma, scope, limit);
      const scores = await app.prisma.score.findMany({
        where: { id: { in: ids } },
        include: { user: { select: { pseudo: true } } },
      });
      const byId = new Map(scores.map((score) => [score.id, score]));
      const entries = ids.flatMap((id, index) => {
        const score = byId.get(id);
        return score ? [{ ...toScoreDto(score), rank: index + 1 }] : [];
      });
      return { entries };
    },
  );

  app.get(
    '/:id/replay',
    {
      schema: {
        tags: ['scores'],
        summary: 'Graine et commandes d’une partie du classement, pour la revoir',
        params: z.object({ id: z.string().max(40) }),
        response: { 200: ReplayResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      const score = await app.prisma.score.findUnique({
        where: { id: request.params.id },
        include: { user: { select: { pseudo: true } } },
      });
      if (!score) throw new AppError(404, 'NOT_FOUND', 'Partie introuvable');
      const { cards } = await cardSetByVersion(app.prisma, score.cardsVersion);
      return {
        score: toScoreDto(score),
        seed: score.seed,
        commands: CommandLogSchema.parse(score.commandsLog),
        cardsVersion: score.cardsVersion,
        cards,
        unlocks: UnlocksSchema.parse(score.unlocks),
      };
    },
  );
};
