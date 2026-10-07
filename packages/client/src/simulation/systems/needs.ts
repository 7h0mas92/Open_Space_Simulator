import { BALANCE, type GameState } from '@oss/shared';
import { addGauge, addMoney, clamp, devIds, notify, text, type SimContext } from '../helpers';
import type { SimClock } from '../time';

/**
 * Système « café » : les devs consomment du café en travaillant et pendant leurs
 * pauses ; les machines et la cuisine sont réapprovisionnées chaque matin à 8h (et facturées).
 */
export function coffeeSystem(state: GameState, ctx: SimContext, clock: SimClock): void {
  if (clock.hour === 8 && !clock.isWeekend) {
    const missing = 100 - state.gauges.coffee;
    const restock = Math.min(
      missing,
      ctx.office.coffeeRestock + BALANCE.coffee.kitchenRestock[state.phase],
    );
    if (restock > 0) {
      addGauge(state, 'coffee', restock);
      addMoney(state, -restock * BALANCE.coffee.pricePerPoint);
    }
  }
  const before = state.gauges.coffee;
  let consumption = 0;
  for (const id of devIds(state)) {
    const identity = state.components.identity[id];
    const kind = state.components.activity[id]?.kind;
    if (!identity || identity.role === 'AI_AGENT' || identity.role === 'GHOST') continue;
    const addict = identity.trait === 'COFFEE_ADDICT' ? BALANCE.coffee.addictMultiplier : 1;
    if (kind === 'WORKING' || kind === 'MEETING')
      consumption += BALANCE.coffee.consumptionPerWorkTick * addict;
    else if (kind === 'COFFEE') consumption += BALANCE.coffee.consumptionPerBreak * addict;
  }
  addGauge(state, 'coffee', -consumption * BALANCE.coffee.stockScale[state.phase]);
  if (before > 0 && state.gauges.coffee <= 0) {
    notify(
      state,
      ctx,
      'COFFEE_EMPTY',
      text([
        'Plus de café. La productivité est divisée par 3.',
        'Out of coffee. Productivity is divided by 3.',
      ]),
    );
  }
}

/** Système « énergie » : on se fatigue en travaillant, on récupère en pause et la nuit. */
export function energySystem(state: GameState, ctx: SimContext): void {
  const { energy } = BALANCE;
  for (const id of devIds(state)) {
    const identity = state.components.identity[id];
    const stats = state.components.stats[id];
    const mood = state.components.mood[id];
    const kind = state.components.activity[id]?.kind;
    if (!identity || !stats || !mood || !kind) continue;
    if (identity.role === 'AI_AGENT') {
      mood.energy = 100;
      continue;
    }
    let delta: number;
    switch (kind) {
      case 'WORKING':
      case 'MEETING':
      case 'YELLING':
      case 'ARGUING': {
        const endurance = 1.35 - stats.endurance * energy.enduranceSaving;
        const saving = 1 - (ctx.office.seatEnergySaving[id] ?? 0);
        const workaholic = identity.trait === 'WORKAHOLIC' ? 1.2 : 1;
        delta = -energy.drainPerWorkTick * endurance * saving * workaholic;
        break;
      }
      case 'SLEEPING':
        delta = energy.restPerTick + ctx.office.restBonus;
        break;
      case 'GONE':
        delta = energy.restPerTick;
        break;
      case 'IDLE':
        delta = 0.5;
        break;
      default:
        delta = 1 + ctx.office.restBonus * 0.5;
    }
    mood.energy = clamp(mood.energy + delta, 0, 100);
  }
}
