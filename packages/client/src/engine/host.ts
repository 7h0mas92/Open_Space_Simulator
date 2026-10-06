import { SaveDataSchema, type Notification, type Speed } from '@oss/shared';
import { CardLibrary } from '../events/library';
import { Simulation } from '../simulation/simulation';
import { GameClock, isSpeed } from './clock';
import type { MainToWorker, WorkerToMain } from './protocol';

/**
 * Côté Web Worker : héberge la simulation, la fait avancer au rythme de l'horloge et
 * envoie des snapshots. Indépendant de `self` pour être testable (et utilisable sur le
 * thread principal en secours, si les Web Workers sont indisponibles).
 */
export class SimulationHost {
  private simulation: Simulation | null = null;
  private readonly clock: GameClock;
  private lastFrame: number | null = null;
  private pending: Notification[] = [];

  constructor(
    private readonly post: (message: WorkerToMain) => void,
    private readonly now: () => number,
    clock = new GameClock(),
  ) {
    this.clock = clock;
  }

  handle(message: MainToWorker): void {
    try {
      switch (message.type) {
        case 'init':
          this.init(message);
          break;
        case 'command':
          this.command(message.id, message);
          break;
        case 'setSpeed':
          this.setSpeed(message.speed);
          break;
        case 'save':
          this.save(message.id);
          break;
      }
    } catch (error) {
      this.post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }

  private init(message: Extract<MainToWorker, { type: 'init' }>): void {
    const cards = CardLibrary.parse(message.cards);
    if (message.game.kind === 'new') {
      this.simulation = Simulation.create(
        { seed: message.game.seed, mode: message.game.mode },
        cards,
      );
    } else {
      const save = SaveDataSchema.parse(message.game.save);
      this.simulation = Simulation.restore(save.state, cards, save.commands);
    }
    this.lastFrame = this.now();
    this.clock.reset();
    this.publish();
  }

  private command(id: number, message: Extract<MainToWorker, { type: 'command' }>): void {
    const simulation = this.requireSimulation();
    const { result, notifications } = simulation.dispatch(message.command);
    this.pending.push(...notifications);
    this.post({ type: 'commandResult', id, result });
    this.publish();
  }

  private setSpeed(speed: Speed): void {
    if (!isSpeed(speed)) return;
    // Mode Hardcore : pas de pause.
    if (speed === 0 && this.simulation?.state.mode === 'HARDCORE') return;
    this.clock.speed = speed;
    this.publish();
  }

  private save(id: number): void {
    const simulation = this.requireSimulation();
    // Copie profonde : la sauvegarde ne doit pas changer si la partie continue.
    const save = structuredClone({ state: simulation.state, commands: simulation.commands });
    this.post({ type: 'save', id, save });
  }

  private requireSimulation(): Simulation {
    if (!this.simulation) throw new Error('Aucune partie en cours : envoyer "init" d’abord');
    return this.simulation;
  }

  /**
   * Un « frame » de la boucle du worker : joue les ticks dus depuis le dernier appel.
   * Renvoie le nombre de ticks joués.
   */
  frame(): number {
    const simulation = this.simulation;
    const now = this.now();
    const elapsed = this.lastFrame === null ? 0 : now - this.lastFrame;
    this.lastFrame = now;
    if (!simulation) return 0;
    if (!simulation.isRunning) {
      this.clock.reset();
      return 0;
    }
    const ticks = this.clock.advance(elapsed);
    let played = 0;
    for (; played < ticks && simulation.isRunning; played++)
      this.pending.push(...simulation.step());
    if (played > 0) this.publish();
    return played;
  }

  private publish(): void {
    const simulation = this.simulation;
    if (!simulation) return;
    this.post({
      type: 'snapshot',
      state: simulation.state,
      notifications: this.pending,
      speed: this.clock.speed,
      running: simulation.isRunning && this.clock.speed !== 0,
      tickDurationMs: this.clock.tickDuration,
    });
    this.pending = [];
  }
}
