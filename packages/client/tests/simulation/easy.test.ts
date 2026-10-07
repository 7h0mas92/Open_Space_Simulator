import { BALANCE, GAME } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { eventSystem } from '../../src/events/draw';
import { applyEffects, badEffectFactor, escalate } from '../../src/events/effects';
import { clockAt } from '../../src/simulation/time';
import { toGameView } from '../../src/view/adapter';
import { FixedRng, makeContext, newSimulation, stateWithTeam, testCard } from './fixtures';

/** Mercredi 10h du sprint courant. */
const WEDNESDAY_10H = clockAt(1, (2 * 24 + 2) * 2);

describe('Mode Facile', () => {
  it('démarre avec 50 % de trésorerie en plus', () => {
    const easy = newSimulation('seed', 'EASY').state;
    const normal = newSimulation('seed', 'NORMAL').state;
    expect(easy.gauges.treasury - normal.gauges.treasury).toBe(
      GAME.startingTreasury * (BALANCE.easy.treasuryMultiplier - 1),
    );
    expect(easy.totalRaised).toBe(GAME.startingTreasury * BALANCE.easy.treasuryMultiplier);
  });

  it('tire au plus 2 cartes par sprint', () => {
    const { state } = stateWithTeam(['INTERN'], 'EASY');
    state.stage = 'EXECUTION';
    const ctx = makeContext(state, { rng: new FixedRng(0), cards: [testCard()] });
    state.events.drawnThisSprint = BALANCE.easy.maxEventsPerSprint;
    eventSystem(state, ctx, WEDNESDAY_10H);
    expect(state.events.pending).toBeNull();
    state.events.drawnThisSprint = BALANCE.easy.maxEventsPerSprint - 1;
    eventSystem(state, ctx, WEDNESDAY_10H);
    expect(state.events.pending).not.toBeNull();
  });

  it('divise par deux les seuls effets négatifs des cartes', () => {
    expect(badEffectFactor('EASY')).toBe(BALANCE.easy.badEffectMultiplier);
    expect(badEffectFactor('NORMAL')).toBe(1);
    expect(escalate(-10, -1, 0, 0.5)).toBe(-5);
    expect(escalate(10, -1, 0, 0.5)).toBe(10);
    expect(escalate(-10, -1, 1, 0.5)).toBe(-10 * (1 + BALANCE.events.escalation) * 0.5);

    const easy = stateWithTeam([], 'EASY').state;
    const normal = stateWithTeam([], 'NORMAL').state;
    for (const state of [easy, normal]) {
      state.gauges.coffee = 50;
      state.gauges.hype = 50;
      applyEffects(state, makeContext(state), testCard(), { coffee: -20, hype: 10 }, 0);
    }
    expect(easy.gauges.coffee).toBe(40);
    expect(normal.gauges.coffee).toBe(30);
    expect(easy.gauges.hype).toBe(normal.gauges.hype);
  });

  it('affiche sur la carte les effets déjà adoucis', () => {
    const simulation = newSimulation('seed', 'EASY');
    const card = testCard({
      choices: [
        { label: { fr: 'Oui', en: 'Yes' }, effects: { coffee: -20, hype: 6 } },
        { label: { fr: 'Non', en: 'No' }, effects: {} },
      ],
    });
    simulation.state.events.pending = { cardId: card.id, level: 0, drawnAtTick: 0 };
    const view = toGameView(simulation.state, {
      speed: 0,
      running: false,
      card: (id) => (id === card.id ? card : undefined),
    });
    expect(view.event?.choices[0]?.effects).toEqual({ coffee: -10, hype: 6 });
  });
});
