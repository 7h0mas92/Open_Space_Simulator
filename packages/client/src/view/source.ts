/**
 * Source de la partie pour l'interface : relie le moteur (Web Worker de la simulation) au
 * modèle de vue. Chaque snapshot du moteur devient un `GameView` ; chaque `GameCommand` de
 * l'interface devient une commande typée de la simulation.
 */
import {
  BUILTIN_CARDS_VERSION,
  type EventCard,
  type GameMode,
  type LoggedCommand,
  type SaveData,
  type Speed,
  type StoryStart,
  type StoryRewardId,
} from '@oss/shared';
import { createGameEngine, type EngineSnapshot, type GameEngine, type GameStart } from '../engine';
import { DEFAULT_CARDS } from '../events/defaultCards';
import { toCommand, toGameView } from './adapter';
import type { CommandResult, GameCommand, GameNotification, GameView } from './types';

export type SourceListener = (view: GameView, notifications: readonly GameNotification[]) => void;

/** Ce dont l'interface a besoin d'une partie en cours. */
export interface GameSource {
  readonly view: GameView;
  /** Version du jeu de cartes de la partie (sauvegardes, publication du score). */
  readonly cardsVersion: string;
  dispatch(command: GameCommand): Promise<CommandResult>;
  setSpeed(speed: Speed): void;
  save(): Promise<SaveData>;
  subscribe(listener: SourceListener): () => void;
  dispose(): void;
}

export interface NewGame {
  readonly seed: string;
  readonly mode: GameMode;
  /** Mode Histoire : la mission jouée. */
  readonly mission?: StoryStart;
  /** Récompenses du mode Histoire débloquées par le joueur. */
  readonly unlocks?: readonly StoryRewardId[];
}

/** Revoir une partie du classement à partir de sa graine et de ses commandes. */
export interface ReplayGame extends NewGame {
  readonly commands: readonly LoggedCommand[];
}

export type SourceStart = NewGame | ReplayGame | { readonly save: SaveData };

function toGameStart(game: SourceStart): GameStart {
  if ('save' in game) return { kind: 'load', save: game.save };
  if ('commands' in game) return { kind: 'replay', ...game };
  return { kind: 'new', ...game };
}

export class EngineSource implements GameSource {
  private current: GameView;
  private readonly listeners = new Set<SourceListener>();
  private readonly cards: Map<string, EventCard>;
  private readonly unsubscribe: () => void;

  private constructor(
    private readonly engine: GameEngine,
    first: EngineSnapshot,
    cards: readonly EventCard[],
    readonly cardsVersion: string,
  ) {
    this.cards = new Map(cards.map((card) => [card.id, card]));
    this.current = this.toView(first);
    this.unsubscribe = engine.subscribe((snapshot) => {
      this.current = this.toView(snapshot);
      for (const listener of this.listeners) listener(this.current, snapshot.notifications);
    });
  }

  /** Démarre une partie. `engine` est injectable pour les tests. */
  static async start(
    game: SourceStart,
    options: { engine?: GameEngine; cards?: readonly EventCard[]; cardsVersion?: string } = {},
  ): Promise<EngineSource> {
    const engine = options.engine ?? createGameEngine();
    const cards = options.cards ?? DEFAULT_CARDS;
    const first = await engine.start(toGameStart(game), cards);
    return new EngineSource(engine, first, cards, options.cardsVersion ?? BUILTIN_CARDS_VERSION);
  }

  get view(): GameView {
    return this.current;
  }

  private toView(snapshot: EngineSnapshot): GameView {
    return toGameView(snapshot.state, {
      speed: snapshot.speed,
      running: snapshot.running,
      tickDurationMs: snapshot.tickDurationMs,
      receivedAt: performance.now(),
      card: (id) => this.cards.get(id),
      replay: snapshot.replay,
    });
  }

  async dispatch(command: GameCommand): Promise<CommandResult> {
    if (command.type === 'setSpeed') {
      this.setSpeed(command.speed);
      return { ok: true };
    }
    const simCommand = toCommand(command, this.current);
    if (!simCommand) return { ok: false, reason: 'INVALID_COMMAND' };
    const result = await this.engine.dispatch(simCommand);
    return result.ok ? { ok: true } : { ok: false, reason: result.error };
  }

  setSpeed(speed: Speed): void {
    this.engine.setSpeed(speed);
  }

  save(): Promise<SaveData> {
    return this.engine.save();
  }

  subscribe(listener: SourceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.unsubscribe();
    this.listeners.clear();
    this.engine.dispose();
  }
}
