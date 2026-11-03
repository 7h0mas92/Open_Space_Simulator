import {
  BALANCE,
  ROLE_STACK,
  ROLE_TRADE,
  TASK_TRADES,
  TASK_FLOW,
  TASK_TYPES,
  taskTrade,
  wrongSide,
  type CommandResult,
  type EntityId,
  type GameState,
  type Task,
  type TaskColumn,
  type TaskTrade,
  type TaskType,
} from '@oss/shared';
import {
  DESIGN_TASKS,
  PRODUCT_TASKS,
  TASK_SIZES,
  TASK_TYPE_WEIGHTS,
  type TradeTaskTemplate,
} from './data/tasks';
import { QA_TASKS } from './data/qaTasks';
import { addComponent, createEntity, destroyEntity, query } from './ecs';
import { devIds, text } from './helpers';
import type { Rng } from './rng';
import { pickTaskTitle, tradeTitleRoll } from './taskTitles';

/** Identifiants des tâches d'une colonne, triés par priorité. */
export function tasksInColumn(state: GameState, column: TaskColumn): EntityId[] {
  return query(state, 'task')
    .filter((id) => state.components.task[id]?.column === column)
    .sort(
      (a, b) => (state.components.task[a]?.order ?? 0) - (state.components.task[b]?.order ?? 0),
    );
}

/** Modèles des tâches hors code : designeuse, Product Owner et testeurs. */
const TRADE_TASKS: Readonly<Record<Exclude<TaskTrade, 'DEV'>, readonly TradeTaskTemplate[]>> = {
  DESIGN: DESIGN_TASKS,
  PRODUCT: PRODUCT_TASKS,
  QA: QA_TASKS,
};

/**
 * Crée une tâche dans le backlog. Les tâches de code tirent leur type ; celles de la
 * designeuse, du Product Owner et des testeurs tirent un modèle qui fixe le type. Le titre
 * vient ensuite de `pickTaskTitle` (catalogue selon la phase, saison, pas de répétition).
 */
export function createTask(
  state: GameState,
  rng: Rng,
  type?: TaskType,
  trade: TaskTrade = 'DEV',
): EntityId {
  const template = trade === 'DEV' ? null : rng.pick(TRADE_TASKS[trade]);
  const taskType =
    template?.type ?? type ?? rng.weighted(TASK_TYPES, (t) => TASK_TYPE_WEIGHTS[t]) ?? 'FEATURE';
  const size = rng.weighted(TASK_SIZES, (s) => s.weight)?.size ?? 3;
  // Le code garde son ancien tirage de titre ; les autres métiers ont déjà tiré leur modèle.
  const roll = trade === 'DEV' ? rng.next() : tradeTitleRoll(state);
  const title = pickTaskTitle(state, trade, taskType, roll);
  const id = createEntity(state);
  const task: Task = {
    title: text(title),
    type: taskType,
    trade,
    size,
    progress: 0,
    work: size * BALANCE.work.unitsPerPoint,
    column: 'BACKLOG',
    order: state.nextEntityId,
    assigneeId: null,
    qualitySum: 0,
    debtFactor: 0,
    shinyFramework:
      trade === 'DEV' && taskType === 'FEATURE' && rng.chance(BALANCE.roles.shinyFrameworkChance),
    designApproved: false,
    hallucinated: false,
    createdAtSprint: state.sprint,
    doneAtSprint: null,
  };
  addComponent(state, id, 'task', task);
  return id;
}

/** Nombre de membres de l'équipe par métier (l'encadrement ne compte dans aucun). */
export function teamByTrade(state: GameState): Record<TaskTrade, number> {
  const count: Record<TaskTrade, number> = { DEV: 0, DESIGN: 0, PRODUCT: 0, QA: 0 };
  for (const id of devIds(state)) {
    const role = state.components.identity[id]?.role;
    const trade = role ? ROLE_TRADE[role] : null;
    if (trade) count[trade] += 1;
  }
  return count;
}

/**
 * Métier de la prochaine tâche, au prorata des effectifs de chaque métier. Une équipe
 * qui ne fait que du code ne consomme aucun tirage : ses parties restent identiques.
 */
function pickTrade(rng: Rng, team: Record<TaskTrade, number>): TaskTrade {
  const present = TASK_TRADES.filter((trade) => team[trade] > 0);
  if (present.length <= 1) return present[0] ?? 'DEV';
  return rng.weighted(present, (trade) => team[trade]) ?? 'DEV';
}

/** Taille maximale du backlog : elle grandit avec l'équipe. */
export function backlogMax(state: GameState): number {
  const team = taskTakers(state);
  return Math.max(BALANCE.start.backlogMax, Math.ceil(team * TASK_FLOW.backlogPerDev));
}

/** Membres de l'équipe qui prennent des tâches (l'encadrement n'en prend pas). */
export function taskTakers(state: GameState): number {
  const team = teamByTrade(state);
  return team.DEV + team.DESIGN + team.PRODUCT + team.QA;
}

/** Nouvelles idées pour le sprint qui commence : 3 par dev, au moins `newTasksPerSprint`. */
export function sprintIdeas(state: GameState): number {
  return Math.max(
    BALANCE.start.newTasksPerSprint,
    Math.ceil(taskTakers(state) * TASK_FLOW.ideasPerDev),
  );
}

/**
 * Nouvelles idées à chaque sprint : au moins `newTasksPerSprint`, sinon 3 par dev qui prend
 * des tâches. Le backlog garde jusqu'à `backlogMax` idées (davantage pour une grande équipe) ;
 * au-delà, les plus vieilles sont oubliées. Pendant le sprint, `sprintLoad.ts` complète le
 * « À faire » si l'équipe avance plus vite que prévu.
 */
export function refillBacklog(state: GameState, rng: Rng): void {
  const { start } = BALANCE;
  const existing = tasksInColumn(state, 'BACKLOG').length;
  const toCreate = existing === 0 ? start.backlogSize : sprintIdeas(state);
  const trades = teamByTrade(state);
  for (let i = 0; i < toCreate; i++) createTask(state, rng, undefined, pickTrade(rng, trades));
  const backlog = tasksInColumn(state, 'BACKLOG');
  const overflow = backlog.length - backlogMax(state);
  if (overflow <= 0) return;
  const oldest = [...backlog].sort(
    (a, b) =>
      (state.components.task[a]?.createdAtSprint ?? 0) -
      (state.components.task[b]?.createdAtSprint ?? 0),
  );
  for (const id of oldest.slice(0, overflow)) destroyEntity(state, id);
}

/** Réattribue des ordres 0, 1, 2... dans une colonne, en insérant `taskId` à `index`. */
export function reorder(
  state: GameState,
  column: TaskColumn,
  taskId: EntityId,
  index: number | undefined,
): void {
  const ids = tasksInColumn(state, column).filter((id) => id !== taskId);
  ids.splice(index === undefined ? ids.length : Math.min(index, ids.length), 0, taskId);
  ids.forEach((id, position) => {
    const task = state.components.task[id];
    if (task) task.order = position;
  });
}

/** Glisser-déposer du Kanban : BACKLOG ⇄ TODO, ou changement de priorité. */
export function moveTask(
  state: GameState,
  taskId: EntityId,
  column: 'BACKLOG' | 'TODO',
  index?: number,
): CommandResult {
  const task = state.components.task[taskId];
  if (!task) return { ok: false, error: 'NOT_FOUND' };
  if (task.column !== 'BACKLOG' && task.column !== 'TODO')
    return { ok: false, error: 'WRONG_STAGE' };
  if (column === 'BACKLOG' && task.assigneeId) unassign(state, taskId);
  task.column = column;
  reorder(state, column, taskId, index);
  return { ok: true };
}

/** Bouton « Tout en À faire » : le backlog passe en bas de la colonne TODO, dans son ordre. */
export function moveAllToTodo(state: GameState): CommandResult {
  const backlog = tasksInColumn(state, 'BACKLOG');
  if (backlog.length === 0) return { ok: false, error: 'NOT_FOUND' };
  for (const id of backlog) {
    const task = state.components.task[id];
    if (!task) continue;
    task.column = 'TODO';
    reorder(state, 'TODO', id, undefined);
  }
  return { ok: true };
}

/** Retire une tâche du Kanban (en libérant le dev qui y travaillait). */
export function removeTask(state: GameState, taskId: EntityId): void {
  unassign(state, taskId);
  destroyEntity(state, taskId);
}

function unassign(state: GameState, taskId: EntityId): void {
  const task = state.components.task[taskId];
  if (!task?.assigneeId) return;
  const worker = state.components.worker[task.assigneeId];
  if (worker?.taskId === taskId) worker.taskId = null;
  task.assigneeId = null;
}

/** Affecte une tâche à un dev. Un dev ne travaille que sur une tâche à la fois. */
export function assignTask(
  state: GameState,
  taskId: EntityId,
  devId: EntityId | null,
): CommandResult {
  const task = state.components.task[taskId];
  if (!task || task.column === 'DONE') return { ok: false, error: 'NOT_FOUND' };
  if (devId === null) {
    unassign(state, taskId);
    return { ok: true };
  }
  const worker = state.components.worker[devId];
  if (!worker) return { ok: false, error: 'NOT_FOUND' };
  if (worker.taskId && worker.taskId !== taskId) unassign(state, worker.taskId);
  unassign(state, taskId);
  task.assigneeId = devId;
  worker.taskId = taskId;
  if (task.column === 'BACKLOG') {
    task.column = 'TODO';
    reorder(state, 'TODO', taskId, undefined);
  }
  return { ok: true };
}

/**
 * Métier d'un membre de l'équipe (`DEV` par défaut), ou `null` pour l'encadrement, qui ne
 * prend aucune tâche tout seul.
 */
export function devTrade(state: GameState, devId: EntityId): TaskTrade | null {
  const role = state.components.identity[devId]?.role;
  return role ? ROLE_TRADE[role] : 'DEV';
}

/**
 * Clé de file d'un dev : son métier, et son côté de la stack pour un dev front ou back
 * (`null` : il ne prend rien tout seul). Deux devs de même clé voient les mêmes tâches.
 */
export function devQueueKey(state: GameState, devId: EntityId): string | null {
  const role = state.components.identity[devId]?.role;
  const trade = devTrade(state, devId);
  if (!trade) return null;
  const stack = role ? ROLE_STACK[role] : undefined;
  return stack && stack !== 'FULL' && trade === 'DEV' ? `${trade}:${stack}` : trade;
}

/** Reste-t-il une tâche libre de ce métier en TODO ou en cours ? (sans trier les colonnes) */
export function hasFreeTask(state: GameState, trade: TaskTrade): boolean {
  for (const id in state.components.task) {
    const task = state.components.task[id];
    if (
      task &&
      task.assigneeId === null &&
      (task.column === 'TODO' || task.column === 'IN_PROGRESS') &&
      taskTrade(task) === trade
    )
      return true;
  }
  return false;
}

/**
 * Un dev sans tâche prend la suivante de son métier : d'abord une tâche urgente, puis une
 * tâche commencée puis abandonnée, sinon la première de la colonne TODO. Il ne touche jamais
 * aux tâches des autres métiers : seul le joueur peut les lui confier à la main. Un dev front
 * prend d'abord du front (un dev back, du back) ; s'il n'en reste plus, il dépanne de l'autre
 * côté, plus lentement. Les urgences passent toujours en premier. L'encadrement ne prend rien.
 */
export function autoAssign(state: GameState, devId: EntityId): EntityId | null {
  const trade = devTrade(state, devId);
  const role = state.components.identity[devId]?.role;
  if (!trade) return null;
  const queue = [...tasksInColumn(state, 'IN_PROGRESS'), ...tasksInColumn(state, 'TODO')];
  const isUrgent = (id: EntityId) => state.components.task[id]?.kind === 'URGENT';
  const candidates = [...queue.filter(isUrgent), ...queue.filter((id) => !isUrgent(id))];
  const free = candidates.filter((id) => {
    const task = state.components.task[id];
    return task?.assigneeId === null && taskTrade(task) === trade;
  });
  const onSide = (id: EntityId) => {
    const task = state.components.task[id];
    return !role || !task || task.kind === 'URGENT' || !wrongSide(role, task);
  };
  const next = free.find(onSide) ?? free[0];
  if (!next) return null;
  assignTask(state, next, devId);
  return next;
}
