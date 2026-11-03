import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  GameStateSchema,
  PRICE_TIERS,
  PRICING,
  PRICING_MODELS,
  defaultPricing,
  oneTimePrice,
  pricingChangeHype,
  pricingChangeLoss,
  pricingFactors,
  userValue,
} from '@oss/shared';
import { computeValuation, monthlyRevenue } from '../../src/simulation/economy';
import { acquireUsers } from '../../src/simulation/pricing';
import type { Simulation } from '../../src/simulation/simulation';
import { toGameView } from '../../src/view/adapter';
import { newSimulation } from './fixtures';

const viewOf = (simulation: Simulation) =>
  toGameView(simulation.state, { speed: 1, running: false, card: () => undefined });

/** Une partie en planification avec des utilisateurs, pour voir l'effet des prix. */
function withUsers(seed: string, users = 100_000): Simulation {
  const simulation = newSimulation(seed);
  simulation.state.gauges.users = users;
  return simulation;
}

describe('Modèle économique', () => {
  it('commence en freemium standard, l’économie d’origine (aussi pour les vieilles sauvegardes)', () => {
    const simulation = withUsers('prix-defaut');
    expect(simulation.state.pricing).toEqual(defaultPricing());
    expect(pricingFactors('FREEMIUM', 'STANDARD')).toEqual({ arpu: 1, acquisition: 1, churn: 1 });
    expect(userValue('FREEMIUM', 'STANDARD')).toBe(1);
    expect(monthlyRevenue(simulation.state)).toBeCloseTo(100_000 * BALANCE.economy.arpuMonthly);
    const old = structuredClone(simulation.state) as Partial<typeof simulation.state>;
    delete old.pricing;
    expect(GameStateSchema.parse(old).pricing).toEqual(defaultPricing());
  });

  it('l’abonnement rapporte plus par utilisateur mais en attire moins', () => {
    const sub = pricingFactors('SUBSCRIPTION', 'STANDARD');
    const free = pricingFactors('FREE_ADS', 'STANDARD');
    expect(sub.arpu).toBeGreaterThan(1);
    expect(sub.acquisition).toBeLessThan(1);
    expect(sub.churn).toBeGreaterThan(1);
    expect(free.arpu).toBeLessThan(1);
    expect(free.acquisition).toBeGreaterThan(1);
    expect(userValue('SUBSCRIPTION', 'STANDARD')).toBeGreaterThan(
      userValue('FREE_ADS', 'STANDARD'),
    );
  });

  it('chaque modèle et chaque prix a un revenu, une acquisition et des départs positifs', () => {
    for (const model of PRICING_MODELS)
      for (const tier of PRICE_TIERS) {
        const f = pricingFactors(model, tier);
        expect(f.arpu).toBeGreaterThan(0);
        expect(f.acquisition).toBeGreaterThan(0);
        expect(f.churn).toBeGreaterThan(0);
      }
  });

  it('monter les prix fait partir des utilisateurs et coûte de la hype', () => {
    const simulation = withUsers('prix-hausse');
    const hype = simulation.state.gauges.hype;
    const loss = pricingChangeLoss(defaultPricing(), 'SUBSCRIPTION', 'PREMIUM');
    expect(loss).toBeGreaterThan(0);
    expect(loss).toBeLessThanOrEqual(PRICING.maxRaiseLoss);
    const result = simulation.dispatch({
      type: 'SET_PRICING',
      model: 'SUBSCRIPTION',
      tier: 'PREMIUM',
    }).result;
    expect(result.ok).toBe(true);
    expect(simulation.state.gauges.users).toBeCloseTo(100_000 * (1 - loss));
    expect(simulation.state.gauges.hype).toBeCloseTo(Math.max(0, hype + PRICING.raiseHype));
    expect(simulation.state.pricing).toMatchObject({
      model: 'SUBSCRIPTION',
      tier: 'PREMIUM',
      changedSprint: 1,
      changes: 1,
    });
    expect(simulation.state.notifications.at(-1)?.kind).toBe('PRICING_CHANGED');
  });

  it('baisser les prix ne fait partir personne et donne de la hype', () => {
    expect(pricingChangeLoss(defaultPricing(), 'FREE_ADS', 'LOW')).toBe(0);
    expect(pricingChangeHype(defaultPricing(), 'FREE_ADS', 'LOW')).toBe(PRICING.cutHype);
    const simulation = withUsers('prix-baisse');
    simulation.dispatch({ type: 'SET_PRICING', model: 'FREE_ADS', tier: 'LOW' });
    expect(simulation.state.gauges.users).toBe(100_000);
  });

  it('un seul changement par sprint, et pas pour rien', () => {
    const simulation = withUsers('prix-cooldown');
    const same = simulation.dispatch({ type: 'SET_PRICING', model: 'FREEMIUM', tier: 'STANDARD' });
    expect(same.result).toEqual({ ok: false, error: 'NOT_ELIGIBLE' });
    simulation.dispatch({ type: 'SET_PRICING', model: 'FREEMIUM', tier: 'LOW' });
    const again = simulation.dispatch({ type: 'SET_PRICING', model: 'FREEMIUM', tier: 'PREMIUM' });
    expect(again.result).toEqual({ ok: false, error: 'COOLDOWN' });
    expect(viewOf(simulation).pricing.blocker).toBe('COOLDOWN');
  });

  it('en achat unique, chaque nouvel utilisateur paie une fois', () => {
    const simulation = withUsers('prix-achat');
    simulation.dispatch({ type: 'SET_PRICING', model: 'ONE_TIME', tier: 'STANDARD' });
    const { state } = simulation;
    const treasury = state.gauges.treasury;
    const users = state.gauges.users;
    const gained = acquireUsers(state, 1000);
    expect(gained).toBeCloseTo(1000 * pricingFactors('ONE_TIME', 'STANDARD').acquisition);
    expect(state.gauges.users).toBeCloseTo(users + gained);
    expect(state.gauges.treasury - treasury).toBeCloseTo(
      gained * oneTimePrice('ONE_TIME', 'STANDARD'),
    );
  });

  it('la valorisation compte plus un client payant qu’un visiteur', () => {
    const free = withUsers('prix-valo');
    const paid = withUsers('prix-valo');
    free.dispatch({ type: 'SET_PRICING', model: 'FREE_ADS', tier: 'STANDARD' });
    paid.state.pricing = {
      model: 'SUBSCRIPTION',
      tier: 'STANDARD',
      changedSprint: null,
      changes: 1,
    };
    expect(computeValuation(paid.state)).toBeGreaterThan(computeValuation(free.state));
  });

  it('la vue montre les 12 réglages et ce qu’ils coûteraient', () => {
    const simulation = withUsers('prix-vue');
    const view = viewOf(simulation).pricing;
    expect(view.choices).toHaveLength(PRICING_MODELS.length * PRICE_TIERS.length);
    expect(view.current).toMatchObject({ model: 'FREEMIUM', tier: 'STANDARD', usersLost: 0 });
    const premium = view.choices.find((c) => c.model === 'SUBSCRIPTION' && c.tier === 'PREMIUM');
    expect(premium?.usersLost).toBeGreaterThan(0);
    expect(premium?.hype).toBe(PRICING.raiseHype);
    expect(view.blocker).toBeNull();
  });

  it('rejoue la même partie à l’identique (aucun tirage)', () => {
    const a = newSimulation('prix-replay');
    const b = newSimulation('prix-replay');
    for (const sim of [a, b]) {
      sim.dispatch({ type: 'SET_PRICING', model: 'SUBSCRIPTION', tier: 'LOW' });
      sim.dispatch({ type: 'START_SPRINT' });
      for (let i = 0; i < 400 && sim.isRunning; i++) sim.step();
    }
    expect(a.state.rng).toEqual(b.state.rng);
    expect(a.state.gauges).toEqual(b.state.gauges);
  });
});
