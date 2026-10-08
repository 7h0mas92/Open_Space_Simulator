import {
  CARD_GAUGES,
  CardGaugeSchema,
  DevRoleSchema,
  PHASES,
  PhaseSchema,
  type AdminCardListItem,
  type CardGauge,
  type DevRole,
  type EventCard,
  type Phase,
} from '@oss/shared';
import { z } from 'zod';

/**
 * Filtres du back-office, en TypeScript pur (testés sans navigateur).
 * Tous les filtres se combinent : une carte doit les passer tous pour être affichée.
 */

/** Phases où une carte peut tomber (la phase Fin n'a pas de sprint). */
export const PLAYABLE_PHASES = PHASES.filter((phase) => phase !== 'END');

/** Particularités d'une carte, filtrables par cases à cocher. */
export const CARD_TRAITS = [
  'chain',
  'drawOnly',
  'timed',
  'gaugeCondition',
  'team',
  'achievement',
  'venture',
] as const;
export type CardTrait = (typeof CARD_TRAITS)[number];

export const CARD_SORTS = ['title', 'weight', 'draws', 'updated'] as const;
export type CardSort = (typeof CARD_SORTS)[number];

export type CardFilters = {
  /** Recherche dans l'identifiant, le titre, la description et les choix (FR et EN). */
  text: string;
  status: 'all' | 'active' | 'inactive';
  /** La carte peut tomber dans cette phase. */
  phase: Phase | 'all';
  /** `none` : cartes sans profil requis. */
  role: DevRole | 'all' | 'none';
  /** Au moins un choix modifie cette jauge. */
  gauge: CardGauge | 'all';
  /** La carte a toutes ces particularités. */
  traits: CardTrait[];
  sort: CardSort;
};

export const DEFAULT_FILTERS: CardFilters = {
  text: '',
  status: 'all',
  phase: 'all',
  role: 'all',
  gauge: 'all',
  traits: [],
  sort: 'title',
};

/** Nombre de filtres actifs (hors tri), pour le badge du bouton « Filtres ». */
export function activeFilterCount(filters: CardFilters): number {
  return (
    (filters.text.trim() ? 1 : 0) +
    (filters.status !== 'all' ? 1 : 0) +
    (filters.phase !== 'all' ? 1 : 0) +
    (filters.role !== 'all' ? 1 : 0) +
    (filters.gauge !== 'all' ? 1 : 0) +
    filters.traits.length
  );
}

/** Jauges modifiées par au moins un choix (`moral.<role>` compte comme `moral`). */
export function touchedGauges(card: EventCard): CardGauge[] {
  const touched = new Set<CardGauge>();
  for (const choice of card.choices) {
    for (const [key, value] of Object.entries(choice.effects)) {
      if (typeof value !== 'number' || value === 0) continue;
      const gauge = key.startsWith('moral.') ? 'moral' : key;
      if ((CARD_GAUGES as readonly string[]).includes(gauge)) touched.add(gauge as CardGauge);
    }
  }
  return CARD_GAUGES.filter((gauge) => touched.has(gauge));
}

/** Particularités d'une carte. */
export function cardTraits(card: EventCard): CardTrait[] {
  const effects = card.choices.map((choice) => choice.effects);
  const { conditions } = card;
  const traits: Record<CardTrait, boolean> = {
    chain: effects.some((effect) => effect.requeue !== undefined),
    drawOnly: card.weight === 0,
    timed: conditions.dayOfWeek !== undefined || conditions.afterHour !== undefined,
    gaugeCondition: Object.keys(conditions.gauges ?? {}).length > 0,
    team: effects.some((effect) => effect.spawnDev !== undefined || effect.fireDev !== undefined),
    achievement: effects.some((effect) => effect.unlockAchievement !== undefined),
    venture:
      conditions.hasVenture !== undefined ||
      effects.some((effect) => effect.ventureValue !== undefined),
  };
  return CARD_TRAITS.filter((trait) => traits[trait]);
}

/** Phases (incluses) où la carte peut tomber. */
export function phaseRange(card: EventCard): { from: Phase; to: Phase } {
  const last = PLAYABLE_PHASES[PLAYABLE_PHASES.length - 1] ?? 'UNICORN';
  return {
    from: card.conditions.minPhase ?? 'GARAGE',
    to:
      card.conditions.maxPhase && card.conditions.maxPhase !== 'END'
        ? card.conditions.maxPhase
        : last,
  };
}

function inPhase(card: EventCard, phase: Phase): boolean {
  const { from, to } = phaseRange(card);
  const index = PHASES.indexOf(phase);
  return PHASES.indexOf(from) <= index && index <= PHASES.indexOf(to);
}

/** Minuscules sans accents, pour qu'« equipe » trouve « Équipe ». */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function searchable(card: EventCard): string {
  return normalize(
    [
      card.id,
      card.title.fr,
      card.title.en,
      card.description.fr,
      card.description.en,
      ...card.choices.flatMap((choice) => [choice.label.fr, choice.label.en]),
    ].join('\n'),
  );
}

export function matchesFilters(card: AdminCardListItem, filters: CardFilters): boolean {
  const words = normalize(filters.text).split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    const haystack = searchable(card);
    if (!words.every((word) => haystack.includes(word))) return false;
  }
  if (filters.status === 'active' && !card.active) return false;
  if (filters.status === 'inactive' && card.active) return false;
  if (filters.phase !== 'all' && !inPhase(card, filters.phase)) return false;
  if (filters.role === 'none' && card.conditions.hasRole !== undefined) return false;
  if (filters.role !== 'all' && filters.role !== 'none' && card.conditions.hasRole !== filters.role)
    return false;
  if (filters.gauge !== 'all' && !touchedGauges(card).includes(filters.gauge)) return false;
  if (filters.traits.length > 0) {
    const traits = cardTraits(card);
    if (!filters.traits.every((trait) => traits.includes(trait))) return false;
  }
  return true;
}

/** Filtre puis trie. Le titre sert à départager, dans la langue affichée. */
export function filterCards(
  cards: readonly AdminCardListItem[],
  filters: CardFilters,
  language: string,
): AdminCardListItem[] {
  const title = (card: AdminCardListItem) =>
    language.startsWith('en') ? card.title.en : card.title.fr;
  const byTitle = (a: AdminCardListItem, b: AdminCardListItem) =>
    // Les guillemets « » en tête de titre ne comptent pas dans l'ordre alphabétique.
    title(a).localeCompare(title(b), language, { ignorePunctuation: true });
  const compare: Record<CardSort, (a: AdminCardListItem, b: AdminCardListItem) => number> = {
    title: byTitle,
    weight: (a, b) => b.weight - a.weight || byTitle(a, b),
    draws: (a, b) => b.draws - a.draws || byTitle(a, b),
    updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt) || byTitle(a, b),
  };
  return cards.filter((card) => matchesFilters(card, filters)).sort(compare[filters.sort]);
}

/** Relu à l'ouverture : chaque champ invalide reprend sa valeur par défaut. */
const StoredFiltersSchema = z.object({
  text: z.string().catch(DEFAULT_FILTERS.text),
  status: z.enum(['all', 'active', 'inactive']).catch(DEFAULT_FILTERS.status),
  phase: z.union([PhaseSchema, z.literal('all')]).catch(DEFAULT_FILTERS.phase),
  role: z.union([DevRoleSchema, z.enum(['all', 'none'])]).catch(DEFAULT_FILTERS.role),
  gauge: z.union([CardGaugeSchema, z.literal('all')]).catch(DEFAULT_FILTERS.gauge),
  traits: z.array(z.enum(CARD_TRAITS)).catch([]),
  sort: z.enum(CARD_SORTS).catch(DEFAULT_FILTERS.sort),
});

const STORAGE_KEY = 'oss.admin.cardFilters';

/** Filtres de la session précédente (ils survivent à l'aller-retour vers l'éditeur et au F5). */
export function loadFilters(): CardFilters {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return StoredFiltersSchema.parse(JSON.parse(raw));
  } catch {
    // Stockage indisponible ou JSON abîmé : on repart des filtres par défaut.
  }
  return DEFAULT_FILTERS;
}

export function saveFilters(filters: CardFilters): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Navigation privée stricte : les filtres ne seront simplement pas retenus.
  }
}
