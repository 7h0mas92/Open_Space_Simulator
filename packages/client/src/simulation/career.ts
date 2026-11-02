import {
  careerLegend,
  careerLegendOfSeed,
  careerMilestoneLabel,
  careerStars,
  isEndMilestone,
  type CareerLegend,
  type CareerMetric,
  type CareerMilestone,
  type CareerResult,
  type CareerState,
  type GameState,
  type LocalizedText,
  type Outcome,
  type Phase,
} from '@oss/shared';
import { phaseIndex } from './furniture';
import { notify, teamSize, text, type SimContext } from './helpers';

/*
 * Mode Carrière : suivi des jalons de la légende choisie (voir `shared/sim/career.ts`).
 * Tout se lit dans l'état, sans un seul tirage : une partie Carrière se rejoue à l'identique.
 * Les jalons à échéance sont vérifiés à chaque démo ; ceux « de fin » quand la partie s'arrête.
 */

/** Légende d'une partie Carrière (la première si la graine n'en nomme aucune). */
export function legendOfSeed(seed: string): CareerLegend {
  return careerLegend(careerLegendOfSeed(seed) ?? 'pepin');
}

/** État de départ d'une carrière : tous les jalons à tenir. */
export function createCareerState(seed: string): CareerState {
  const legend = legendOfSeed(seed);
  return {
    legend: legend.id,
    milestones: Object.fromEntries(
      legend.milestones.map((milestone) => [milestone.id, { status: 'PENDING', sprint: null }]),
    ),
  };
}

/** Valeur actuelle d'un indicateur visé par un jalon. */
export function careerMetricValue(state: GameState, metric: CareerMetric): number {
  switch (metric) {
    case 'users':
      return state.gauges.users;
    case 'valuation':
      return state.valuation;
    case 'raised':
      return state.totalRaised;
    case 'rounds':
      return state.fundingRounds;
    case 'features':
      return state.stats.featuresShipped;
    case 'team':
      return teamSize(state);
    case 'stability':
      return state.gauges.stability;
    case 'hype':
      return state.gauges.hype;
    case 'ownership':
      return state.ownership;
  }
}

/** Ce que la partie a atteint, pour un jalon (null : seulement jugé à la fin). */
function reached(
  state: GameState,
  milestone: CareerMilestone,
  phase: Phase,
  outcome: Outcome | null,
): boolean {
  switch (milestone.kind) {
    case 'phase':
      return phaseIndex(phase) >= phaseIndex(milestone.phase);
    case 'metric':
      return careerMetricValue(state, milestone.metric) >= milestone.min;
    case 'debtMax':
      return outcome !== null && outcome !== 'BANKRUPTCY' && state.gauges.debt <= milestone.max;
    case 'outcome':
      return outcome !== null && milestone.outcomes.includes(outcome);
  }
}

function settle(
  state: GameState,
  ctx: SimContext,
  career: CareerState,
  milestone: CareerMilestone,
  done: boolean,
): void {
  career.milestones[milestone.id] = { status: done ? 'DONE' : 'FAILED', sprint: state.sprint };
  const legend = careerLegend(career.legend);
  const label = careerMilestoneLabel(milestone);
  notify(
    state,
    ctx,
    done ? 'CAREER_MILESTONE' : 'CAREER_MISSED',
    done
      ? text(['Jalon tenu, comme {legend} : {label}.', 'Milestone met, like {legend}: {label}.'], {
          legend: legend.name,
          label,
        })
      : text(['Jalon manqué ({legend}) : {label}.', 'Milestone missed ({legend}): {label}.'], {
          legend: legend.name,
          label,
        }),
  );
}

/** Dernier sprint pour tenir le jalon (null : jugé à la fin de la partie). */
function deadlineOf(milestone: CareerMilestone): number | null {
  return milestone.kind === 'phase' || milestone.kind === 'metric'
    ? (milestone.bySprint ?? null)
    : null;
}

/** Démo de fin de sprint : jalons atteints, et échéances dépassées. */
export function careerDemo(state: GameState, ctx: SimContext): void {
  const career = state.career;
  if (!career) return;
  for (const milestone of careerLegend(career.legend).milestones) {
    if (isEndMilestone(milestone) || career.milestones[milestone.id]?.status !== 'PENDING')
      continue;
    const deadline = deadlineOf(milestone);
    if (deadline === null) continue;
    if (reached(state, milestone, state.phase, null) && state.sprint <= deadline)
      settle(state, ctx, career, milestone, true);
    else if (state.sprint >= deadline) settle(state, ctx, career, milestone, false);
  }
}

/**
 * Fin de partie : les jalons encore ouverts sont jugés une dernière fois (une échéance pas encore
 * passée compte si l'objectif est atteint), puis le bilan donne les étoiles.
 */
export function careerEnd(
  state: GameState,
  ctx: SimContext,
  outcome: Outcome,
  phaseReached: Phase,
): CareerResult | null {
  const career = state.career;
  if (!career) return null;
  const legend = careerLegend(career.legend);
  for (const milestone of legend.milestones) {
    if (career.milestones[milestone.id]?.status !== 'PENDING') continue;
    const alive = outcome !== 'BANKRUPTCY' || milestone.kind === 'outcome';
    const deadline = deadlineOf(milestone);
    const inTime = deadline === null || state.sprint <= deadline;
    settle(
      state,
      ctx,
      career,
      milestone,
      alive && inTime && reached(state, milestone, phaseReached, outcome),
    );
  }
  const done = legend.milestones.filter(
    (milestone) => career.milestones[milestone.id]?.status === 'DONE',
  ).length;
  const total = legend.milestones.length;
  return { legend: legend.id, done, total, stars: careerStars(done, total) };
}

/** Fin de la phrase partageable : « Carrière Pépin Computer : 3 jalons sur 4 (★★☆). » */
export function careerHeadline(result: CareerResult): LocalizedText {
  const legend = careerLegend(result.legend);
  const stars = '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars);
  return text(
    [
      ' Carrière « {legend} » : {done} jalons sur {total} ({stars}).',
      ' Career "{legend}": {done} of {total} milestones ({stars}).',
    ],
    { legend: legend.name, done: result.done, total: result.total, stars },
  );
}
