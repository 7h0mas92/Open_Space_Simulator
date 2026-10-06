import type { SlackAiRequest } from '@oss/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SlackAiCache, sanitizeMessages } from '../src/services/slack-ai.service.js';
import { createTestApp, registerUser } from './helpers.js';

const request: SlackAiRequest = {
  locale: 'fr',
  event: { kind: 'PROD_DOWN', text: 'La prod est tombée' },
  game: {
    phase: 'SEED',
    sprint: 4,
    gauges: { treasury: 900_000, coffee: 40, debt: 55, stability: 20, hype: 30, users: 1200 },
  },
  devs: [
    { name: 'Kevin', role: 'INTERN', trait: 'GAMER', morale: 70 },
    { name: 'Gérard', role: 'SENIOR_BEARD', trait: 'GRUMPY', morale: 40 },
  ],
};

let app: FastifyInstance;
afterEach(async () => {
  await app.close();
});

describe('POST /api/slack-ai/message', () => {
  it('répond 503 sans clé API : le client garde ses templates', async () => {
    app = await createTestApp({}, { slackAi: null });
    expect((await app.inject({ url: '/api/slack-ai/status' })).json().enabled).toBe(false);
    const cookies = await registerUser(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/slack-ai/message',
      cookies,
      payload: request,
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('AI_UNAVAILABLE');
  });

  it('génère, met en cache et applique le quota quotidien', async () => {
    const generator = vi.fn(async () => [
      { channel: 'incidents' as const, author: 'Kevin', text: 'C’est pas moi, promis.' },
      { channel: 'random' as const, author: 'Inconnu', text: 'Je ne fais pas partie de l’équipe' },
    ]);
    app = await createTestApp({ AI_DAILY_QUOTA: '2' }, { slackAi: generator });
    const cookies = await registerUser(app);
    const send = (payload: SlackAiRequest) =>
      app.inject({ method: 'POST', url: '/api/slack-ai/message', cookies, payload });

    const first = (await send(request)).json();
    // Seuls les membres de l'équipe peuvent signer un message.
    expect(first.messages).toEqual([
      { channel: 'incidents', author: 'Kevin', text: 'C’est pas moi, promis.' },
    ]);
    expect(first).toMatchObject({ cached: false, remaining: 1 });

    // Même événement : réponse en cache, pas de nouvel appel ni de quota consommé.
    const cached = (await send({ ...request, game: { ...request.game, sprint: 5 } })).json();
    expect(cached.cached).toBe(true);
    expect(generator).toHaveBeenCalledTimes(1);

    const other = (event: string) => ({
      ...request,
      event: { kind: 'CARD_RESOLVED', text: event },
    });
    expect((await send(other('a'))).json().remaining).toBe(0);
    const over = await send(other('b'));
    expect(over.statusCode).toBe(429);
    expect(over.json().error.code).toBe('AI_QUOTA_EXCEEDED');
    expect(generator).toHaveBeenCalledTimes(2);
  });

  it('se replie sur les templates si l’IA échoue', async () => {
    app = await createTestApp({}, { slackAi: async () => Promise.reject(new Error('boom')) });
    const cookies = await registerUser(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/slack-ai/message',
      cookies,
      payload: request,
    });
    expect(response.json().error.code).toBe('AI_UNAVAILABLE');
  });

  it('exige une session et un résumé valide', async () => {
    app = await createTestApp({}, { slackAi: async () => [] });
    expect(
      (await app.inject({ method: 'POST', url: '/api/slack-ai/message', payload: request }))
        .statusCode,
    ).toBe(401);
    const cookies = await registerUser(app);
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/slack-ai/message',
      cookies,
      payload: { ...request, devs: [] },
    });
    expect(invalid.statusCode).toBe(400);
  });
});

describe('SlackAiCache', () => {
  it('expire les entrées et limite sa taille', () => {
    let now = 0;
    const cache = new SlackAiCache(1000, 2, () => now);
    const message = [{ channel: 'general' as const, author: 'Kevin', text: 'ok' }];
    cache.set('a', message);
    cache.set('b', message);
    cache.set('c', message);
    expect(cache.get('a')).toBeNull();
    expect(cache.get('c')).toEqual(message);
    now = 2000;
    expect(cache.get('c')).toBeNull();
  });

  it('ignore les jauges dans la clé', () => {
    const changed = { ...request, game: { ...request.game, sprint: 9 } };
    expect(SlackAiCache.key(changed)).toBe(SlackAiCache.key(request));
  });
});

describe('sanitizeMessages', () => {
  it('garde 3 messages au plus, signés par l’équipe, et coupe les textes trop longs', () => {
    const long = 'x'.repeat(400);
    const result = sanitizeMessages(
      request,
      Array.from({ length: 5 }, () => ({
        channel: 'general' as const,
        author: 'Gérard',
        text: long,
      })),
    );
    expect(result).toHaveLength(3);
    expect(result[0]!.text).toHaveLength(280);
  });
});
