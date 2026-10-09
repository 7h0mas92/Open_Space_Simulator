import { describe, expect, it } from 'vitest';
import {
  EVENT_CARDS,
  GameStateSchema,
  TEAM_MAX,
  VENTURE_IDEAS,
  VENTURES,
  type GameState,
} from '@oss/shared';
import { conditionsMet } from '../../src/events/conditions';
import { applyEffects } from '../../src/events/effects';
import { CardLibrary } from '../../src/events/library';
import { createBot, playWithBot } from '../../src/simulation/bots';
import { computeValuation, portfolioValue } from '../../src/simulation/economy';
import { canPlace } from '../../src/simulation/furniture';
import { teamMax } from '../../src/simulation/helpers';
import { replay } from '../../src/simulation/replay';
import { Simulation } from '../../src/simulation/simulation';
import { clockAt } from '../../src/simulation/time';
import {
  emergencySale,
  officeWings,
  ventureBlocker,
  ventureOffers,
  ventureSprint,
} from '../../src/simulation/ventures';
import { officeLayout } from '../../src/view/layout';
import { makeContext, newSimulation, stateWithTeam, testCard } from './fixtures';

/** Startup en Série A, en planification, avec de quoi investir. */
function richSeriesA(): { simulation: Simulation; state: GameState } {
  const simulation = newSimulation('ventures');
  const { state } = simulation;
  state.phase = 'SERIES_A';
  state.sprint = 12;
  state.gauges.treasury = 20_000_000;
  return { simulation, state };
}

function foundFirst(simulation: Simulation): string {
  const offer = ventureOffers(simulation.state)[0];
  if (!offer) throw new Error('aucun projet proposé');
  expect(simulation.dispatch({ type: 'FOUND_VENTURE', ideaId: offer.idea.id }).result).toEqual({
    ok: true,
  });
  return offer.idea.id;
}

describe('Filiales : déblocage et projets', () => {
  it('sont verrouillées avant la Série A', () => {
    const simulation = newSimulation('ventures');
    expect(ventureOffers(simulation.state)).toEqual([]);
    expect(ventureBlocker(simulation.state)).toBe('LOCKED');
    const result = simulation.dispatch({ type: 'FOUND_VENTURE', ideaId: 'meeting-saas' }).result;
    expect(result).toEqual({ ok: false, error: 'LOCKED' });
  });

  it('proposent un projet par profil de risque, toujours les mêmes pour une graine et un sprint', () => {
    const { state } = richSeriesA();
    const offers = ventureOffers(state);
    expect(offers.map((o) => o.idea.risk)).toEqual(['SAFE', 'BOLD', 'MOONSHOT']);
    expect(ventureOffers(state)).toEqual(offers);
    for (const offer of offers) {
      const { min, max } = VENTURES.risks[offer.idea.risk].cost;
      expect(offer.cost).toBeGreaterThanOrEqual(min - 50_000);
      expect(offer.cost).toBeLessThanOrEqual(max + 50_000);
      expect(offer.cost % 50_000).toBe(0);
    }
    state.sprint += 1;
    expect(ventureOffers(state)).not.toEqual(offers);
  });

  it('ne consomment pas le générateur aléatoire de la partie', () => {
    const { simulation, state } = richSeriesA();
    const before = [...state.rng];
    ventureOffers(state);
    foundFirst(simulation);
    expect(state.rng).toEqual(before);
  });

  it('a 18 projets aux identifiants uniques, six par profil', () => {
    expect(new Set(VENTURE_IDEAS.map((idea) => idea.id)).size).toBe(VENTURE_IDEAS.length);
    for (const risk of ['SAFE', 'BOLD', 'MOONSHOT'] as const)
      expect(VENTURE_IDEAS.filter((idea) => idea.risk === risk)).toHaveLength(6);
  });
});

describe('Filiales : création', () => {
  it('payent la mise, ajoutent la filiale, une aile et des places dans l’équipe', () => {
    const { simulation, state } = richSeriesA();
    const offer = ventureOffers(state)[1];
    if (!offer) throw new Error('projet manquant');
    const valuation = computeValuation(state);
    const hype = state.gauges.hype;
    simulation.dispatch({ type: 'FOUND_VENTURE', ideaId: offer.idea.id });

    expect(state.gauges.treasury).toBe(20_000_000 - offer.cost);
    expect(state.ventures).toHaveLength(1);
    const venture = state.ventures[0];
    expect(venture?.status).toBe('ACTIVE');
    expect(venture?.stake).toBe(VENTURES.stake);
    // Nos parts valent exactement la mise : créer une filiale n'invente pas de valeur.
    expect(portfolioValue(state)).toBe(offer.cost);
    // La valorisation compte nos parts (et le petit gain de hype de l'annonce).
    expect(state.valuation).toBe(computeValuation(state));
    expect(state.valuation).toBeGreaterThanOrEqual(valuation + offer.cost);
    expect(state.gauges.hype).toBe(Math.min(100, hype + VENTURES.hypeOnCreate));
    expect(officeWings(state)).toBe(1);
    expect(teamMax(state)).toBe(TEAM_MAX.SERIES_A + VENTURES.teamPerWing);
    expect(state.notifications.map((n) => n.kind)).toContain('VENTURE_FOUNDED');
    expect(state.achievements).toContain('business-angel');
  });

  it('refusent un projet inconnu, un deuxième projet le même sprint et un projet trop cher', () => {
    const { simulation, state } = richSeriesA();
    expect(simulation.dispatch({ type: 'FOUND_VENTURE', ideaId: 'nope' }).result).toEqual({
      ok: false,
      error: 'INVALID_CHOICE',
    });
    foundFirst(simulation);
    const second = ventureOffers(state)[1];
    expect(
      simulation.dispatch({ type: 'FOUND_VENTURE', ideaId: second?.idea.id ?? '' }).result,
    ).toEqual({ ok: false, error: 'COOLDOWN' });

    const poor = richSeriesA();
    poor.state.gauges.treasury = 100_000;
    const offer = ventureOffers(poor.state)[0];
    expect(
      poor.simulation.dispatch({ type: 'FOUND_VENTURE', ideaId: offer?.idea.id ?? '' }).result,
    ).toEqual({ ok: false, error: 'NOT_ENOUGH_MONEY' });
    expect(poor.state.gauges.treasury).toBe(100_000);
  });

  it('se limitent à trois et se ferment pendant les derniers sprints', () => {
    const { simulation, state } = richSeriesA();
    for (let i = 0; i < VENTURES.maxFounded; i++) {
      foundFirst(simulation);
      state.sprint += VENTURES.cooldownSprints;
    }
    expect(state.ventures).toHaveLength(3);
    expect(ventureBlocker(state)).toBe('VENTURE_LIMIT');

    const late = richSeriesA();
    late.state.sprint = late.state.totalSprints - 1;
    expect(ventureBlocker(late.state)).toBe('TOO_LATE');
    late.state.sprint = late.state.totalSprints - VENTURES.closedLastSprints;
    expect(ventureBlocker(late.state)).toBeNull();
  });

  it('ne se créent que pendant la planification', () => {
    const { simulation, state } = richSeriesA();
    simulation.dispatch({ type: 'START_SPRINT' });
    expect(ventureBlocker(state)).toBe('WRONG_STAGE');
  });
});

describe('Filiales : vie, mort et revente', () => {
  it('évoluent à chaque sprint de façon reproductible', () => {
    const a = richSeriesA();
    const b = richSeriesA();
    foundFirst(a.simulation);
    foundFirst(b.simulation);
    for (let sprint = 0; sprint < 10; sprint++) {
      a.state.sprint += 1;
      b.state.sprint += 1;
      ventureSprint(a.state, makeContext(a.state));
      ventureSprint(b.state, makeContext(b.state));
    }
    expect(a.state.ventures).toEqual(b.state.ventures);
    expect(a.state.ventures[0]?.history.length).toBeGreaterThan(0);
  });

  it('versent des dividendes, coulent parfois, ne dépassent jamais le plafond', () => {
    let dividends = 0;
    let dead = 0;
    for (let game = 0; game < 40; game++) {
      const simulation = newSimulation(`life-${game}`);
      const { state } = simulation;
      state.phase = 'SERIES_A';
      state.gauges.treasury = 50_000_000;
      for (const risk of [0, 1, 2]) {
        const offer = ventureOffers(state)[risk];
        if (offer) simulation.dispatch({ type: 'FOUND_VENTURE', ideaId: offer.idea.id });
        state.lastVentureSprint = null;
      }
      for (let sprint = 0; sprint < 25; sprint++) {
        state.sprint += 1;
        ventureSprint(state, makeContext(state));
      }
      for (const venture of state.ventures) {
        dividends += venture.dividends;
        if (venture.status === 'DEAD') {
          dead += 1;
          expect(venture.valuation).toBe(0);
        }
        expect(venture.valuation).toBeLessThanOrEqual(VENTURES.maxValuation);
        if (venture.risk === 'MOONSHOT') expect(venture.dividends).toBe(0);
      }
      expect(state.stats.ventureCashIn).toBe(
        state.ventures.reduce((total, venture) => total + venture.dividends, 0),
      );
    }
    expect(dividends).toBeGreaterThan(0);
    expect(dead).toBeGreaterThan(0);
  });

  it('se revendent avec une décote, et l’aile reste', () => {
    const { simulation, state } = richSeriesA();
    foundFirst(simulation);
    const venture = state.ventures[0];
    if (!venture) throw new Error('filiale manquante');
    venture.valuation = 10_000_000;
    const treasury = state.gauges.treasury;
    expect(simulation.dispatch({ type: 'SELL_VENTURE', ventureId: venture.id }).result).toEqual({
      ok: true,
    });
    const price = Math.round(10_000_000 * VENTURES.stake * VENTURES.saleDiscount);
    expect(state.gauges.treasury).toBe(treasury + price);
    expect(venture.status).toBe('SOLD');
    expect(venture.soldFor).toBe(price);
    expect(portfolioValue(state)).toBe(0);
    expect(officeWings(state)).toBe(1);
    expect(simulation.dispatch({ type: 'SELL_VENTURE', ventureId: venture.id }).result).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
  });

  it('sont bradées pour éviter la faillite', () => {
    const { simulation, state } = richSeriesA();
    foundFirst(simulation);
    const venture = state.ventures[0];
    if (!venture) throw new Error('filiale manquante');
    venture.valuation = 10_000_000;
    state.gauges.treasury = -1_000;
    expect(emergencySale(state, makeContext(state))).toBe(true);
    expect(venture.status).toBe('SOLD');
    expect(state.gauges.treasury).toBe(
      -1_000 + Math.round((10_000_000 * VENTURES.stake * VENTURES.saleDiscount) / 2),
    );
    state.gauges.treasury = -1_000;
    expect(emergencySale(state, makeContext(state))).toBe(false);
  });
});

describe('Filiales : cartes, bureau et sauvegarde', () => {
  it('six cartes ne tombent qu’avec une filiale active', () => {
    const cards = EVENT_CARDS.filter((card) => card.conditions.hasVenture);
    expect(cards).toHaveLength(6);
    const { simulation, state } = richSeriesA();
    const clock = clockAt(1, 100);
    for (const card of cards) expect(conditionsMet(state, card, clock)).toBe(false);
    foundFirst(simulation);
    for (const card of cards) expect(conditionsMet(state, card, clock)).toBe(true);
  });

  it('l’effet ventureValue change la valorisation de la dernière filiale', () => {
    const { simulation, state } = richSeriesA();
    foundFirst(simulation);
    const venture = state.ventures[0];
    if (!venture) throw new Error('filiale manquante');
    const before = venture.valuation;
    const card = testCard({
      choices: [
        { label: { fr: 'A', en: 'A' }, effects: { ventureValue: 50 } },
        { label: { fr: 'B', en: 'B' }, effects: {} },
      ],
    });
    applyEffects(state, makeContext(state), card, { ventureValue: 50 }, 0);
    expect(venture.valuation).toBe(Math.round(before * 1.5));
  });

  it('chaque filiale agrandit le bureau d’une aile incubateur', () => {
    const base = officeLayout('SERIES_A');
    const wide = officeLayout('SERIES_A', 2);
    expect(wide.width).toBe(base.width + 2 * VENTURES.wingWidth);
    expect(wide.rooms.filter((room) => room.kind === 'incubator')).toHaveLength(2);
    expect(wide.maxTeam).toBe(base.maxTeam + 2 * VENTURES.teamPerWing);
    expect(officeLayout('UNICORN', 9).width).toBe(
      officeLayout('UNICORN').width + VENTURES.maxFounded * VENTURES.wingWidth,
    );
    // Chaque cloison d'aile a deux portes.
    const wall = base.width;
    const wallCells = wide.partitions.filter((cell) => cell.x === wall);
    expect(wallCells).toHaveLength(base.depth - 2);
  });

  it('on peut meubler l’aile côté simulation', () => {
    const { simulation, state } = richSeriesA();
    const { state: other } = stateWithTeam([]);
    const desk = { id: 'desk', width: 2, depth: 1 } as Parameters<typeof canPlace>[1];
    const x = officeLayout('SERIES_A').width + 2;
    expect(canPlace(other, desk, x, 1, 0)).toBe(false);
    foundFirst(simulation);
    expect(canPlace(state, desk, x, 1, 0)).toBe(true);
  });

  it('une sauvegarde d’avant les filiales se recharge sans filiale', () => {
    const { state } = newSimulation('old-save');
    const old = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    delete old.ventures;
    delete old.lastVentureSprint;
    const stats = old.stats as Record<string, unknown>;
    delete stats.venturesFounded;
    delete stats.ventureCashIn;
    const parsed = GameStateSchema.parse(old);
    expect(parsed.ventures).toEqual([]);
    expect(parsed.lastVentureSprint).toBeNull();
    expect(parsed.stats.venturesFounded).toBe(0);
  });

  // Parties complètes et rejouées : plusieurs secondes sur une machine chargée (CI).
  it('une partie avec filiales se rejoue à l’identique (replay, anti-triche)', () => {
    const cards = new CardLibrary(EVENT_CARDS);
    const simulation = Simulation.create({ seed: 'investor-replay', mode: 'NORMAL' }, cards);
    playWithBot(simulation, createBot('investor', 'investor-replay'), cards);
    expect(simulation.state.ventures.length).toBeGreaterThan(0);
    const replayed = replay({
      seed: 'investor-replay',
      mode: 'NORMAL',
      commands: simulation.commands,
      cards,
    });
    expect(replayed.state).toEqual(simulation.state);
  }, 20_000);
});
