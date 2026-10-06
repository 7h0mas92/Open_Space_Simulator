import {
  BALANCE,
  TASK_TYPES,
  type CommandResult,
  type EntityId,
  type GameState,
  type Task,
  type TaskColumn,
  type TaskType,
} from '@oss/shared';
import { TASK_SIZES, TASK_TITLES, TASK_TYPE_WEIGHTS } from './data/tasks';
import { addComponent, createEntity, destroyEntity, query } from './ecs';
import { text } from './helpers';
import type { Rng } from './rng';

/** Identifiants des tâches d'une colonne, triés par priorité. */
export function tasksInColumn(state: GameState, column: TaskColumn): EntityId[] {
  return query(state, 'task')
    .filter((id) => state.components.task[id]?.column === column)
    .sort(
      (a, b) => (state.components.task[a]?.order ?? 0) - (state.components.task[b]?.order ?? 0),
    );
}

/** Crée une tâche dans le backlog. */
export function createTask(state: GameState, rng: Rng, type?: TaskType): EntityId {
  const taskType = type ?? rng.weighted(TASK_TYPES, (t) => TASK_TYPE_WEIGHTS[t]) ?? 'FEATURE';
  const size = rng.weighted(TASK_SIZES, (s) => s.weight)?.size ?? 3;
  const id = createEntity(state);
  const task: Task = {
    title: text(rng.pick(TASK_TITLES[taskType])),
    type: taskType,
    size,
    progress: 0,
    work: size * BALANCE.work.unitsPerPoint,
    column: 'BACKLOG',
    order: state.nextEntityId,
    assigneeId: null,
    qualitySum: 0,
    debtFactor: 0,
    shinyFramework: taskType === 'FEATURE' && rng.chance(BALANCE.roles.shinyFrameworkChance),
    designApproved: false,
    hallucinated: false,
    createdAtSprint: state.sprint,
    doneAtSprint: null,
  };
  addComponent(state, id, 'task', task);
  return id;
}

/**
 * Nouvelles idées à chaque sprint : au moins `newTasksPerSprint` (2 par dev pour une
 * grande équipe). Au-delà de `backlogMax`, les plus vieilles idées sont oubliées.
 */
export function refillBacklog(state: GameState, rng: Rng): void {
  const { start } = BALANCE;
  const existing = tasksInColumn(state, 'BACKLOG').length;
  const team = Object.keys(state.components.identity).length;
  const toCreate = existing === 0 ? start.backlogSize : Math.max(start.newTasksPerSprint, team * 2);
  for (let i = 0; i < toCreate; i++) createTask(state, rng);
  const backlog = tasksInColumn(state, 'BACKLOG');
  const overflow = backlog.length - start.backlogMax;
  if (overflow <= 0) return;
  const oldest = [...backlog].sort(
    (a, b) =>
      (state.components.task[a]?.createdAtSprint ?? 0) -
      (state.components.task[b]?.createdAtSprint ?? 0),
  );
  for (const id of oldest.slice(0, overflow)) destroyEntity(state, id);
}

/** Réattribue des ordres 0, 1, 2... dans une colonne, en insérant `taskId` à `index`. */
function reorder(
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
 * Un dev sans tâche prend la suivante : d'abord une tâche commencée puis abandonnée,
 * sinon la première de la colonne TODO.
 */
export function autoAssign(state: GameState, devId: EntityId): EntityId | null {
  const candidates = [...tasksInColumn(state, 'IN_PROGRESS'), ...tasksInColumn(state, 'TODO')];
  const next = candidates.find((id) => state.components.task[id]?.assigneeId === null);
  if (!next) return null;
  assignTask(state, next, devId);
  return next;
}
