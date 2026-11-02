import { BALANCE, ENDLESS, GAME } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { fixedCosts } from '../../src/simulation/economy';
import { endDemo } from '../../src/simulation/sprint';
import { makeContext, newSimulation, stateWithTeam } from './fixtures';

describe('Mode illimité', () => {
  it('ne s’arrête pas après les 39 sprints', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD'], 'ENDLESS');
    expect(state.totalSprints).toBe(ENDLESS.sprintCap);
    state.sprint = GAME.totalSprints;
    state.stage = 'DEMO';
    const ctx = makeContext(state);
    expect(endDemo(state, ctx).ok).toBe(true);
    expect(state.stage).toBe('PLANNING');
    expect(state.sprint).toBe(GAME.totalSprints + 1);
    expect(state.result).toBeNull();
  });

  it('annonce la concurrence au 40e sprint puis tous les 6 mois', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD'], 'ENDLESS');
    const ctx = makeContext(state);
    const announced: number[] = [];
    for (let sprint = GAME.totalSprints; sprint < GAME.totalSprints + 30; sprint++) {
      state.sprint = sprint;
      state.stage = 'DEMO';
      state.gauges.treasury = 1e12;
      const before = state.notifications.length;
      endDemo(state, ctx);
      if (state.notifications.slice(before).some((n) => n.kind === 'COMPETITION_RISES'))
        announced.push(state.sprint);
    }
    expect(announced).toEqual([
      40,
      40 + ENDLESS.milestoneSprints,
      40 + 2 * ENDLESS.milestoneSprints,
    ]);
  });

  it('fait monter les frais fixes après les 18 mois, pas avant', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD'], 'ENDLESS');
    const base = BALANCE.economy.fixedCostsMonthly[state.phase];
    state.sprint = GAME.totalSprints;
    expect(fixedCosts(state)).toBe(base);
    state.sprint = GAME.totalSprints + 25;
    expect(fixedCosts(state)).toBeCloseTo(
      base * (1 + 25 * ENDLESS.fixedCostGrowthPerSprint + 625 * ENDLESS.fixedCostGrowthSquared),
    );
  });

  it('garde les 18 premiers mois identiques au mode Normal (même graine)', () => {
    const endless = newSimulation('same-seed', 'ENDLESS').state;
    const normal = newSimulation('same-seed', 'NORMAL').state;
    expect(endless.gauges).toEqual(normal.gauges);
    expect(endless.candidates).toEqual(normal.candidates);
  });

  it('ajoute les sprints tenus à la phrase de fin', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD'], 'ENDLESS');
    state.sprint = 57;
    state.gauges.treasury = -1;
    state.stage = 'DEMO';
    state.lostSprintsPending = 1;
    endDemo(state, makeContext(state));
    expect(state.result?.outcome).toBe('BANKRUPTCY');
    expect(state.result?.headline.fr).toContain('Mode illimité : 58 sprints tenus.');
    expect(state.result?.headline.en).toContain('Endless mode: 58 sprints survived.');
  });
});
