import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { User } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';

/**
 * Gestion des sessions :
 * - un JWT d'accès court (15 min) dans le cookie httpOnly `access_token` ;
 * - un refresh token opaque long (30 j) dans le cookie httpOnly `refresh_token`,
 *   envoyé uniquement aux routes /api/auth. En base, on ne garde que son empreinte SHA-256.
 */
export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/auth';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function cookieBase(app: FastifyInstance) {
  return {
    httpOnly: true,
    secure: app.config.COOKIE_SECURE,
    sameSite: 'lax' as const,
  };
}

/** Ouvre une session : émet les deux jetons et les pose en cookies. */
export async function startSession(
  app: FastifyInstance,
  reply: FastifyReply,
  user: Pick<User, 'id' | 'role'>,
): Promise<void> {
  const accessToken = await reply.jwtSign({ sub: user.id, role: user.role });
  const refreshToken = randomBytes(32).toString('base64url');
  const ttlMs = app.config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

  await app.prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });

  reply
    .setCookie(ACCESS_COOKIE, accessToken, {
      ...cookieBase(app),
      path: '/',
      maxAge: app.config.ACCESS_TOKEN_TTL_SECONDS,
    })
    .setCookie(REFRESH_COOKIE, refreshToken, {
      ...cookieBase(app),
      path: REFRESH_COOKIE_PATH,
      maxAge: ttlMs / 1000,
    });
}

/**
 * Échange un refresh token contre une nouvelle paire de jetons (rotation).
 * Si un jeton déjà révoqué est présenté, c'est probablement un vol :
 * on révoque toutes les sessions de l'utilisateur.
 */
export async function rotateSession(
  app: FastifyInstance,
  reply: FastifyReply,
  refreshToken: string | undefined,
): Promise<User> {
  const invalid = new AppError(
    401,
    'INVALID_REFRESH_TOKEN',
    'Session expirée ou révoquée, reconnecte-toi',
  );
  if (!refreshToken) throw invalid;

  const stored = await app.prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: true },
  });
  if (!stored) throw invalid;

  if (stored.revokedAt) {
    await app.prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    app.log.warn({ userId: stored.userId }, 'Réutilisation d’un refresh token révoqué');
    throw invalid;
  }
  if (stored.expiresAt <= new Date()) throw invalid;

  // Révocation conditionnelle : si deux requêtes utilisent le même jeton en même temps,
  // une seule gagne.
  const { count } = await app.prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw invalid;

  await startSession(app, reply, stored.user);
  return stored.user;
}

/** Ferme la session courante : révoque le refresh token et efface les cookies. */
export async function endSession(
  app: FastifyInstance,
  reply: FastifyReply,
  refreshToken: string | undefined,
): Promise<void> {
  if (refreshToken) {
    await app.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  reply
    .clearCookie(ACCESS_COOKIE, { ...cookieBase(app), path: '/' })
    .clearCookie(REFRESH_COOKIE, { ...cookieBase(app), path: REFRESH_COOKIE_PATH });
}
