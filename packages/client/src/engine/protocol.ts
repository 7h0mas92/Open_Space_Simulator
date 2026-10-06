import type {
  Command,
  CommandResult,
  EventCard,
  GameMode,
  GameState,
  Notification,
  SaveData,
  Speed,
} from '@oss/shared';

/**
 * Messages échangés entre le thread principal (rendu + UI) et le Web Worker (simulation).
 * Tout passe par `postMessage` : les deux côtés ne partagent jamais d'objet.
 */

export type GameStart =
  { kind: 'new'; seed: string; mode: GameMode } | { kind: 'load'; save: SaveData };

export type MainToWorker =
  | { type: 'init'; cards: readonly EventCard[]; game: GameStart }
  | { type: 'command'; id: number; command: Command }
  | { type: 'setSpeed'; speed: Speed }
  | { type: 'save'; id: number };

/** Ce que le rendu et l'UI reçoivent après chaque lot de ticks ou chaque commande. */
export interface EngineSnapshot {
  state: GameState;
  /** Notifications émises depuis le snapshot précédent (effets visuels, Slack). */
  notifications: Notification[];
  speed: Speed;
  /** Faux si la simulation attend le joueur (planification, carte, démo, fin). */
  running: boolean;
  /** Durée réelle d'un tick à la vitesse actuelle, pour interpoler les positions. */
  tickDurationMs: number;
}

export type WorkerToMain =
  | ({ type: 'snapshot' } & EngineSnapshot)
  | { type: 'commandResult'; id: number; result: CommandResult }
  | { type: 'save'; id: number; save: SaveData }
  | { type: 'error'; message: string };
