import { EVENT_CARDS } from '@oss/shared';
import { CardLibrary } from './library';

/** Les 100 cartes intégrées au jeu (repli hors ligne quand l'API est injoignable). */
export const DEFAULT_CARDS = EVENT_CARDS;

export function defaultCardLibrary(): CardLibrary {
  return new CardLibrary(EVENT_CARDS);
}
