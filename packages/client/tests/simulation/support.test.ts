import { describe, expect, it } from 'vitest';
import {
  GameStateSchema,
  SUPPORT,
  SUPPORT_MAX_AGENTS,
  dailyTickets,
  emptySupportState,
  satisfactionTarget,
  supportChurnFactor,
  supportGrowthFactor,
} from '@oss/shared';
import { monthlyExpenses } from '../../src/simulation/economy';
import {
  setSupport,
  supportCapacity,
  supportDay,
  supportMonthly,
  supportWorkFactor,
  ticketsToday,
} from '../../src/simulation/support';
import { clockAt } from '../../src/simulation/time';
import { toGameView } from '../../src/view/adapter';
import { makeContext, newSimulation, stateWithTeam } from './fixtures';

/** Lundi midi et samedi midi du premier sprint. */
const MONDAY = clockAt(1, 6);
const SATURDAY = clockAt(1, 5 * 48 + 6);

describe('Support client', () => {
  it('démarre vide et reste valide pour les vieilles sauvegardes', () => {
    const simulation = newSimulation('support-vieux');
    expect(simulation.state.support).toEqual(emptySupportState());
    const old = structuredClone(simulation.state) as Partial<typeof simulation.state>;
    delete old.support;
    expect(GameStateSchema.parse(old).support).toEqual(emptySupportState());
  });

  it('reçoit plus de tickets avec plus d’utilisateurs, de dette et d’instabilité', () => {
    expect(dailyTickets(1000, 0, 100)).toBeCloseTo(3);
    expect(dailyTickets(1_000_000, 0, 100)).toBeCloseTo(3 * Math.sqrt(1000));
    expect(dailyTickets(1000, 50, 100)).toBeCloseTo(4.5);
    expect(dailyTickets(1000, 0, 50)).toBeCloseTo(4.5);
    expect(dailyTickets(0, 80, 10)).toBe(0);
  });

  it('les tickets en attente font baisser la satisfaction et partir les utilisateurs', () => {
    expect(satisfactionTarget(0, 10)).toBe(SUPPORT.targetMax);
    expect(satisfactionTarget(20, 10)).toBe(SUPPORT.targetMax - 2 * SUPPORT.targetPerWaitDay);
    expect(satisfactionTarget(1000, 10)).toBe(0);
    expect(supportChurnFactor(75)).toBe(1);
    expect(supportChurnFactor(0)).toBeCloseTo(1 + SUPPORT.maxExtraChurn);
    expect(supportGrowthFactor(85)).toBe(1 + SUPPORT.happyGrowth);
    expect(supportGrowthFactor(70)).toBe(1);
  });

  it('sans personne au support, les tickets s’accumulent et la satisfaction chute', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD']);
    state.gauges.users = 100_000;
    const ctx = makeContext(state);
    const received = ticketsToday(state);
    for (let day = 0; day < 10; day++) supportDay(state, ctx, MONDAY);
    expect(state.support.backlog).toBeCloseTo(received * 10);
    expect(state.support.satisfaction).toBeLessThan(SUPPORT.churnThreshold);
    expect(state.notifications.some((n) => n.kind === 'SUPPORT_UNHAPPY')).toBe(true);
  });

  it('les agents répondent aux tickets et gardent les utilisateurs contents', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD']);
    state.gauges.users = 100_000;
    const ctx = makeContext(state);
    const hype = state.gauges.hype;
    state.support.agents = 2;
    expect(supportCapacity(state)).toBe(2 * SUPPORT.agentCapacity);
    for (let day = 0; day < 20; day++) supportDay(state, ctx, MONDAY);
    expect(state.support.backlog).toBe(0);
    expect(state.support.satisfaction).toBeGreaterThan(SUPPORT.happyThreshold);
    expect(state.gauges.hype).toBeGreaterThan(hype);
  });

  it('pas de tickets le week-end', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD']);
    state.gauges.users = 100_000;
    supportDay(state, makeContext(state), SATURDAY);
    expect(state.support.received).toBe(0);
    expect(state.support.backlog).toBe(0);
  });

  it('les devs de garde répondent aussi, mais codent moins', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD', 'TEN_X', 'INTERN', 'RUSTACEAN']);
    expect(supportWorkFactor(state)).toBe(1);
    state.support.duty = 'HEAVY';
    expect(supportWorkFactor(state)).toBe(1 - SUPPORT.dutyShare.HEAVY);
    expect(supportCapacity(state)).toBeCloseTo(4 * SUPPORT.devCapacity * SUPPORT.dutyShare.HEAVY);
  });

  it('les agents sont payés chaque mois', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD']);
    const before = monthlyExpenses(state);
    state.support.agents = 3;
    expect(supportMonthly(state)).toBe(3 * SUPPORT.agentSalary);
    expect(monthlyExpenses(state)).toBeCloseTo(before + 3 * SUPPORT.agentSalary);
  });

  it('refuse un réglage inchangé ou trop d’agents pour la phase', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD']);
    const ctx = makeContext(state);
    expect(setSupport(state, ctx, 0, 'NONE')).toEqual({ ok: false, error: 'NOT_ELIGIBLE' });
    const max = SUPPORT_MAX_AGENTS[state.phase];
    expect(setSupport(state, ctx, max + 1, 'NONE')).toEqual({ ok: false, error: 'TEAM_FULL' });
    expect(setSupport(state, ctx, max, 'LIGHT')).toEqual({ ok: true });
    expect(state.support).toMatchObject({ agents: max, duty: 'LIGHT' });
    expect(state.notifications.some((n) => n.kind === 'SUPPORT_STAFFED')).toBe(true);
  });

  it('se règle par une commande et s’affiche dans la vue, sans toucher au hasard', () => {
    const a = newSimulation('support-commande');
    const rng = [...a.state.rng];
    expect(a.dispatch({ type: 'SET_SUPPORT', agents: 1, duty: 'LIGHT' }).result.ok).toBe(true);
    expect(a.state.rng).toEqual(rng);
    const view = toGameView(a.state, { speed: 1, running: false, card: () => undefined });
    expect(view.support).toMatchObject({ agents: 1, duty: 'LIGHT' });
    const b = newSimulation('support-commande');
    b.dispatch({ type: 'SET_SUPPORT', agents: 1, duty: 'LIGHT' });
    expect(b.state).toEqual(a.state);
  });
});
