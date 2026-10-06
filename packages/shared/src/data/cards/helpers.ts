import type { LocalizedText } from '../../i18n.js';
import type { EventCard } from '../../sim/cards.js';

/** Raccourci pour écrire un texte bilingue. */
export const t = (fr: string, en: string): LocalizedText => ({ fr, en });

/** Valeurs par défaut d'une carte : pas de condition, poids 10, pas de cooldown particulier. */
export function card(
  definition: Omit<EventCard, 'conditions' | 'weight' | 'cooldownSprints'> & Partial<EventCard>,
): EventCard {
  return { conditions: {}, weight: 10, cooldownSprints: 4, ...definition };
}

/** Le choix « On en reparle » : la carte reviendra, en pire. */
export const LATER = t('On en reparle', "Let's talk about it later");
