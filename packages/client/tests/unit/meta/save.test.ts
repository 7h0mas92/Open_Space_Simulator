import {
  BUILTIN_CARDS_VERSION,
  EVENT_CARDS,
  type CardSetResponse,
  type SaveData,
  type SaveSummary,
} from '@oss/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pendingAchievements } from '../../../src/save/achievements';
import { cardsForVersion, currentCards } from '../../../src/save/cards';
import { AUTOSAVE_SLOT, saves, SLOTS, summarize } from '../../../src/save/saves';
import { localStore, MemoryStore, setLocalStore } from '../../../src/save/storage';
import { bodyOf, calls, mockApi, saveData } from './helpers';

const VERSION = '0123456789abcdef';

/** Le serveur renvoie la sauvegarde qu'on vient de lui envoyer. */
function echoSave(slot: number) {
  return (init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { data: SaveData; cardsVersion: string };
    return Response.json({
      summary: summarize(slot, body.data, body.cardsVersion),
      data: body.data,
    });
  };
}

let store: MemoryStore;

beforeEach(() => {
  store = new MemoryStore();
  setLocalStore(store);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MemoryStore', () => {
  it('lit, écrit, liste par préfixe et supprime', async () => {
    await store.set('save:1', { a: 1 });
    await store.set('save:2', { a: 2 });
    await store.set('cards:current', []);
    expect(await store.get('save:1')).toEqual({ a: 1 });
    expect((await store.keys('save:')).sort()).toEqual(['save:1', 'save:2']);
    await store.delete('save:1');
    expect(await store.get('save:1')).toBeUndefined();
  });

  it('stocke une copie : modifier l’objet d’origine ne change rien', async () => {
    const value = { list: [1, 2] };
    await store.set('k', value);
    value.list.push(3);
    const read = await store.get<{ list: number[] }>('k');
    expect(read).toEqual({ list: [1, 2] });
    read?.list.push(4);
    expect(await store.get('k')).toEqual({ list: [1, 2] });
  });

  it('remplace le stockage partagé de l’application', () => {
    expect(localStore()).toBe(store);
  });
});

describe('saves (hors ligne)', () => {
  it('écrit puis relit une sauvegarde sans appeler le serveur', async () => {
    const fetchMock = mockApi({});
    const data = saveData('offline');
    expect(await saves.write(2, data, BUILTIN_CARDS_VERSION, false)).toBe(false);

    const list = await saves.list(false);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ slot: 2, seed: 'offline', cardsVersion: 'builtin' });
    const loaded = await saves.load(2, false);
    expect(loaded.data).toEqual(data);
    expect(loaded.cardsVersion).toBe(BUILTIN_CARDS_VERSION);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse de charger un emplacement vide', async () => {
    await expect(saves.load(3, false)).rejects.toThrow('Emplacement 3 vide');
  });

  it('ignore une sauvegarde locale corrompue', async () => {
    await store.set('save:4', { summary: {}, data: { state: 'pas un état' }, synced: false });
    expect(await saves.list(false)).toEqual([]);
  });

  it('supprime une sauvegarde', async () => {
    await saves.write(AUTOSAVE_SLOT, saveData(), BUILTIN_CARDS_VERSION, false);
    await saves.remove(AUTOSAVE_SLOT, false);
    expect(await saves.list(false)).toEqual([]);
  });

  it('propose un emplacement auto et quatre manuels', () => {
    expect(SLOTS).toEqual([1, 2, 3, 4, 5]);
    expect(AUTOSAVE_SLOT).toBe(1);
  });
});

describe('saves (connecté)', () => {
  it('envoie la sauvegarde au serveur et la marque synchronisée', async () => {
    const fetchMock = mockApi({ 'PUT /api/saves/2': echoSave(2) });
    const data = saveData('online');
    expect(await saves.write(2, data, VERSION, true)).toBe(true);
    expect(bodyOf(fetchMock, 'PUT /api/saves/2')).toEqual({ data, cardsVersion: VERSION });
    expect(await store.get('save:2')).toMatchObject({ synced: true });
  });

  it('garde la sauvegarde sur l’appareil si le réseau tombe', async () => {
    mockApi({});
    expect(await saves.write(2, saveData(), VERSION, true)).toBe(false);
    expect(await store.get('save:2')).toMatchObject({ synced: false });
  });

  it('fusionne la liste du serveur avec les sauvegardes locales non envoyées', async () => {
    const remote = (slot: number, seed: string): SaveSummary => ({
      ...summarize(slot, saveData(seed), VERSION),
    });
    mockApi({
      'GET /api/saves': () =>
        Response.json({ saves: [remote(3, 'serveur-3'), remote(2, 'serveur-2')] }),
    });
    await saves.write(2, saveData('local-2'), VERSION, false);

    const list = await saves.list(true);
    expect(list.map((s) => [s.slot, s.seed])).toEqual([
      [2, 'local-2'],
      [3, 'serveur-3'],
    ]);
  });

  it('retombe sur la liste locale si le serveur est injoignable', async () => {
    mockApi({});
    await saves.write(5, saveData('local-5'), VERSION, false);
    expect((await saves.list(true)).map((s) => s.seed)).toEqual(['local-5']);
  });

  it('charge depuis le serveur, sauf si la copie locale est plus récente', async () => {
    const serverData = saveData('serveur');
    const fetchMock = mockApi({
      'GET /api/saves/1': () =>
        Response.json({ summary: summarize(1, serverData, VERSION), data: serverData }),
    });
    expect((await saves.load(1, true)).data.state.seed).toBe('serveur');

    await saves.write(1, saveData('local'), VERSION, false);
    fetchMock.mockClear();
    expect((await saves.load(1, true)).data.state.seed).toBe('local');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('charge la copie locale si le serveur est injoignable', async () => {
    mockApi({ 'PUT /api/saves/1': echoSave(1) });
    await saves.write(1, saveData('synchro'), VERSION, true);
    expect((await saves.load(1, true)).data.state.seed).toBe('synchro');
  });

  it('supprime aussi sur le serveur, sans échouer s’il est injoignable', async () => {
    const fetchMock = mockApi({ 'DELETE /api/saves/2': () => Response.json({ ok: true }) });
    await saves.write(2, saveData(), VERSION, false);
    await saves.remove(2, true);
    expect(calls(fetchMock)).toContain('DELETE /api/saves/2');
    mockApi({});
    await expect(saves.remove(3, true)).resolves.toBeUndefined();
  });
});

describe('saves.syncPending', () => {
  it('envoie les sauvegardes faites hors ligne', async () => {
    await saves.write(2, saveData('a'), VERSION, false);
    await saves.write(4, saveData('b'), VERSION, false);
    const fetchMock = mockApi({ 'PUT /api/saves/2': echoSave(2), 'PUT /api/saves/4': echoSave(4) });

    expect(await saves.syncPending()).toBe(2);
    expect(calls(fetchMock)).toEqual(['PUT /api/saves/2', 'PUT /api/saves/4']);
    expect(await store.get('save:4')).toMatchObject({ synced: true });
    // Plus rien à envoyer ensuite.
    expect(await saves.syncPending()).toBe(0);
  });

  it('s’arrête à la première erreur réseau', async () => {
    await saves.write(2, saveData('a'), VERSION, false);
    await saves.write(4, saveData('b'), VERSION, false);
    const fetchMock = mockApi({});
    expect(await saves.syncPending()).toBe(0);
    expect(calls(fetchMock)).toEqual(['PUT /api/saves/2']);
    expect(await store.get('save:2')).toMatchObject({ synced: false });
  });
});

describe('pendingAchievements', () => {
  it('garde les succès sans doublon', async () => {
    await pendingAchievements.add(['duck-lead', 'zero-meeting']);
    await pendingAchievements.add(['duck-lead']);
    await pendingAchievements.add([]);
    expect(await pendingAchievements.all()).toEqual(['duck-lead', 'zero-meeting']);
  });

  it('envoie les succès au serveur puis vide la liste', async () => {
    const fetchMock = mockApi({
      'POST /api/achievements/unlock': () => Response.json({ unlocked: ['duck-lead'] }),
    });
    await pendingAchievements.add(['duck-lead', 'zero-meeting']);
    expect(await pendingAchievements.sync()).toEqual(['duck-lead']);
    expect(bodyOf(fetchMock, 'POST /api/achievements/unlock')).toEqual({
      ids: ['duck-lead', 'zero-meeting'],
    });
    expect(await pendingAchievements.all()).toEqual([]);
  });

  it('garde un succès débloqué pendant l’envoi', async () => {
    mockApi({
      'POST /api/achievements/unlock': () => {
        void pendingAchievements.add(['office-dog']);
        return Response.json({ unlocked: ['duck-lead'] });
      },
    });
    await pendingAchievements.add(['duck-lead']);
    await pendingAchievements.sync();
    await vi.waitFor(async () => expect(await pendingAchievements.all()).toEqual(['office-dog']));
  });

  it('n’appelle pas le serveur sans succès en attente', async () => {
    const fetchMock = mockApi({});
    expect(await pendingAchievements.sync()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('garde les succès si l’envoi échoue', async () => {
    mockApi({});
    await pendingAchievements.add(['duck-lead']);
    await expect(pendingAchievements.sync()).rejects.toThrow();
    expect(await pendingAchievements.all()).toEqual(['duck-lead']);
  });
});

describe('cartes d’événements', () => {
  const serverSet: CardSetResponse = { version: VERSION, cards: EVENT_CARDS.slice(0, 3) };

  it('prend les cartes du serveur et les met en cache', async () => {
    mockApi({ 'GET /api/events': () => Response.json(serverSet) });
    expect(await currentCards()).toEqual(serverSet);
    expect(await store.get('cards:current')).toEqual(serverSet);
    expect(await store.get(`cards:${VERSION}`)).toEqual(serverSet);
  });

  it('hors ligne, reprend le dernier jeu de cartes en cache', async () => {
    await store.set('cards:current', serverSet);
    mockApi({});
    expect(await currentCards()).toEqual(serverSet);
  });

  it('sans réseau ni cache, joue avec les 100 cartes intégrées', async () => {
    mockApi({});
    const set = await currentCards();
    expect(set.version).toBe(BUILTIN_CARDS_VERSION);
    expect(set.cards).toHaveLength(EVENT_CARDS.length);
  });

  it('ignore un cache corrompu', async () => {
    await store.set('cards:current', { version: 'nimporte', cards: 'non' });
    mockApi({});
    expect((await currentCards()).version).toBe(BUILTIN_CARDS_VERSION);
  });

  it('retrouve les cartes exactes d’une version', async () => {
    const fetchMock = mockApi({
      [`GET /api/events?version=${VERSION}`]: () => Response.json(serverSet),
    });
    expect(await cardsForVersion(BUILTIN_CARDS_VERSION)).toMatchObject({ version: 'builtin' });
    expect(fetchMock).not.toHaveBeenCalled();

    expect(await cardsForVersion(VERSION)).toEqual(serverSet);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Deuxième fois : depuis le cache, sans réseau.
    expect(await cardsForVersion(VERSION)).toEqual(serverSet);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('échoue si une version inconnue n’est ni en cache ni joignable', async () => {
    mockApi({});
    await expect(cardsForVersion('fedcba9876543210')).rejects.toThrow();
  });
});
