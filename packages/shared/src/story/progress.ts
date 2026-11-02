import { z } from 'zod';
import { CommandLogSchema } from '../sim/commands.js';
import { CardsVersionSchema } from '../meta/api.js';
import { STORY_MISSION_IDS, StoryMissionIdSchema } from './campaign.js';
import { StoryRewardIdSchema } from './rewards.js';

/**
 * Contrats de l'API du mode Histoire (/api/story). Une mission réussie n'est gardée sur le
 * compte qu'après rejeu par le serveur de sa graine et de ses commandes, comme un score :
 * personne ne débloque une récompense sans avoir vraiment gagné la mission.
 */

/** Une mission réussie, telle que le client la garde pour l'envoyer au serveur. */
export const MissionCompletionSchema = z.object({
  missionId: StoryMissionIdSchema,
  seed: z.string().min(1).max(64),
  commands: CommandLogSchema,
  cardsVersion: CardsVersionSchema,
});
export type MissionCompletion = z.infer<typeof MissionCompletionSchema>;

export const StoryProgressResponseSchema = z.object({
  /** Missions réussies, dans l'ordre de la campagne. */
  completed: z.array(StoryMissionIdSchema).max(STORY_MISSION_IDS.length),
  /** Récompenses débloquées par ces missions. */
  unlocks: z.array(StoryRewardIdSchema),
});
export type StoryProgressResponse = z.infer<typeof StoryProgressResponseSchema>;
