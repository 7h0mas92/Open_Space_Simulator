import type { CommandResult, GameState } from '@oss/shared';
import { notify, type SimContext } from '../simulation/helpers';
import { applyEffects } from './effects';

/** Le joueur choisit une réponse à la carte affichée. */
export function resolveEvent(
  state: GameState,
  ctx: SimContext,
  choiceIndex: number,
): CommandResult {
  const pending = state.events.pending;
  if (!pending) return { ok: false, error: 'WRONG_STAGE' };
  const card = ctx.cards.get(pending.cardId);
  const choice = card?.choices[choiceIndex];
  if (!card) {
    // Carte retirée de la bibliothèque entre-temps (désactivée par un admin) : on l'oublie.
    state.events.pending = null;
    return { ok: true };
  }
  if (!choice) return { ok: false, error: 'INVALID_CHOICE' };
  state.events.pending = null;
  state.events.choices.push({ cardId: card.id, choiceIndex, sprint: state.sprint });
  state.stats.cardsResolved += 1;
  applyEffects(state, ctx, card, choice.effects, pending.level);
  notify(state, ctx, 'CARD_RESOLVED', choice.label);
  return { ok: true };
}
