/**
 * Source de la partie pour l'interface : relie le moteur (Web Worker de la simulation) au
 * modèle de vue. Chaque snapshot du moteur devient un `GameView` ; chaque `GameCommand` de
 * l'interface devient une commande typée de la simulation.
 */
import type { EventCard, GameMode, SaveData, Speed } from '@oss/shared';
import { createGameEngine, type EngineSnapshot, type GameEngine } from '../engine';
import { DEFAULT_CARDS } from '../events/defaultCards';
import { toCommand, toGameView } from './adapter';
import type { CommandResult, GameCommand, GameNotification, GameView } from './types';

export type SourceListener = (view: GameView, notifications: readonly GameNotification[]) => void;

/** Ce dont l'interface a besoin d'une partie en cours. */
export interface GameSource {
  readonly view: GameView;
  dispatch(command: GameCommand): Promise<CommandResult>;
  setSpeed(speed: Speed): void;
  save(): Promise<SaveData>;
  subscribe(listener: SourceListener): () => void;
  dispose(): void;
}

export interface NewGame {
  readonly seed: string;
  readonly mode: GameMode;
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
    game: NewGame | { readonly save: SaveData },
    options: { engine?: GameEngine; cards?: readonly EventCard[] } = {},
  ): Promise<EngineSource> {
    const engine = options.engine ?? createGameEngine();
    const cards = options.cards ?? DEFAULT_CARDS;
    const first = await engine.start(
      'save' in game ? { kind: 'load', save: game.save } : { kind: 'new', ...game },
      cards,
    );
    return new EngineSource(engine, first, cards);
  }

  get view(): GameView {
    return this.current;
  }

  private toView(snapshot: EngineSnapshot): GameView {
    return toGameView(snapshot.state, {
      speed: snapshot.speed,
      running: snapshot.running,
      card: (id) => this.cards.get(id),
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
