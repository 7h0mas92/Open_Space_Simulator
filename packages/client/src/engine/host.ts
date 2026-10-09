import {
  CommandLogSchema,
  SaveDataSchema,
  type LoggedCommand,
  type Notification,
  type Speed,
} from '@oss/shared';
import { CardLibrary } from '../events/library';
import { Simulation } from '../simulation/simulation';
import { GameClock, isSpeed } from './clock';
import type { MainToWorker, WorkerToMain } from './protocol';

/** En replay, le temps passe plus vite : x4 revoit un sprint en quelques secondes. */
export const REPLAY_BOOST = 8;
/** Temps réel (à x1) laissé au spectateur devant une carte, une démo ou un pitch. */
export const REPLAY_DWELL_MS = 2400;

interface ReplayCursor {
  commands: readonly LoggedCommand[];
  next: number;
  /** Temps passé devant l'écran bloquant en cours (ms, multiplié par la vitesse). */
  dwell: number;
}

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
  private replay: ReplayCursor | null = null;
  /**
   * Vitesse à reprendre une fois la carte d'événement tranchée (`null` : le temps n'a pas été
   * arrêté par une carte). Seule l'horloge réelle s'arrête : la simulation, elle, était déjà
   * bloquée par la carte, donc replays, Daily et sauvegardes ne changent pas.
   */
  private resumeSpeed: Speed | null = null;

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
    this.replay = null;
    this.resumeSpeed = null;
    if (message.game.kind === 'new') {
      this.simulation = Simulation.create(
        { seed: message.game.seed, mode: message.game.mode },
        cards,
      );
    } else if (message.game.kind === 'replay') {
      this.simulation = Simulation.create(
        { seed: message.game.seed, mode: message.game.mode },
        cards,
      );
      this.replay = { commands: CommandLogSchema.parse(message.game.commands), next: 0, dwell: 0 };
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
    // Pendant un replay, seules les commandes enregistrées pilotent la partie.
    if (this.replay) {
      this.post({ type: 'commandResult', id, result: { ok: false, error: 'LOCKED' } });
      return;
    }
    const { result, notifications } = simulation.dispatch(message.command);
    this.pending.push(...notifications);
    this.post({ type: 'commandResult', id, result });
    this.publish();
  }

  private setSpeed(speed: Speed): void {
    if (!isSpeed(speed)) return;
    // Mode Hardcore : pas de pause.
    if (speed === 0 && this.simulation?.state.mode === 'HARDCORE') return;
    // Carte ouverte : la pause tient jusqu'à la réponse, la vitesse choisie s'appliquera après.
    if (this.resumeSpeed !== null) {
      if (speed !== 0) this.resumeSpeed = speed;
      return;
    }
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
    if (this.replay) return this.replayFrame(simulation, this.replay, elapsed);
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

  /**
   * Un « frame » de replay : les commandes enregistrées sont rejouées à leur tick, comme dans
   * `replay()` (simulation/replay.ts). Devant un écran bloquant (carte, démo, pitch), on laisse
   * quelques secondes au spectateur avant d'appliquer la commande suivante.
   */
  private replayFrame(simulation: Simulation, cursor: ReplayCursor, elapsed: number): number {
    const speed = this.clock.speed;
    let changed = false;
    for (;;) {
      const entry = cursor.commands[cursor.next];
      if (!entry || entry.tick !== simulation.state.tick) break;
      if (!simulation.isRunning) {
        cursor.dwell += elapsed * speed;
        elapsed = 0;
        if (cursor.dwell < REPLAY_DWELL_MS) break;
      }
      cursor.dwell = 0;
      const { result, notifications } = simulation.dispatch(entry.command);
      if (!result.ok) {
        this.post({ type: 'error', message: `Replay : commande refusée (${result.error})` });
        cursor.next = cursor.commands.length;
        break;
      }
      this.pending.push(...notifications);
      cursor.next += 1;
      changed = true;
    }
    let played = 0;
    if (simulation.isRunning) {
      const next = cursor.commands[cursor.next];
      const ticks = this.clock.advance(elapsed * REPLAY_BOOST);
      for (; played < ticks && simulation.isRunning; played++) {
        if (next && simulation.state.tick >= next.tick) break;
        this.pending.push(...simulation.step());
      }
    } else {
      this.clock.reset();
    }
    if (played > 0 || changed) this.publish();
    return played;
  }

  /**
   * Une carte d'événement tombe : le temps passe en pause (les personnages s'arrêtent, le
   * bouton ❚❚ s'allume) pour laisser le joueur lire et choisir. Une fois la carte tranchée, la
   * vitesse d'avant reprend. Pas en Hardcore (pas de pause, la carte se résout seule) ni en
   * replay (le spectateur garde la main sur la vitesse).
   */
  private holdForEvent(simulation: Simulation): void {
    const pending = simulation.state.events.pending !== null;
    if (this.resumeSpeed !== null) {
      if (pending) return;
      this.clock.speed = this.resumeSpeed;
      this.resumeSpeed = null;
    } else if (
      pending &&
      !this.replay &&
      simulation.state.mode !== 'HARDCORE' &&
      simulation.state.stage === 'EXECUTION' &&
      this.clock.speed !== 0
    ) {
      this.resumeSpeed = this.clock.speed;
      this.clock.speed = 0;
    }
  }

  private publish(): void {
    const simulation = this.simulation;
    if (!simulation) return;
    this.holdForEvent(simulation);
    this.post({
      type: 'snapshot',
      state: simulation.state,
      notifications: this.pending,
      speed: this.clock.speed,
      running: simulation.isRunning && this.clock.speed !== 0,
      tickDurationMs: this.replay
        ? this.clock.tickDuration / REPLAY_BOOST
        : this.clock.tickDuration,
      replay: this.replay ? { played: this.replay.next, total: this.replay.commands.length } : null,
    });
    this.pending = [];
  }
}
