import { SlackAiRequestSchema, SlackAiResponseSchema, utcDate } from '@oss/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { errorResponses } from '../lib/schemas.js';
import {
  SlackAiCache,
  SlackAiError,
  sanitizeMessages,
  type SlackAiGenerator,
} from '../services/slack-ai.service.js';

export interface SlackAiRoutesOptions {
  /** null : pas de clé ANTHROPIC_API_KEY, le mode IA est désactivé. */
  generator: SlackAiGenerator | null;
}

/**
 * Slack piloté par l'IA : /api/slack-ai/*. Proxy vers l'API Claude avec quota quotidien
 * par joueur et cache. En cas d'erreur, le client revient à ses templates.
 */
export const slackAiRoutes: FastifyPluginAsyncZod<SlackAiRoutesOptions> = async (
  app,
  { generator },
) => {
  const cache = new SlackAiCache(app.config.AI_CACHE_TTL_SECONDS * 1000);
  const quota = app.config.AI_DAILY_QUOTA;

  app.get(
    '/status',
    {
      schema: {
        tags: ['slack-ai'],
        summary: 'Le mode IA est-il disponible sur ce serveur ?',
        response: { 200: z.object({ enabled: z.boolean(), dailyQuota: z.number().int() }) },
      },
    },
    async () => ({ enabled: generator !== null && quota > 0, dailyQuota: quota }),
  );

  app.post(
    '/message',
    {
      preHandler: app.authenticate,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['slack-ai'],
        summary: 'Messages Slack générés par l’IA pour un événement de la partie',
        security: [{ cookieAuth: [] }],
        body: SlackAiRequestSchema,
        response: { 200: SlackAiResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      if (!generator || quota === 0)
        throw new AppError(503, 'AI_UNAVAILABLE', 'Le mode IA n’est pas configuré');
      const userId = request.user.sub;
      const date = new Date(utcDate(new Date()));
      const usage = await app.prisma.aiQuota.findUnique({
        where: { userId_date: { userId, date } },
      });
      const used = usage?.count ?? 0;

      const key = SlackAiCache.key(request.body);
      const cached = cache.get(key);
      if (cached) return { messages: cached, cached: true, remaining: Math.max(0, quota - used) };

      if (used >= quota)
        throw new AppError(429, 'AI_QUOTA_EXCEEDED', 'Quota quotidien du mode IA atteint');
      // L'appel est compté avant d'être fait : deux requêtes simultanées ne dépassent pas le quota.
      const { count } = await app.prisma.aiQuota.upsert({
        where: { userId_date: { userId, date } },
        update: { count: { increment: 1 } },
        create: { userId, date, count: 1 },
      });
      if (count > quota)
        throw new AppError(429, 'AI_QUOTA_EXCEEDED', 'Quota quotidien du mode IA atteint');

      try {
        const messages = sanitizeMessages(request.body, await generator(request.body));
        if (messages.length === 0) throw new SlackAiError('Aucun message exploitable');
        cache.set(key, messages);
        return { messages, cached: false, remaining: Math.max(0, quota - count) };
      } catch (error) {
        request.log.warn({ err: error }, 'Slack IA indisponible, retour aux templates');
        throw new AppError(503, 'AI_UNAVAILABLE', 'L’IA ne répond pas, retour aux templates');
      }
    },
  );
};
