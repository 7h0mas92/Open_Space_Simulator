import type { GameMode, GameState, LoggedCommand, StoryStart, StoryRewardId } from '@oss/shared';
import type { CardLibrary } from '../events/library';
import { Simulation } from './simulation';

export class ReplayError extends Error {
  constructor(
    message: string,
    /** Index de la commande qui n'a pas pu être rejouée. */
    readonly commandIndex: number,
  ) {
    super(message);
    this.name = 'ReplayError';
  }
}

export interface ReplayOptions {
  seed: string;
  mode: GameMode;
  /** Mode Histoire : la mission jouée. */
  mission?: StoryStart;
  /** Récompenses du mode Histoire utilisées par la partie (son point de départ). */
  unlocks?: readonly StoryRewardId[];
  commands: readonly LoggedCommand[];
  cards: CardLibrary;
  /** Appelé après chaque tick (pour afficher un replay au ralenti, par exemple). */
  onTick?: (state: GameState) => void;
}

/**
 * Rejoue une partie à partir de sa graine et de ses commandes. Comme la simulation
 * est déterministe, on retombe exactement sur le même état final : c'est la base
 * des replays et de la vérification des scores côté serveur (anti-triche).
 */
export function replay({
  seed,
  mode,
  mission,
  unlocks,
  commands,
  cards,
  onTick,
}: ReplayOptions): Simulation {
  const simulation = Simulation.create(
    { seed, mode, ...(mission ? { mission } : {}), ...(unlocks ? { unlocks } : {}) },
    cards,
  );
  commands.forEach((entry, index) => {
    while (simulation.state.tick < entry.tick) {
      if (!simulation.isRunning) {
        throw new ReplayError(
          `Partie bloquée au tick ${simulation.state.tick}, commande attendue au tick ${entry.tick}`,
          index,
        );
      }
      simulation.step();
      onTick?.(simulation.state);
    }
    if (simulation.state.tick !== entry.tick) {
      throw new ReplayError(
        `Commande prévue au tick ${entry.tick}, partie déjà au tick ${simulation.state.tick}`,
        index,
      );
    }
    const { result } = simulation.dispatch(entry.command);
    if (!result.ok)
      throw new ReplayError(`Commande ${entry.command.type} refusée : ${result.error}`, index);
  });
  // Après la dernière commande, la partie continue jusqu'au prochain blocage.
  while (simulation.isRunning) {
    simulation.step();
    onTick?.(simulation.state);
  }
  return simulation;
}
