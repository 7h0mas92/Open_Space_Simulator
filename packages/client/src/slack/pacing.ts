/**
 * Débit du Slack simulé. Les notifications de la simulation arrivent par rafales (et quatre
 * fois plus vite en x4) : sans limite, le canal défile plus vite qu'on ne peut le lire.
 *
 * Seau de jetons en temps réel : on peut publier MESSAGE_BURST messages d'affilée, puis un
 * nouveau message toutes les MESSAGE_INTERVAL_MS. Les messages banals sont abandonnés quand
 * le seau est vide ; les urgents (prod down, levée, démission...) passent toujours.
 */
import type { SlackTrigger } from './templates';

/** Un jeton revient toutes les 20 s : au plus 3 messages par minute en régime continu. */
export const MESSAGE_INTERVAL_MS = 20_000;
/** Messages publiables d'affilée après un moment calme. */
export const MESSAGE_BURST = 2;

/** Événements qu'on ne passe jamais sous silence, même quand le canal est saturé. */
export const URGENT_TRIGGERS: ReadonlySet<SlackTrigger> = new Set<SlackTrigger>([
  'PROD_DOWN',
  'URGENT_TASK',
  'FUNDS_RAISED',
  'PITCH_FAILED',
  'DEV_RESIGNED',
  'DEV_FIRED',
  'PHASE_UP',
  'GAME_OVER',
]);

export const isUrgent = (trigger: SlackTrigger): boolean => URGENT_TRIGGERS.has(trigger);

export class SlackPacer {
  private tokens = MESSAGE_BURST;
  private refilledAt: number | null = null;

  constructor(private readonly now: () => number = Date.now) {}

  private refill(): void {
    const now = this.now();
    if (this.refilledAt !== null) {
      const earned = (now - this.refilledAt) / MESSAGE_INTERVAL_MS;
      this.tokens = Math.min(MESSAGE_BURST, this.tokens + earned);
    }
    this.refilledAt = now;
  }

  /** Un message peut-il partir maintenant ? Il consomme un jeton s'il part. */
  take(urgent = false): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    if (!urgent) return false;
    // L'urgent passe quand même, et vide le seau : le bavardage attendra.
    this.tokens = 0;
    return true;
  }
}
