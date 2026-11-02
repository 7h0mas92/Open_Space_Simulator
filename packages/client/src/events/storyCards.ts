import { STORY_CARD_SCHEDULE, STORY_CARD_TIME, getStoryAct, type GameState } from '@oss/shared';
import type { SimContext } from '../simulation/helpers';
import type { SimClock } from '../simulation/time';
import { forceCard } from './draw';

/**
 * Cartes de l'histoire en actes (`shared/story/cards.ts`) : chaque acte impose ses deux cartes à
 * un sprint fixé, à partir du mardi 10h. Aucun tirage : la carte est présentée comme une carte
 * forcée (« Vendredi 17h04 »), le rejeu du serveur la retrouve au même moment. Une carte déjà
 * sortie ne revient pas, une carte d'un acte terminé ne tombe plus.
 */
export function storyCardSystem(state: GameState, ctx: SimContext, clock: SimClock): boolean {
  const story = state.story;
  const campaign = story?.campaign;
  if (!story || !campaign || campaign.freeSeason || state.events.pending) return false;
  const sprintOfAct = state.sprint - story.startSprint + 1;
  const late =
    clock.dayOfWeek > STORY_CARD_TIME.dayOfWeek ||
    (clock.dayOfWeek === STORY_CARD_TIME.dayOfWeek && clock.hour >= STORY_CARD_TIME.hour);
  for (const entry of STORY_CARD_SCHEDULE[getStoryAct(campaign.act).id]) {
    if (entry.cardId in state.events.lastSeenSprint) continue;
    const due = sprintOfAct > entry.sprint || (sprintOfAct === entry.sprint && late);
    if (due) return forceCard(state, ctx, entry.cardId);
  }
  return false;
}
