import { BUILTIN_CARDS_VERSION } from '@oss/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { playCampaign, playMission, playWithUnlocks } from './game-fixtures.js';
import { createTestApp, registerUser } from './helpers.js';

let app: FastifyInstance;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(async () => {
  await app.close();
});

const player = (name: string) => registerUser(app, { email: `${name}@startup.io`, pseudo: name });

const complete = (cookies: Record<string, string>, payload: object) =>
  app.inject({ method: 'POST', url: '/api/story/complete', cookies, payload });

describe('/api/story', () => {
  it('exige une session', async () => {
    expect((await app.inject({ url: '/api/story' })).statusCode).toBe(401);
  });

  it('rejoue la mission réussie, la garde sur le compte et débloque sa récompense', async () => {
    const cookies = await player('story');
    expect((await app.inject({ url: '/api/story', cookies })).json()).toEqual({
      completed: [],
      unlocks: [],
    });
    const game = playMission('story-seed');
    expect(game.state.result?.mission?.success).toBe(true);
    const response = await complete(cookies, {
      missionId: 'first-commit',
      seed: 'story-seed',
      commands: game.commands,
      cardsVersion: BUILTIN_CARDS_VERSION,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ completed: ['first-commit'], unlocks: ['wall-blueprint'] });
    // La rejouer garde une seule victoire.
    const again = await complete(cookies, {
      missionId: 'first-commit',
      seed: 'story-seed',
      commands: game.commands,
      cardsVersion: BUILTIN_CARDS_VERSION,
    });
    expect(again.json().completed).toEqual(['first-commit']);
  });

  it('refuse une mission qui n’est pas réussie au rejeu', async () => {
    const cookies = await player('cheater');
    const game = playMission('story-seed');
    const response = await complete(cookies, {
      missionId: 'coffee-first',
      seed: 'story-seed',
      commands: game.commands,
      cardsVersion: BUILTIN_CARDS_VERSION,
    });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(response.statusCode).toBeLessThan(500);
    expect((await app.inject({ url: '/api/story', cookies })).json().completed).toEqual([]);
  });
});

describe('/api/story/complete et longue partie en actes', () => {
  it('rejoue l’histoire jusqu’à la dernière commande et garde l’objectif rempli', async () => {
    const cookies = await player('conteur');
    const game = playCampaign('histoire-seed');
    expect(game.state.story?.campaign?.done).toContain('leave-garage');
    expect(game.state.result).toBeNull();
    const response = await complete(cookies, {
      missionId: 'leave-garage',
      seed: 'histoire-seed',
      commands: game.commands,
      cardsVersion: BUILTIN_CARDS_VERSION,
      campaign: true,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ completed: ['leave-garage'], unlocks: ['color-gold'] });
  });

  it('refuse un objectif que l’histoire n’a pas rempli', async () => {
    const cookies = await player('tricheur');
    const game = playCampaign('histoire-seed');
    const response = await complete(cookies, {
      missionId: 'opening-bell',
      seed: 'histoire-seed',
      commands: game.commands,
      cardsVersion: BUILTIN_CARDS_VERSION,
      campaign: true,
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('MISSION_NOT_COMPLETED');
  });
});

describe('POST /api/scores et récompenses du mode Histoire', () => {
  const submit = (cookies: Record<string, string>, payload: object) =>
    app.inject({ method: 'POST', url: '/api/scores', cookies, payload });

  it('les missions n’ont pas de classement', async () => {
    const cookies = await player('ranked');
    const game = playMission('story-seed');
    const response = await submit(cookies, {
      mode: 'STORY',
      seed: 'story-seed',
      commands: game.commands,
      cardsVersion: BUILTIN_CARDS_VERSION,
      claimed: { outcome: 'ZOMBIE', valuation: game.state.valuation },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('STORY_NOT_RANKED');
  });

  it('refuse une récompense pas encore gagnée, puis l’accepte et la rejoue', async () => {
    const cookies = await player('rewarded');
    const game = playWithUnlocks('unlock-seed', ['wall-blueprint']);
    const payload = {
      mode: 'SHIP_IN_3',
      seed: 'unlock-seed',
      commands: game.commands,
      cardsVersion: BUILTIN_CARDS_VERSION,
      unlocks: ['wall-blueprint'],
      claimed: { outcome: game.result.outcome, valuation: game.result.valuation },
    };
    const refused = await submit(cookies, payload);
    expect(refused.statusCode).toBe(403);
    expect(refused.json().error.code).toBe('UNLOCK_NOT_EARNED');

    const mission = playMission('story-seed');
    await complete(cookies, {
      missionId: 'first-commit',
      seed: 'story-seed',
      commands: mission.commands,
      cardsVersion: BUILTIN_CARDS_VERSION,
    });
    const accepted = await submit(cookies, payload);
    expect(accepted.statusCode).toBe(201);
    const replay = await app.inject({
      url: `/api/scores/${accepted.json().score.id}/replay`,
    });
    expect(replay.json().unlocks).toEqual(['wall-blueprint']);
  });
});
