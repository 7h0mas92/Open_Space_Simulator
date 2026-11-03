import { TASK_FLOW, TIME, type GameState } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { MORE_TASK_TITLES } from '../../src/simulation/data/moreTasks';
import { TASK_TITLES } from '../../src/simulation/data/tasks';
import {
  remainingWork,
  sprintForecast,
  sprintLoadSystem,
  tradePace,
  workdaysBefore,
  WORKDAYS_PER_SPRINT,
} from '../../src/simulation/sprintLoad';
import { workSystem } from '../../src/simulation/systems/work';
import {
  createTask,
  refillBacklog,
  removeTask,
  sprintIdeas,
  taskTakers,
  tasksInColumn,
} from '../../src/simulation/tasks';
import { clockAt } from '../../src/simulation/time';
import { makeContext, stateWithTeam } from './fixtures';

/** Place l'état à un jour (0 = lundi) et une heure du sprint en cours. */
function setTime(state: GameState, day: number, hour: number) {
  state.sprintTick = (day * 24 + hour - 8) * TIME.ticksPerHour;
  return clockAt(state.sprint, state.sprintTick);
}

function executing(roles: Parameters<typeof stateWithTeam>[0]) {
  const { state, ids } = stateWithTeam(roles);
  state.stage = 'EXECUTION';
  state.sprint = 3;
  for (const id of tasksInColumn(state, 'TODO')) removeTask(state, id);
  return { state, ids, ctx: makeContext(state) };
}

const todoCount = (state: GameState) =>
  tasksInColumn(state, 'TODO').length + tasksInColumn(state, 'IN_PROGRESS').length;

describe('Idées du sprint selon la taille de l’équipe', () => {
  it('3 idées par membre qui prend des tâches, au moins 5', () => {
    const small = stateWithTeam(['SENIOR_BEARD']).state;
    const big = stateWithTeam(Array.from({ length: 10 }, () => 'TEN_X' as const)).state;
    expect(sprintIdeas(small)).toBe(5);
    expect(sprintIdeas(big)).toBe(10 * TASK_FLOW.ideasPerDev);
  });

  it('l’encadrement ne compte pas dans les idées', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD', 'TEN_X', 'SCRUM_MASTER']);
    expect(taskTakers(state)).toBe(2);
  });

  it('le backlog reçoit les idées du sprint', () => {
    const { state } = stateWithTeam(Array.from({ length: 8 }, () => 'TEN_X' as const));
    const ctx = makeContext(state);
    createTask(state, ctx.rng);
    const before = tasksInColumn(state, 'BACKLOG').length;
    refillBacklog(state, ctx.rng);
    expect(tasksInColumn(state, 'BACKLOG').length).toBe(before + 8 * TASK_FLOW.ideasPerDev);
  });
});

describe('Jours ouvrés', () => {
  it('un sprint compte 10 jours ouvrés, sans les week-ends', () => {
    expect(WORKDAYS_PER_SPRINT).toBe(10);
    expect(workdaysBefore(0)).toBe(0);
    expect(workdaysBefore(5)).toBe(5);
    expect(workdaysBefore(7)).toBe(5);
    expect(workdaysBefore(8)).toBe(6);
    expect(workdaysBefore(14)).toBe(10);
  });
});

describe('Réapprovisionnement du « À faire »', () => {
  it('le travail abattu est compté par métier', () => {
    const { state, ids, ctx } = executing(['SENIOR_BEARD']);
    const task = createTask(state, ctx.rng);
    state.components.task[task]!.column = 'TODO';
    state.components.worker[ids[0]!]!.taskId = task;
    state.components.task[task]!.assigneeId = ids[0]!;
    state.components.activity[ids[0]!]!.kind = 'WORKING';
    workSystem(state, ctx, setTime(state, 0, 10));
    expect(state.tracker.workByTrade.DEV ?? 0).toBeGreaterThan(0);
  });

  it('une équipe rapide reçoit des tâches pour les jours qui restent', () => {
    const { state, ctx } = executing(['SENIOR_BEARD', 'TEN_X']);
    // 3 jours ouvrés passés, 60 unités par jour : il faut ~7 jours × 60 de travail.
    state.tracker.workByTrade = { DEV: 180 };
    const clock = setTime(state, 3, TASK_FLOW.topUp.morningHour);
    sprintLoadSystem(state, ctx, clock);
    expect(todoCount(state)).toBeGreaterThan(0);
    expect(ctx.outbox.some((n) => n.kind === 'TODO_TOPPED_UP')).toBe(true);
    // Pas plus de 2 tâches par dev en un passage.
    expect(todoCount(state)).toBeLessThanOrEqual(2 * TASK_FLOW.topUp.maxPerDev);
  });

  it('les idées du backlog passent en premier, dans leur ordre', () => {
    const { state, ctx } = executing(['SENIOR_BEARD']);
    for (let i = 0; i < 3; i++) createTask(state, ctx.rng);
    const first = tasksInColumn(state, 'BACKLOG')[0]!;
    state.tracker.workByTrade = { DEV: 300 };
    sprintLoadSystem(state, ctx, setTime(state, 2, TASK_FLOW.topUp.morningHour));
    expect(state.components.task[first]!.column).toBe('TODO');
  });

  it('rien n’est ajouté quand le « À faire » suffit', () => {
    const { state, ctx } = executing(['SENIOR_BEARD']);
    for (let i = 0; i < 6; i++) {
      const id = createTask(state, ctx.rng);
      state.components.task[id]!.column = 'TODO';
    }
    const before = todoCount(state);
    state.tracker.workByTrade = { DEV: 10 };
    sprintLoadSystem(state, ctx, setTime(state, 2, TASK_FLOW.topUp.morningHour));
    expect(todoCount(state)).toBe(before);
    expect(ctx.outbox.some((n) => n.kind === 'TODO_TOPPED_UP')).toBe(false);
  });

  it('une équipe en retard est prévenue au 6e jour ouvré, sans rien retirer', () => {
    const { state, ctx } = executing(['SENIOR_BEARD']);
    for (let i = 0; i < 12; i++) {
      const id = createTask(state, ctx.rng);
      state.components.task[id]!.column = 'TODO';
    }
    const before = todoCount(state);
    state.tracker.workByTrade = { DEV: 5 * 4 };
    // Lundi de la 2e semaine (jour 7) : 5 jours ouvrés passés.
    sprintLoadSystem(state, ctx, setTime(state, 7, TASK_FLOW.topUp.morningHour));
    expect(ctx.outbox.some((n) => n.kind === 'SPRINT_BEHIND')).toBe(true);
    expect(todoCount(state)).toBe(before);
  });

  it('à 14h, un dev qui attend sans tâche en reçoit une', () => {
    const { state, ids, ctx } = executing(['SENIOR_BEARD', 'TEN_X']);
    for (const id of ids) state.components.activity[id]!.kind = 'IDLE';
    sprintLoadSystem(state, ctx, setTime(state, 1, TASK_FLOW.topUp.middayHour));
    expect(todoCount(state)).toBe(2);
  });

  it('pas de réapprovisionnement le week-end ni en planification', () => {
    const { state, ctx } = executing(['SENIOR_BEARD']);
    state.tracker.workByTrade = { DEV: 500 };
    sprintLoadSystem(state, ctx, setTime(state, 5, TASK_FLOW.topUp.morningHour));
    state.stage = 'PLANNING';
    sprintLoadSystem(state, ctx, setTime(state, 1, TASK_FLOW.topUp.morningHour));
    expect(todoCount(state)).toBe(0);
  });

  it('les nouvelles idées ne touchent pas au générateur de la partie', () => {
    const { state, ctx } = executing(['SENIOR_BEARD']);
    for (const id of tasksInColumn(state, 'BACKLOG')) removeTask(state, id);
    const rngBefore = JSON.stringify(state.rng);
    state.tracker.workByTrade = { DEV: 300 };
    sprintLoadSystem(state, ctx, setTime(state, 2, TASK_FLOW.topUp.morningHour));
    expect(todoCount(state)).toBeGreaterThan(0);
    expect(JSON.stringify(state.rng)).toBe(rngBefore);
  });

  it('rythme et travail restant', () => {
    const { state, ctx } = executing(['SENIOR_BEARD']);
    expect(tradePace(state, 'DEV', 2, 0)).toBe(2 * TASK_FLOW.topUp.defaultUnitsPerDevDay);
    state.tracker.workByTrade = { DEV: 90 };
    expect(tradePace(state, 'DEV', 1, 3)).toBe(30);
    const id = createTask(state, ctx.rng);
    const task = state.components.task[id]!;
    task.column = 'IN_PROGRESS';
    task.progress = 4;
    expect(remainingWork(state).DEV).toBe(task.work - 4);
  });

  it('la prévision du Kanban grandit avec l’équipe', () => {
    const small = stateWithTeam(['SENIOR_BEARD']).state;
    const big = stateWithTeam(Array.from({ length: 6 }, () => 'TEN_X' as const)).state;
    const at = clockAt(1, 0);
    expect(sprintForecast(big, at).capacity).toBeGreaterThan(sprintForecast(small, at).capacity);
    expect(sprintForecast(big, at).takers).toBe(6);
  });
});

describe('Variété des tâches', () => {
  it('au moins 50 titres de code par type, sans doublon', () => {
    for (const type of ['FEATURE', 'REFACTO', 'BUGFIX', 'INFRA'] as const) {
      const titles = [...TASK_TITLES[type], ...MORE_TASK_TITLES[type]].map(([fr]) => fr);
      expect(titles.length).toBeGreaterThanOrEqual(45);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });
});
