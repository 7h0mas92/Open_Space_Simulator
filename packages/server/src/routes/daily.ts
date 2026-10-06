import { dailySeed, DailyResponseSchema, utcDate } from '@oss/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

/** Mode Daily : /api/daily — la même graine pour tout le monde, chaque jour (UTC). */
export const dailyRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    {
      schema: {
        tags: ['daily'],
        summary: 'Graine du Daily du jour',
        response: { 200: DailyResponseSchema },
      },
    },
    async () => {
      const date = utcDate(new Date());
      return { date, seed: dailySeed(date) };
    },
  );
};
