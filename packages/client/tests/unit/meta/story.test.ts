import type { MissionCompletion } from '@oss/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStore, setLocalStore } from '../../../src/save/storage';
import { storyProgress } from '../../../src/save/story';
import { calls, mockApi } from './helpers';

function completion(missionId: MissionCompletion['missionId']): MissionCompletion {
  return { missionId, seed: `seed-${missionId}`, commands: [], cardsVersion: 'builtin' };
}

function progress(completed: string[]) {
  return () => Response.json({ completed, unlocks: [] });
}

beforeEach(() => setLocalStore(new MemoryStore()));
afterEach(() => vi.unstubAllGlobals());

describe('Progression du mode Histoire', () => {
  it('garde les missions réussies sur l’appareil, dans l’ordre de la campagne', async () => {
    expect(await storyProgress.completed()).toEqual([]);
    await storyProgress.complete(completion('coffee-first'));
    await storyProgress.complete(completion('first-commit'));
    await storyProgress.complete(completion('first-commit'));
    expect(await storyProgress.completed()).toEqual(['first-commit', 'coffee-first']);
    expect(await storyProgress.unlocks()).toEqual(['wall-blueprint', 'perk-espresso']);
  });

  it('envoie les missions en attente, puis fusionne avec le compte', async () => {
    await storyProgress.complete(completion('first-commit'));
    const fetchMock = mockApi({
      'POST /api/story/complete': progress(['first-commit']),
      'GET /api/story': progress(['first-commit', 'coffee-first']),
    });
    expect(await storyProgress.sync()).toEqual(['first-commit', 'coffee-first']);
    expect(calls(fetchMock)).toEqual(['POST /api/story/complete', 'GET /api/story']);
    // Plus rien en attente : la synchronisation suivante ne renvoie rien.
    fetchMock.mockClear();
    await storyProgress.sync();
    expect(calls(fetchMock)).toEqual(['GET /api/story']);
  });

  it('une mission refusée reste réussie sur l’appareil, sans être renvoyée', async () => {
    await storyProgress.complete(completion('first-commit'));
    const refusal = () =>
      Response.json({ error: { code: 'MISSION_NOT_COMPLETED', message: 'non' } }, { status: 422 });
    const fetchMock = mockApi({
      'POST /api/story/complete': refusal,
      'GET /api/story': progress([]),
    });
    expect(await storyProgress.sync()).toEqual(['first-commit']);
    fetchMock.mockClear();
    await storyProgress.sync();
    expect(calls(fetchMock)).toEqual(['GET /api/story']);
  });

  it('hors ligne, la mission reste en attente', async () => {
    await storyProgress.complete(completion('first-commit'));
    mockApi({});
    await expect(storyProgress.sync()).rejects.toThrow();
    const fetchMock = mockApi({
      'POST /api/story/complete': progress(['first-commit']),
      'GET /api/story': progress(['first-commit']),
    });
    await storyProgress.sync();
    expect(calls(fetchMock)).toContain('POST /api/story/complete');
  });
});
