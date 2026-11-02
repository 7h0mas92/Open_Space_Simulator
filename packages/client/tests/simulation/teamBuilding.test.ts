import { OUTING_DEFINITIONS, TEAM_BUILDING, type GameState } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { activitySystem } from '../../src/simulation/systems/activity';
import {
  bookTeamBuilding,
  cancelTeamBuilding,
  isOnOuting,
  outingPrice,
  teamBuildingSystem,
} from '../../src/simulation/teamBuilding';
import { clockAt } from '../../src/simulation/time';
import { makeContext, newSimulation, stateWithTeam } from './fixtures';

/** Horloge à un jour du sprint (0 = lundi de la 1re semaine) et une heure, au sprint `sprint`. */
const at = (day: number, hour: number, sprint = 1) => clockAt(sprint, (day * 24 + hour - 8) * 2);

function team(): { state: GameState; ids: string[] } {
  const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'TEN_X', 'DESIGNER', 'GHOST']);
  for (const id of ids) {
    const mood = state.components.mood[id]!;
    mood.moral = 50;
    mood.energy = 50;
  }
  return { state, ids };
}

describe('Team building', () => {
  it('se réserve et se paie en planification, par participant (sans le Dev Fantôme)', () => {
    const { state } = team();
    const treasury = state.gauges.treasury;
    expect(outingPrice(state, OUTING_DEFINITIONS['escape-game'])).toBe(3 * 90);
    expect(bookTeamBuilding(state, makeContext(state), 'escape-game')).toEqual({ ok: true });
    expect(state.gauges.treasury).toBe(treasury - 270);
    expect(bookTeamBuilding(state, makeContext(state), 'afterwork')).toEqual({
      ok: false,
      error: 'COOLDOWN',
    });
    expect(cancelTeamBuilding(state)).toEqual({ ok: true });
    expect(state.gauges.treasury).toBe(treasury - 270 * (1 - TEAM_BUILDING.cancelRefund));
  });

  it('respecte la phase et la trésorerie', () => {
    const { state } = team();
    state.phase = 'GARAGE';
    expect(bookTeamBuilding(state, makeContext(state), 'seminar')).toEqual({
      ok: false,
      error: 'LOCKED',
    });
    state.phase = 'UNICORN';
    state.gauges.treasury = 100;
    expect(bookTeamBuilding(state, makeContext(state), 'offsite')).toEqual({
      ok: false,
      error: 'NOT_ENOUGH_MONEY',
    });
  });

  it('l’équipe quitte le bureau pendant la sortie, et en revient soudée', () => {
    const { state, ids } = team();
    const [a, b] = [ids[0]!, ids[1]!];
    state.components.relations[a]![b] = -50;
    state.components.relations[b]![a] = -50;
    bookTeamBuilding(state, makeContext(state), 'escape-game');
    state.stage = 'EXECUTION';
    expect(isOnOuting(state, at(11, 10))).toBe(false);
    expect(isOnOuting(state, at(11, 15))).toBe(true);
    activitySystem(state, makeContext(state), at(11, 15));
    expect(state.components.activity[a]?.kind).toBe('GONE');

    const rng = [...state.rng];
    const ctx = makeContext(state);
    teamBuildingSystem(state, ctx, at(11, 18));
    expect(state.rng).toEqual(rng);
    expect(state.teamBuilding.count).toBe(1);
    expect(state.teamBuilding.booked).toBeNull();
    expect(ctx.outbox.some((n) => n.kind === 'TEAM_BUILDING_DONE')).toBe(true);
    expect(state.components.mood[a]!.moral).toBeGreaterThan(50);
    // Le Dev Fantôme n'est pas venu.
    expect(state.components.mood[ids[3]!]!.moral).toBe(50);
    // Le conflit s'apaise (ou empire, si quelqu'un a caché la clé).
    expect(state.components.relations[a]![b]).not.toBe(-50);
  });

  it('la même sortie deux sprints de suite rapporte deux fois moins de moral', () => {
    const gain = (repeat: boolean) => {
      const { state, ids } = team();
      state.sprint = 3;
      if (repeat) state.teamBuilding.last = { outing: 'laser-game', sprint: 2 };
      state.phase = 'SEED';
      bookTeamBuilding(state, makeContext(state), 'laser-game');
      state.stage = 'EXECUTION';
      state.components.stats[ids[2]!]!.ego = 1;
      teamBuildingSystem(state, makeContext(state), at(11, 18, 3));
      return state.components.mood[ids[2]!]!.moral - 50;
    };
    expect(gain(true)).toBeCloseTo(gain(false) * TEAM_BUILDING.repeatMoralFactor);
  });

  it('sans sortie, rien ne change : une partie reste identique', () => {
    const play = () => {
      const simulation = newSimulation('2026-03-02.outing');
      for (let i = 0; i < 2 * 700 && simulation.state.stage !== 'ENDED'; i++) {
        const { stage, events } = simulation.state;
        if (events.pending) simulation.dispatch({ type: 'RESOLVE_EVENT', choiceIndex: 0 });
        else if (stage === 'DEMO') simulation.dispatch({ type: 'END_DEMO' });
        else if (stage === 'PLANNING') simulation.dispatch({ type: 'START_SPRINT' });
        simulation.step();
      }
      return JSON.stringify(simulation.state);
    };
    expect(play()).toBe(play());
  });
});
