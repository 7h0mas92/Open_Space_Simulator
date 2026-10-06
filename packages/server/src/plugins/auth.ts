import jwt from '@fastify/jwt';
import type { Role } from '@oss/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { Env } from '../config/env.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { ACCESS_COOKIE } from '../services/session.service.js';

/** Contenu du JWT d'accès. `sub` est l'identifiant de l'utilisateur. */
export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler : exige un JWT d'accès valide. */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** preHandler : exige un rôle (ADMIN inclut tous les droits). */
    requireRole: (role: Role) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/** Authentification par JWT stocké dans un cookie httpOnly. */
export const authPlugin = fp(async (app: FastifyInstance, { env }: { env: Env }) => {
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: ACCESS_COOKIE, signed: false },
    sign: { expiresIn: env.ACCESS_TOKEN_TTL_SECONDS },
  });

  app.decorate('authenticate', async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch {
      throw unauthorized();
    }
  });

  app.decorate('requireRole', (role: Role) => async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch {
      throw unauthorized();
    }
    if (role === 'ADMIN' && request.user.role !== 'ADMIN') {
      throw forbidden('Réservé aux administrateurs');
    }
  });
});
