import { CharacterPackIdSchema, type CharacterPackId } from '@oss/shared';
import { z } from 'zod';
import { create } from 'zustand';
import { metaApi } from '../api/meta';
import { localStore } from './storage';

const CACHE_KEY = 'packs:enabled';
const CachedPacksSchema = z.array(CharacterPackIdSchema);

async function cached(): Promise<CharacterPackId[]> {
  try {
    const parsed = CachedPacksSchema.safeParse(await localStore().get(CACHE_KEY));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/**
 * Packs de personnages activés par l'administrateur : ceux du serveur (mis en cache pour le
 * hors-ligne), sinon le dernier cache, sinon aucun.
 */
export async function enabledCharacterPacks(): Promise<CharacterPackId[]> {
  try {
    const enabled = (await metaApi.characterPacks())
      .filter((pack) => pack.enabled)
      .map((pack) => pack.id);
    await localStore()
      .set(CACHE_KEY, enabled)
      .catch(() => undefined);
    return enabled;
  } catch {
    return cached();
  }
}

interface CharacterPacksStore {
  readonly enabled: readonly CharacterPackId[];
  /** Relit les packs actifs (au lancement d'une partie, après un changement au back-office). */
  refresh(): Promise<void>;
}

export const useCharacterPacks = create<CharacterPacksStore>((set) => ({
  enabled: [],
  refresh: async () => set({ enabled: await enabledCharacterPacks() }),
}));
