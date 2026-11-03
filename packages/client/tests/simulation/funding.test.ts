import {
  ANNEXES,
  FINANCING,
  argumentBasis,
  isRandomArgument,
  pitchRating,
  FUNDING_TIERS,
  GameStateSchema,
  PITCH_ARGUMENTS,
  getPitchArgument,
  type GameState,
} from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/simulation/commands';
import { monthlyExpenses, repayLoan } from '../../src/simulation/economy';
import { financingOffers, takeFinancing } from '../../src/simulation/financing';
import {
  answerDelta,
  categoryStrengths,
  estimatePitchChance,
  expectedAnswer,
  pitchArgument,
  startPitch,
} from '../../src/simulation/fundraising';
import { Rng } from '../../src/simulation/rng';
import { canPlace } from '../../src/simulation/furniture';
import { teamMax, teamMoral } from '../../src/simulation/helpers';
import { getFurniture } from '@oss/shared';
import { EVENT_CARDS } from '@oss/shared';
import { CardLibrary } from '../../src/events/library';
import { createBot, playWithBot } from '../../src/simulation/bots';
import { replay } from '../../src/simulation/replay';
import { Simulation } from '../../src/simulation/simulation';
import { FixedRng, makeContext, stateWithTeam } from './fixtures';

/** État en Série A, prêt pour le tour de table numéro `rounds` (2 = Série B). */
function seriesState(rounds: number): GameState {
  const { state } = stateWithTeam(['SENIOR_BEARD', 'TEN_X', 'DESIGNER']);
  state.phase = 'SERIES_A';
  state.fundingRounds = rounds;
  state.gauges.hype = 70;
  state.gauges.users = 200_000;
  return state;
}

describe('Tours de table de plus en plus durs', () => {
  it('chaque tour demande au moins autant que le précédent', () => {
    for (let i = 1; i < FUNDING_TIERS.length; i++) {
      const previous = FUNDING_TIERS[i - 1]!;
      const tier = FUNDING_TIERS[i]!;
      expect(tier.manches).toBeGreaterThanOrEqual(previous.manches);
      expect(tier.options).toBeGreaterThanOrEqual(previous.options);
      expect(tier.bar).toBeGreaterThan(previous.bar);
      expect(tier.offTopicPenalty).toBeGreaterThan(previous.offTopicPenalty);
      expect(tier.bluffCaught).toBeGreaterThan(previous.bluffCaught);
    }
    // Le Seed reste un pitch en 3 manches, comme avant.
    expect(FUNDING_TIERS[0]).toMatchObject({ manches: 3, options: 3, bar: 0 });
  });

  it('les bluffs et les arguments de grands tours n’arrivent pas au Seed', () => {
    const seedPool = PITCH_ARGUMENTS.filter((argument) => (argument.minTier ?? 0) === 0);
    expect(seedPool.every((argument) => !argument.bluff)).toBe(true);
    expect(PITCH_ARGUMENTS.some((argument) => argument.bluff)).toBe(true);
  });

  it('pose une question à chaque manche et propose toujours une réponse dans le thème', () => {
    const state = seriesState(2);
    const ctx = makeContext(state);
    expect(startPitch(state, ctx).ok).toBe(true);
    const pitch = state.pitch!;
    expect(pitch).toMatchObject({ tier: 2, manches: 4 });
    expect(pitch.options).toHaveLength(4);
    while (state.pitch && !state.pitch.result) {
      const question = state.pitch.question!;
      expect(question).not.toBeNull();
      const categories = state.pitch.options.map((id) => getPitchArgument(id)?.category);
      expect(categories).toContain(question.category);
      pitchArgument(state, ctx, state.pitch.options[0]!);
    }
    expect(state.pitch!.log.length).toBeGreaterThan(0);
  });

  it('une réponse hors sujet coûte plus cher aux grands tours', () => {
    const seed = FUNDING_TIERS[0]!;
    const late = FUNDING_TIERS[4]!;
    expect(answerDelta(1, 1, true, seed)).toBeGreaterThan(answerDelta(1, 1, false, seed));
    expect(answerDelta(1, 1, false, late)).toBeLessThan(answerDelta(1, 1, false, seed));
    // Une mauvaise réponse dans le thème n'est pas récompensée.
    expect(answerDelta(-1, 1, true, seed)).toBe(-1);
  });

  it('un investisseur qui s’ennuie quitte la salle avant la fin', () => {
    const state = seriesState(3);
    state.gauges.hype = 5;
    state.gauges.users = 10;
    state.gauges.debt = 100;
    state.gauges.stability = 0;
    const ctx = makeContext(state, { rng: new FixedRng(0.999) });
    expect(startPitch(state, ctx).ok).toBe(true);
    pitchArgument(state, ctx, state.pitch!.options[0]!);
    // Il écoute toujours au moins deux réponses.
    expect(state.pitch!.result).toBeNull();
    pitchArgument(state, ctx, state.pitch!.options[0]!);
    expect(state.pitch!.walkedOut).toBe(true);
    expect(state.pitch!.round).toBeLessThan(state.pitch!.manches);
    expect(state.pitch!.result?.success).toBe(false);
    expect(ctx.outbox.find((n) => n.kind === 'PITCH_FAILED')?.text.fr).toMatch(/quitté la salle/);
  });

  it('la Série B réussie ouvre une annexe au bureau et des places dans l’équipe', () => {
    const state = seriesState(2);
    const ctx = makeContext(state, { rng: new FixedRng(0.01) });
    const before = teamMax(state);
    const desk = getFurniture('desk')!;
    // Hors du bureau de la Série A (14 cases de profondeur) avant l'annexe…
    expect(canPlace(state, desk, 2, 16, 0)).toBe(false);
    startPitch(state, ctx);
    while (state.pitch && !state.pitch.result) pitchArgument(state, ctx, state.pitch.options[0]!);
    expect(state.pitch!.result!.success).toBe(true);
    expect(state.fundingRounds).toBe(3);
    expect(teamMax(state)).toBe(before + ANNEXES.teamPerAnnex);
    // … et dedans après.
    expect(canPlace(state, desk, 2, 16, 0)).toBe(true);
    expect(ctx.outbox.some((n) => n.text.fr.includes('salle d’arcade'))).toBe(true);
    expect(ctx.outbox.some((n) => n.text.fr.includes('Série B'))).toBe(true);
  });

  it('un bluff est tiré sur une graine à part, pas sur le hasard de la partie', () => {
    const outcomes = [0.01, 0.999].map((value) => {
      const state = seriesState(2);
      const ctx = makeContext(state, { rng: new FixedRng(value) });
      startPitch(state, ctx);
      state.pitch!.options = ['bluff-users'];
      state.pitch!.question = { category: 'TRACTION', index: 0 };
      pitchArgument(state, ctx, 'bluff-users');
      return state.pitch!.log[0]!;
    });
    const [first, second] = outcomes;
    expect(first!.onTopic).toBe(true);
    expect(first!.delta > 0).toBe(!first!.bluffCaught);
    // Même graine, même sprint : même verdict, quoi que tire le générateur principal.
    expect(second!.bluffCaught).toBe(first!.bluffCaught);
  });
});

/** Joue un pitch en prenant à chaque manche l'argument le plus fort parmi ceux proposés. */
function playBestPitch(base: GameState, seed: string): boolean {
  const state = structuredClone(base);
  state.seed = seed;
  const ctx = makeContext(state, { rng: Rng.fromSeed(seed) });
  startPitch(state, ctx);
  while (state.pitch && !state.pitch.result) {
    const pitch = state.pitch;
    const best = [...pitch.options].sort(
      (a, b) => expectedAnswer(state, pitch, b) - expectedAnswer(state, pitch, a),
    )[0]!;
    pitchArgument(state, ctx, best);
  }
  return state.pitch?.result?.success ?? false;
}

describe('Ce que le panneau affiche correspond au pitch', () => {
  it('estime la chance sans tirage, entre 0 et 1', () => {
    const state = seriesState(2);
    const before = JSON.stringify(state);
    const chance = estimatePitchChance(state);
    expect(chance).toBeGreaterThan(0);
    expect(chance).toBeLessThan(1);
    expect(estimatePitchChance(state)).toBe(chance);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('une startup en meilleure forme a plus de chances, un tour plus dur en a moins', () => {
    const state = seriesState(2);
    const weak = structuredClone(state);
    weak.gauges.hype = 25;
    weak.gauges.debt = 85;
    expect(estimatePitchChance(weak)).toBeLessThan(estimatePitchChance(state));
    const harder = structuredClone(state);
    harder.fundingRounds = 5;
    expect(estimatePitchChance(harder)).toBeLessThan(estimatePitchChance(state));
  });

  it('la chance estimée colle à la réussite réelle d’un joueur qui choisit bien', () => {
    for (const [rounds, hype, debt] of [
      [0, 45, 30],
      [2, 70, 20],
      [4, 55, 50],
    ] as const) {
      const state = seriesState(rounds);
      state.gauges.hype = hype;
      state.gauges.debt = debt;
      const games = 400;
      let wins = 0;
      for (let i = 0; i < games; i++) if (playBestPitch(state, `calibre-${rounds}-${i}`)) wins++;
      expect(Math.abs(wins / games - estimatePitchChance(state))).toBeLessThan(0.12);
    }
  });

  it('note chaque thème et chaque argument, et dit sur quoi il s’appuie', () => {
    const state = seriesState(2);
    state.gauges.debt = 95;
    expect(pitchRating(categoryStrengths(state).TECH)).toBe('weak');
    state.gauges.debt = 0;
    expect(pitchRating(categoryStrengths(state).TECH)).toBe('strong');
    expect(argumentBasis(getPitchArgument('uptime')!)).toBe('stability');
    expect(argumentBasis(getPitchArgument('users-curve')!)).toBe('users');
    expect(isRandomArgument(getPitchArgument('live-demo')!)).toBe(true);
    expect(isRandomArgument(getPitchArgument('clean-code')!)).toBe(false);
  });
});

describe('Autres financements', () => {
  function planningState(): GameState {
    const state = seriesState(2);
    state.stage = 'PLANNING';
    state.gauges.treasury = 500_000;
    return state;
  }

  it('calcule les offres sans aucun tirage au sort', () => {
    const state = planningState();
    const rng = [...state.rng];
    const offers = financingOffers(state);
    expect(offers.map((offer) => offer.kind)).toEqual(['BRIDGE', 'LOAN', 'CROWDFUNDING', 'GRANT']);
    expect(state.rng).toEqual(rng);
    expect(offers.find((o) => o.kind === 'BRIDGE')?.dilution).toBe(FINANCING.BRIDGE.dilution);
  });

  it('accorde un prêt bancaire remboursé chaque mois', () => {
    const state = planningState();
    const ctx = makeContext(state);
    const expenses = monthlyExpenses(state);
    const offer = financingOffers(state).find((o) => o.kind === 'LOAN')!;
    expect(offer.blocker).toBeNull();
    expect(takeFinancing(state, ctx, 'LOAN').ok).toBe(true);
    expect(state.gauges.treasury).toBe(500_000 + offer.amount);
    const loan = state.financing.loan!;
    expect(loan.monthly).toBe(offer.monthly);
    expect(monthlyExpenses(state)).toBeCloseTo(expenses + loan.monthly, 5);
    // Un seul prêt à la fois.
    expect(financingOffers(state).find((o) => o.kind === 'LOAN')?.blocker).toBe('COOLDOWN');
    state.financing.lastSprint = {};
    expect(financingOffers(state).find((o) => o.kind === 'LOAN')?.blocker).toBe('LOAN_ACTIVE');
    // Remboursé en 12 mois.
    const remaining = loan.remaining;
    repayLoan(state, 30);
    expect(state.financing.loan!.remaining).toBeCloseTo(remaining - loan.monthly, 5);
    repayLoan(state, 30 * FINANCING.LOAN.durationMonths);
    expect(state.financing.loan).toBeNull();
  });

  it('pas de prêt sans chiffre d’affaires', () => {
    const state = planningState();
    state.gauges.users = 0;
    const ctx = makeContext(state);
    expect(financingOffers(state).find((o) => o.kind === 'LOAN')?.blocker).toBe('NO_REVENUE');
    expect(takeFinancing(state, ctx, 'LOAN')).toEqual({ ok: false, error: 'NOT_AVAILABLE' });
    expect(state.financing.loan).toBeNull();
  });

  it('les business angels diluent sans compter comme un tour de table', () => {
    const state = planningState();
    const ctx = makeContext(state);
    expect(applyCommand(state, ctx, { type: 'TAKE_FINANCING', kind: 'BRIDGE' }).ok).toBe(true);
    expect(state.ownership).toBeCloseTo(1 - FINANCING.BRIDGE.dilution, 5);
    expect(state.fundingRounds).toBe(2);
    expect(applyCommand(state, ctx, { type: 'TAKE_FINANCING', kind: 'BRIDGE' })).toEqual({
      ok: false,
      error: 'COOLDOWN',
    });
  });

  it('le financement participatif demande des utilisateurs et ajoute de la dette', () => {
    const state = planningState();
    const ctx = makeContext(state);
    const debt = state.gauges.debt;
    expect(takeFinancing(state, ctx, 'CROWDFUNDING').ok).toBe(true);
    expect(state.gauges.debt).toBe(debt + FINANCING.CROWDFUNDING.debt);
    const small = planningState();
    small.gauges.users = 100;
    expect(financingOffers(small).find((o) => o.kind === 'CROWDFUNDING')?.blocker).toBe(
      'NOT_ENOUGH_USERS',
    );
  });

  it('la subvention coûte du moral et n’est plus versée aux licornes', () => {
    const state = planningState();
    const ctx = makeContext(state);
    const moral = teamMoral(state);
    expect(takeFinancing(state, ctx, 'GRANT').ok).toBe(true);
    expect(teamMoral(state)).toBeLessThan(moral);
    const unicorn = planningState();
    unicorn.phase = 'UNICORN';
    expect(financingOffers(unicorn).find((o) => o.kind === 'GRANT')?.blocker).toBe('TOO_BIG');
    const indebted = planningState();
    indebted.gauges.debt = 90;
    expect(financingOffers(indebted).find((o) => o.kind === 'GRANT')?.blocker).toBe(
      'TOO_MUCH_DEBT',
    );
  });

  it('refuse un financement en dehors de la planification', () => {
    const state = planningState();
    state.stage = 'EXECUTION';
    expect(takeFinancing(state, makeContext(state), 'GRANT')).toEqual({
      ok: false,
      error: 'WRONG_STAGE',
    });
  });

  // Parties complètes et rejouées : plusieurs secondes sur une machine chargée (CI).
  // La première graine où le bot manque d'argent et prend des financements : chaque changement
  // d'équilibrage déplace ces parties, une graine fixe finirait par ne plus en prendre aucun.
  it('une partie avec financements se rejoue à l’identique (replay, anti-triche)', () => {
    const cards = new CardLibrary(EVENT_CARDS);
    let seed = '';
    let simulation: Simulation | null = null;
    for (let i = 0; i < 40 && !simulation; i++) {
      seed = `fin-${i}`;
      const candidate = Simulation.create({ seed, mode: 'NORMAL' }, cards);
      playWithBot(candidate, createBot('financier', seed), cards);
      if (candidate.commands.some((entry) => entry.command.type === 'TAKE_FINANCING'))
        simulation = candidate;
    }
    if (!simulation) throw new Error('Aucune partie du bot « financier » ne prend de financement');
    const replayed = replay({
      seed,
      mode: 'NORMAL',
      commands: simulation.commands,
      cards,
    });
    expect(replayed.state).toEqual(simulation.state);
  }, 120_000);

  it('charge une ancienne sauvegarde sans financements ni nouveaux champs de pitch', () => {
    const state = seriesState(2);
    const ctx = makeContext(state);
    startPitch(state, ctx);
    const old = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    delete old.financing;
    const { investor, round, interest, options, chosen, result } = state.pitch!;
    old.pitch = { investor, round, interest, options, chosen, result };
    const parsed = GameStateSchema.parse(old);
    expect(parsed.financing).toEqual({ lastSprint: {}, loan: null });
    expect(parsed.pitch).toMatchObject({ tier: 0, manches: 3, question: null, log: [] });
  });
});
