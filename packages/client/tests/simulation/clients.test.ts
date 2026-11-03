import { describe, expect, it } from 'vitest';
import {
  CLIENT_SLOTS,
  CLIENTS,
  GameStateSchema,
  contractMonthly,
  emptyClientsState,
} from '@oss/shared';
import {
  activeContracts,
  clientsDemo,
  clientsMonthly,
  clientsOutage,
  freeClientSlots,
  refreshClientOffers,
} from '../../src/simulation/clients';
import { annualRevenue } from '../../src/simulation/economy';
import type { Simulation } from '../../src/simulation/simulation';
import { toGameView } from '../../src/view/adapter';
import { makeContext, newSimulation } from './fixtures';

const viewOf = (simulation: Simulation) =>
  toGameView(simulation.state, { speed: 1, running: false, card: () => undefined });

/** Signe la première offre et renvoie le contrat. */
function signFirst(simulation: Simulation) {
  const offer = simulation.state.clients.offers[0];
  if (!offer) throw new Error('aucune offre');
  const result = simulation.dispatch({ type: 'SIGN_CLIENT', offerId: offer.id }).result;
  expect(result.ok).toBe(true);
  const contract = simulation.state.clients.contracts.at(-1);
  if (!contract) throw new Error('aucun contrat');
  return contract;
}

describe('Clients B2B', () => {
  it('propose des offres dès la première planification, sans toucher au hasard de la partie', () => {
    const a = newSimulation('b2b-offres');
    expect(a.state.clients.offers).toHaveLength(CLIENTS.offersPerSprint);
    const rng = [...a.state.rng];
    a.state.clients.offersSprint = null;
    refreshClientOffers(a.state);
    expect(a.state.rng).toEqual(rng);
    const b = newSimulation('b2b-offres');
    expect(b.state.clients.offers).toEqual(a.state.clients.offers);
  });

  it('reste valide pour les vieilles sauvegardes', () => {
    const simulation = newSimulation('b2b-vieux');
    const old = structuredClone(simulation.state) as Partial<typeof simulation.state>;
    delete old.clients;
    expect(GameStateSchema.parse(old).clients).toEqual(emptyClientsState());
  });

  it('signer paie la prime et occupe une place', () => {
    const simulation = newSimulation('b2b-signe');
    const treasury = simulation.state.gauges.treasury;
    const contract = signFirst(simulation);
    expect(simulation.state.gauges.treasury).toBeCloseTo(
      treasury + contract.monthlyFee * CLIENTS.signingMonths,
    );
    expect(contract).toMatchObject({ status: 'ACTIVE', progress: 0, signedSprint: 1 });
    expect(contract.dueSprint).toBe(contract.sprints);
    expect(freeClientSlots(simulation.state)).toBe(CLIENT_SLOTS.GARAGE - 1);
    // Au garage, une seule place : la deuxième offre est refusée.
    const next = simulation.state.clients.offers[0];
    expect(next).toBeDefined();
    const refused = simulation.dispatch({ type: 'SIGN_CLIENT', offerId: next?.id ?? '' }).result;
    expect(refused).toEqual({ ok: false, error: 'NOT_ELIGIBLE' });
    expect(viewOf(simulation).clients.offers[0]?.blocker).toBe('NO_SLOT');
  });

  it('livré à temps : prime, utilisateurs, puis maintenance qui finit', () => {
    const simulation = newSimulation('b2b-livre');
    const { state } = simulation;
    const ctx = makeContext(state);
    const contract = signFirst(simulation);
    const treasury = state.gauges.treasury;
    const users = state.gauges.users;
    clientsDemo(state, ctx, { [contract.need]: contract.points + 10 });
    expect(contract.status).toBe('DELIVERED');
    expect(contract.progress).toBe(contract.points);
    expect(state.gauges.treasury).toBeCloseTo(
      treasury + contract.monthlyFee * CLIENTS.deliveryMonths,
    );
    expect(state.gauges.users).toBeCloseTo(users + contract.users);
    expect(contractMonthly(contract)).toBeCloseTo(contract.monthlyFee * CLIENTS.maintenanceShare);
    expect(activeContracts(state)).toHaveLength(0);
    state.sprint += CLIENTS.maintenanceSprints;
    clientsDemo(state, ctx, {});
    expect(state.clients.contracts).toHaveLength(0);
    expect(state.clients).toMatchObject({ delivered: 1, lost: 0 });
  });

  it('les points d’un autre type ne comptent pas, et un point ne sert qu’une fois', () => {
    const simulation = newSimulation('b2b-type');
    const { state } = simulation;
    state.phase = 'SERIES_A';
    const ctx = makeContext(state);
    const first = signFirst(simulation);
    const second = signFirst(simulation);
    second.need = first.need;
    const other = first.need === 'FEATURE' ? 'INFRA' : 'FEATURE';
    clientsDemo(state, ctx, { [other]: 100 });
    expect(first.progress).toBe(0);
    clientsDemo(state, ctx, { [first.need]: first.points });
    expect(first.progress).toBe(first.points);
    expect(second.progress).toBe(0);
  });

  it('échéance ratée : pénalité et hype perdue', () => {
    const simulation = newSimulation('b2b-rate');
    const { state } = simulation;
    const ctx = makeContext(state);
    const contract = signFirst(simulation);
    state.sprint = contract.dueSprint;
    const treasury = state.gauges.treasury;
    const hype = state.gauges.hype;
    clientsDemo(state, ctx, {});
    expect(state.clients.contracts).toHaveLength(0);
    expect(state.clients.lost).toBe(1);
    expect(state.gauges.treasury).toBeCloseTo(
      treasury - contract.monthlyFee * CLIENTS.penaltyMonths,
    );
    expect(state.gauges.hype).toBeCloseTo(Math.max(0, hype + CLIENTS.breakHype));
    expect(state.notifications.at(-1)?.kind).toBe('CLIENT_LOST');
  });

  it('chaque panne applique le SLA, et le client part après trop de pannes', () => {
    const simulation = newSimulation('b2b-sla');
    const { state } = simulation;
    const ctx = makeContext(state);
    const contract = signFirst(simulation);
    const treasury = state.gauges.treasury;
    clientsOutage(state, ctx);
    expect(contract.breaches).toBe(1);
    expect(state.gauges.treasury).toBeCloseTo(
      treasury - contract.monthlyFee * CLIENTS.slaPenaltyMonths,
    );
    for (let i = 0; i < CLIENTS.maxBreaches; i++) clientsOutage(state, ctx);
    expect(state.clients.contracts).toHaveLength(0);
    expect(state.clients.lost).toBe(1);
  });

  it('rompre un contrat en cours coûte la pénalité', () => {
    const simulation = newSimulation('b2b-rompt');
    const contract = signFirst(simulation);
    const treasury = simulation.state.gauges.treasury;
    simulation.dispatch({ type: 'DROP_CLIENT', contractId: contract.id });
    expect(simulation.state.gauges.treasury).toBeCloseTo(
      treasury - contract.monthlyFee * CLIENTS.penaltyMonths,
    );
    const missing = simulation.dispatch({ type: 'DROP_CLIENT', contractId: 'inconnu' }).result;
    expect(missing).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('les forfaits comptent dans le revenu récurrent', () => {
    const simulation = newSimulation('b2b-arr');
    const before = annualRevenue(simulation.state);
    const contract = signFirst(simulation);
    expect(clientsMonthly(simulation.state)).toBe(contract.monthlyFee);
    expect(annualRevenue(simulation.state)).toBeCloseTo(before + contract.monthlyFee * 12);
    const view = viewOf(simulation).clients;
    expect(view.contracts[0]).toMatchObject({ status: 'ACTIVE', sprintsLeft: contract.sprints });
    expect(view.monthlyTotal).toBe(contract.monthlyFee);
  });

  it('rejoue la même partie à l’identique', () => {
    const a = newSimulation('b2b-replay');
    const b = newSimulation('b2b-replay');
    for (const sim of [a, b]) {
      signFirst(sim);
      sim.dispatch({ type: 'START_SPRINT' });
      for (let i = 0; i < 400 && sim.isRunning; i++) sim.step();
    }
    expect(a.state.rng).toEqual(b.state.rng);
    expect(a.state.clients).toEqual(b.state.clients);
  });
});
