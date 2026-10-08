import { BALANCE, DEV_ROLES, type CardEffects, type EventCard, type GameState } from '@oss/shared';
import { unlockAchievement } from '../simulation/achievements';
import { fireDev, spawnDev } from '../simulation/devs';
import {
  addGauge,
  addMoney,
  addUsers,
  changeMoral,
  devIds,
  devsWithRole,
  type SimContext,
} from '../simulation/helpers';
import { changeVentureValuation, latestActiveVenture } from '../simulation/ventures';

/** Sens « négatif » de chaque effet chiffré : c'est lui qu'on aggrave en cas de report. */
const BAD_DIRECTION: Record<
  'treasury' | 'coffee' | 'hype' | 'debt' | 'stability' | 'users' | 'moral' | 'ventureValue',
  1 | -1
> = {
  ventureValue: -1,
  treasury: -1,
  coffee: -1,
  hype: -1,
  debt: 1,
  stability: -1,
  users: -1,
  moral: -1,
};

/**
 * Multiplie un effet par l'aggravation s'il va dans le mauvais sens. `softening` adoucit
 * les seuls effets négatifs (mode Facile).
 */
export function escalate(
  value: number,
  badDirection: 1 | -1,
  level: number,
  softening = 1,
): number {
  const isBad = Math.sign(value) === badDirection;
  return isBad ? value * (1 + BALANCE.events.escalation * level) * softening : value;
}

/** Part des effets négatifs conservée selon le mode : moitié moins en Facile. */
export function badEffectFactor(mode: GameState['mode']): number {
  return mode === 'EASY' ? BALANCE.easy.badEffectMultiplier : 1;
}

/**
 * Applique les effets d'un choix de carte. `level` est le niveau d'aggravation :
 * une carte reportée revient avec des effets négatifs plus forts.
 */
export function applyEffects(
  state: GameState,
  ctx: SimContext,
  card: EventCard,
  effects: CardEffects,
  level: number,
): void {
  const softening = badEffectFactor(state.mode);
  const scaled = (key: keyof typeof BAD_DIRECTION): number => {
    const value = effects[key];
    return value === undefined ? 0 : escalate(value, BAD_DIRECTION[key], level, softening);
  };

  if (effects.treasury !== undefined) addMoney(state, scaled('treasury'));
  if (effects.coffee !== undefined) addGauge(state, 'coffee', scaled('coffee'));
  if (effects.hype !== undefined) addGauge(state, 'hype', scaled('hype'));
  if (effects.debt !== undefined) addGauge(state, 'debt', scaled('debt'));
  if (effects.stability !== undefined) addGauge(state, 'stability', scaled('stability'));
  if (effects.users !== undefined) addUsers(state, (state.gauges.users * scaled('users')) / 100);
  if (effects.moral !== undefined) {
    const delta = scaled('moral');
    for (const id of devIds(state)) changeMoral(state, id, delta);
  }
  for (const role of DEV_ROLES) {
    const value = effects[`moral.${role}`];
    if (value === undefined) continue;
    const delta = escalate(value, -1, level, softening);
    for (const id of devsWithRole(state, role)) changeMoral(state, id, delta);
  }

  if (effects.sprintsLost) state.lostSprintsPending += effects.sprintsLost;
  if (effects.requeue) {
    const sameCard = effects.requeue.cardId === undefined || effects.requeue.cardId === card.id;
    state.events.queue.push({
      cardId: effects.requeue.cardId ?? card.id,
      level: sameCard ? level + 1 : level,
      availableAtSprint: state.sprint + (effects.requeue.delaySprints ?? 1),
    });
  }
  if (effects.spawnDev) spawnDev(state, ctx, effects.spawnDev);
  if (effects.fireDev) {
    const pool =
      effects.fireDev === 'RANDOM' ? devIds(state) : devsWithRole(state, effects.fireDev);
    if (pool.length > 0) fireDev(state, ctx, ctx.rng.pick(pool));
  }
  if (effects.unlockAchievement) unlockAchievement(state, ctx, effects.unlockAchievement);
  const venture = latestActiveVenture(state);
  if (effects.ventureValue !== undefined && venture)
    changeVentureValuation(venture, 1 + scaled('ventureValue') / 100);
}
