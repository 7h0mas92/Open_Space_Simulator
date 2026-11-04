import { BALANCE, difficultyOf, type EventCard, type GameState, modeRules } from '@oss/shared';
import { notify, type SimContext } from '../simulation/helpers';
import type { SimClock } from '../simulation/time';
import { inCooldown, isEligible } from './conditions';
import { resolveEvent } from './resolve';
import { storyCardSystem } from './storyCards';

/** Chance par heure ouvrée qu'une carte remise en file (« On en reparle ») revienne. */
const QUEUED_CHANCE_PER_HOUR = 0.25;

function present(state: GameState, ctx: SimContext, card: EventCard, level: number): void {
  state.events.pending = { cardId: card.id, level, drawnAtTick: state.tick };
  state.events.lastSeenSprint[card.id] = state.sprint;
  state.events.drawnThisSprint += 1;
  notify(state, ctx, 'CARD_DRAWN', card.title);
}

/**
 * Impose une carte (ex. : la panne du vendredi déclenche « Vendredi 17h04 »).
 * Ignorée si une carte est déjà affichée ou si la carte est en cooldown.
 */
export function forceCard(state: GameState, ctx: SimContext, cardId: string, level = 0): boolean {
  const card = ctx.cards.get(cardId);
  if (!card || state.events.pending || inCooldown(state, card)) return false;
  present(state, ctx, card, level);
  return true;
}

/** Tirage pondéré parmi les cartes éligibles ; les cartes remises en file passent d'abord. */
export function drawCard(state: GameState, ctx: SimContext, clock: SimClock): boolean {
  const { events } = state;
  const queuedIndex = events.queue.findIndex((entry) => entry.availableAtSprint <= state.sprint);
  if (queuedIndex >= 0 && ctx.rng.chance(QUEUED_CHANCE_PER_HOUR)) {
    const [entry] = events.queue.splice(queuedIndex, 1);
    const card = entry ? ctx.cards.get(entry.cardId) : undefined;
    if (entry && card) {
      present(state, ctx, card, entry.level);
      return true;
    }
  }
  if (!ctx.rng.chance(BALANCE.events.drawChancePerWorkHour * difficultyOf(state.mode).eventChance))
    return false;
  const eligible = ctx.cards.cards.filter((card) => isEligible(state, card, clock));
  // Pendant une période (Halloween, Noël…), ses cartes passent souvent devant les autres :
  // la période ne dure qu'une semaine.
  const seasonal = eligible.filter((c) => c.conditions.season !== undefined);
  const pool =
    seasonal.length > 0 && ctx.rng.chance(BALANCE.events.seasonalShare) ? seasonal : eligible;
  const card = ctx.rng.weighted(pool, (c) => c.weight);
  if (!card) return false;
  present(state, ctx, card, 0);
  return true;
}

/**
 * Système « événements » : pendant l'exécution, à chaque heure ouvrée, une carte peut
 * tomber. En Hardcore (pas de pause), une carte ignorée trop longtemps se résout
 * toute seule avec le dernier choix : « tu n'as rien décidé, le problème a décidé pour toi ».
 */
export function eventSystem(state: GameState, ctx: SimContext, clock: SimClock): void {
  if (state.stage !== 'EXECUTION') return;
  const { pending } = state.events;
  if (pending) {
    if (
      !modeRules(state.mode).cardsPauseTime &&
      state.tick - pending.drawnAtTick >= BALANCE.events.hardcoreAutoResolveTicks
    ) {
      const card = ctx.cards.get(pending.cardId);
      resolveEvent(state, ctx, card ? card.choices.length - 1 : 0);
    }
    return;
  }
  const workHour =
    !clock.isWeekend && Number.isInteger(clock.hour) && clock.hour >= 9 && clock.hour < 19;
  if (!workHour) return;
  // Histoire en actes : les cartes de l'acte passent avant le tirage habituel.
  if (storyCardSystem(state, ctx, clock)) return;
  const maxPerSprint = difficultyOf(state.mode).eventsPerSprint;
  if (state.events.drawnThisSprint >= maxPerSprint) return;
  drawCard(state, ctx, clock);
}
