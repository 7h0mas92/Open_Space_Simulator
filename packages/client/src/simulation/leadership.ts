import {
  BALANCE,
  contributorsOf,
  isManagementRole,
  type DevRole,
  type GameState,
  type TeamShape,
} from '@oss/shared';
import { addGauge, changeMoral, clamp, devIds } from './helpers';

/**
 * Encadrement et équipe qualité : ce que le directeur technique, le sous-directeur, les
 * managers, le scrum master, le tech lead, les testeurs et les DevOps apportent à toute
 * l'équipe. Aucun tirage au sort : une équipe sans ces profils joue exactement comme avant.
 */

/** Effectif par profil et phase : de quoi savoir quels postes sont ouverts. */
export function teamShape(state: GameState): TeamShape {
  const roles: Partial<Record<DevRole, number>> = {};
  for (const id of devIds(state)) {
    const role = state.components.identity[id]?.role;
    if (role) roles[role] = (roles[role] ?? 0) + 1;
  }
  return { phase: state.phase, roles };
}

export interface LeadershipEffects {
  /** Bonus de productivité pour toute l'équipe (0,06 = +6 %). */
  readonly productivity: number;
  /** Multiplicateur du malus des réunions du Product Owner (1 : inchangé). */
  readonly meetingFactor: number;
  /** Multiplicateur de la dette ajoutée par les features livrées (1 : inchangé). */
  readonly featureDebtFactor: number;
  /** Part de l'équipe encadrée par un manager, de 0 à 1. */
  readonly coverage: number;
  /** Moral gagné chaque jour par chaque membre de l'équipe. */
  readonly dailyMoral: number;
  /** Stabilité gagnée chaque jour. */
  readonly dailyStability: number;
  /** Hype gagnée chaque jour. */
  readonly dailyHype: number;
  /** Points de conflit effacés chaque jour (médiation des managers). */
  readonly conflictEase: number;
}

export const NO_LEADERSHIP: LeadershipEffects = {
  productivity: 0,
  meetingFactor: 1,
  featureDebtFactor: 1,
  coverage: 0,
  dailyMoral: 0,
  dailyStability: 0,
  dailyHype: 0,
  conflictEase: 0,
};

/** Effets de l'encadrement pour une équipe donnée (fonction pure, facile à tester). */
export function leadershipFor(shape: TeamShape): LeadershipEffects {
  const l = BALANCE.leadership;
  const count = (role: DevRole) => shape.roles[role] ?? 0;
  const directors = Math.min(1, count('DIRECTOR'));
  const deputies = Math.min(1, count('DEPUTY_DIRECTOR'));
  const scrum = Math.min(1, count('SCRUM_MASTER'));
  const contributors = contributorsOf(shape);
  const coverage =
    contributors > 0 ? clamp((count('MANAGER') * l.managerSpan) / contributors, 0, 1) : 0;
  const qaReduction = Math.min(
    l.qaDebtReductionMax,
    count('QA_TESTER') * l.qaDebtReductionPerTester,
  );
  return {
    productivity:
      directors * l.directorProductivity +
      deputies * l.deputyProductivity +
      coverage * l.managerProductivity +
      scrum * l.scrumProductivity,
    meetingFactor: scrum > 0 ? l.scrumMeetingFactor : 1,
    featureDebtFactor: l.techLeadDebtFactor ** Math.min(2, count('TECH_LEAD')) * (1 - qaReduction),
    coverage,
    dailyMoral: deputies * l.deputyDailyMoral + coverage * l.managerDailyMoral,
    dailyStability: Math.min(l.devopsDailyStabilityMax, count('DEVOPS') * l.devopsDailyStability),
    dailyHype: directors * l.directorDailyHype,
    conflictEase: coverage * l.managerConflictEase,
  };
}

/** L'équipe compte-t-elle au moins un profil qui change quelque chose ? (raccourci) */
function hasLeadershipRole(state: GameState): boolean {
  for (const id of devIds(state)) {
    const role = state.components.identity[id]?.role;
    if (
      role &&
      (isManagementRole(role) || role === 'TECH_LEAD' || role === 'QA_TESTER' || role === 'DEVOPS')
    )
      return true;
  }
  return false;
}

/** Effets de l'encadrement pour la partie en cours. */
export function leadershipEffects(state: GameState): LeadershipEffects {
  return hasLeadershipRole(state) ? leadershipFor(teamShape(state)) : NO_LEADERSHIP;
}

/** Effets quotidiens (à minuit) : moral, médiation des conflits, stabilité, hype. */
export function applyDailyLeadership(state: GameState): void {
  const effects = leadershipEffects(state);
  if (effects === NO_LEADERSHIP) return;
  if (effects.dailyHype > 0) addGauge(state, 'hype', effects.dailyHype);
  if (effects.dailyStability > 0) addGauge(state, 'stability', effects.dailyStability);
  for (const id of devIds(state)) {
    if (effects.dailyMoral > 0) changeMoral(state, id, effects.dailyMoral);
    if (effects.conflictEase <= 0) continue;
    const relations = state.components.relations[id];
    if (!relations) continue;
    for (const [otherId, affinity] of Object.entries(relations)) {
      if (affinity < 0) relations[otherId] = Math.min(0, affinity + effects.conflictEase);
    }
  }
}
