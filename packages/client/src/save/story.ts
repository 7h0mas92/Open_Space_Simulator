import {
  MissionCompletionSchema,
  SaveDataSchema,
  type SaveData,
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

const CHECKPOINTS_KEY = 'story:checkpoints';

/** Point de sauvegarde d'un acte de la longue partie : la partie à la 1re planification de l'acte. */
export interface ActCheckpoint {
  readonly act: number;
  readonly data: SaveData;
  readonly cardsVersion: string;
}

const CheckpointsSchema = z.object({
  seed: z.string(),
  acts: z.array(
    z.object({ act: z.number().int().min(0), data: SaveDataSchema, cardsVersion: z.string() }),
  ),
});
type Checkpoints = z.infer<typeof CheckpointsSchema>;

async function readCheckpoints(): Promise<Checkpoints | null> {
  const parsed = CheckpointsSchema.safeParse(await localStore().get(CHECKPOINTS_KEY));
  return parsed.success ? parsed.data : null;
}

/**
 * Points de sauvegarde de la longue partie du mode Histoire, sur l'appareil : un par acte, pour
 * reprendre un acte raté sans rejouer toute l'histoire. Une seule histoire est gardée : en
 * commencer une nouvelle efface les points de la précédente.
 */
export const storyCheckpoints = {
  /** Points de l'histoire en cours (la plus récente), du prologue au dernier acte atteint. */
  async list(): Promise<{ seed: string; acts: ActCheckpoint[] } | null> {
    const saved = await readCheckpoints();
    if (!saved) return null;
    return { seed: saved.seed, acts: [...saved.acts].sort((a, b) => a.act - b.act) };
  },

  /** Vrai si l'acte de cette histoire a déjà son point de sauvegarde. */
  async has(seed: string, act: number): Promise<boolean> {
    const saved = await readCheckpoints();
    return saved?.seed === seed && saved.acts.some((c) => c.act === act);
  },

  /** Reprend un acte : renvoie son point de sauvegarde et oublie ceux des actes suivants. */
  async resume(act: number): Promise<ActCheckpoint | null> {
    const saved = await readCheckpoints();
    const checkpoint = saved?.acts.find((c) => c.act === act);
    if (!saved || !checkpoint) return null;
    await localStore().set(CHECKPOINTS_KEY, {
      seed: saved.seed,
      acts: saved.acts.filter((c) => c.act <= act),
    });
    return checkpoint;
  },

  /** Garde le point de sauvegarde d'un acte (remplace ceux des actes suivants, rejoués). */
  async keep(seed: string, checkpoint: ActCheckpoint): Promise<void> {
    const saved = await readCheckpoints();
    const acts = saved?.seed === seed ? saved.acts.filter((c) => c.act < checkpoint.act) : [];
    await localStore().set(CHECKPOINTS_KEY, { seed, acts: [...acts, checkpoint] });
  },
};
