import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Env } from './config/env.js';
import { createPrismaClient, type PrismaClient } from './lib/prisma.js';
import { authPlugin } from './plugins/auth.js';
import { errorsPlugin } from './plugins/errors.js';
import { prismaPlugin } from './plugins/prisma.js';
import { securityPlugin } from './plugins/security.js';
import { swaggerPlugin } from './plugins/swagger.js';
import { achievementsRoutes } from './routes/achievements.js';
import { storyRoutes } from './routes/story.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { dailyRoutes } from './routes/daily.js';
import { eventsRoutes } from './routes/events.js';
import { healthRoutes } from './routes/health.js';
import { meRoutes } from './routes/me.js';
import { decorRoutes } from './routes/decor.js';
import { packsRoutes } from './routes/packs.js';
import { savesRoutes } from './routes/saves.js';
import { scoresRoutes } from './routes/scores.js';
import { slackAiRoutes } from './routes/slack-ai.js';
import { syncAchievementCatalog } from './services/achievement.service.js';
import { ensureBuiltinCardSet } from './services/cards.service.js';
import { GithubService } from './services/github.service.js';
import { createClaudeGenerator, type SlackAiGenerator } from './services/slack-ai.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: Env;
  }
}

export interface AppDependencies {
  /** Client Prisma déjà créé (tests) ; sinon créé à partir de DATABASE_URL. */
  prisma?: PrismaClient;
  /** Implémentation de fetch utilisée pour GitHub (simulée dans les tests). */
  fetch?: typeof fetch;
  /** Générateur du Slack IA (simulé dans les tests). Par défaut : l'API Claude si une clé existe. */
  slackAi?: SlackAiGenerator | null;
}

/**
 * Construit l'application Fastify sans la démarrer.
 * Les tests l'utilisent directement avec `app.inject()`, sans ouvrir de port.
 */
export async function buildApp(env: Env, deps: AppDependencies = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
      ...(env.NODE_ENV === 'development' && {
        transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } },
      }),
    },
    // Derrière le proxy de Render / Vercel : IP réelle du client pour le rate limiting.
    trustProxy: env.NODE_ENV === 'production',
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('config', env);

  await app.register(errorsPlugin);
  await app.register(securityPlugin, { env });
  await app.register(prismaPlugin, { prisma: deps.prisma ?? createPrismaClient(env.DATABASE_URL) });
  await app.register(authPlugin, { env });
  await app.register(swaggerPlugin);

  const github = new GithubService(env, deps.fetch);
  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(authRoutes, { prefix: '/api/auth', github });
  await app.register(meRoutes, { prefix: '/api/me' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(eventsRoutes, { prefix: '/api/events' });
  await app.register(packsRoutes, { prefix: '/api/character-packs' });
  await app.register(decorRoutes, { prefix: '/api/decor-themes' });
  await app.register(savesRoutes, { prefix: '/api/saves' });
  await app.register(scoresRoutes, { prefix: '/api/scores' });
  await app.register(dailyRoutes, { prefix: '/api/daily' });
  await app.register(achievementsRoutes, { prefix: '/api/achievements' });
  await app.register(storyRoutes, { prefix: '/api/story' });
  const slackAi =
    deps.slackAi !== undefined
      ? deps.slackAi
      : env.ANTHROPIC_API_KEY
        ? createClaudeGenerator(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL)
        : null;
  await app.register(slackAiRoutes, { prefix: '/api/slack-ai', generator: slackAi });

  // La base suit le code : catalogue des succès et cartes intégrées (version « builtin »).
  app.addHook('onReady', async () => {
    await syncAchievementCatalog(app.prisma);
    await ensureBuiltinCardSet(app.prisma);
  });

  return app;
}
