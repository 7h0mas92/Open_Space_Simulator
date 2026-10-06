import { AuthResponseSchema, UpdateMeBodySchema } from '@oss/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { Prisma } from '../generated/prisma/client.js';
import { AppError, unauthorized } from '../lib/errors.js';
import { errorResponses } from '../lib/schemas.js';
import { toUserDto } from '../services/user.service.js';

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
};
