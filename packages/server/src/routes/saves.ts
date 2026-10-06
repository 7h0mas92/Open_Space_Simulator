import {
  OkResponseSchema,
  PutSaveBodySchema,
  SaveDataSchema,
  SaveListResponseSchema,
  SaveResponseSchema,
  SaveSlotSchema,
  type SaveSummary,
} from '@oss/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Prisma, Save } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
import { errorResponses } from '../lib/schemas.js';

/** Une partie complète (état + journal de commandes) pèse quelques centaines de ko. */
const SAVE_BODY_LIMIT = 8 * 1024 * 1024;

const SlotParamsSchema = z.object({ slot: SaveSlotSchema });

/** Résumé lu dans l'état sauvegardé, pour afficher les emplacements sans tout télécharger. */
function toSummary(save: Save): SaveSummary {
  const state = SaveDataSchema.shape.state.parse(save.state);
  return {
    slot: save.slot,
    mode: save.mode,
    seed: save.seed,
    sprint: state.sprint,
    phase: state.phase,
    valuation: state.valuation,
    cardsVersion: save.cardsVersion as SaveSummary['cardsVersion'],
    updatedAt: save.updatedAt.toISOString(),
  };
}

/** Sauvegardes du joueur connecté (5 emplacements) : /api/saves */
export const savesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);
  const security = [{ cookieAuth: [] }];

  app.get(
    '/',
    {
      schema: {
        tags: ['saves'],
        summary: 'Lister ses sauvegardes',
        security,
        response: { 200: SaveListResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      const saves = await app.prisma.save.findMany({
        where: { userId: request.user.sub },
        orderBy: { slot: 'asc' },
      });
      return { saves: saves.map(toSummary) };
    },
  );

  app.get(
    '/:slot',
    {
      schema: {
        tags: ['saves'],
        summary: 'Charger une sauvegarde',
        security,
        params: SlotParamsSchema,
        response: { 200: SaveResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      const save = await app.prisma.save.findUnique({
        where: { userId_slot: { userId: request.user.sub, slot: request.params.slot } },
      });
      if (!save) throw new AppError(404, 'NOT_FOUND', 'Emplacement vide');
      return {
        summary: toSummary(save),
        data: SaveDataSchema.parse({ state: save.state, commands: save.commandsLog }),
      };
    },
  );

  app.put(
    '/:slot',
    {
      bodyLimit: SAVE_BODY_LIMIT,
      schema: {
        tags: ['saves'],
        summary: 'Écrire une sauvegarde (crée ou remplace l’emplacement)',
        security,
        params: SlotParamsSchema,
        body: PutSaveBodySchema,
        response: { 200: SaveResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      const { data, cardsVersion } = request.body;
      const userId = request.user.sub;
      const { slot } = request.params;
      const fields = {
        state: data.state as Prisma.InputJsonValue,
        commandsLog: data.commands as Prisma.InputJsonValue,
        seed: data.state.seed,
        mode: data.state.mode,
        cardsVersion,
      };
      const save = await app.prisma.save.upsert({
        where: { userId_slot: { userId, slot } },
        update: fields,
        create: { userId, slot, ...fields },
      });
      return { summary: toSummary(save), data };
    },
  );

  app.delete(
    '/:slot',
    {
      schema: {
        tags: ['saves'],
        summary: 'Effacer une sauvegarde',
        security,
        params: SlotParamsSchema,
        response: { 200: OkResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      await app.prisma.save.deleteMany({
        where: { userId: request.user.sub, slot: request.params.slot },
      });
      return { ok: true as const };
    },
  );
};
