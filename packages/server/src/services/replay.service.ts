import {
  type EventCard,
  type GameMode,
  type GameResult,
  type GameState,
  type LoggedCommand,
  type StoryMissionId,
  type StoryRewardId,
} from '@oss/shared';
import { CardLibrary, replay, ReplayError } from '@oss/client/simulation';
import { AppError } from '../lib/errors.js';

export interface VerifiedGame {
  state: GameState;
  result: GameResult;
}

/**
 * Anti-triche : rejoue la partie à partir de sa graine et de ses commandes, avec la
 * simulation du client (TypeScript pur, déterministe). Le score enregistré est celui que
 * le serveur obtient, jamais celui que le client annonce.
 */
export function verifyGame(input: {
  seed: string;
  mode: GameMode;
  /** Mode Histoire : la mission jouée. */
  mission?: StoryMissionId;
  /** Récompenses du mode Histoire utilisées par la partie (déjà vérifiées par l'appelant). */
  unlocks?: readonly StoryRewardId[];
  commands: readonly LoggedCommand[];
  cards: readonly EventCard[];
}): VerifiedGame {
  let state: GameState;
  try {
    state = replay({ ...input, cards: new CardLibrary(input.cards) }).state;
  } catch (error) {
    if (error instanceof ReplayError) {
      throw new AppError(
        422,
        'REPLAY_REJECTED',
        `Rejeu impossible (commande n°${error.commandIndex + 1}) : ${error.message}`,
      );
    }
    throw error;
  }
  if (!state.result) throw new AppError(422, 'GAME_NOT_FINISHED', 'La partie n’est pas terminée');
  return { state, result: state.result };
}

/**
 * Mode Histoire : rejoue une mission et vérifie qu'elle est vraiment réussie. Une mission
 * perdue (ou une partie d'un autre mode) ne débloque rien.
 */
export function verifyMission(input: {
  missionId: StoryMissionId;
  seed: string;
  commands: readonly LoggedCommand[];
  cards: readonly EventCard[];
}): VerifiedGame {
  const verified = verifyGame({
    seed: input.seed,
    mode: 'STORY',
    mission: input.missionId,
    commands: input.commands,
    cards: input.cards,
  });
  const mission = verified.result.mission;
  if (!mission || mission.id !== input.missionId || !mission.success)
    throw new AppError(422, 'MISSION_NOT_COMPLETED', 'La mission n’est pas réussie au rejeu');
  return verified;
}
