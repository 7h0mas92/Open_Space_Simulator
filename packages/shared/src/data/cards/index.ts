import type { EventCard } from '../../sim/cards.js';
import { BUSINESS_CARDS } from './business.js';
import { MISC_CARDS } from './misc.js';
import { OFFICE_CARDS } from './office.js';
import { TEAM_CARDS } from './team.js';
import { TECH_CARDS } from './tech.js';

/**
 * Les 100 cartes d'événements du jeu. Le serveur les insère en base (seed) ; le client
 * les embarque aussi comme repli hors ligne si l'API et le cache sont indisponibles.
 */
export const EVENT_CARDS: readonly EventCard[] = [
  ...TECH_CARDS,
  ...TEAM_CARDS,
  ...OFFICE_CARDS,
  ...BUSINESS_CARDS,
  ...MISC_CARDS,
];

/** Succès débloquables par des cartes (l'étape « Méta » les crée en base). */
export const CARD_ACHIEVEMENTS = [
  'this-is-fine',
  'duck-lead',
  'bobby-tables',
  'zero-meeting',
  'web3-bro',
  'log-scale',
  'office-dog',
] as const;
