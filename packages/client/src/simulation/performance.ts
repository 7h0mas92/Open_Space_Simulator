import {
  BALANCE,
  ROLE_PROFILES,
  TIME,
  type EntityId,
  type DevRole,
  type GameState,
  type Identity,
  type SprintPerformance,
  type Stats,
} from '@oss/shared';
import { clamp, devIds } from './helpers';

/**
 * Performance des devs.
 *
 * Pendant le sprint, la simulation note ce que chaque dev produit (`record*`). À la démo,
 * le sprint est archivé (`closeSprintPerformance`). Les fonctions de calcul (`productivityOf`,
 * `overallPerformance`...) sont pures : la fiche dev et les candidats les utilisent aussi.
 */

export function emptySprintPerformance(sprint: number): SprintPerformance {
  return {
    sprint,
    work: 0,
    qualitySum: 0,
    points: 0,
    tasks: 0,
    workTicks: 0,
    incidents: 0,
    lost: false,
  };
}

/** Compteurs du sprint en cours d'un dev (créés au besoin, pour les vieilles sauvegardes). */
function current(state: GameState, devId: EntityId): SprintPerformance | null {
  if (!(devId in state.components.identity)) return null;
  const store = state.components.performance;
  const perf = (store[devId] ??= {
    current: emptySprintPerformance(state.sprint),
    sprints: [],
  });
  return perf.current;
}

/** Une demi-heure de travail sur une tâche. */
export function recordWork(state: GameState, devId: EntityId, units: number, quality: number) {
  const perf = current(state, devId);
  if (!perf) return;
  perf.work += units;
  perf.qualitySum += units * quality;
  perf.workTicks += 1;
}

export function recordTaskDone(state: GameState, devId: EntityId, points: number): void {
  const perf = current(state, devId);
  if (!perf) return;
  perf.points += points;
  perf.tasks += 1;
}

export function recordIncident(state: GameState, devId: EntityId): void {
  const perf = current(state, devId);
  if (perf) perf.incidents += 1;
}

/** Fin de sprint (démo ou sprint perdu) : le sprint de chaque dev est archivé. */
export function closeSprintPerformance(state: GameState, lost = false): void {
  for (const id of devIds(state)) {
    const perf = current(state, id);
    const record = state.components.performance[id];
    if (!perf || !record) continue;
    record.sprints.push({ ...perf, sprint: state.sprint, lost });
    const overflow = record.sprints.length - BALANCE.performance.sprintsKept;
    if (overflow > 0) record.sprints.splice(0, overflow);
    record.current = emptySprintPerformance(state.sprint + 1);
  }
}

// --- Calculs (purs) ------------------------------------------------------------------------

/**
 * Productivité d'un sprint : travail produit par heure travaillée, en % d'un dev standard
 * dans des conditions ordinaires. Null si le dev n'a pas travaillé sur une tâche ce sprint.
 */
export function productivityOf(sprint: SprintPerformance): number | null {
  if (sprint.workTicks === 0) return null;
  const hours = (sprint.workTicks * TIME.tickMinutes) / 60;
  return (sprint.work / hours / BALANCE.performance.referenceUnitsPerHour) * 100;
}

/** Heures passées à travailler sur une tâche pendant un sprint. */
export function hoursOf(sprint: SprintPerformance): number {
  return (sprint.workTicks * TIME.tickMinutes) / 60;
}

/** Qualité moyenne du travail d'un sprint (0 à 1), ou null s'il n'a rien produit. */
export function qualityOf(sprint: SprintPerformance): number | null {
  return sprint.work > 0 ? sprint.qualitySum / sprint.work : null;
}

/**
 * Productivité attendue d'après le profil, en % d'un dev standard. Elle ne compte que ce qui
 * tient au dev (vitesse, profil, niveau, trait) ; le moral, le café ou les réunions s'ajoutent
 * en jeu et se voient dans la productivité mesurée.
 */
export function expectedProductivity(identity: Identity, stats: Stats, level = 1): number {
  let rate = (stats.speed / 5) * ROLE_PROFILES[identity.role].speedMultiplier;
  rate *= 1 + (level - 1) * 0.05;
  if (identity.trait === 'PERFECTIONIST') rate *= 0.9;
  return rate * 100;
}

/** Qualité attendue d'après le profil (0 à 1), comme `effectiveQuality` sans les bonus du bureau. */
export function expectedQuality(identity: Identity, stats: Stats): number {
  let quality = (stats.quality / 10) * ROLE_PROFILES[identity.role].qualityMultiplier;
  if (identity.trait === 'PERFECTIONIST') quality *= 1.15;
  return clamp(quality, 0, 1);
}

export const PERFORMANCE_GRADES = ['S', 'A', 'B', 'C', 'D'] as const;
export type PerformanceGrade = (typeof PERFORMANCE_GRADES)[number];

export interface OverallPerformance {
  /** Note de 0 à 100. */
  score: number;
  grade: PerformanceGrade;
  /** Vrai tant qu'aucun sprint terminé ne permet de mesurer : la note vient du profil. */
  estimated: boolean;
  /** Productivité retenue (mesurée sur les 2 derniers sprints, ou attendue), en %. */
  productivity: number;
  /** Qualité retenue, de 0 à 1. */
  quality: number;
  /** Pannes provoquées pendant les 2 derniers sprints. */
  incidents: number;
}

export function gradeOf(score: number): PerformanceGrade {
  if (score >= 85) return 'S';
  if (score >= 70) return 'A';
  if (score >= 55) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

/**
 * Ce que certains profils apportent sans produire de tickets : la hype du Product Owner,
 * la qualité perçue aux démos de la Designeuse, la relecture du tech lead, et l'encadrement,
 * qui fait avancer les autres (`leadership.ts`).
 */
export const ROLE_PERFORMANCE_BONUS: Partial<Record<DevRole, number>> = {
  PRODUCT_OWNER: 20,
  DESIGNER: 10,
  TECH_LEAD: 10,
  SCRUM_MASTER: 25,
  MANAGER: 30,
  DEPUTY_DIRECTOR: 30,
  DIRECTOR: 35,
};

/** Sprints mesurables : parmi les 2 derniers sprints, ceux où le dev a travaillé. */
export function measuredSprints(sprints: readonly SprintPerformance[]): SprintPerformance[] {
  return sprints.slice(-2).filter((sprint) => !sprint.lost && sprint.workTicks > 0);
}

/**
 * Performance globale, de 0 à 100 :
 * - 50 % productivité (200 % d'un dev standard donne le maximum) ;
 * - 35 % qualité du travail ;
 * - 15 % endurance (capacité à tenir sans s'épuiser) ;
 * - un bonus pour le Product Owner et la Designeuse (`ROLE_PERFORMANCE_BONUS`) ;
 * - 5 points de moins par panne de prod provoquée.
 * Elle est mesurée sur les 2 derniers sprints, ou estimée d'après le profil avant cela.
 */
export function overallPerformance(
  identity: Identity,
  stats: Stats,
  level: number,
  sprints: readonly SprintPerformance[] = [],
): OverallPerformance {
  const measured = measuredSprints(sprints);
  const work = measured.reduce((sum, sprint) => sum + sprint.work, 0);
  const estimated = measured.length === 0;
  const productivity = estimated
    ? expectedProductivity(identity, stats, level)
    : measured.reduce((sum, sprint) => sum + (productivityOf(sprint) ?? 0), 0) / measured.length;
  const quality =
    work > 0
      ? measured.reduce((sum, sprint) => sum + sprint.qualitySum, 0) / work
      : expectedQuality(identity, stats);
  const incidents = sprints.slice(-2).reduce((sum, sprint) => sum + sprint.incidents, 0);
  const raw =
    0.25 * Math.min(productivity, 200) +
    35 * quality +
    1.5 * stats.endurance +
    (ROLE_PERFORMANCE_BONUS[identity.role] ?? 0) -
    5 * incidents;
  const score = Math.round(clamp(raw, 0, 100));
  return { score, grade: gradeOf(score), estimated, productivity, quality, incidents };
}
