import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildApp, type AppDependencies } from '../src/app.js';
import { loadEnv, type Env } from '../src/config/env.js';
import { createPrismaClient } from '../src/lib/prisma.js';

export function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: 'test-secret-test-secret-test-secret-123',
    AUTH_RATE_LIMIT_MAX: '1000',
    RATE_LIMIT_MAX: '1000',
    ...overrides,
  });
}

/** Construit une application de test sur une base vide. */
export async function createTestApp(
  overrides: Record<string, string> = {},
  deps: AppDependencies = {},
): Promise<FastifyInstance> {
  const env = testEnv(overrides);
  const prisma = deps.prisma ?? createPrismaClient(env.DATABASE_URL);
  await prisma.$executeRawUnsafe(
    'TRUNCATE "User", "EventCard", "Achievement", "CardSet", "CharacterPack", "DecorTheme" RESTART IDENTITY CASCADE',
  );
  const app = await buildApp(env, { ...deps, prisma });
  await app.ready();
  return app;
}

/** Extrait les cookies `Set-Cookie` d'une réponse sous forme { nom: valeur }. */
export function cookiesOf(response: LightMyRequestResponse): Record<string, string> {
  return Object.fromEntries(response.cookies.map((cookie) => [cookie.name, cookie.value]));
}

export const validUser = {
  email: 'kevin@startup.io',
  password: 'ninja-du-code',
  pseudo: 'kevin_ninja',
};

/** Inscrit un utilisateur et renvoie ses cookies de session. */
export async function registerUser(
  app: FastifyInstance,
  body: Partial<typeof validUser> & { locale?: string } = {},
): Promise<Record<string, string>> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { ...validUser, ...body },
  });
  if (response.statusCode !== 201) throw new Error(response.body);
  return cookiesOf(response);
}
