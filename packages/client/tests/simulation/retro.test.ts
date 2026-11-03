import { RETRO, type GameState } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import {
  activeRetro,
  holdRetro,
  retroOptions,
  retroPlanning,
  retroVotes,
  retroWinner,
} from '../../src/simulation/retro';
import { coffeeSystem } from '../../src/simulation/systems/needs';
import { effectiveQuality } from '../../src/simulation/systems/work';
import { makeContext, newSimulation, stateWithTeam } from './fixtures';

function teamAtSprint2(): { state: GameState; ids: string[] } {
  const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'TEN_X', 'PRODUCT_OWNER', 'INTERN']);
  state.sprint = 2;
  return { state, ids };
}

describe('Rétrospective', () => {
  it('propose 3 actions selon les problèmes du sprint écoulé', () => {
    const { state } = teamAtSprint2();
    state.gauges.debt = 90;
    state.history.sprints.push({
      sprint: 1,
      lost: false,
      usersGained: 0,
      usersLost: 0,
      revenue: 0,
      expenses: 0,
      hypeDelta: 0,
      featuresShipped: 3,
      hallucinations: 0,
      incidents: 4,
      valuation: 0,
      feedback: [],
    });
    const options = retroOptions(state);
    expect(options).toHaveLength(RETRO.options);
    expect(options).toContain('MORE_TESTS');
    expect(options).toContain('CODE_REVIEW');
  });

  it('pas de rétro au premier sprint', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD']);
    retroPlanning(state);
    expect(state.retro.pending).toBeNull();
  });

  it('les votes sont reproductibles et ne touchent pas au RNG de la partie', () => {
    const { state } = teamAtSprint2();
    const rng = [...state.rng];
    const options = retroOptions(state);
    expect(retroVotes(state, options)).toEqual(retroVotes(state, options));
    expect(state.rng).toEqual(rng);
  });

  it('suivre le vote remonte le moral de tous ; imposer vexe les autres votants', () => {
    const { state, ids } = teamAtSprint2();
    for (const id of ids) state.components.mood[id]!.moral = 50;
    retroPlanning(state);
    const pending = state.retro.pending!;
    const winner = retroWinner(pending.options, pending.votes)!;
    expect(holdRetro(state, makeContext(state), winner)).toEqual({ ok: true });
    for (const id of ids) expect(state.components.mood[id]!.moral).toBe(50 + RETRO.followMoral);
    expect(activeRetro(state)).toBe(winner);
    expect(state.retro.pending).toBeNull();

    const other = teamAtSprint2();
    for (const id of other.ids) other.state.components.mood[id]!.moral = 50;
    retroPlanning(other.state);
    const { options, votes } = other.state.retro.pending!;
    const imposed = options.find((action) => action !== retroWinner(options, votes))!;
    holdRetro(other.state, makeContext(other.state), imposed);
    for (const id of other.ids) {
      const expected = votes[id] === imposed ? 50 : 50 - RETRO.imposeMoral;
      expect(other.state.components.mood[id]!.moral).toBe(expected);
    }
    expect(other.state.retro.imposed).toBe(1);
  });

  it('refuse une action qui n’était pas proposée, et hors planification', () => {
    const { state } = teamAtSprint2();
    retroPlanning(state);
    const missing = (
      ['MORE_TESTS', 'CODE_REVIEW', 'COFFEE_BAR', 'MEDIATION', 'KEEP_GOING', 'KUDOS'] as const
    ).find((action) => !state.retro.pending!.options.includes(action))!;
    expect(holdRetro(state, makeContext(state), missing)).toEqual({
      ok: false,
      error: 'INVALID_CHOICE',
    });
    state.stage = 'EXECUTION';
    expect(holdRetro(state, makeContext(state), null)).toEqual({
      ok: false,
      error: 'WRONG_STAGE',
    });
  });

  it('les actions s’appliquent pendant le sprint suivant seulement', () => {
    const { state, ids } = teamAtSprint2();
    const ctx = makeContext(state);
    const base = effectiveQuality(state, ctx, ids[0]!);
    state.retro.active = { action: 'CODE_REVIEW', sprint: 2 };
    expect(effectiveQuality(state, ctx, ids[0]!)).toBeGreaterThan(base);
    state.sprint = 3;
    expect(effectiveQuality(state, ctx, ids[0]!)).toBe(base);

    // Café en libre-service : on en boit moins.
    const drink = (bar: boolean) => {
      const { state: s, ids: team } = teamAtSprint2();
      for (const id of team) s.components.activity[id]!.kind = 'WORKING';
      if (bar) s.retro.active = { action: 'COFFEE_BAR', sprint: 2 };
      s.gauges.coffee = 80;
      coffeeSystem(s, makeContext(s), { ...ctxClock });
      return 80 - s.gauges.coffee;
    };
    expect(drink(true)).toBeCloseTo(drink(false) * RETRO.coffeeBarConsumption);
  });

  it('la médiation apaise tout de suite les relations tendues', () => {
    const { state, ids } = teamAtSprint2();
    state.components.relations[ids[0]!]![ids[1]!] = -40;
    state.components.relations[ids[1]!]![ids[0]!] = -5;
    state.retro.pending = { sprint: 2, options: ['MEDIATION', 'KUDOS', 'KEEP_GOING'], votes: {} };
    holdRetro(state, makeContext(state), 'MEDIATION');
    expect(state.components.relations[ids[0]!]![ids[1]!]).toBe(-40 + RETRO.mediationAffinity);
    expect(state.components.relations[ids[1]!]![ids[0]!]).toBe(0);
  });

  it('passer la rétro donne exactement la même partie que l’ignorer', () => {
    const play = (skip: boolean) => {
      const simulation = newSimulation('2026-03-02.retro');
      for (let i = 0; i < 4 * 700 && simulation.state.stage !== 'ENDED'; i++) {
        const { stage, retro, events } = simulation.state;
        if (events.pending) simulation.dispatch({ type: 'RESOLVE_EVENT', choiceIndex: 0 });
        else if (stage === 'DEMO') simulation.dispatch({ type: 'END_DEMO' });
        else if (stage === 'PLANNING') {
          if (skip && retro.pending) simulation.dispatch({ type: 'HOLD_RETRO', action: null });
          simulation.dispatch({ type: 'START_SPRINT' });
        }
        simulation.step();
      }
      const state = structuredClone(simulation.state) as Partial<GameState>;
      delete state.retro;
      return JSON.stringify(state);
    };
    expect(play(true)).toBe(play(false));
  });
});

/** Un mardi à 10h : l'heure n'a pas d'importance pour la consommation de café. */
const ctxClock = {
  dayInSprint: 1,
  day: 1,
  dayOfWeek: 2,
  hour: 10,
  isWeekend: false,
  holiday: false,
  isFriday17: false,
};
