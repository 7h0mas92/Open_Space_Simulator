import type { Command, CommandResult, EventCard, SaveData, Speed } from '@oss/shared';
import { SimulationHost } from './host';
import type { EngineSnapshot, GameStart, MainToWorker, WorkerToMain } from './protocol';

/** Le minimum d'un Worker dont le moteur a besoin (un vrai Worker, ou un faux pour les tests). */
export interface WorkerLike {
  postMessage(message: MainToWorker): void;
  onmessage: ((event: MessageEvent<WorkerToMain>) => void) | null;
  terminate(): void;
}

export type SnapshotListener = (snapshot: EngineSnapshot) => void;

/**
 * API du moteur côté thread principal. L'UI (Zustand) et le rendu (Three.js) ne
 * parlent à la simulation QUE par cet objet : commandes typées dans un sens,
 * snapshots en lecture seule dans l'autre.
 */
export interface GameEngine {
  /** Démarre une partie (nouvelle ou chargée). Résout au premier snapshot. */
  start(game: GameStart, cards: readonly EventCard[]): Promise<EngineSnapshot>;
  dispatch(command: Command): Promise<CommandResult>;
  setSpeed(speed: Speed): void;
  /** Sauvegarde instantanée : l'état et le journal des commandes. */
  save(): Promise<SaveData>;
  /** Dernier snapshot reçu (null avant le démarrage). */
  readonly snapshot: EngineSnapshot | null;
  subscribe(listener: SnapshotListener): () => void;
  /** Erreurs remontées par le worker. */
  onError(listener: (message: string) => void): () => void;
  dispose(): void;
}

class WorkerGameEngine implements GameEngine {
  private nextId = 1;
  private readonly results = new Map<number, (result: CommandResult) => void>();
  private readonly saves = new Map<number, (save: SaveData) => void>();
  private readonly listeners = new Set<SnapshotListener>();
  private readonly errorListeners = new Set<(message: string) => void>();
  private firstSnapshot: ((snapshot: EngineSnapshot) => void) | null = null;
  private latest: EngineSnapshot | null = null;

  constructor(private readonly worker: WorkerLike) {
    worker.onmessage = (event) => this.receive(event.data);
  }

  get snapshot(): EngineSnapshot | null {
    return this.latest;
  }

  private receive(message: WorkerToMain): void {
    switch (message.type) {
      case 'snapshot': {
        const snapshot: EngineSnapshot = {
          state: message.state,
          notifications: message.notifications,
          speed: message.speed,
          running: message.running,
          tickDurationMs: message.tickDurationMs,
          replay: message.replay,
        };
        this.latest = snapshot;
        this.firstSnapshot?.(snapshot);
        this.firstSnapshot = null;
        for (const listener of this.listeners) listener(snapshot);
        break;
      }
      case 'commandResult':
        this.results.get(message.id)?.(message.result);
        this.results.delete(message.id);
        break;
      case 'save':
        this.saves.get(message.id)?.(message.save);
        this.saves.delete(message.id);
        break;
      case 'error':
        for (const listener of this.errorListeners) listener(message.message);
        break;
    }
  }

  start(game: GameStart, cards: readonly EventCard[]): Promise<EngineSnapshot> {
    return new Promise((resolve) => {
      this.firstSnapshot = resolve;
      this.worker.postMessage({ type: 'init', cards, game });
    });
  }

  dispatch(command: Command): Promise<CommandResult> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.results.set(id, resolve);
      this.worker.postMessage({ type: 'command', id, command });
    });
  }

  setSpeed(speed: Speed): void {
    this.worker.postMessage({ type: 'setSpeed', speed });
  }

  save(): Promise<SaveData> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.saves.set(id, resolve);
      this.worker.postMessage({ type: 'save', id });
    });
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onError(listener: (message: string) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  dispose(): void {
    this.worker.terminate();
    this.listeners.clear();
    this.errorListeners.clear();
  }
}

/**
 * « Worker » qui tourne sur le thread principal : même protocole, mêmes copies des
 * messages (structuredClone), mais sans thread séparé. Sert aux tests et de secours.
 */
export class InlineWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<WorkerToMain>) => void) | null = null;
  private readonly host: SimulationHost;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: { now?: () => number; frameMs?: number; autoStart?: boolean } = {}) {
    this.host = new SimulationHost(
      (message) =>
        this.onmessage?.({ data: structuredClone(message) } as MessageEvent<WorkerToMain>),
      options.now ?? (() => performance.now()),
    );
    if (options.autoStart ?? true)
      this.timer = setInterval(() => this.host.frame(), options.frameMs ?? 16);
  }

  postMessage(message: MainToWorker): void {
    this.host.handle(structuredClone(message));
  }

  /** Avance la boucle à la main (tests). */
  frame(): number {
    return this.host.frame();
  }

  terminate(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

/** Crée le moteur avec un vrai Web Worker (ou celui fourni, pour les tests). */
export function createGameEngine(worker?: WorkerLike): GameEngine {
  if (worker) return new WorkerGameEngine(worker);
  if (typeof Worker === 'undefined') return new WorkerGameEngine(new InlineWorker());
  const real = new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' });
  return new WorkerGameEngine(real as unknown as WorkerLike);
}
