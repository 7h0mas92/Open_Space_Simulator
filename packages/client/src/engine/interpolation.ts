import type { EngineSnapshot } from './protocol';

/**
 * Tampon de snapshots pour le rendu : garde le précédent et le courant, et calcule où
 * l'on en est entre les deux. Le rendu interpole (positions, éclairage jour/nuit) pour
 * rester fluide à 60 images par seconde alors que la simulation avance par ticks.
 */
export class SnapshotBuffer {
  private previous: EngineSnapshot | null = null;
  private current: EngineSnapshot | null = null;
  private receivedAt = 0;

  push(snapshot: EngineSnapshot, nowMs: number): void {
    // Un snapshot sans nouveau tick (commande, changement de vitesse) remplace le courant.
    if (this.current && snapshot.state.tick === this.current.state.tick) {
      this.current = snapshot;
      return;
    }
    this.previous = this.current;
    this.current = snapshot;
    this.receivedAt = nowMs;
  }

  get latest(): EngineSnapshot | null {
    return this.current;
  }

  get before(): EngineSnapshot | null {
    return this.previous;
  }

  /** Progression entre le snapshot précédent (0) et le courant (1). */
  alpha(nowMs: number): number {
    const current = this.current;
    if (!current || !this.previous || !current.running) return 1;
    const duration = current.tickDurationMs;
    if (!Number.isFinite(duration) || duration <= 0) return 1;
    return Math.min(1, Math.max(0, (nowMs - this.receivedAt) / duration));
  }
}

/** Interpolation linéaire. */
export function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}
