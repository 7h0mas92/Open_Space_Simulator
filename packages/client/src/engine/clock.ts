import { GAME, SPEEDS, TIME, type Speed } from '@oss/shared';

/** Durée réelle d'un tick à vitesse x1 : un sprint (672 ticks) dure environ 5 minutes. */
export const TICK_MS_AT_X1 = (GAME.sprintRealSecondsAtX1 * 1000) / TIME.ticksPerSprint;

/** Nombre maximum de ticks rattrapés en une fois (onglet en arrière-plan, gros ralentissement). */
export const MAX_TICKS_PER_FRAME = 16;

export function isSpeed(value: number): value is Speed {
  return (SPEEDS as readonly number[]).includes(value);
}

/**
 * Horloge à pas fixe. On lui donne le temps réel écoulé ; elle répond combien de ticks
 * de simulation exécuter. La simulation ne voit jamais le temps réel : à x4 elle fait
 * simplement 4 fois plus de ticks, les mêmes, dans le même ordre (« fix your timestep »).
 */
export class GameClock {
  private accumulator = 0;
  private currentSpeed: Speed = 1;

  constructor(private readonly tickMs = TICK_MS_AT_X1) {}

  get speed(): Speed {
    return this.currentSpeed;
  }

  set speed(speed: Speed) {
    this.currentSpeed = speed;
    if (speed === 0) this.accumulator = 0;
  }

  /** Durée réelle d'un tick à la vitesse actuelle (Infinity en pause). */
  get tickDuration(): number {
    return this.currentSpeed === 0 ? Number.POSITIVE_INFINITY : this.tickMs / this.currentSpeed;
  }

  /** Avance de `elapsedMs` millisecondes réelles et renvoie le nombre de ticks à jouer. */
  advance(elapsedMs: number): number {
    if (this.currentSpeed === 0 || elapsedMs <= 0) return 0;
    this.accumulator += elapsedMs * this.currentSpeed;
    let ticks = Math.floor(this.accumulator / this.tickMs);
    this.accumulator -= ticks * this.tickMs;
    if (ticks > MAX_TICKS_PER_FRAME) {
      ticks = MAX_TICKS_PER_FRAME;
      this.accumulator = 0;
    }
    return ticks;
  }

  /** Progression vers le prochain tick (0 à 1) : sert à interpoler l'affichage. */
  get alpha(): number {
    return this.currentSpeed === 0 ? 0 : Math.min(1, this.accumulator / this.tickMs);
  }

  /** Oublie le temps accumulé (la simulation est bloquée : planification, carte, démo). */
  reset(): void {
    this.accumulator = 0;
  }
}
