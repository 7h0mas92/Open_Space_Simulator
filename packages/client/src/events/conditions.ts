import type { CardGauge, EventCard, GameState } from '@oss/shared';
import { phaseIndex } from '../simulation/furniture';
import { hasRole, teamMoral } from '../simulation/helpers';
import type { SimClock } from '../simulation/time';

/** Valeur d'une jauge telle que la voient les conditions de cartes. */
export function cardGaugeValue(state: GameState, gauge: CardGauge): number {
  return gauge === 'moral' ? teamMoral(state) : state.gauges[gauge];
}

/** Les conditions de la carte sont-elles remplies (phase, rôle, jauges, jour, heure) ? */
export function conditionsMet(state: GameState, card: EventCard, clock: SimClock): boolean {
  const c = card.conditions;
  const phase = phaseIndex(state.phase);
  if (c.minPhase && phase < phaseIndex(c.minPhase)) return false;
  if (c.maxPhase && phase > phaseIndex(c.maxPhase)) return false;
  if (c.hasRole && !hasRole(state, c.hasRole)) return false;
  if (c.dayOfWeek !== undefined && clock.dayOfWeek !== c.dayOfWeek) return false;
  if (c.afterHour !== undefined && clock.hour < c.afterHour) return false;
  if (c.requiresSeen && !(c.requiresSeen in state.events.lastSeenSprint)) return false;
  if (c.gauges) {
    for (const [gauge, range] of Object.entries(c.gauges) as [
      CardGauge,
      { min?: number; max?: number },
    ][]) {
      const value = cardGaugeValue(state, gauge);
      if (range.min !== undefined && value < range.min) return false;
      if (range.max !== undefined && value > range.max) return false;
    }
  }
  return true;
}

/** La carte est-elle encore en période de récupération (cooldown) ? */
export function inCooldown(state: GameState, card: EventCard): boolean {
  const last = state.events.lastSeenSprint[card.id];
  return last !== undefined && state.sprint - last <= card.cooldownSprints;
}

/** Carte tirable naturellement : poids positif, hors cooldown, conditions remplies. */
export function isEligible(state: GameState, card: EventCard, clock: SimClock): boolean {
  return card.weight > 0 && !inCooldown(state, card) && conditionsMet(state, card, clock);
}
