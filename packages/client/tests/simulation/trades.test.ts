import { BALANCE, ROLE_TRADE, taskTrade, type GameState, type TaskTrade } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { productivity } from '../../src/simulation/systems/work';
import {
  autoAssign,
  createTask,
  refillBacklog,
  tasksInColumn,
  teamByTrade,
} from '../../src/simulation/tasks';
import { makeContext, newSimulation, stateWithTeam } from './fixtures';

function backlogTrades(state: GameState): Set<TaskTrade> {
  return new Set(
    tasksInColumn(state, 'BACKLOG').map((id) => taskTrade(state.components.task[id]!)),
  );
}

describe('Métiers du Kanban', () => {
  it('chaque profil a un métier : la designeuse dessine, le PO écrit des specs', () => {
    expect(ROLE_TRADE.DESIGNER).toBe('DESIGN');
    expect(ROLE_TRADE.PRODUCT_OWNER).toBe('PRODUCT');
    expect(ROLE_TRADE.RUSTACEAN).toBe('DEV');
    const { state } = stateWithTeam(['SENIOR_BEARD', 'INTERN', 'DESIGNER']);
    expect(teamByTrade(state)).toEqual({ DEV: 2, DESIGN: 1, PRODUCT: 0 });
  });

  it('une équipe de devs ne reçoit que des tâches de code', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD', 'TEN_X', 'AI_AGENT']);
    refillBacklog(state, makeContext(state).rng);
    expect(backlogTrades(state)).toEqual(new Set(['DEV']));
  });

  it('le backlog suit les métiers présents dans l’équipe', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD', 'DESIGNER', 'PRODUCT_OWNER']);
    const ctx = makeContext(state);
    for (let i = 0; i < 4; i++) refillBacklog(state, ctx.rng);
    expect(backlogTrades(state)).toEqual(new Set(['DEV', 'DESIGN', 'PRODUCT']));
    for (const id of tasksInColumn(state, 'BACKLOG')) {
      const task = state.components.task[id]!;
      // Les tâches hors code ont leurs propres titres et ne tentent pas le Senior Barbu.
      if (taskTrade(task) !== 'DEV') {
        expect(['FEATURE', 'BUGFIX']).toContain(task.type);
        expect(task.shinyFramework).toBe(false);
      }
    }
  });

  it('chacun ne prend tout seul que les tâches de son métier', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'DESIGNER']);
    const [dev, designer] = ids as [string, string];
    const rng = makeContext(state).rng;
    const design = createTask(state, rng, undefined, 'DESIGN');
    const code = createTask(state, rng, 'FEATURE', 'DEV');
    for (const id of [design, code]) state.components.task[id]!.column = 'TODO';
    // La tâche de design est en tête de colonne, mais le dev passe son tour.
    expect(tasksInColumn(state, 'TODO')[0]).toBe(design);
    expect(autoAssign(state, dev)).toBe(code);
    expect(autoAssign(state, designer)).toBe(design);
    // Plus rien pour la designeuse : elle ne pioche pas dans le code.
    const other = createTask(state, rng, 'BUGFIX', 'DEV');
    state.components.task[other]!.column = 'TODO';
    state.components.task[design]!.assigneeId = null;
    state.components.worker[designer]!.taskId = null;
    state.components.task[design]!.column = 'DONE';
    expect(autoAssign(state, designer)).toBeNull();
  });

  it('pendant le sprint, la designeuse ne vole pas le travail des devs', () => {
    const simulation = newSimulation('metiers');
    const state = simulation.state;
    // Une partie qui commence avec un seul dev : toutes les tâches sont du code.
    expect(backlogTrades(state)).toEqual(new Set(['DEV']));
    simulation.dispatch({ type: 'MOVE_ALL_TO_TODO' });
    simulation.dispatch({ type: 'START_SPRINT' });
    simulation.runUntilBlocked(48);
    for (const id of Object.keys(state.components.identity)) {
      const taskId = state.components.worker[id]?.taskId;
      if (!taskId) continue;
      expect(taskTrade(state.components.task[taskId]!)).toBe(
        ROLE_TRADE[state.components.identity[id]!.role],
      );
    }
  });

  it('une tâche confiée hors métier avance moins vite', () => {
    const { state, ids } = stateWithTeam(['PRODUCT_OWNER']);
    const ctx = makeContext(state);
    const po = ids[0]!;
    const own = state.components.task[createTask(state, ctx.rng, undefined, 'PRODUCT')]!;
    const code = { ...own, trade: 'DEV' as const };
    expect(productivity(state, ctx, po, code)).toBeCloseTo(
      productivity(state, ctx, po, own) * BALANCE.work.offTradeMultiplier,
    );
  });

  it('les tâches des anciennes sauvegardes sont du code', () => {
    const { state } = stateWithTeam(['INTERN']);
    const id = createTask(state, makeContext(state).rng);
    delete state.components.task[id]!.trade;
    expect(taskTrade(state.components.task[id]!)).toBe('DEV');
    expect(autoAssign(state, Object.keys(state.components.identity)[0]!)).toBeNull();
    state.components.task[id]!.column = 'TODO';
    expect(autoAssign(state, Object.keys(state.components.identity)[0]!)).toBe(id);
  });
});

describe('Bouton « Tout en À faire »', () => {
  it('passe tout le backlog en À faire, à la suite et dans l’ordre', () => {
    const simulation = newSimulation('tout-a-faire');
    const state = simulation.state;
    const [first, ...rest] = tasksInColumn(state, 'BACKLOG');
    simulation.dispatch({ type: 'MOVE_TASK', taskId: first!, column: 'TODO' });
    expect(simulation.dispatch({ type: 'MOVE_ALL_TO_TODO' }).result.ok).toBe(true);
    expect(tasksInColumn(state, 'BACKLOG')).toEqual([]);
    expect(tasksInColumn(state, 'TODO')).toEqual([first, ...rest]);
    // Backlog vide : rien à faire.
    expect(simulation.dispatch({ type: 'MOVE_ALL_TO_TODO' }).result.ok).toBe(false);
  });

  it('est refusé hors de la gestion du Kanban', () => {
    const simulation = newSimulation('tout-a-faire-fin');
    simulation.state.stage = 'DEMO';
    expect(simulation.dispatch({ type: 'MOVE_ALL_TO_TODO' }).result).toEqual({
      ok: false,
      error: 'WRONG_STAGE',
    });
  });
});
