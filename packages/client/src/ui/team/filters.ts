import { BALANCE, type DevRole } from '@oss/shared';
import type { DevView, PerformanceGrade } from '../../view/types';

/**
 * Filtres et tri de la liste de l'équipe. Fonctions pures sur la `GameView` : la liste reste
 * un simple affichage, rien n'est envoyé à la simulation.
 */

/** Sous cette affinité, deux collègues sont en conflit (même seuil que la fiche du dev). */
export const CONFLICT_AFFINITY = -25;
/** Au-dessus de cette affinité, deux collègues s'entendent bien. */
export const FRIEND_AFFINITY = 25;
/** Fatigué : sous le seuil d'énergie qui renvoie un dev en télétravail. */
export const TIRED_ENERGY = BALANCE.remote.fatigueEnergy;
/** Moral bas : sous le seuil dont un dev épuisé doit sortir pour revenir au bureau. */
export const LOW_MORALE = BALANCE.remote.burnoutMoralRecovered;

/** Situations à surveiller, cumulables. */
export const TEAM_FLAGS = [
  'CONFLICT',
  'TIRED',
  'LOW_MORALE',
  'REMOTE',
  'OFFICE',
  'ABSENT',
] as const;
export type TeamFlag = (typeof TEAM_FLAGS)[number];

export const TEAM_SORTS = [
  'PERF_DESC',
  'PERF_ASC',
  'MORALE_ASC',
  'ENERGY_ASC',
  'CONFLICTS_DESC',
  'SALARY_DESC',
  'SENIORITY_DESC',
  'NAME',
] as const;
export type TeamSort = (typeof TEAM_SORTS)[number];

export interface TeamFilters {
  /** Notes de performance retenues (vide : toutes). */
  readonly grades: readonly PerformanceGrade[];
  /** Métier retenu, ou `ALL`. */
  readonly role: DevRole | 'ALL';
  /** Situations exigées, toutes à la fois (vide : aucune contrainte). */
  readonly flags: readonly TeamFlag[];
  readonly sort: TeamSort;
}

export const DEFAULT_TEAM_FILTERS: TeamFilters = {
  grades: [],
  role: 'ALL',
  flags: [],
  sort: 'PERF_DESC',
};

/** Nombre de filtres actifs (le tri n'en est pas un), pour le badge du bouton. */
export function activeFilterCount(filters: TeamFilters): number {
  return filters.grades.length + (filters.role === 'ALL' ? 0 : 1) + filters.flags.length;
}

/** Collègues encore dans l'équipe avec qui le dev est en conflit, du pire au moins pire. */
export function conflictsOf(dev: DevView, team: readonly DevView[]): DevView[] {
  return team
    .filter((other) => other.id !== dev.id && (dev.relations[other.id] ?? 0) < CONFLICT_AFFINITY)
    .sort((a, b) => (dev.relations[a.id] ?? 0) - (dev.relations[b.id] ?? 0));
}

function hasFlag(dev: DevView, flag: TeamFlag, team: readonly DevView[]): boolean {
  switch (flag) {
    case 'CONFLICT':
      return conflictsOf(dev, team).length > 0;
    case 'TIRED':
      return dev.energy < TIRED_ENERGY;
    case 'LOW_MORALE':
      return dev.morale < LOW_MORALE;
    case 'REMOTE':
      return dev.remoteReason !== null && !dev.absence?.started;
    case 'OFFICE':
      return dev.remoteReason === null && !dev.absence?.started;
    case 'ABSENT':
      return dev.absence?.started === true;
  }
}

export function matchesFilters(
  dev: DevView,
  filters: TeamFilters,
  team: readonly DevView[],
): boolean {
  if (filters.grades.length > 0 && !filters.grades.includes(dev.performance.grade)) return false;
  if (filters.role !== 'ALL' && dev.role !== filters.role) return false;
  return filters.flags.every((flag) => hasFlag(dev, flag, team));
}

function compare(a: DevView, b: DevView, sort: TeamSort, team: readonly DevView[]): number {
  switch (sort) {
    case 'PERF_DESC':
      return b.performance.score - a.performance.score;
    case 'PERF_ASC':
      return a.performance.score - b.performance.score;
    case 'MORALE_ASC':
      return a.morale - b.morale;
    case 'ENERGY_ASC':
      return a.energy - b.energy;
    case 'CONFLICTS_DESC':
      return conflictsOf(b, team).length - conflictsOf(a, team).length;
    case 'SALARY_DESC':
      return b.salary - a.salary;
    case 'SENIORITY_DESC':
      return (b.career?.sprintsInTeam ?? 0) - (a.career?.sprintsInTeam ?? 0);
    case 'NAME':
      return 0;
  }
}

/** Devs qui passent les filtres, triés ; à égalité, par ordre alphabétique. */
export function filterTeam(team: readonly DevView[], filters: TeamFilters): DevView[] {
  return team
    .filter((dev) => matchesFilters(dev, filters, team))
    .sort(
      (a, b) =>
        compare(a, b, filters.sort, team) || a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1),
    );
}

/** Ajoute la valeur si elle est absente, la retire sinon. */
export function toggle<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}
