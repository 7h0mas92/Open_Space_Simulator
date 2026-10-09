import {
  BALANCE,
  OBJECTIVE_KINDS,
  PROD_FIX_TEMPLATE,
  TASK_FLOW,
  TIME,
  URGENT_TEMPLATES,
  WEEKLY_TEMPLATES,
  getTaskTemplate,
  templateTitle,
  type EntityId,
  type GameState,
  type ObjectiveDifficulty,
  type ObjectiveKind,
  type Phase,
  type SpecialTaskTemplate,
  type SprintObjective,
  type Task,
  type TaskFlowEffects,
} from '@oss/shared';
import { addComponent, createEntity, query } from './ecs';
import { monthlyExpenses } from './economy';
import {
  addGauge,
  addMoney,
  addUsers,
  changeMoral,
  devIds,
  moneyText,
  notify,
  teamSize,
  text,
  type SimContext,
} from './helpers';
import { Rng } from './rng';
import { removeTask, reorder, tasksInColumn } from './tasks';
import { clockAt, type SimClock } from './time';

/**
 * Tâches dynamiques : urgences, tâches hebdomadaires et objectifs de sprint. Tout le hasard passe par `flowRng`, un générateur créé à la volée à partir de la
 * graine, de la clé et de l'instant : le générateur de la partie (`ctx.rng`) n'est jamais
 * consommé ici, et la partie reste 100 % déterministe.
 */
function flowRng(state: GameState, key: string): Rng {
  return Rng.fromSeed(`${state.seed}#tasks#${key}#${state.sprint}#${state.sprintTick}`);
}

/** Instant du jeu qui ne fait que croître : sprint × ticks par sprint + tick du sprint. */
export function sprintTime(state: Pick<GameState, 'sprint' | 'sprintTick'>): number {
  return state.sprint * TIME.ticksPerSprint + state.sprintTick;
}

function isWorkingTick(clock: SimClock): boolean {
  return !clock.isWeekend && clock.hour >= 9 && clock.hour < 19;
}

/** Échéance après `hours` heures ouvrées (lundi-vendredi, 9h-19h), en temps de sprint. */
export function deadlineAfter(state: GameState, hours: number): number {
  let remaining = hours * TIME.ticksPerHour;
  let sprint = state.sprint;
  let tick = state.sprintTick;
  while (remaining > 0) {
    if (isWorkingTick(clockAt(sprint, tick))) remaining -= 1;
    tick += 1;
    if (tick >= TIME.ticksPerSprint) {
      sprint += 1;
      tick = 0;
    }
  }
  return sprint * TIME.ticksPerSprint + tick;
}

/** Vendredi à 18h de la semaine en cours, en temps de sprint. */
function fridayDeadline(state: GameState, clock: SimClock): number {
  const weekStart = clock.dayInSprint - (clock.dayOfWeek - 1);
  const minutes = (weekStart + 4) * 1440 + TASK_FLOW.weeklyDueHour * 60 - TIME.sprintStartMinute;
  return state.sprint * TIME.ticksPerSprint + Math.round(minutes / TIME.tickMinutes);
}

/** Tâches spéciales encore ouvertes (pas terminées). */
export function openSpecialTasks(state: GameState): EntityId[] {
  return query(state, 'task').filter((id) => {
    const task = state.components.task[id];
    return task?.kind !== undefined && task.column !== 'DONE';
  });
}

/** Les tâches spéciales passent devant : urgences d'abord, puis tâches hebdomadaires. */
function insertInTodo(state: GameState, taskId: EntityId): void {
  const todo = tasksInColumn(state, 'TODO').filter((id) => id !== taskId);
  const task = state.components.task[taskId];
  const rank = (id: EntityId) => {
    const kind = state.components.task[id]?.kind;
    return kind === 'URGENT' ? 0 : kind === 'WEEKLY' ? 1 : 2;
  };
  const mine = task?.kind === 'URGENT' ? 0 : 1;
  const index = todo.filter((id) => rank(id) <= mine).length;
  reorder(state, 'TODO', taskId, index);
}

function createSpecialTask(
  state: GameState,
  template: SpecialTaskTemplate,
  deadline: number,
): EntityId {
  const id = createEntity(state);
  const task: Task = {
    title: templateTitle(template),
    type: template.type,
    // Urgences et tâches de la semaine : c'est du code (prod, sécurité, dette).
    trade: 'DEV',
    size: template.size,
    progress: 0,
    work: template.size * BALANCE.work.unitsPerPoint,
    column: 'TODO',
    order: 0,
    assigneeId: null,
    qualitySum: 0,
    debtFactor: 0,
    shinyFramework: false,
    designApproved: false,
    hallucinated: false,
    createdAtSprint: state.sprint,
    doneAtSprint: null,
    kind: template.kind,
    template: template.id,
    deadline,
  };
  addComponent(state, id, 'task', task);
  insertInTodo(state, id);
  return id;
}

/** Une urgence tombe : la tâche passe en tête du « À faire » et un message s'affiche. */
export function raiseUrgent(
  state: GameState,
  ctx: SimContext,
  templateId: string,
): EntityId | null {
  const template = getTaskTemplate(templateId);
  if (!template?.deadlineHours || state.stage !== 'EXECUTION') return null;
  // Une même urgence n'est pas ouverte deux fois (la prod est déjà en train d'être réparée).
  const open = openSpecialTasks(state).some(
    (id) => state.components.task[id]?.template === templateId,
  );
  if (open) return null;
  const id = createSpecialTask(state, template, deadlineAfter(state, template.deadlineHours));
  notify(
    state,
    ctx,
    'URGENT_TASK',
    text(template.alert ?? template.title, { hours: template.deadlineHours }),
    id,
  );
  return id;
}

/** Applique les effets d'une tâche spéciale réussie ou ratée. */
export function applyFlowEffects(state: GameState, effects: TaskFlowEffects): void {
  if (effects.hype) addGauge(state, 'hype', effects.hype);
  if (effects.debt) addGauge(state, 'debt', effects.debt);
  if (effects.stability) addGauge(state, 'stability', effects.stability);
  if (effects.usersShare) addUsers(state, state.gauges.users * effects.usersShare);
  if (effects.treasuryMonths) addMoney(state, monthlyExpenses(state) * effects.treasuryMonths);
  if (effects.moral) for (const id of devIds(state)) changeMoral(state, id, effects.moral);
}

/** Une tâche spéciale terminée à temps : sa récompense tombe tout de suite. */
export function completeSpecialTask(state: GameState, ctx: SimContext, task: Task): void {
  const template = getTaskTemplate(task.template);
  if (!template || !task.kind) return;
  applyFlowEffects(state, template.reward);
  state.tracker.specialDone += 1;
  if (task.kind === 'URGENT') {
    state.stats.urgentDone += 1;
    notify(
      state,
      ctx,
      'URGENT_DONE',
      text(['Urgence réglée à temps : « {task} ».', 'Emergency handled in time: "{task}".'], {
        task: task.title,
      }),
    );
  } else {
    state.stats.weeklyDone += 1;
  }
}

/** Échéance dépassée : la tâche disparaît du Kanban et sa pénalité s'applique. */
function expireTasks(state: GameState, ctx: SimContext): void {
  const now = sprintTime(state);
  const missedWeekly: Task[] = [];
  for (const id of openSpecialTasks(state)) {
    const task = state.components.task[id];
    if (!task || task.deadline === undefined || task.deadline > now) continue;
    const template = getTaskTemplate(task.template);
    if (template) applyFlowEffects(state, template.penalty);
    state.tracker.specialMissed += 1;
    removeTask(state, id);
    if (task.kind === 'URGENT') {
      state.stats.urgentMissed += 1;
      notify(
        state,
        ctx,
        'URGENT_MISSED',
        text(
          [
            'Trop tard pour « {task} ». Les utilisateurs l’ont remarqué.',
            'Too late for "{task}". Users noticed.',
          ],
          { task: task.title },
        ),
      );
    } else {
      state.stats.weeklyMissed += 1;
      missedWeekly.push(task);
    }
  }
  if (missedWeekly.length > 0)
    notify(
      state,
      ctx,
      'WEEKLY_MISSED',
      text(
        [
          '{count} tâche(s) de la semaine pas faite(s). Ça finira bien par se voir.',
          "{count} weekly task(s) not done. Someone's going to notice.",
        ],
        { count: missedWeekly.length },
      ),
    );
}

/** Lundi 9h : les tâches de la semaine arrivent, dues vendredi 18h. */
function addWeeklyTasks(state: GameState, ctx: SimContext, clock: SimClock): void {
  const rng = flowRng(state, 'weekly');
  const count = Math.min(
    TASK_FLOW.weeklyMax,
    1 + Math.floor(teamSize(state) / TASK_FLOW.weeklyPerDevs),
  );
  if (count <= 0) return;
  const pool = [...WEEKLY_TEMPLATES];
  const deadline = fridayDeadline(state, clock);
  const titles: string[] = [];
  const titlesEn: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const template = rng.weighted(pool, (t) => t.weight);
    if (!template) break;
    pool.splice(pool.indexOf(template), 1);
    createSpecialTask(state, template, deadline);
    titles.push(template.title[0]);
    titlesEn.push(template.title[1]);
  }
  notify(
    state,
    ctx,
    'WEEKLY_TASKS',
    {
      fr: `Tâches de la semaine, à finir avant vendredi 18h : ${titles.join(', ')}.`,
      en: `This week's tasks, due Friday 6pm: ${titlesEn.join(', ')}.`,
    },
    null,
  );
}

/** Une urgence au hasard, plus probable avec une grande équipe (plus de code, plus de clients). */
function maybeRandomUrgent(state: GameState, ctx: SimContext): void {
  if (state.sprint < TASK_FLOW.urgentFromSprint) return;
  const rng = flowRng(state, 'urgent');
  const chance = Math.min(
    TASK_FLOW.urgentMaxChance,
    TASK_FLOW.urgentBaseChance + TASK_FLOW.urgentChancePerDev * teamSize(state),
  );
  if (!rng.chance(chance)) return;
  const template = rng.weighted(URGENT_TEMPLATES, (t) => t.weight);
  if (template) raiseUrgent(state, ctx, template.id);
}

/** Système « flux de tâches » : échéances, tâches de la semaine et urgences du jour. */
export function taskFlowSystem(state: GameState, ctx: SimContext, clock: SimClock): void {
  if (state.stage !== 'EXECUTION') return;
  expireTasks(state, ctx);
  if (clock.isWeekend) return;
  if (clock.dayOfWeek === 1 && clock.hour === 9) addWeeklyTasks(state, ctx, clock);
  if (clock.hour === 10) maybeRandomUrgent(state, ctx);
}

/** La prod tombe : une tâche urgente « Réparer la prod » apparaît (null si déjà ouverte). */
export function urgentProdFix(state: GameState, ctx: SimContext): EntityId | null {
  return raiseUrgent(state, ctx, PROD_FIX_TEMPLATE);
}

// ─── Objectifs de sprint ────────────────────────────────────────────────────

const DIFFICULTY_WEIGHTS: Record<Phase, Record<ObjectiveDifficulty, number>> = {
  GARAGE: { EASY: 0.6, MEDIUM: 0.3, HARD: 0.1 },
  SEED: { EASY: 0.45, MEDIUM: 0.4, HARD: 0.15 },
  SERIES_A: { EASY: 0.35, MEDIUM: 0.4, HARD: 0.25 },
  UNICORN: { EASY: 0.25, MEDIUM: 0.4, HARD: 0.35 },
  END: { EASY: 0.25, MEDIUM: 0.4, HARD: 0.35 },
};

const LEVEL: Record<ObjectiveDifficulty, number> = { EASY: 0, MEDIUM: 1, HARD: 2 };

/** Cibles par difficulté (facile, moyen, difficile). */
const TARGETS = {
  featuresPerDev: { EASY: 0.5, MEDIUM: 0.9, HARD: 1.4 },
  tasksPerDev: { EASY: 1.2, MEDIUM: 2, HARD: 3 },
  debtPoints: { EASY: 3, MEDIUM: 6, HARD: 10 },
  usersShare: { EASY: 0.05, MEDIUM: 0.1, HARD: 0.2 },
  usersFloor: { EASY: 200, MEDIUM: 500, HARD: 1500 },
} as const;

/** Cible d'un objectif selon sa difficulté et la taille de l'équipe. */
function objectiveTarget(
  state: GameState,
  kind: ObjectiveKind,
  difficulty: ObjectiveDifficulty,
): number {
  const team = Math.max(1, teamSize(state));
  const level = LEVEL[difficulty];
  switch (kind) {
    case 'SHIP_FEATURES':
      return Math.max(1 + level, Math.round(team * TARGETS.featuresPerDev[difficulty]));
    case 'CLOSE_TASKS':
      return Math.max(2 + level, Math.round(team * TARGETS.tasksPerDev[difficulty]));
    case 'ZERO_INCIDENT':
      return 0;
    case 'REDUCE_DEBT':
      return TARGETS.debtPoints[difficulty];
    case 'GAIN_USERS': {
      const users = Math.max(
        TARGETS.usersFloor[difficulty],
        state.gauges.users * TARGETS.usersShare[difficulty],
      );
      return Math.round(users / 10) * 10;
    }
  }
}

/** Un sprint sans panne est plus ou moins dur selon la stabilité et les stagiaires. */
function zeroIncidentDifficulty(state: GameState): ObjectiveDifficulty {
  const interns = devIds(state).filter(
    (id) => state.components.identity[id]?.role === 'INTERN',
  ).length;
  const risk = (100 - state.gauges.stability) / 100 + interns * 0.15;
  return risk < 0.3 ? 'EASY' : risk < 0.55 ? 'MEDIUM' : 'HARD';
}

/** Tire (ou non) l'objectif du sprint qui commence. */
export function rollObjective(state: GameState, ctx: SimContext): void {
  state.objective = null;
  if (state.sprint < TASK_FLOW.objectiveFromSprint) return;
  const rng = flowRng(state, 'objective');
  if (!rng.chance(TASK_FLOW.objectiveChance)) return;
  const kinds = OBJECTIVE_KINDS.filter((kind) => kind !== 'REDUCE_DEBT' || state.gauges.debt >= 20);
  const kind = rng.pick(kinds);
  const weights = DIFFICULTY_WEIGHTS[state.phase];
  const difficulty =
    kind === 'ZERO_INCIDENT'
      ? zeroIncidentDifficulty(state)
      : (rng.weighted(['EASY', 'MEDIUM', 'HARD'] as const, (d) => weights[d]) ?? 'EASY');
  const reward = TASK_FLOW.rewards[difficulty];
  state.objective = {
    kind,
    difficulty,
    target: objectiveTarget(state, kind, difficulty),
    baseline: kind === 'REDUCE_DEBT' ? Math.round(state.gauges.debt) : 0,
    sprint: state.sprint,
    reward: {
      treasury: Math.round((monthlyExpenses(state) * reward.treasuryMonths) / 1000) * 1000,
      hype: reward.hype,
      moral: reward.moral,
    },
    status: 'ACTIVE',
    value: null,
  };
  notify(state, ctx, 'OBJECTIVE_SET', objectiveText(state.objective));
}

/** Où en est l'objectif : la valeur à comparer à la cible. */
export function objectiveValue(state: GameState, objective: SprintObjective): number {
  const done = query(state, 'task')
    .map((id) => state.components.task[id])
    .filter((task) => task?.column === 'DONE' && task.doneAtSprint === objective.sprint);
  switch (objective.kind) {
    case 'SHIP_FEATURES':
      return done.filter((task) => task?.type === 'FEATURE' && !task.hallucinated && !task.kind)
        .length;
    case 'CLOSE_TASKS':
      return done.length;
    case 'ZERO_INCIDENT':
      return state.tracker.incidents;
    case 'REDUCE_DEBT':
      return Math.max(0, Math.round(objective.baseline - state.gauges.debt));
    case 'GAIN_USERS':
      return Math.max(0, Math.round(state.gauges.users - state.tracker.usersAtStart));
  }
}

export function objectiveReached(objective: SprintObjective, value: number): boolean {
  return objective.kind === 'ZERO_INCIDENT' ? value === 0 : value >= objective.target;
}

/** Libellé bilingue d'un objectif (notifications ; l'interface a ses propres textes). */
function objectiveText(objective: SprintObjective): ReturnType<typeof text> {
  const labels: Record<ObjectiveKind, readonly [string, string]> = {
    SHIP_FEATURES: ['livrer {target} features', 'ship {target} features'],
    CLOSE_TASKS: ['terminer {target} tâches', 'finish {target} tasks'],
    ZERO_INCIDENT: ['aucune panne de prod', 'zero prod outage'],
    REDUCE_DEBT: [
      'faire baisser la dette de {target} points',
      'bring tech debt down by {target} points',
    ],
    GAIN_USERS: ['gagner {target} utilisateurs', 'gain {target} users'],
  };
  const goal = text(labels[objective.kind], { target: objective.target });
  return text(
    [
      'Objectif du sprint : {goal}. Récompense : {reward}.',
      'Sprint goal: {goal}. Reward: {reward}.',
    ],
    { goal, reward: moneyText(objective.reward.treasury) },
  );
}

/** Démo : l'objectif est réussi (récompense) ou raté (rien de plus). */
export function settleObjective(state: GameState, ctx: SimContext): SprintObjective | null {
  const objective = state.objective;
  if (!objective || objective.status !== 'ACTIVE') return null;
  const value = objectiveValue(state, objective);
  objective.value = value;
  if (objectiveReached(objective, value)) {
    objective.status = 'SUCCESS';
    state.stats.objectivesDone += 1;
    addMoney(state, objective.reward.treasury);
    addGauge(state, 'hype', objective.reward.hype);
    if (objective.reward.moral)
      for (const id of devIds(state)) changeMoral(state, id, objective.reward.moral);
    notify(
      state,
      ctx,
      'OBJECTIVE_DONE',
      text(['Objectif du sprint atteint ! +{amount}.', 'Sprint goal reached! +{amount}.'], {
        amount: moneyText(objective.reward.treasury),
      }),
    );
  } else {
    objective.status = 'FAILED';
    state.stats.objectivesFailed += 1;
    notify(
      state,
      ctx,
      'OBJECTIVE_FAILED',
      text([
        'Objectif du sprint raté. Ce sera pour la prochaine fois.',
        'Sprint goal missed. Next time.',
      ]),
    );
  }
  return { ...objective };
}
