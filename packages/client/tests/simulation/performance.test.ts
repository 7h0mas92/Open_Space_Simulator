import { BALANCE, GameStateSchema, type Identity, type SprintPerformance } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import {
  closeSprintPerformance,
  emptySprintPerformance,
  expectedProductivity,
  gradeOf,
  overallPerformance,
  productivityOf,
  recordIncident,
} from '../../src/simulation/performance';
import { workSystem } from '../../src/simulation/systems/work';
import { assignTask, createTask } from '../../src/simulation/tasks';
import { toGameView } from '../../src/view/adapter';
import { makeContext, newSimulation, stateWithTeam } from './fixtures';

const identity = (role: Identity['role'], trait: Identity['trait'] = 'ZEN'): Identity => ({
  name: 'Kevin',
  age: 24,
  role,
  trait,
  bio: { fr: '', en: '' },
  look: 0,
});
const VIEW = { speed: 1, running: false, card: () => undefined } as const;
const STANDARD = { speed: 5, quality: 5, endurance: 5, ego: 5 };

/** Un sprint où le dev a travaillé `hours` heures au rythme d'un dev standard × `ratio`. */
function sprint(n: number, hours: number, ratio = 1, quality = 0.5): SprintPerformance {
  const work = hours * BALANCE.performance.referenceUnitsPerHour * ratio;
  return {
    ...emptySprintPerformance(n),
    work,
    qualitySum: work * quality,
    workTicks: hours * 2,
    points: 3,
    tasks: 1,
  };
}

describe('Productivité et performance des devs', () => {
  it('note le travail de chaque dev pendant le sprint', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'INTERN']);
    const ctx = makeContext(state);
    const taskId = createTask(state, ctx.rng, 'FEATURE');
    assignTask(state, taskId, ids[0]!);
    state.stage = 'EXECUTION';
    state.components.activity[ids[0]!]!.kind = 'WORKING';
    workSystem(state, ctx);
    workSystem(state, ctx);
    const current = state.components.performance[ids[0]!]!.current;
    expect(current.workTicks).toBe(2);
    expect(current.work).toBeGreaterThan(0);
    expect(current.qualitySum / current.work).toBeGreaterThan(0);
    // Le stagiaire n'avait pas de tâche : rien de noté.
    expect(state.components.performance[ids[1]!]!.current.workTicks).toBe(0);
  });

  it('archive chaque sprint à la démo et ne garde que les derniers', () => {
    const { state, ids } = stateWithTeam(['TEN_X']);
    const id = ids[0]!;
    recordIncident(state, id);
    for (let n = 1; n <= BALANCE.performance.sprintsKept + 2; n++) {
      state.sprint = n;
      closeSprintPerformance(state, n === 2);
    }
    const { sprints, current } = state.components.performance[id]!;
    expect(sprints).toHaveLength(BALANCE.performance.sprintsKept);
    expect(sprints.at(-1)?.sprint).toBe(BALANCE.performance.sprintsKept + 2);
    expect(current).toEqual(emptySprintPerformance(BALANCE.performance.sprintsKept + 3));
    expect(sprints.every((s) => !s.lost && s.incidents === 0)).toBe(true);
  });

  it('une vraie partie remplit l’historique de productivité de l’équipe', () => {
    const simulation = newSimulation('perf');
    simulation.dispatch({ type: 'START_SPRINT' });
    while (simulation.state.stage === 'EXECUTION') {
      simulation.runUntilBlocked();
      if (simulation.state.events.pending)
        simulation.dispatch({ type: 'RESOLVE_EVENT', choiceIndex: 0 });
    }
    const [dev] = toGameView(simulation.state, VIEW).devs;
    expect(dev?.performance.lastSprints).toHaveLength(1);
    expect(dev?.performance.lastSprints[0]?.sprint).toBe(1);
    expect(dev?.performance.current?.hours).toBe(0);
  });

  it('productivité : 100 % pour un dev standard, rien sans tâche', () => {
    expect(productivityOf(sprint(1, 20))).toBeCloseTo(100);
    expect(productivityOf(sprint(1, 20, 2))).toBeCloseTo(200);
    expect(productivityOf(emptySprintPerformance(1))).toBeNull();
  });

  it('productivité attendue : vitesse, profil, niveau et trait', () => {
    expect(expectedProductivity(identity('GHOST'), STANDARD)).toBeCloseTo(100);
    expect(expectedProductivity(identity('TEN_X'), STANDARD)).toBeCloseTo(220);
    expect(expectedProductivity(identity('GHOST'), STANDARD, 3)).toBeCloseTo(110);
    expect(expectedProductivity(identity('GHOST', 'PERFECTIONIST'), STANDARD)).toBeCloseTo(90);
  });

  it('performance globale estimée, puis mesurée sur les 2 derniers sprints', () => {
    const ghost = identity('GHOST');
    const estimated = overallPerformance(ghost, STANDARD, 1);
    expect(estimated).toMatchObject({ estimated: true, productivity: 100, quality: 0.5 });
    // 0,25 × 100 + 35 × 0,5 + 1,5 × 5 = 50
    expect(estimated.score).toBe(50);
    expect(estimated.grade).toBe('C');

    // Le vieux sprint lent ne compte plus : seuls les 2 derniers comptent.
    const measured = overallPerformance(ghost, STANDARD, 1, [
      sprint(1, 20, 0.2),
      sprint(2, 20, 2, 1),
      sprint(3, 20, 2, 1),
    ]);
    expect(measured).toMatchObject({ estimated: false, quality: 1 });
    expect(measured.productivity).toBeCloseTo(200);
    expect(measured.score).toBe(93);
    expect(measured.grade).toBe('S');
  });

  it('les sprints perdus ou sans tâche ne sont pas mesurés, les pannes coûtent 5 points', () => {
    const intern = identity('INTERN');
    const idle = { ...emptySprintPerformance(2), incidents: 2 };
    const lost = { ...sprint(3, 20), lost: true };
    const result = overallPerformance(intern, STANDARD, 1, [idle, lost]);
    expect(result.estimated).toBe(true);
    expect(result.incidents).toBe(2);
    expect(result.score).toBe(overallPerformance(intern, STANDARD, 1).score - 10);
  });

  it('le Product Owner et la Designeuse ont un bonus de profil', () => {
    const ghost = overallPerformance(identity('GHOST'), STANDARD, 1).score;
    const po = overallPerformance(identity('PRODUCT_OWNER'), STANDARD, 1);
    expect(po.score).toBe(ghost - 12 + 20);
  });

  it('notes de S à D', () => {
    expect([90, 75, 60, 45, 10].map(gradeOf)).toEqual(['S', 'A', 'B', 'C', 'D']);
  });

  it('les anciennes sauvegardes, sans performance, restent valides', () => {
    const simulation = newSimulation('old-save');
    const json = JSON.parse(JSON.stringify(simulation.state)) as Record<string, unknown>;
    delete (json.components as Record<string, unknown>).performance;
    const parsed = GameStateSchema.parse(json);
    expect(parsed.components.performance).toEqual({});
    // Les compteurs se recréent au premier travail noté.
    closeSprintPerformance(parsed);
    const [dev] = toGameView(parsed, VIEW).devs;
    expect(dev?.performance.estimated).toBe(true);
  });
});
