import {
  MissionCompletionSchema,
  STORY_MISSION_IDS,
  StoryMissionIdSchema,
  storyUnlocks,
  type MissionCompletion,
  type StoryMissionId,
  type StoryRewardId,
} from '@oss/shared';
import { z } from 'zod';
import { ApiRequestError } from '../api/client';
import { metaApi } from '../api/meta';
import { localStore } from './storage';

const KEY = 'story:progress';

/**
 * Progression du mode Histoire gardée sur l'appareil : les missions réussies, et celles pas
 * encore envoyées au serveur (invité, hors ligne). Connecté, chaque mission en attente est
 * envoyée à POST /story/complete, qui la rejoue avant de la garder sur le compte.
 */
const LocalProgressSchema = z.object({
  completed: z.array(StoryMissionIdSchema),
  pending: z.array(MissionCompletionSchema),
});
type LocalProgress = z.infer<typeof LocalProgressSchema>;

const EMPTY: LocalProgress = { completed: [], pending: [] };

/** Missions dans l'ordre de la campagne, sans doublon. */
function inOrder(ids: readonly string[]): StoryMissionId[] {
  return STORY_MISSION_IDS.filter((id) => ids.includes(id));
}

async function read(): Promise<LocalProgress> {
  const parsed = LocalProgressSchema.safeParse(await localStore().get(KEY));
  return parsed.success ? parsed.data : EMPTY;
}

async function write(progress: LocalProgress): Promise<void> {
  await localStore().set(KEY, progress);
}

export const storyProgress = {
  /** Missions réussies sur cet appareil (et sur le compte, après une synchronisation). */
  async completed(): Promise<StoryMissionId[]> {
    return (await read()).completed;
  },

  /** Récompenses débloquées, à passer à chaque nouvelle partie. */
  async unlocks(): Promise<StoryRewardId[]> {
    return storyUnlocks(await this.completed());
  },

  /** Note une mission réussie (avec de quoi la rejouer) et renvoie la progression. */
  async complete(completion: MissionCompletion): Promise<StoryMissionId[]> {
    const progress = await read();
    const pending = progress.pending.filter((p) => p.missionId !== completion.missionId);
    const next = {
      completed: inOrder([...progress.completed, completion.missionId]),
      pending: [...pending, completion],
    };
    await write(next);
    return next.completed;
  },

  /**
   * Envoie les missions en attente, puis fusionne avec la progression du compte (une partie
   * jouée sur un autre appareil revient ici). Une mission refusée par le serveur reste réussie
   * sur cet appareil, mais n'est plus renvoyée.
   */
  async sync(): Promise<StoryMissionId[]> {
    const progress = await read();
    const sent = new Set<StoryMissionId>();
    let account: readonly StoryMissionId[] = [];
    for (const completion of progress.pending) {
      try {
        account = (await metaApi.completeMission(completion)).completed;
        sent.add(completion.missionId);
      } catch (error) {
        // Réseau coupé : on réessaiera plus tard. Refus (rejeu impossible) : on abandonne.
        if (!(error instanceof ApiRequestError) || error.status === 0 || error.status >= 500)
          throw error;
        sent.add(completion.missionId);
      }
    }
    if (progress.pending.length === 0 || sent.size > 0)
      account = (await metaApi.storyProgress()).completed;
    // On relit : une mission réussie pendant l'envoi est gardée.
    const latest = await read();
    const next = {
      completed: inOrder([...latest.completed, ...account]),
      pending: latest.pending.filter((p) => !sent.has(p.missionId)),
    };
    await write(next);
    return next.completed;
  },
};
