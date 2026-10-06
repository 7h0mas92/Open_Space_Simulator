import { metaApi } from '../api/meta';
import { localStore } from './storage';

const KEY = 'achievements:pending';

/**
 * Succès débloqués en jeu mais pas encore enregistrés sur le serveur (invité, hors ligne,
 * partie abandonnée). Ils sont envoyés à POST /achievements/unlock dès que possible.
 */
export const pendingAchievements = {
  async add(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    const current = (await localStore().get<string[]>(KEY)) ?? [];
    await localStore().set(KEY, [...new Set([...current, ...ids])]);
  },

  async all(): Promise<string[]> {
    return (await localStore().get<string[]>(KEY)) ?? [];
  },

  /** Envoie les succès en attente ; renvoie ceux que le serveur vient de débloquer. */
  async sync(): Promise<string[]> {
    const ids = await this.all();
    if (ids.length === 0) return [];
    const unlocked = await metaApi.unlockAchievements(ids);
    await localStore().delete(KEY);
    return unlocked;
  },
};
