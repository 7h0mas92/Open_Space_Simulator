import {
  BALANCE,
  TASK_FLOW,
  TASK_TRADES,
  TIME,
  taskTrade,
  type EntityId,
  type GameState,
  type TaskTrade,
} from '@oss/shared';
import { devIds, notify, text, type SimContext } from './helpers';
import { TASK_SIZES } from './data/tasks';
import { sideRng, type Rng } from './rng';
import { createTask, devTrade, hasFreeTask, reorder, tasksInColumn, teamByTrade } from './tasks';
import type { SimClock } from './time';

/**
 * Charge du sprint : le « À faire » suit le rythme réel de l'équipe.
 *
 * - Chaque matin de semaine, pour chaque métier (code, design, produit, recette), on compare
 *   le travail qui reste dans « À faire » et « En cours » à ce que l'équipe abat par jour
 *   depuis le début du sprint. S'il n'y a pas de quoi tenir jusqu'à la démo, des tâches
 *   arrivent : d'abord les idées du backlog, dans leur ordre, puis de nouvelles idées.
 * - À 14h, un métier dont un dev attend sans rien à faire reçoit tout de suite des tâches.
 * - Au 6e jour ouvré, si l'équipe est nettement en retard, un message prévient que tout ne
 *   sera pas fini (rien n'est retiré : le joueur garde la main sur ses priorités).
 *
 * Le hasard des nouvelles idées vient d'une graine à part (`seed#tasks#topup#…`) : le
 * générateur de la partie n'est jamais consommé ici, la partie reste déterministe.
 */

const { topUp } = TASK_FLOW;

/** Jours ouvrés d'un sprint (le sprint commence un lundi : 2 semaines de 5 jours). */
export const WORKDAYS_PER_SPRINT = Math.round((TIME.daysPerSprint * 5) / 7);

/** Jours ouvrés déjà écoulés avant le jour `dayInSprint` (0 = lundi de la 1re semaine). */
export function workdaysBefore(dayInSprint: number): number {
  let count = 0;
  for (let day = 0; day < dayInSprint; day++) if (day % 7 < 5) count += 1;
  return count;
}

/** Travail (en unités) qui reste à faire dans « À faire » et « En cours », par métier. */
export function remainingWork(state: GameState): Record<TaskTrade, number> {
  const left: Record<TaskTrade, number> = { DEV: 0, DESIGN: 0, PRODUCT: 0, QA: 0 };
  for (const id in state.components.task) {
    const task = state.components.task[id];
    if (!task || (task.column !== 'TODO' && task.column !== 'IN_PROGRESS')) continue;
    left[taskTrade(task)] += Math.max(0, task.work - task.progress);
  }
  return left;
}

/**
 * Rythme d'un métier : unités de travail abattues par jour ouvré depuis le début du sprint.
 * Au premier matin, faute de mesure, on prend une estimation par membre du métier.
 */
export function tradePace(
  state: GameState,
  trade: TaskTrade,
  members: number,
  workdaysDone: number,
): number {
  if (workdaysDone === 0) return members * topUp.defaultUnitsPerDevDay;
  return (state.tracker.workByTrade[trade] ?? 0) / workdaysDone;
}

/** Ajoute le travail abattu au compteur du sprint (appelé par le système « travail »). */
export function recordTradeWork(state: GameState, trade: TaskTrade, units: number): void {
  state.tracker.workByTrade[trade] = (state.tracker.workByTrade[trade] ?? 0) + units;
}

/**
 * Fait passer jusqu'à `count` tâches de ce métier dans « À faire » : les idées du backlog
 * d'abord (dans l'ordre choisi par le joueur), puis de nouvelles idées. S'arrête dès que
 * `units` unités de travail sont ajoutées. Renvoie le nombre de tâches ajoutées.
 */
function feedTodo(
  state: GameState,
  rng: Rng,
  trade: TaskTrade,
  count: number,
  units: number,
): number {
  let added = 0;
  let addedUnits = 0;
  const backlog = tasksInColumn(state, 'BACKLOG').filter((id) => {
    const task = state.components.task[id];
    return task !== undefined && taskTrade(task) === trade;
  });
  while (added < count && addedUnits < units) {
    const id: EntityId = backlog.shift() ?? createTask(state, rng, undefined, trade);
    const task = state.components.task[id];
    if (!task) break;
    task.column = 'TODO';
    reorder(state, 'TODO', id, undefined);
    added += 1;
    addedUnits += Math.max(0, task.work - task.progress);
  }
  return added;
}

function topUpRng(state: GameState): Rng {
  return sideRng(state.seed, 'tasks', 'topup', state.sprint, state.sprintTick);
}

/** Matin : compare le travail restant au rythme de chaque métier et complète si besoin. */
function morningTopUp(state: GameState, ctx: SimContext, clock: SimClock): void {
  const done = workdaysBefore(clock.dayInSprint);
  const daysLeft = WORKDAYS_PER_SPRINT - done;
  if (daysLeft <= 0) return;
  const team = teamByTrade(state);
  const left = remainingWork(state);
  const rng = topUpRng(state);
  let added = 0;
  let lateTasks = 0;
  for (const trade of TASK_TRADES) {
    const members = team[trade];
    if (members === 0) continue;
    const pace = tradePace(state, trade, members, done);
    const needed = pace * daysLeft * topUp.margin;
    if (left[trade] < needed) {
      added += feedTodo(state, rng, trade, members * topUp.maxPerDev, needed - left[trade]);
    } else if (
      done === topUp.behindFromWorkday &&
      pace > 0 &&
      left[trade] > pace * daysLeft * topUp.behindRatio
    ) {
      lateTasks += lateTaskCount(state, trade, pace * daysLeft);
    }
  }
  if (added > 0)
    notify(
      state,
      ctx,
      'TODO_TOPPED_UP',
      text(
        [
          'L’équipe avance plus vite que prévu : {count} tâche(s) ajoutée(s) au « À faire » pour la suite du sprint.',
          'The team is ahead of schedule: {count} task(s) added to "To do" for the rest of the sprint.',
        ],
        { count: added },
      ),
    );
  if (lateTasks > 0)
    notify(
      state,
      ctx,
      'SPRINT_BEHIND',
      text(
        [
          'À ce rythme, environ {count} tâche(s) du « À faire » ne seront pas finies avant la démo.',
          'At this pace, about {count} task(s) in "To do" won’t be done before the demo.',
        ],
        { count: lateTasks },
      ),
    );
}

/** Nombre de tâches de ce métier, en fin de « À faire », que le rythme ne permettra pas de finir. */
function lateTaskCount(state: GameState, trade: TaskTrade, capacity: number): number {
  const queue = [...tasksInColumn(state, 'IN_PROGRESS'), ...tasksInColumn(state, 'TODO')];
  let budget = capacity;
  let late = 0;
  for (const id of queue) {
    const task = state.components.task[id];
    if (!task || taskTrade(task) !== trade) continue;
    budget -= Math.max(0, task.work - task.progress);
    if (budget < 0) late += 1;
  }
  return late;
}

/** 14h : un dev présent qui attend sans tâche de son métier en reçoit une tout de suite. */
function middayTopUp(state: GameState, ctx: SimContext): void {
  const waiting: Record<TaskTrade, number> = { DEV: 0, DESIGN: 0, PRODUCT: 0, QA: 0 };
  for (const id of devIds(state)) {
    const trade = devTrade(state, id);
    const kind = state.components.activity[id]?.kind;
    if (!trade || state.components.worker[id]?.taskId || kind === 'GONE') continue;
    waiting[trade] += 1;
  }
  const rng = topUpRng(state);
  let added = 0;
  for (const trade of TASK_TRADES) {
    if (waiting[trade] === 0 || hasFreeTask(state, trade)) continue;
    added += feedTodo(state, rng, trade, waiting[trade], Number.POSITIVE_INFINITY);
  }
  if (added > 0)
    notify(
      state,
      ctx,
      'TODO_TOPPED_UP',
      text(
        [
          'Des devs n’avaient plus rien à faire : {count} tâche(s) ajoutée(s) au « À faire ».',
          'Some devs had nothing left to do: {count} task(s) added to "To do".',
        ],
        { count: added },
      ),
    );
}

/** Unités de travail d'une tâche moyenne du backlog (taille moyenne × unités par point). */
export const AVERAGE_TASK_UNITS =
  (TASK_SIZES.reduce((sum, s) => sum + s.size * s.weight, 0) /
    TASK_SIZES.reduce((sum, s) => sum + s.weight, 0)) *
  BALANCE.work.unitsPerPoint;

/** Prévision affichée au-dessus du Kanban. */
export interface SprintForecast {
  /** Membres de l'équipe qui prennent des tâches. */
  readonly takers: number;
  /** Tâches que l'équipe devrait encore finir d'ici la démo, au rythme mesuré. */
  readonly capacity: number;
  /** Tâches en « À faire » et « En cours ». */
  readonly planned: number;
}

/** Combien de tâches l'équipe peut encore finir ce sprint (estimation au rythme actuel). */
export function sprintForecast(state: GameState, clock: SimClock): SprintForecast {
  const executing = state.stage === 'EXECUTION';
  const done = executing ? workdaysBefore(clock.dayInSprint) : 0;
  const daysLeft = WORKDAYS_PER_SPRINT - done;
  const team = teamByTrade(state);
  let units = 0;
  for (const trade of TASK_TRADES) {
    if (team[trade] > 0) units += tradePace(state, trade, team[trade], done) * daysLeft;
  }
  const planned = Object.values(state.components.task).filter(
    (task) => task?.column === 'TODO' || task?.column === 'IN_PROGRESS',
  ).length;
  return {
    takers: team.DEV + team.DESIGN + team.PRODUCT + team.QA,
    capacity: Math.round(units / AVERAGE_TASK_UNITS),
    planned,
  };
}

/** Système appelé par le flux de tâches, les jours ouvrés pendant l'exécution. */
export function sprintLoadSystem(state: GameState, ctx: SimContext, clock: SimClock): void {
  if (state.stage !== 'EXECUTION' || clock.isWeekend) return;
  if (clock.hour === topUp.morningHour) morningTopUp(state, ctx, clock);
  else if (clock.hour === topUp.middayHour) middayTopUp(state, ctx);
}
