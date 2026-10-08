import { BALANCE, TIME, type CommandResult, type GameState, type LocalizedText } from '@oss/shared';
import { BUYERS, FEEDBACK_BAD, FEEDBACK_GOOD, FEEDBACK_NEUTRAL } from './data/flavor';
import { generateCandidates } from './devs';
import { destroyEntity, query } from './ecs';
import { computeValuation, monthlyExpenses, monthlyRevenue } from './economy';
import { endGame, endOfTime } from './endings';
import { phaseIndex } from './furniture';
import {
  addGauge,
  addMoney,
  addUsers,
  hasRole,
  moneyText,
  notify,
  text,
  type SimContext,
} from './helpers';
import { hypeDrift } from './systems/daily';
import { refillBacklog } from './tasks';

/** Remise à zéro des compteurs du sprint. */
function resetTracker(state: GameState): void {
  state.tracker = {
    usersAtStart: state.gauges.users,
    usersLost: 0,
    revenue: 0,
    expenses: 0,
    hypeAtStart: state.gauges.hype,
    incidents: 0,
  };
}

/** Prépare la planification d'un sprint : candidats, backlog, compteurs. */
export function beginPlanning(state: GameState, ctx: SimContext): void {
  state.stage = 'PLANNING';
  state.sprintTick = 0;
  state.events.drawnThisSprint = 0;
  generateCandidates(state, ctx);
  refillBacklog(state, ctx.rng);
  resetTracker(state);
}

/** Fin de la planification : le sprint démarre. */
export function startSprint(state: GameState, ctx: SimContext): CommandResult {
  if (state.stage !== 'PLANNING') return { ok: false, error: 'WRONG_STAGE' };
  state.stage = 'EXECUTION';
  notify(
    state,
    ctx,
    'SPRINT_STARTED',
    text(['Sprint {sprint} : c’est parti !', "Sprint {sprint}: let's go!"], {
      sprint: state.sprint,
    }),
  );
  return { ok: true };
}

function pickFeedback(state: GameState, ctx: SimContext, shipped: number): LocalizedText[] {
  const happy = shipped > 0 && state.gauges.stability >= 50;
  const angry = state.gauges.stability < 35 || shipped === 0;
  const feedback: LocalizedText[] = [];
  for (let i = 0; i < 3; i++) {
    const roll = ctx.rng.next();
    const pool =
      roll < 0.25
        ? FEEDBACK_NEUTRAL
        : happy && !angry
          ? FEEDBACK_GOOD
          : angry
            ? FEEDBACK_BAD
            : roll < 0.6
              ? FEEDBACK_GOOD
              : FEEDBACK_BAD;
    feedback.push(text(ctx.rng.pick(pool)));
  }
  return feedback;
}

/**
 * Démo de fin de sprint : les features terminées sont livrées aux utilisateurs.
 * C'est ici que se joue le dilemme : les features font monter la hype, les refactos la font baisser.
 */
export function endSprint(state: GameState, ctx: SimContext): void {
  const done = query(state, 'task')
    .map((id) => state.components.task[id])
    .filter((task) => task?.column === 'DONE' && task.doneAtSprint === state.sprint);
  let featurePoints = 0;
  let refactoPoints = 0;
  let usersGained = 0;
  let shipped = 0;
  let hallucinations = 0;
  const { users: u } = BALANCE;
  const perPoint = u.perFeaturePoint[state.phase];
  const hypeFactor = 0.5 + state.gauges.hype / 100;
  const stabilityFactor = 0.5 + state.gauges.stability / 200;
  const designer = hasRole(state, 'DESIGNER') ? 1 + u.designerBonus : 1;
  for (const task of done) {
    if (!task) continue;
    if (task.type === 'REFACTO') refactoPoints += task.size;
    if (task.type !== 'FEATURE') continue;
    if (task.hallucinated) {
      hallucinations += 1;
      continue;
    }
    shipped += 1;
    featurePoints += task.size;
    const quality = task.progress > 0 ? task.qualitySum / task.progress : 0.5;
    usersGained += task.size * perPoint * (0.5 + quality) * hypeFactor * stabilityFactor * designer;
  }
  addUsers(state, usersGained);
  // Plus la hype est haute, plus il est dur de la faire monter encore.
  const hypeRoom = Math.max(0, 1 - state.gauges.hype / BALANCE.hype.softCap);
  addGauge(
    state,
    'hype',
    featurePoints * u.hypePerFeaturePoint * hypeRoom + refactoPoints * u.hypePerRefactoPoint,
  );
  state.valuation = computeValuation(state);

  state.history.sprints.push({
    sprint: state.sprint,
    lost: false,
    usersGained: Math.round(usersGained),
    usersLost: Math.round(state.tracker.usersLost),
    revenue: Math.round(state.tracker.revenue),
    expenses: Math.round(state.tracker.expenses),
    hypeDelta: Math.round((state.gauges.hype - state.tracker.hypeAtStart) * 10) / 10,
    featuresShipped: shipped,
    hallucinations,
    incidents: state.tracker.incidents,
    valuation: state.valuation,
    feedback: pickFeedback(state, ctx, shipped),
  });
  state.stage = 'DEMO';
  notify(
    state,
    ctx,
    'SPRINT_ENDED',
    text(
      [
        'Démo du sprint {sprint} : {shipped} features livrées.',
        'Sprint {sprint} demo: {shipped} features shipped.',
      ],
      { sprint: state.sprint, shipped },
    ),
  );

  checkPhaseAndOffers(state, ctx);
}

/** Licorne à 1 Md€ de valorisation ; offres de rachat à partir de la Série A. */
function checkPhaseAndOffers(state: GameState, ctx: SimContext): void {
  if (state.phase === 'SERIES_A' && state.valuation >= BALANCE.phases.unicornValuation) {
    state.phase = 'UNICORN';
    notify(
      state,
      ctx,
      'PHASE_UP',
      text(
        [
          'Licorne ! Valorisation de {amount}. Toboggan et sieste-pods débloqués.',
          'Unicorn! Valued at {amount}. Slide and nap pods unlocked.',
        ],
        { amount: moneyText(state.valuation) },
      ),
    );
  }
  if (state.acquisitionOffer && state.acquisitionOffer.expiresAtSprint < state.sprint)
    state.acquisitionOffer = null;
  if (
    !state.acquisitionOffer &&
    phaseIndex(state.phase) >= phaseIndex('SERIES_A') &&
    ctx.rng.chance(BALANCE.phases.acquisitionChancePerSprint)
  ) {
    const buyer = text(ctx.rng.pick(BUYERS));
    const amount = Math.round(state.valuation * ctx.rng.range(0.6, 1.2));
    state.acquisitionOffer = { buyer, amount, expiresAtSprint: state.sprint + 1 };
    notify(
      state,
      ctx,
      'ACQUISITION_OFFER',
      text(
        [
          '{buyer} propose de vous racheter pour {amount}.',
          '{buyer} offers to acquire you for {amount}.',
        ],
        { buyer, amount: moneyText(amount) },
      ),
    );
  }
}

/** Sprint perdu (effet `sprintsLost`) : deux semaines de dépenses, aucune production. */
function loseSprint(state: GameState, ctx: SimContext): void {
  resetTracker(state);
  const days = TIME.daysPerSprint;
  addMoney(state, (-monthlyExpenses(state) * days) / 30);
  addMoney(state, (monthlyRevenue(state) * days) / 30);
  const churn = state.gauges.users * BALANCE.users.baseDailyChurn * days;
  addUsers(state, -churn);
  for (let day = 0; day < days; day++) addGauge(state, 'hype', hypeDrift(state.gauges.hype));
  state.valuation = computeValuation(state);
  state.history.sprints.push({
    sprint: state.sprint,
    lost: true,
    usersGained: 0,
    usersLost: Math.round(state.tracker.usersLost),
    revenue: Math.round(state.tracker.revenue),
    expenses: Math.round(state.tracker.expenses),
    hypeDelta: Math.round((state.gauges.hype - state.tracker.hypeAtStart) * 10) / 10,
    featuresShipped: 0,
    hallucinations: 0,
    incidents: 0,
    valuation: state.valuation,
    feedback: [
      text(['« Il se passe quelque chose chez vous ? »', '"Is anything happening over there?"']),
    ],
  });
  notify(
    state,
    ctx,
    'SPRINT_LOST',
    text(
      [
        'Sprint {sprint} perdu. Personne ne sait vraiment ce qui s’est passé.',
        'Sprint {sprint} lost. Nobody really knows what happened.',
      ],
      { sprint: state.sprint },
    ),
  );
}

/** Supprime les tâches terminées des sprints précédents (l'état reste léger). */
function pruneDoneTasks(state: GameState): void {
  for (const id of query(state, 'task')) {
    const task = state.components.task[id];
    if (task?.column === 'DONE' && task.doneAtSprint !== null && task.doneAtSprint < state.sprint) {
      destroyEntity(state, id);
    }
  }
}

/** Fin de l'écran de démo : sprint suivant (ou fin de partie). */
export function endDemo(state: GameState, ctx: SimContext): CommandResult {
  if (state.stage !== 'DEMO') return { ok: false, error: 'WRONG_STAGE' };
  while (state.lostSprintsPending > 0) {
    state.lostSprintsPending -= 1;
    if (state.sprint >= state.totalSprints) break;
    state.sprint += 1;
    loseSprint(state, ctx);
    if (state.gauges.treasury < 0) {
      state.lostSprintsPending = 0;
      endGame(state, ctx, 'BANKRUPTCY');
      return { ok: true };
    }
  }
  state.lostSprintsPending = 0;
  if (state.sprint >= state.totalSprints) {
    endOfTime(state, ctx);
    return { ok: true };
  }
  state.sprint += 1;
  pruneDoneTasks(state);
  beginPlanning(state, ctx);
  return { ok: true };
}
