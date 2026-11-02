/**
 * Progression du mode Histoire pour l'interface (Zustand) : missions réussies, lues sur
 * l'appareil puis complétées par le compte quand le joueur est connecté.
 */
import type { MissionCompletion, StoryMissionId } from '@oss/shared';
import { create } from 'zustand';
import { storyProgress } from '../../save/story';

interface StoryStore {
  completed: readonly StoryMissionId[];
  loaded: boolean;
  /** Relit la progression gardée sur l'appareil. */
  load(): Promise<void>;
  /** Mission réussie : gardée sur l'appareil, envoyée au serveur si `online`. */
  complete(completion: MissionCompletion, online: boolean): Promise<void>;
  /** Envoie les missions en attente et récupère celles du compte. */
  sync(): Promise<void>;
}

export const useStory = create<StoryStore>((set, get) => ({
  completed: [],
  loaded: false,

  async load() {
    set({ completed: await storyProgress.completed(), loaded: true });
  },

  async complete(completion, online) {
    set({ completed: await storyProgress.complete(completion), loaded: true });
    if (online) await get().sync();
  },

  async sync() {
    try {
      set({ completed: await storyProgress.sync(), loaded: true });
    } catch {
      // Hors ligne : la progression de l'appareil suffit, on réessaiera à la prochaine connexion.
      await get().load();
    }
  },
}));
