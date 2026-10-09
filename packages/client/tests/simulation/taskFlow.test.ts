import { GameStateSchema, PROD_FIX_TEMPLATE, TIME, type GameState } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { teamSize } from '../../src/simulation/helpers';
import { prodDown } from '../../src/simulation/systems/incidents';
import { workSystem } from '../../src/simulation/systems/work';
import {
  deadlineAfter,
  objectiveValue,
  raiseUrgent,
  rollObjective,
  settleObjective,
  sprintTime,
  taskFlowSystem,
} from '../../src/simulation/taskFlow';
import {
  autoAssign,
  backlogMax,
  createTask,
  refillBacklog,
  tasksInColumn,
} from '../../src/simulation/tasks';
import { clockAt } from '../../src/simulation/time';
import { endSprint } from '../../src/simulation/sprint';
import { makeContext, newSimulation, stateWithTeam } from './fixtures';

/** Place l'état à un jour (0 = lundi) et une heure du sprint en cours. */
function setTime(state: GameState, day: number, hour: number) {
  state.sprintTick = (day * 24 + hour - 8) * TIME.ticksPerHour;
  return clockAt(state.sprint, state.sprintTick);
}

function executing(roles: Parameters<typeof stateWithTeam>[0] = ['SENIOR_BEARD', 'TEN_X']) {
  const { state, ids } = stateWithTeam(roles);
  state.stage = 'EXECUTION';
  state.sprint = 3;
  return { state, ids, ctx: makeContext(state) };
}

const special = (state: GameState, kind: 'URGENT' | 'WEEKLY') =>
  Object.entries(state.components.task).filter(([, task]) => task.kind === kind);

describe('Volume de tâches', () => {
  it('le backlog grandit avec l’équipe', () => {
    const small = stateWithTeam(['SENIOR_BEARD']).state;
    const big = stateWithTeam(Array.from({ length: 12 }, () => 'TEN_X' as const)).state;
    for (const state of [small, big]) {
      createTask(state, makeContext(state).rng);
      refillBacklog(state, makeContext(state).rng);
    }
    const smallCount = tasksInColumn(small, 'BACKLOG').length;
    const bigCount = tasksInColumn(big, 'BACKLOG').length;
    expect(bigCount).toBeGreaterThanOrEqual(12 * 2);
    expect(bigCount).toBeGreaterThan(smallCount);
    expect(backlogMax(big)).toBeGreaterThan(backlogMax(small));
  });
});

describe('Tâches urgentes', () => {
  it('une panne de prod crée « Réparer la prod » en tête du « À faire », une seule fois', () => {
    const { state, ctx } = executing();
    const normal = createTask(state, ctx.rng);
    state.components.task[normal]!.column = 'TODO';
    prodDown(state, ctx, { fr: 'panne', en: 'outage' });
    prodDown(state, ctx, { fr: 'panne', en: 'outage' });
    const urgent = special(state, 'URGENT');
    expect(urgent).toHaveLength(1);
    expect(urgent[0]![1].template).toBe(PROD_FIX_TEMPLATE);
    expect(tasksInColumn(state, 'TODO')[0]).toBe(urgent[0]![0]);
    expect(ctx.outbox.some((n) => n.kind === 'URGENT_TASK')).toBe(true);
  });

  it('les devs libres prennent l’urgence avant le reste', () => {
    const { state, ctx, ids } = executing();
    const normal = createTask(state, ctx.rng);
    state.components.task[normal]!.column = 'TODO';
    const urgentId = raiseUrgent(state, ctx, 'security-patch');
    // Même si le joueur la range en bas de la colonne.
    state.components.task[urgentId!]!.order = 99;
    expect(autoAssign(state, ids[0]!)).toBe(urgentId);
  });

  it('finie à temps, elle rapporte sa récompense', () => {
    const { state, ctx, ids } = executing(['SENIOR_BEARD']);
    state.gauges.stability = 50;
    const id = raiseUrgent(state, ctx, PROD_FIX_TEMPLATE)!;
    autoAssign(state, ids[0]!);
    state.components.activity[ids[0]!]!.kind = 'WORKING';
    for (let i = 0; i < 500 && state.components.task[id]?.column !== 'DONE'; i++)
      workSystem(state, ctx);
    expect(state.components.task[id]?.column).toBe('DONE');
    expect(state.stats.urgentDone).toBe(1);
    expect(state.tracker.specialDone).toBe(1);
    // Seule la récompense de l'urgence compte (+2), pas l'effet habituel d'un bugfix.
    expect(state.gauges.stability).toBe(52);
  });

  it('ratée, elle disparaît et sa pénalité tombe', () => {
    const { state, ctx } = executing();
    state.gauges.users = 10_000;
    setTime(state, 1, 10);
    const id = raiseUrgent(state, ctx, PROD_FIX_TEMPLATE)!;
    const hype = state.gauges.hype;
    setTime(state, 3, 10);
    taskFlowSystem(state, ctx, clockAt(state.sprint, state.sprintTick));
    expect(state.components.task[id]).toBeUndefined();
    expect(state.stats.urgentMissed).toBe(1);
    expect(state.gauges.users).toBeLessThan(10_000);
    expect(state.gauges.hype).toBeLessThan(hype);
    expect(ctx.outbox.some((n) => n.kind === 'URGENT_MISSED')).toBe(true);
  });

  it('le délai ne compte que les heures ouvrées', () => {
    const { state } = executing();
    // Vendredi 17h + 10 h ouvrées = lundi suivant 17h (2 h vendredi, 8 h lundi).
    setTime(state, 4, 17);
    const deadline = deadlineAfter(state, 10);
    const monday = { sprint: state.sprint, sprintTick: (7 * 24 + 17 - 8) * TIME.ticksPerHour };
    expect(deadline).toBe(sprintTime(monday));
  });

  it('pas d’urgence hors exécution', () => {
    const { state, ctx } = executing();
    state.stage = 'PLANNING';
    expect(raiseUrgent(state, ctx, 'big-client')).toBeNull();
  });
});

describe('Tâches de la semaine', () => {
  it('arrivent le lundi à 9h, dues le vendredi à 18h, plus nombreuses avec l’équipe', () => {
    const { state, ctx } = executing();
    taskFlowSystem(state, ctx, setTime(state, 0, 9));
    const weekly = special(state, 'WEEKLY');
    expect(weekly).toHaveLength(1);
    const friday = sprintTime({
      sprint: state.sprint,
      sprintTick: (4 * 24 + 18 - 8) * TIME.ticksPerHour,
    });
    expect(weekly[0]![1].deadline).toBe(friday);

    const big = executing(Array.from({ length: 12 }, () => 'TEN_X' as const));
    taskFlowSystem(big.state, big.ctx, setTime(big.state, 7, 9));
    expect(special(big.state, 'WEEKLY')).toHaveLength(3);
  });

  it('pas finies vendredi 18h : elles disparaissent avec un petit malus', () => {
    const { state, ctx } = executing();
    taskFlowSystem(state, ctx, setTime(state, 0, 9));
    taskFlowSystem(state, ctx, setTime(state, 4, 18));
    expect(special(state, 'WEEKLY')).toHaveLength(0);
    expect(state.stats.weeklyMissed).toBe(1);
  });
});

describe('Objectifs de sprint', () => {
  it('sont tirés sur une graine à part, sans toucher au hasard de la partie', () => {
    const counts = { set: 0 };
    for (let sprint = 2; sprint < 40; sprint++) {
      const { state, ctx } = executing();
      state.sprint = sprint;
      const rng = [...state.rng];
      rollObjective(state, ctx);
      expect(state.rng).toEqual(rng);
      if (state.objective) {
        counts.set += 1;
        expect(state.objective.reward.treasury).toBeGreaterThan(0);
      }
    }
    // Pas à chaque sprint, mais souvent.
    expect(counts.set).toBeGreaterThan(5);
    expect(counts.set).toBeLessThan(38);
  });

  it('jamais au premier sprint', () => {
    const { state, ctx } = executing();
    state.sprint = 1;
    rollObjective(state, ctx);
    expect(state.objective).toBeNull();
  });

  it('réussi : récompense ; raté : rien', () => {
    const { state, ctx } = executing();
    const reward = { treasury: 100_000, hype: 4, moral: 3 };
    state.objective = {
      kind: 'CLOSE_TASKS',
      difficulty: 'MEDIUM',
      target: 1,
      baseline: 0,
      sprint: state.sprint,
      reward,
      status: 'ACTIVE',
      value: null,
    };
    const id = createTask(state, ctx.rng);
    expect(objectiveValue(state, state.objective)).toBe(0);
    state.components.task[id]!.column = 'DONE';
    state.components.task[id]!.doneAtSprint = state.sprint;
    const treasury = state.gauges.treasury;
    expect(settleObjective(state, ctx)?.status).toBe('SUCCESS');
    expect(state.gauges.treasury).toBe(treasury + reward.treasury);
    expect(state.stats.objectivesDone).toBe(1);

    state.objective = { ...state.objective, kind: 'ZERO_INCIDENT', status: 'ACTIVE', target: 0 };
    state.tracker.incidents = 2;
    const after = state.gauges.treasury;
    expect(settleObjective(state, ctx)?.status).toBe('FAILED');
    expect(state.gauges.treasury).toBe(after);
    expect(state.stats.objectivesFailed).toBe(1);
  });

  it('la démo garde le résultat dans le bilan du sprint', () => {
    const { state, ctx } = executing();
    state.objective = {
      kind: 'ZERO_INCIDENT',
      difficulty: 'EASY',
      target: 0,
      baseline: 0,
      sprint: state.sprint,
      reward: { treasury: 1000, hype: 2, moral: 0 },
      status: 'ACTIVE',
      value: null,
    };
    endSprint(state, ctx);
    expect(state.history.sprints.at(-1)?.objective?.status).toBe('SUCCESS');
  });
});

describe('Compatibilité et déterminisme', () => {
  it('une sauvegarde d’avant les tâches dynamiques se charge', () => {
    const state = newSimulation('old-save').state as unknown as Record<string, unknown>;
    const old = structuredClone(state);
    delete old.objective;
    const removed = new Set(['urgentDone', 'urgentMissed', 'weeklyDone', 'weeklyMissed']);
    old.stats = Object.fromEntries(
      Object.entries(old.stats as Record<string, unknown>).filter(([key]) => !removed.has(key)),
    );
    const tracker = old.tracker as Record<string, unknown>;
    delete tracker.specialDone;
    const parsed = GameStateSchema.parse(old);
    expect(parsed.objective).toBeNull();
    expect(parsed.stats.urgentDone).toBe(0);
    expect(parsed.tracker.specialDone).toBe(0);
  });

  it('deux parties de même graine ont les mêmes urgences, tâches et objectifs', () => {
    const play = () => {
      const simulation = newSimulation('flow-determinism');
      for (let sprint = 0; sprint < 4; sprint++) {
        simulation.dispatch({ type: 'START_SPRINT' });
        simulation.runUntilBlocked(TIME.ticksPerSprint);
        if (simulation.state.stage === 'DEMO') simulation.dispatch({ type: 'END_DEMO' });
      }
      return simulation.state;
    };
    const a = play();
    const b = play();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.stats.weeklyDone + a.stats.weeklyMissed).toBeGreaterThan(0);
    expect(teamSize(a)).toBeGreaterThan(0);
  });
});
