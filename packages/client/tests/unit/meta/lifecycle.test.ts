import type { GameResult, SaveData } from '@oss/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTOSAVE_SLOT, saves } from '../../../src/save/saves';
import { MemoryStore, setLocalStore } from '../../../src/save/storage';
import { wrapText } from '../../../src/ui/game/shareImage';
import { useGame } from '../../../src/ui/store/game';
import {
  dailyDateOf,
  installGameLifecycle,
  saveGame,
  submitScore,
} from '../../../src/ui/store/lifecycle';
import { useSession } from '../../../src/ui/store/session';
import type { GameSource } from '../../../src/view/source';
import type { GameView } from '../../../src/view/types';
import { bodyOf, gameView, mockApi, saveData } from './helpers';

const RESULT: GameResult = {
  outcome: 'ACQUISITION',
  phaseReached: 'SERIES_A',
  sprint: 39,
  valuation: 400_000_000,
  ownership: 0.4,
  headline: { fr: 'Rachetée 400 M€', en: 'Acquired for €400M' },
};

const USER = {
  id: 'u1',
  email: 'kevin@startup.io',
  pseudo: 'kevin_ninja',
  role: 'USER',
  locale: 'fr',
  hasPassword: true,
  hasGithub: false,
  createdAt: '2026-10-06T10:00:00.000Z',
} as const;

/** Source de partie factice : seule la sauvegarde est utilisée par la publication du score. */
function fakeSource(view: GameView, data: SaveData = saveData()): GameSource {
  return {
    view,
    cardsVersion: 'builtin',
    dispatch: async () => ({ ok: true }),
    setSpeed: () => undefined,
    save: async () => data,
    subscribe: () => () => undefined,
    dispose: () => undefined,
  };
}

/** Met une partie terminée dans le store du jeu. */
function endedGame(overrides: Partial<GameView> = {}) {
  const view = gameView({ step: 'ENDED', result: RESULT, ...overrides });
  const source = fakeSource(view);
  useGame.setState({ source, view, replayOf: null, submission: { status: 'idle' } });
  return source;
}

function scoreResponse(rank: number) {
  return Response.json({
    score: {
      id: 's1',
      pseudo: 'kevin_ninja',
      mode: 'NORMAL',
      valuation: RESULT.valuation,
      outcome: RESULT.outcome,
      phaseReached: RESULT.phaseReached,
      sprintsPlayed: 39,
      company: 'Synergify',
      dailyDate: null,
      createdAt: '2026-10-06T10:00:00.000Z',
    },
    rank,
    newAchievements: ['duck-lead'],
  });
}

beforeEach(() => {
  setLocalStore(new MemoryStore());
  useGame.getState().quit();
  useSession.setState({ status: 'authenticated', user: USER, error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('dailyDateOf', () => {
  it('retrouve la date dans la graine du Daily', () => {
    expect(dailyDateOf('daily-2026-10-06')).toBe('2026-10-06');
  });

  it('ignore les autres graines', () => {
    expect(dailyDateOf('abc123')).toBeUndefined();
    expect(dailyDateOf('daily-2026-10-06-bis')).toBeUndefined();
    expect(dailyDateOf('xdaily-2026-10-06')).toBeUndefined();
  });
});

describe('submitScore', () => {
  it('ne publie rien pour un invité', async () => {
    useSession.setState({ status: 'guest', user: null });
    const fetchMock = mockApi({});
    endedGame();
    await submitScore();
    expect(useGame.getState().submission).toEqual({ status: 'guest' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('publie la graine et les commandes, puis affiche le rang', async () => {
    const fetchMock = mockApi({ 'POST /api/scores': () => scoreResponse(3) });
    const source = endedGame({ seed: 'graine', mode: 'NORMAL' });
    const data = await source.save();
    await submitScore();

    expect(useGame.getState().submission).toEqual({
      status: 'done',
      rank: 3,
      newAchievements: ['duck-lead'],
    });
    expect(bodyOf(fetchMock, 'POST /api/scores')).toEqual({
      mode: 'NORMAL',
      seed: 'graine',
      commands: data.commands,
      cardsVersion: 'builtin',
      claimed: { outcome: 'ACQUISITION', valuation: 400_000_000 },
    });
  });

  it('ajoute la date du Daily', async () => {
    const fetchMock = mockApi({ 'POST /api/scores': () => scoreResponse(1) });
    endedGame({ seed: 'daily-2026-10-06', mode: 'DAILY' });
    await submitScore();
    expect(bodyOf(fetchMock, 'POST /api/scores')).toMatchObject({
      mode: 'DAILY',
      dailyDate: '2026-10-06',
    });
  });

  it('affiche le code d’erreur renvoyé par le serveur', async () => {
    mockApi({
      'POST /api/scores': () =>
        Response.json({ error: { code: 'SCORE_MISMATCH', message: 'triche ?' } }, { status: 422 }),
    });
    endedGame();
    await submitScore();
    expect(useGame.getState().submission).toEqual({ status: 'error', code: 'SCORE_MISMATCH' });
  });

  it('signale une erreur réseau', async () => {
    mockApi({});
    endedGame();
    await submitScore();
    expect(useGame.getState().submission).toEqual({ status: 'error', code: 'NETWORK_ERROR' });
  });

  it('ne publie ni une partie en cours ni un replay', async () => {
    const fetchMock = mockApi({});
    endedGame({ result: null });
    await submitScore();
    expect(useGame.getState().submission).toEqual({ status: 'idle' });

    endedGame();
    useGame.setState({ replayOf: 'kevin_ninja', submission: { status: 'replay' } });
    await submitScore();
    expect(useGame.getState().submission).toEqual({ status: 'replay' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('saveGame', () => {
  it('sauvegarde la partie en cours sur l’appareil (invité)', async () => {
    useSession.setState({ status: 'guest', user: null });
    endedGame();
    expect(await saveGame(2)).toBe(false);
  });

  it('envoie la sauvegarde au serveur pour un joueur connecté', async () => {
    const data = saveData();
    mockApi({
      'PUT /api/saves/2': () =>
        Response.json({
          summary: {
            slot: 2,
            mode: data.state.mode,
            seed: data.state.seed,
            sprint: 1,
            phase: 'SEED',
            valuation: 0,
            cardsVersion: 'builtin',
            updatedAt: '2026-10-06T10:00:00.000Z',
          },
          data,
        }),
    });
    endedGame();
    expect(await saveGame(2)).toBe(true);
  });

  it('ne sauvegarde ni sans partie ni pendant un replay', async () => {
    expect(await saveGame(2)).toBe(false);
    endedGame();
    useGame.setState({ replayOf: 'kevin_ninja' });
    expect(await saveGame(2)).toBe(false);
  });
});

describe('fin de partie', () => {
  it('retire la partie terminée de « Continuer »', async () => {
    useSession.setState({ status: 'guest', user: null });
    installGameLifecycle();
    const running = gameView({ seed: 'tests', step: 'EXECUTION', result: null });
    useGame.setState({ source: fakeSource(running), view: running, replayOf: null });
    await saves.write(AUTOSAVE_SLOT, saveData('tests'), 'builtin', false);
    expect(await saves.latestResumable(false)).not.toBeNull();

    useGame.setState({ view: { ...running, step: 'ENDED', result: RESULT } });
    await vi.waitFor(async () => expect(await saves.latestResumable(false)).toBeNull());
    expect(await saves.list(false)).toEqual([]);
  });
});

describe('wrapText', () => {
  /** Une lettre = une unité de largeur. */
  const measure = (text: string) => text.length;

  it('coupe le texte entre les mots', () => {
    expect(wrapText(measure, 'Ma startup a été rachetée 400 M€', 12)).toEqual([
      'Ma startup a',
      'été rachetée',
      '400 M€',
    ]);
  });

  it('ignore les espaces multiples et les textes vides', () => {
    expect(wrapText(measure, '  un   deux  ', 100)).toEqual(['un deux']);
    expect(wrapText(measure, '   ', 100)).toEqual([]);
  });

  it('garde un mot trop long sur sa propre ligne', () => {
    expect(wrapText(measure, 'a anticonstitutionnellement b', 5)).toEqual([
      'a',
      'anticonstitutionnellement',
      'b',
    ]);
  });
});
