import { DecorThemeSettingSchema, type DecorMode, type DecorTheme } from '@oss/shared';
import { z } from 'zod';
import { create } from 'zustand';
import { metaApi } from '../api/meta';
import { localStore } from './storage';

const CACHE_KEY = 'decor:themes';
const CachedSchema = z.array(DecorThemeSettingSchema);

export type DecorModes = Partial<Record<DecorTheme, DecorMode>>;

function toModes(settings: readonly { id: DecorTheme; mode: DecorMode }[]): DecorModes {
  return Object.fromEntries(settings.map((setting) => [setting.id, setting.mode]));
}

async function cached(): Promise<DecorModes> {
  try {
    const parsed = CachedSchema.safeParse(await localStore().get(CACHE_KEY));
    return parsed.success ? toModes(parsed.data) : {};
  } catch {
    return {};
  }
}

/**
 * Réglage des décorations de saison choisi par l'administrateur : celui du serveur (mis en cache
 * pour le hors-ligne), sinon le dernier cache, sinon le réglage par défaut (chaque thème décore
 * le bureau pendant sa période), qui vaut aussi pour le jeu invité sans serveur.
 */
export async function decorModes(): Promise<DecorModes> {
  try {
    const themes = await metaApi.decorThemes();
    await localStore()
      .set(CACHE_KEY, themes)
      .catch(() => undefined);
    return toModes(themes);
  } catch {
    return cached();
  }
}

interface DecorStore {
  readonly modes: DecorModes;
  /** Relit le réglage (au lancement d'une partie, après un changement au back-office). */
  refresh(): Promise<void>;
}

export const useDecorThemes = create<DecorStore>((set) => ({
  modes: {},
  refresh: async () => set({ modes: await decorModes() }),
}));
