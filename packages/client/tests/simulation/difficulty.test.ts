import { BALANCE, DIFFICULTY, GAME, GAME_MODES, difficultyOf } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { eventSystem } from '../../src/events/draw';
import { applyEffects, badEffectFactor, escalate } from '../../src/events/effects';
import { monthlyExpenses, monthlyRevenue } from '../../src/simulation/economy';
import { clockAt } from '../../src/simulation/time';
import { toGameView } from '../../src/view/adapter';
import { FixedRng, makeContext, newSimulation, stateWithTeam, testCard } from './fixtures';

/** Mercredi 10h du sprint courant. */
const WEDNESDAY_10H = clockAt(1, (2 * 24 + 2) * 2);

describe('Difficulté des modes', () => {
  it('laisse le Normal et les autres modes au neutre', () => {
    for (const mode of GAME_MODES) {
      if (mode === 'EASY' || mode === 'HARDCORE') continue;
      expect(difficultyOf(mode)).toEqual({
        treasury: 1,
        eventsPerSprint: BALANCE.events.maxPerSprint,
        eventChance: 1,
        badEffects: 1,
        expenses: 1,
        revenue: 1,
        outages: 1,
        pitchBar: 0,
      });
    }
  });

  it('ordonne les modes : Facile plus doux, Hardcore plus dur que le Normal', () => {
    const easy = difficultyOf('EASY');
    const normal = difficultyOf('NORMAL');
    const hard = difficultyOf('HARDCORE');
    expect(easy.treasury).toBeGreaterThan(normal.treasury);
    expect(hard.treasury).toBeLessThan(normal.treasury);
    expect(easy.badEffects).toBeLessThan(1);
    expect(hard.badEffects).toBeGreaterThan(1);
    expect(hard.expenses).toBeGreaterThan(1);
    expect(hard.revenue).toBeLessThan(1);
    expect(hard.pitchBar).toBeGreaterThan(0);
    // Le Facile garde autant de crises que le Normal : il doit rester un défi.
    expect(easy.eventsPerSprint).toBe(normal.eventsPerSprint);
    expect(hard.eventsPerSprint).toBeGreaterThan(normal.eventsPerSprint);
  });

  it('ajuste la trésorerie de départ selon le mode', () => {
    for (const mode of ['EASY', 'HARDCORE'] as const) {
      const state = newSimulation('seed', mode).state;
      const normal = newSimulation('seed', 'NORMAL').state;
      expect(state.gauges.treasury - normal.gauges.treasury).toBeCloseTo(
        GAME.startingTreasury * (DIFFICULTY[mode].treasury - 1),
      );
      expect(state.totalRaised).toBe(GAME.startingTreasury * DIFFICULTY[mode].treasury);
    }
  });

  it('tire au plus le nombre de cartes du mode par sprint', () => {
    for (const mode of ['EASY', 'HARDCORE'] as const) {
      const { state } = stateWithTeam(['INTERN'], mode);
      state.stage = 'EXECUTION';
      const ctx = makeContext(state, { rng: new FixedRng(0), cards: [testCard()] });
      state.events.drawnThisSprint = DIFFICULTY[mode].eventsPerSprint;
      eventSystem(state, ctx, WEDNESDAY_10H);
      expect(state.events.pending).toBeNull();
      state.events.drawnThisSprint = DIFFICULTY[mode].eventsPerSprint - 1;
      eventSystem(state, ctx, WEDNESDAY_10H);
      expect(state.events.pending).not.toBeNull();
    }
  });

  it('adoucit en Facile et aggrave en Hardcore les seuls effets négatifs des cartes', () => {
    expect(badEffectFactor('EASY')).toBe(DIFFICULTY.EASY.badEffects);
    expect(badEffectFactor('HARDCORE')).toBe(DIFFICULTY.HARDCORE.badEffects);
    expect(badEffectFactor('NORMAL')).toBe(1);
    expect(escalate(-10, -1, 0, 0.5)).toBe(-5);
    expect(escalate(10, -1, 0, 0.5)).toBe(10);
    expect(escalate(-10, -1, 1, 0.5)).toBe(-10 * (1 + BALANCE.events.escalation) * 0.5);

    const states = (['EASY', 'NORMAL', 'HARDCORE'] as const).map(
      (mode) => stateWithTeam([], mode).state,
    );
    for (const state of states) {
      state.gauges.coffee = 50;
      state.gauges.hype = 50;
      applyEffects(state, makeContext(state), testCard(), { coffee: -20, hype: 10 }, 0);
    }
    const [easy, normal, hard] = states;
    expect(easy!.gauges.coffee).toBeCloseTo(50 - 20 * DIFFICULTY.EASY.badEffects);
    expect(normal!.gauges.coffee).toBe(30);
    expect(hard!.gauges.coffee).toBeCloseTo(50 - 20 * DIFFICULTY.HARDCORE.badEffects);
    expect(easy!.gauges.hype).toBe(normal!.gauges.hype);
    expect(hard!.gauges.hype).toBe(normal!.gauges.hype);
  });

  it('rend en Hardcore les dépenses plus lourdes et les revenus plus maigres', () => {
    const normal = stateWithTeam(['SENIOR_BEARD', 'TEN_X'], 'NORMAL').state;
    const hard = stateWithTeam(['SENIOR_BEARD', 'TEN_X'], 'HARDCORE').state;
    normal.gauges.users = 5000;
    hard.gauges.users = 5000;
    // Mêmes devs tirés de la même graine : seul le multiplicateur change.
    expect(monthlyExpenses(hard)).toBeCloseTo(
      monthlyExpenses(normal) * DIFFICULTY.HARDCORE.expenses,
    );
    expect(monthlyRevenue(hard)).toBeCloseTo(monthlyRevenue(normal) * DIFFICULTY.HARDCORE.revenue);
  });

  it('affiche sur la carte les effets déjà ajustés', () => {
    const card = testCard({
      choices: [
        { label: { fr: 'Oui', en: 'Yes' }, effects: { coffee: -20, hype: 6 } },
        { label: { fr: 'Non', en: 'No' }, effects: {} },
      ],
    });
    for (const mode of ['EASY', 'HARDCORE'] as const) {
      const simulation = newSimulation('seed', mode);
      simulation.state.events.pending = { cardId: card.id, level: 0, drawnAtTick: 0 };
      const view = toGameView(simulation.state, {
        speed: 0,
        running: false,
        card: (id) => (id === card.id ? card : undefined),
      });
      expect(view.event?.choices[0]?.effects).toEqual({
        coffee: -20 * DIFFICULTY[mode].badEffects,
        hype: 6,
      });
    }
  });
});
