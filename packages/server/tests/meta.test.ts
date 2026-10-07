import { BUILTIN_CARDS_VERSION, dailySeed, EVENT_CARDS, utcDate } from '@oss/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cookiesOf, createTestApp, registerUser, validUser } from './helpers.js';
import { playGame } from './game-fixtures.js';

let app: FastifyInstance;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(async () => {
  await app.close();
});

/** Un compte joueur (pseudo et email uniques). */
async function player(name: string) {
  return registerUser(app, { email: `${name}@startup.io`, pseudo: name });
}

async function admin() {
  await registerUser(app);
  await app.prisma.user.update({ where: { email: validUser.email }, data: { role: 'ADMIN' } });
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: validUser.email, password: validUser.password },
  });
  return cookiesOf(response);
}

async function seedCards() {
  for (const card of EVENT_CARDS.slice(0, 5)) {
    await app.prisma.eventCard.upsert({
      where: { id: card.id },
      update: {},
      create: {
        id: card.id,
        content: { title: card.title, description: card.description },
        conditions: card.conditions,
        choices: card.choices,
        weight: card.weight,
        cooldown: card.cooldownSprints,
      },
    });
  }
}

describe('GET /api/events', () => {
  it('sert les cartes intégrées tant que la base est vide', async () => {
    const response = await app.inject({ url: '/api/events' });
    expect(response.statusCode).toBe(200);
    expect(response.json().version).toBe(BUILTIN_CARDS_VERSION);
    expect(response.json().cards).toHaveLength(100);
  });

  it('versionne les cartes de la base et retrouve une ancienne version', async () => {
    await seedCards();
    const first = (await app.inject({ url: '/api/events' })).json();
    expect(first.version).toMatch(/^[a-f0-9]{16}$/);
    expect(first.cards).toHaveLength(5);

    await app.prisma.eventCard.update({ where: { id: first.cards[0].id }, data: { weight: 99 } });
    const second = (await app.inject({ url: '/api/events' })).json();
    expect(second.version).not.toBe(first.version);

    const old = (await app.inject({ url: `/api/events?version=${first.version}` })).json();
    expect(old.cards[0].weight).toBe(first.cards[0].weight);
    const missing = await app.inject({ url: '/api/events?version=0123456789abcdef' });
    expect(missing.json().error.code).toBe('UNKNOWN_CARDS_VERSION');
  });
});

describe('GET /api/daily', () => {
  it('donne la même graine à tout le monde', async () => {
    const response = await app.inject({ url: '/api/daily' });
    const today = utcDate(new Date());
    expect(response.json()).toEqual({ date: today, seed: dailySeed(today) });
  });
});

describe('/api/saves', () => {
  it('écrit, liste, charge et efface une sauvegarde', async () => {
    const cookies = await player('saver');
    const { state, commands } = playGame('save-me');
    const put = await app.inject({
      method: 'PUT',
      url: '/api/saves/2',
      cookies,
      payload: { data: { state, commands }, cardsVersion: BUILTIN_CARDS_VERSION },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().summary).toMatchObject({ slot: 2, mode: 'SHIP_IN_3', seed: 'save-me' });

    const list = await app.inject({ url: '/api/saves', cookies });
    expect(list.json().saves).toHaveLength(1);

    const load = await app.inject({ url: '/api/saves/2', cookies });
    expect(load.json().data.state.tick).toBe(state.tick);
    expect(load.json().data.commands).toHaveLength(commands.length);

    // Les sauvegardes sont privées.
    const other = await player('curious');
    expect((await app.inject({ url: '/api/saves/2', cookies: other })).statusCode).toBe(404);

    await app.inject({ method: 'DELETE', url: '/api/saves/2', cookies });
    expect((await app.inject({ url: '/api/saves', cookies })).json().saves).toEqual([]);
  });

  it('refuse un emplacement hors 1 à 5 et un état invalide', async () => {
    const cookies = await player('saver');
    const bad = await app.inject({ method: 'PUT', url: '/api/saves/6', cookies, payload: {} });
    expect(bad.statusCode).toBe(400);
    const invalid = await app.inject({
      method: 'PUT',
      url: '/api/saves/1',
      cookies,
      payload: { data: { state: { tick: 1 }, commands: [] }, cardsVersion: 'builtin' },
    });
    expect(invalid.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('exige une session', async () => {
    expect((await app.inject({ url: '/api/saves' })).statusCode).toBe(401);
  });
});

describe('POST /api/scores (anti-triche)', () => {
  const submit = (cookies: Record<string, string>, payload: object) =>
    app.inject({ method: 'POST', url: '/api/scores', cookies, payload });

  it('rejoue la partie et enregistre le score calculé par le serveur', async () => {
    const cookies = await player('honest');
    const game = playGame('honest-seed');
    const response = await submit(cookies, {
      mode: 'SHIP_IN_3',
      seed: 'honest-seed',
      commands: game.commands,
      cardsVersion: BUILTIN_CARDS_VERSION,
      claimed: { outcome: game.result.outcome, valuation: game.result.valuation },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.score).toMatchObject({
      pseudo: 'honest',
      outcome: game.result.outcome,
      valuation: game.result.valuation,
      sprintsPlayed: game.result.sprint,
    });
    expect(body.rank).toBe(1);
    expect(body.newAchievements).toEqual(expect.arrayContaining(game.state.achievements));
  });

  it('refuse un score annoncé qui ne correspond pas au rejeu', async () => {
    const cookies = await player('cheater');
    const game = playGame('cheat-seed');
    const response = await submit(cookies, {
      mode: 'SHIP_IN_3',
      seed: 'cheat-seed',
      commands: game.commands,
      cardsVersion: BUILTIN_CARDS_VERSION,
      claimed: { outcome: 'IPO', valuation: 50_000_000_000 },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('SCORE_MISMATCH');
  });

  it('refuse un journal de commandes falsifié', async () => {
    const cookies = await player('forger');
    const game = playGame('forged-seed');
    // Un recrutement inventé au milieu de la partie : le rejeu le refuse.
    const forged = [...game.commands];
    forged.splice(1, 0, {
      tick: game.commands[0]!.tick,
      command: { type: 'MAKE_OFFER', candidateId: 'c-fake', salary: 1 },
    });
    const response = await submit(cookies, {
      mode: 'SHIP_IN_3',
      seed: 'forged-seed',
      commands: forged,
      cardsVersion: BUILTIN_CARDS_VERSION,
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('REPLAY_REJECTED');
  });

  it('refuse une partie qui n’est pas terminée', async () => {
    const cookies = await player('quitter');
    const response = await submit(cookies, {
      mode: 'NORMAL',
      seed: 'abandon',
      commands: [],
      cardsVersion: BUILTIN_CARDS_VERSION,
    });
    expect(response.json().error.code).toBe('GAME_NOT_FINISHED');
  });

  it('Daily : graine du jour obligatoire, un seul essai', async () => {
    const cookies = await player('daily');
    const today = utcDate(new Date());
    const wrongSeed = await submit(cookies, {
      mode: 'DAILY',
      seed: 'not-the-daily',
      dailyDate: today,
      commands: [],
      cardsVersion: BUILTIN_CARDS_VERSION,
    });
    expect(wrongSeed.json().error.code).toBe('DAILY_INVALID');

    const game = playGame(dailySeed(today), 'DAILY', 'shipper');
    const payload = {
      mode: 'DAILY',
      seed: dailySeed(today),
      dailyDate: today,
      commands: game.commands,
      cardsVersion: BUILTIN_CARDS_VERSION,
    };
    expect((await submit(cookies, payload)).statusCode).toBe(201);
    const again = await submit(cookies, payload);
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('DAILY_ALREADY_PLAYED');

    const board = await app.inject({ url: '/api/scores/top?daily=today' });
    expect(board.json().entries).toHaveLength(1);
    expect(board.json().entries[0]).toMatchObject({ pseudo: 'daily', dailyDate: today });
  }, 60_000);

  it('classement : meilleur score de chaque joueur, puis replay', async () => {
    const alice = await player('alice');
    const bob = await player('bob');
    const games = ['s1', 's2', 's3'].map((seed) => ({ seed, ...playGame(seed) }));
    for (const [cookies, game] of [
      [alice, games[0]!],
      [alice, games[1]!],
      [bob, games[2]!],
    ] as const) {
      const response = await submit(cookies, {
        mode: 'SHIP_IN_3',
        seed: game.seed,
        commands: game.commands,
        cardsVersion: BUILTIN_CARDS_VERSION,
      });
      expect(response.statusCode).toBe(201);
    }
    const board = (await app.inject({ url: '/api/scores/top?mode=SHIP_IN_3' })).json();
    expect(board.entries.map((e: { pseudo: string }) => e.pseudo).sort()).toEqual(['alice', 'bob']);
    const aliceBest = Math.max(games[0]!.result.valuation, games[1]!.result.valuation);
    expect(board.entries.find((e: { pseudo: string }) => e.pseudo === 'alice').valuation).toBe(
      aliceBest,
    );
    const valuations = board.entries.map((e: { valuation: number }) => e.valuation);
    expect(valuations).toEqual([...valuations].sort((a, b) => b - a));

    const global = (await app.inject({ url: '/api/scores/top' })).json();
    expect(global.entries).toHaveLength(2);

    const replay = (await app.inject({ url: `/api/scores/${board.entries[0].id}/replay` })).json();
    expect(replay.cards).toHaveLength(100);
    expect(replay.commands.length).toBeGreaterThan(0);
    expect(replay.cardsVersion).toBe(BUILTIN_CARDS_VERSION);
    expect((await app.inject({ url: '/api/scores/nope/replay' })).statusCode).toBe(404);
  }, 60_000);
});

describe('mode Facile', () => {
  const submit = (cookies: Record<string, string>, payload: object) =>
    app.inject({ method: 'POST', url: '/api/scores', cookies, payload });

  it('a son propre classement et ne compte pas dans le classement global', async () => {
    const carol = await player('carol');
    const easy = playGame('easy-seed', 'EASY');
    const challenge = playGame('challenge-seed', 'SHIP_IN_3');
    for (const [mode, seed, game] of [
      ['EASY', 'easy-seed', easy],
      ['SHIP_IN_3', 'challenge-seed', challenge],
    ] as const) {
      const response = await submit(carol, {
        mode,
        seed,
        commands: game.commands,
        cardsVersion: BUILTIN_CARDS_VERSION,
      });
      expect(response.statusCode).toBe(201);
    }
    const easyBoard = (await app.inject({ url: '/api/scores/top?mode=EASY' })).json();
    expect(easyBoard.entries).toHaveLength(1);
    expect(easyBoard.entries[0]).toMatchObject({ pseudo: 'carol', mode: 'EASY' });
    const global = (await app.inject({ url: '/api/scores/top' })).json();
    expect(global.entries).toHaveLength(1);
    expect(global.entries[0]).toMatchObject({ mode: 'SHIP_IN_3' });
  }, 60_000);
});

describe('succès et profil', () => {
  it('catalogue public, déblocage et profil cumulé', async () => {
    const catalog = (await app.inject({ url: '/api/achievements' })).json().achievements;
    expect(catalog.length).toBeGreaterThanOrEqual(25);
    expect(catalog.every((a: { unlockedAt: unknown }) => a.unlockedAt === null)).toBe(true);
    // Difficulté et succès secrets : l'interface affiche « ??? » tant qu'ils sont verrouillés.
    expect(catalog.find((a: { id: string }) => a.id === 'skynet')).toMatchObject({
      difficulty: 'MEDIUM',
      secret: true,
    });
    expect(catalog.find((a: { id: string }) => a.id === 'hello-world')).toMatchObject({
      difficulty: 'EASY',
      secret: false,
    });

    const cookies = await player('collector');
    const unlock = await app.inject({
      method: 'POST',
      url: '/api/achievements/unlock',
      cookies,
      payload: { ids: ['duck-lead', 'not-an-achievement', 'duck-lead'] },
    });
    expect(unlock.json().unlocked).toEqual(['duck-lead']);
    const twice = await app.inject({
      method: 'POST',
      url: '/api/achievements/unlock',
      cookies,
      payload: { ids: ['duck-lead'] },
    });
    expect(twice.json().unlocked).toEqual([]);

    const game = playGame('profile-seed');
    await app.inject({
      method: 'POST',
      url: '/api/scores',
      cookies,
      payload: {
        mode: 'SHIP_IN_3',
        seed: 'profile-seed',
        commands: game.commands,
        cardsVersion: BUILTIN_CARDS_VERSION,
      },
    });
    const profile = (await app.inject({ url: '/api/me/profile', cookies })).json();
    expect(profile.totals.gamesPlayed).toBe(1);
    expect(profile.totals.outcomes[game.result.outcome]).toBe(1);
    expect(profile.totals.stats.featuresShipped).toBe(game.state.stats.featuresShipped);
    expect(profile.bestGames).toHaveLength(1);
    const duck = profile.achievements.find((a: { id: string }) => a.id === 'duck-lead');
    expect(duck.unlockedAt).not.toBeNull();
  });
});

describe('/api/admin', () => {
  const card = {
    ...EVENT_CARDS[0]!,
    id: 'test-card',
    title: { fr: 'Carte de test', en: 'Test card' },
  };

  it('est réservé aux administrateurs', async () => {
    const cookies = await player('lambda');
    expect((await app.inject({ url: '/api/admin/events', cookies })).statusCode).toBe(403);
    expect((await app.inject({ url: '/api/admin/stats' })).statusCode).toBe(401);
  });

  it('crée, modifie, désactive une carte ; les cartes inactives ne sont plus servies', async () => {
    const cookies = await admin();
    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/events',
      cookies,
      payload: card,
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ id: 'test-card', active: true });
    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/admin/events',
      cookies,
      payload: card,
    });
    expect(duplicate.statusCode).toBe(409);

    const updated = await app.inject({
      method: 'PUT',
      url: '/api/admin/events/test-card',
      cookies,
      payload: { ...card, weight: 42 },
    });
    expect(updated.json().weight).toBe(42);

    const invalid = await app.inject({
      method: 'PUT',
      url: '/api/admin/events/test-card',
      cookies,
      payload: { ...card, choices: [card.choices[0]] },
    });
    expect(invalid.statusCode).toBe(400);

    expect((await app.inject({ url: '/api/events' })).json().cards).toHaveLength(1);
    const disabled = await app.inject({
      method: 'DELETE',
      url: '/api/admin/events/test-card',
      cookies,
    });
    expect(disabled.json().active).toBe(false);
    expect((await app.inject({ url: '/api/admin/events', cookies })).json().cards).toHaveLength(1);
    // Plus aucune carte active : retour aux cartes intégrées.
    expect((await app.inject({ url: '/api/events' })).json().version).toBe('builtin');
  });

  it('calcule les statistiques à partir des parties publiées', async () => {
    const cookies = await admin();
    for (const source of EVENT_CARDS) {
      await app.inject({ method: 'POST', url: '/api/admin/events', cookies, payload: source });
    }
    // La partie est jouée avec les cartes servies par la base (leur ordre compte pour le tirage).
    const { version, cards } = (await app.inject({ url: '/api/events' })).json();
    const game = playGame('stats-seed', 'NORMAL', 'random', cards);
    const posted = await app.inject({
      method: 'POST',
      url: '/api/scores',
      cookies,
      payload: {
        mode: 'NORMAL',
        seed: 'stats-seed',
        commands: game.commands,
        cardsVersion: version,
      },
    });
    expect(posted.statusCode).toBe(201);

    const stats = (await app.inject({ url: '/api/admin/stats', cookies })).json();
    expect(stats.totals.games).toBeGreaterThanOrEqual(1);
    expect(stats.totals.cards).toBe(100);
    expect(stats.topCards.length).toBeGreaterThan(0);
    expect(stats.topChoices[0].share).toBeGreaterThan(0);
    const phase = stats.bankruptcyByPhase.find(
      (row: { phase: string }) => row.phase === game.result.phaseReached,
    );
    expect(phase.games).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
