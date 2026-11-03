import type {
  Command,
  LoggedCommand,
  CommandResult,
  EventCard,
  GameMode,
  GameState,
  Notification,
  SaveData,
  Speed,
  StoryStart,
  StoryRewardId,
} from '@oss/shared';

/**
 * Messages échangés entre le thread principal (rendu + UI) et le Web Worker (simulation).
 * Tout passe par `postMessage` : les deux côtés ne partagent jamais d'objet.
 */

/** Point de départ d'une partie : graine, mode, mission du mode Histoire et récompenses. */
export interface GameSetup {
  seed: string;
  mode: GameMode;
  mission?: StoryStart;
  unlocks?: readonly StoryRewardId[];
}

export type GameStart =
  | ({ kind: 'new' } & GameSetup)
  | { kind: 'load'; save: SaveData }
  /** Revoir une partie : la simulation rejoue elle-même les commandes à leur tick. */
  | ({ kind: 'replay'; commands: readonly LoggedCommand[] } & GameSetup);

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
  /** Replay en cours : commandes déjà rejouées sur le total (null hors replay). */
  replay: { played: number; total: number } | null;
}

export type WorkerToMain =
  | ({ type: 'snapshot' } & EngineSnapshot)
  | { type: 'commandResult'; id: number; result: CommandResult }
  | { type: 'save'; id: number; save: SaveData }
  | { type: 'error'; message: string };
