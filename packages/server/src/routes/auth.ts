import { randomBytes } from 'node:crypto';
import {
  AuthResponseSchema,
  LoginBodySchema,
  OkResponseSchema,
  RegisterBodySchema,
  type ErrorCode,
} from '@oss/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
import { errorResponses } from '../lib/schemas.js';
import type { GithubService } from '../services/github.service.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../services/password.service.js';
import {
  REFRESH_COOKIE,
  endSession,
  rotateSession,
  startSession,
} from '../services/session.service.js';
import { findAvailablePseudo, toUserDto } from '../services/user.service.js';

const OAUTH_STATE_COOKIE = 'oauth_state';

export interface AuthRoutesOptions {
  github: GithubService;
}

/** Routes d'authentification : /api/auth/* */
export const authRoutes: FastifyPluginAsyncZod<AuthRoutesOptions> = async (app, { github }) => {
  const strictRateLimit = {
    rateLimit: { max: app.config.AUTH_RATE_LIMIT_MAX, timeWindow: '1 minute' },
  };

  app.post(
    '/register',
    {
      config: strictRateLimit,
      schema: {
        tags: ['auth'],
        summary: 'Créer un compte avec email et mot de passe',
        body: RegisterBodySchema,
        response: { 201: AuthResponseSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const { email, password, pseudo, locale } = request.body;
      try {
        const user = await app.prisma.user.create({
          data: { email, pseudo, locale, passwordHash: await hashPassword(password) },
        });
        await startSession(app, reply, user);
        return reply.status(201).send({ user: toUserDto(user) });
      } catch (error) {
        // Violation de contrainte d'unicité : email ou pseudo déjà pris.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const target = JSON.stringify(error.meta ?? {});
          throw target.includes('pseudo')
            ? new AppError(409, 'PSEUDO_TAKEN', 'Ce pseudo est déjà pris, choisis-en un autre')
            : new AppError(
                409,
                'EMAIL_TAKEN',
                'Un compte existe déjà avec cet email, connecte-toi plutôt',
              );
        }
        throw error;
      }
    },
  );

  app.post(
    '/login',
    {
      config: strictRateLimit,
      schema: {
        tags: ['auth'],
        summary: 'Se connecter avec email et mot de passe',
        body: LoginBodySchema,
        response: { 200: AuthResponseSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const user = await app.prisma.user.findUnique({ where: { email } });
      const valid = user?.passwordHash
        ? await verifyPassword(user.passwordHash, password)
        : (await verifyAgainstDummy(password), false);
      // Même message que l'email existe ou non : on ne révèle pas les comptes existants.
      if (!user || !valid) {
        throw new AppError(
          401,
          'INVALID_CREDENTIALS',
          'Email ou mot de passe incorrect, vérifie ta saisie',
        );
      }
      await startSession(app, reply, user);
      return { user: toUserDto(user) };
    },
  );

  app.post(
    '/refresh',
    {
      schema: {
        tags: ['auth'],
        summary: 'Renouveler la session à partir du refresh token (cookie)',
        response: { 200: AuthResponseSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const user = await rotateSession(app, reply, request.cookies[REFRESH_COOKIE]);
      return { user: toUserDto(user) };
    },
  );

  app.post(
    '/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'Se déconnecter',
        response: { 200: OkResponseSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      await endSession(app, reply, request.cookies[REFRESH_COOKIE]);
      return { ok: true as const };
    },
  );

  app.get(
    '/providers',
    {
      schema: {
        tags: ['auth'],
        summary: 'Méthodes de connexion disponibles',
        response: { 200: z.object({ password: z.literal(true), github: z.boolean() }) },
      },
    },
    async () => ({ password: true as const, github: github.isConfigured }),
  );

  app.get(
    '/github',
    {
      schema: { tags: ['auth'], summary: 'Démarrer la connexion GitHub (redirection)' },
    },
    async (_request, reply) => {
      const state = randomBytes(16).toString('base64url');
      const url = github.authorizeUrl(state);
      reply.setCookie(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        secure: app.config.COOKIE_SECURE,
        sameSite: 'lax',
        signed: true,
        path: '/api/auth/github',
        maxAge: 10 * 60,
      });
      return reply.redirect(url);
    },
  );

  app.get(
    '/github/callback',
    {
      config: strictRateLimit,
      schema: {
        tags: ['auth'],
        summary: 'Retour de GitHub après autorisation (redirection vers le client)',
        querystring: z.object({
          code: z.string().optional(),
          state: z.string().optional(),
          error: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const fail = (code: ErrorCode) =>
        reply.redirect(`${app.config.CLIENT_URL}/?authError=${code}`);

      const cookie = request.cookies[OAUTH_STATE_COOKIE];
      reply.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/auth/github' });
      const expectedState = cookie ? request.unsignCookie(cookie) : undefined;
      const { code, state } = request.query;
      // Le paramètre `state` protège contre les attaques CSRF sur le flux OAuth.
      if (!code || !state || !expectedState?.valid || expectedState.value !== state) {
        return fail('OAUTH_FAILED');
      }

      let profile;
      try {
        profile = await github.fetchProfile(code);
      } catch (error) {
        request.log.warn({ err: error }, 'Échec OAuth GitHub');
        return fail(error instanceof AppError ? error.code : 'OAUTH_FAILED');
      }

      // 1. Compte déjà lié à GitHub ; 2. sinon compte existant avec le même email vérifié
      //    (on le lie) ; 3. sinon nouveau compte.
      let user = await app.prisma.user.findUnique({ where: { githubId: profile.githubId } });
      if (!user && profile.email) {
        const existing = await app.prisma.user.findUnique({ where: { email: profile.email } });
        if (existing) {
          user = await app.prisma.user.update({
            where: { id: existing.id },
            data: { githubId: profile.githubId },
          });
        }
      }
      user ??= await app.prisma.user.create({
        data: {
          githubId: profile.githubId,
          email: profile.email,
          pseudo: await findAvailablePseudo(app.prisma, profile.login),
        },
      });

      await startSession(app, reply, user);
      return reply.redirect(`${app.config.CLIENT_URL}/?login=github`);
    },
  );
};
