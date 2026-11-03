import { z } from 'zod';
import type { Phase } from '../game.js';

/*
 * Team building : afterwork, escape game, laser game, séminaire au vert, off-site à Lisbonne.
 * Réservé pendant la planification, il a lieu en fin de 2e semaine du sprint. Il coûte de
 * l'argent (par participant) et du temps de travail, répare le moral et les relations.
 *
 * Le hasard (conflit qui empire à l'escape game, équipe gagnante au laser game) est tiré sur
 * une graine à part (graine de la partie + « teambuilding » + sprint) : sans sortie, la partie
 * est exactement la même qu'avant l'ajout de la mécanique.
 */

export const OUTINGS = ['afterwork', 'escape-game', 'laser-game', 'seminar', 'offsite'] as const;
export const OutingIdSchema = z.enum(OUTINGS);
export type OutingId = z.infer<typeof OutingIdSchema>;

export interface OutingDefinition {
  readonly id: OutingId;
  readonly icon: string;
  /** Phase à partir de laquelle la sortie est proposée. */
  readonly phase: Phase;
  /** Prix par participant, en euros. */
  readonly pricePerDev: number;
  /**
   * Quand l'équipe quitte le bureau : jour du sprint (0 = lundi de la 1re semaine) et heure.
   * La sortie finit le jour `endDay` à 18h, où ses effets s'appliquent. Un départ à 18h ne
   * coûte aucun temps de travail.
   */
  readonly startDay: number;
  readonly startHour: number;
  readonly endDay: number;
  /** Moral gagné par chaque participant. */
  readonly moral: number;
  /** Affinités gagnées entre tous les participants. */
  readonly affinity: number;
  /** Affinités gagnées par les paires en conflit (en plus de `affinity`). */
  readonly conflictAffinity: number;
  /** Énergie gagnée (ou perdue : lendemain d'afterwork). */
  readonly energy: number;
  readonly hype: number;
  /** Dette technique (en points de jauge). */
  readonly debt: number;
}

export const TEAM_BUILDING = {
  /** Fin de toutes les sorties. */
  endHour: 18,
  /** Même sortie deux sprints de suite : gains de moral divisés par deux. */
  repeatMoralFactor: 0.5,
  /** Annulation pendant la planification : part remboursée. */
  cancelRefund: 0.5,
  /** Escape game : chance qu'un conflit empire (« il a caché la clé »), et de combien. */
  escapeBackfireChance: 0.15,
  escapeBackfireAffinity: -15,
  /** Laser game : les gros egos de l'équipe perdante boudent. */
  laserEgoThreshold: 7,
  laserLoserMoral: -5,
  /** Moral selon le caractère : le grincheux moitié moins, le bavard et le gamer 50 % de plus. */
  grumpyFactor: 0.5,
  partyFactor: 1.5,
  /** Paires en conflit sous cette affinité. */
  conflictThreshold: -25,
} as const;

export const OUTING_DEFINITIONS: Readonly<Record<OutingId, OutingDefinition>> = {
  afterwork: {
    id: 'afterwork',
    icon: '🍕',
    phase: 'GARAGE',
    pricePerDev: 40,
    startDay: 10,
    startHour: 18,
    endDay: 10,
    moral: 6,
    affinity: 8,
    conflictAffinity: 0,
    energy: -15,
    hype: 0,
    debt: 0,
  },
  'escape-game': {
    id: 'escape-game',
    icon: '🔐',
    phase: 'GARAGE',
    pricePerDev: 90,
    startDay: 11,
    startHour: 14,
    endDay: 11,
    moral: 10,
    affinity: 5,
    conflictAffinity: 25,
    energy: 0,
    hype: 0,
    debt: 0,
  },
  'laser-game': {
    id: 'laser-game',
    icon: '🔫',
    phase: 'SEED',
    pricePerDev: 70,
    startDay: 11,
    startHour: 14,
    endDay: 11,
    moral: 12,
    affinity: 10,
    conflictAffinity: 0,
    energy: 0,
    hype: 0,
    debt: 0,
  },
  seminar: {
    id: 'seminar',
    icon: '🌳',
    phase: 'SERIES_A',
    pricePerDev: 600,
    startDay: 11,
    startHour: 9,
    endDay: 11,
    moral: 20,
    affinity: 20,
    conflictAffinity: 0,
    energy: 40,
    hype: 3,
    debt: 0,
  },
  offsite: {
    id: 'offsite',
    icon: '✈️',
    phase: 'UNICORN',
    pricePerDev: 2500,
    startDay: 10,
    startHour: 9,
    endDay: 11,
    moral: 30,
    affinity: 30,
    conflictAffinity: 0,
    energy: 20,
    hype: 8,
    debt: -5,
  },
};

export const TeamBuildingStateSchema = z.object({
  /** Sortie réservée pour un sprint (null : aucune). */
  booked: z
    .object({ outing: OutingIdSchema, sprint: z.number().int(), cost: z.number().nonnegative() })
    .nullable(),
  /** Dernière sortie faite (pour la règle « deux fois de suite »). */
  last: z.object({ outing: OutingIdSchema, sprint: z.number().int() }).nullable(),
  /** Sorties faites depuis le début de la partie. */
  count: z.number().int().nonnegative(),
});
export type TeamBuildingState = z.infer<typeof TeamBuildingStateSchema>;

export function emptyTeamBuildingState(): TeamBuildingState {
  return { booked: null, last: null, count: 0 };
}
