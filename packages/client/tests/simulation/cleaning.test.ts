import { describe, expect, it } from 'vitest';
import {
  CLEANING,
  CLEANING_WEEK_TICKS,
  GameStateSchema,
  TIME,
  cleaningCallPrice,
  cleaningVisitPrice,
  cleaningWeeklyPrice,
  dirtGrowth,
  dirtProductivity,
  getCleaningPlan,
  type Notification,
  type Task,
} from '@oss/shared';
import { cleaningMonthly, dirtMultiplier, planWeeklyPrice } from '../../src/simulation/cleaning';
import { productivity } from '../../src/simulation/systems/work';
import type { Simulation } from '../../src/simulation/simulation';
import { getClock } from '../../src/simulation/time';
import { toGameView } from '../../src/view/adapter';
import { makeContext, newSimulation, stateWithTeam } from './fixtures';

const viewOf = (simulation: Simulation) =>
  toGameView(simulation.state, { speed: 1, running: false, card: () => undefined });

const TASK: Task = {
  title: { fr: 'Tâche', en: 'Task' },
  type: 'FEATURE',
  trade: 'DEV',
  size: 3,
  progress: 0,
  work: 15,
  column: 'TODO',
  order: 0,
  assigneeId: null,
  qualitySum: 0,
  debtFactor: 0,
  shinyFramework: false,
  designApproved: false,
  hallucinated: false,
  createdAtSprint: 1,
  doneAtSprint: null,
};

/** Lance le sprint et avance jusqu'à l'heure voulue du jour `day` (0 = lundi). */
function runTo(simulation: Simulation, day: number, hour: number): void {
  if (simulation.state.stage === 'PLANNING') simulation.dispatch({ type: 'START_SPRINT' });
  const target = day * TIME.ticksPerDay + (hour - 8) * TIME.ticksPerHour;
  while (simulation.state.sprintTick < target && simulation.isRunning) simulation.step();
  // Les cartes d'événements bloquent la simulation : on choisit la première réponse.
  for (let guard = 0; simulation.state.sprintTick < target && guard < 2000; guard++) {
    if (simulation.state.events.pending)
      simulation.dispatch({ type: 'RESOLVE_EVENT', choiceIndex: 0 });
    else simulation.step();
  }
}

describe('Saleté du bureau', () => {
  it('commence propre et reste valide pour les vieilles sauvegardes', () => {
    const simulation = newSimulation('menage');
    expect(simulation.state.cleaning.dirt).toBe(0);
    const old = structuredClone(simulation.state) as Partial<typeof simulation.state>;
    delete old.cleaning;
    const parsed = GameStateSchema.parse(old);
    expect(parsed.cleaning).toMatchObject({ dirt: 0, plan: null, booking: null, visit: null });
  });

  it('monte pendant les heures de bureau, plus vite quand on attend', () => {
    const simulation = newSimulation('menage');
    runTo(simulation, 0, 19);
    const firstDay = simulation.state.cleaning.dirt;
    expect(firstDay).toBeGreaterThan(0);
    // La nuit, personne ne salit (sans chat).
    runTo(simulation, 1, 8);
    expect(simulation.state.cleaning.dirt).toBeCloseTo(firstDay, 5);
    expect(simulation.state.cleaning.daysSinceClean).toBe(1);
    runTo(simulation, 1, 19);
    const secondDay = simulation.state.cleaning.dirt - firstDay;
    expect(secondDay).toBeGreaterThan(firstDay);
    expect(dirtGrowth(0)).toBe(1);
    expect(dirtGrowth(100)).toBe(1 + CLEANING.growthMax);
  });

  it('ne bouge pas le week-end', () => {
    const simulation = newSimulation('menage');
    runTo(simulation, 5, 9);
    const saturday = simulation.state.cleaning.dirt;
    runTo(simulation, 6, 20);
    expect(simulation.state.cleaning.dirt).toBeCloseTo(saturday, 5);
  });

  it('ralentit les devs au bureau, pas les télétravailleurs', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'SENIOR_BEARD']);
    const [onSite = '', remote = ''] = ids;
    state.components.remote[remote] = true;
    const ctx = makeContext(state);
    const task = TASK;
    const clean = productivity(state, ctx, onSite, task);
    const cleanRemote = productivity(state, ctx, remote, task);
    state.cleaning.dirt = 50;
    expect(dirtMultiplier(state, onSite)).toBeCloseTo(0.8);
    expect(productivity(state, ctx, onSite, task)).toBeCloseTo(clean * 0.8);
    expect(productivity(state, ctx, remote, task)).toBeCloseTo(cleanRemote);
    expect(dirtProductivity(100)).toBeCloseTo(1 - CLEANING.productivityLoss);
  });

  it('prévient l’équipe une fois au-delà du seuil', () => {
    const simulation = newSimulation('menage');
    simulation.state.cleaning.dirt = CLEANING.dirtyAlert - 0.01;
    const notes: Notification[] = [];
    simulation.dispatch({ type: 'START_SPRINT' });
    for (let i = 0; i < 6; i++) notes.push(...simulation.step());
    expect(notes.filter((n) => n.kind === 'OFFICE_DIRTY')).toHaveLength(1);
    expect(simulation.state.cleaning.alerted).toBe(true);
  });
});

describe('Entreprise de nettoyage', () => {
  it('passe le soir même sur appel et rend le bureau propre', () => {
    const simulation = newSimulation('menage');
    simulation.state.cleaning.dirt = 60;
    const treasury = simulation.state.gauges.treasury;
    const price = cleaningCallPrice(cleaningVisitPrice('GARAGE'), false);
    expect(simulation.dispatch({ type: 'CALL_CLEANING', express: false }).result).toEqual({
      ok: true,
    });
    expect(simulation.state.gauges.treasury).toBe(treasury - price);
    // Déjà réservée : pas de second appel.
    expect(simulation.dispatch({ type: 'CALL_CLEANING', express: true }).result.ok).toBe(false);
    runTo(simulation, 0, 18.5);
    expect(simulation.state.cleaning.visit).toBeNull();
    expect(simulation.state.cleaning.booking).not.toBeNull();
    runTo(simulation, 0, 19.5);
    expect(simulation.state.cleaning.visit).not.toBeNull();
    expect(viewOf(simulation).cleaning.visit?.progress).toBeGreaterThan(0);
    runTo(simulation, 0, 23);
    expect(simulation.state.cleaning).toMatchObject({
      dirt: 0,
      visit: null,
      booking: null,
      visits: 1,
      daysSinceClean: 0,
      alerted: false,
    });
  });

  it('arrive tout de suite en express, plus cher', () => {
    const simulation = newSimulation('menage');
    simulation.state.cleaning.dirt = 40;
    expect(cleaningCallPrice(100, true)).toBeGreaterThan(cleaningCallPrice(100, false));
    simulation.dispatch({ type: 'CALL_CLEANING', express: true });
    simulation.dispatch({ type: 'START_SPRINT' });
    simulation.step();
    expect(simulation.state.cleaning.visit?.express).toBe(true);
    for (let i = 0; i < CLEANING.expressTicks; i++) simulation.step();
    expect(simulation.state.cleaning.visit).toBeNull();
    expect(simulation.state.cleaning.dirt).toBeLessThan(1);
  });

  it('refuse un appel sans trésorerie', () => {
    const simulation = newSimulation('menage');
    simulation.state.gauges.treasury = 10;
    expect(simulation.dispatch({ type: 'CALL_CLEANING', express: false }).result).toEqual({
      ok: false,
      error: 'NOT_ENOUGH_MONEY',
    });
    expect(viewOf(simulation).cleaning.callBlocker).toBe('NOT_ENOUGH_MONEY');
  });

  it('abonnement : passages les soirs prévus, facture chaque semaine', () => {
    const simulation = newSimulation('menage');
    const plan = getCleaningPlan('cleaning-twice');
    const weekly = cleaningWeeklyPrice(plan, cleaningVisitPrice('GARAGE'));
    expect(planWeeklyPrice(simulation.state, 'cleaning-twice')).toBe(weekly);
    const treasury = simulation.state.gauges.treasury;
    expect(
      simulation.dispatch({ type: 'SUBSCRIBE_CLEANING', plan: 'cleaning-twice' }).result.ok,
    ).toBe(true);
    expect(simulation.state.gauges.treasury).toBe(treasury - weekly);
    expect(cleaningMonthly(simulation.state)).toBeCloseTo((weekly * 30) / 7);
    // Lundi : pas de passage ; mardi 19h : passage.
    runTo(simulation, 0, 23);
    expect(simulation.state.cleaning.visits).toBe(0);
    runTo(simulation, 1, 23);
    expect(simulation.state.cleaning.visits).toBe(1);
    runTo(simulation, 4, 23);
    expect(simulation.state.cleaning.visits).toBe(2);
    // La semaine suivante est facturée 7 jours après la souscription.
    const paidUntil = simulation.state.cleaning.plan?.paidUntil ?? 0;
    expect(paidUntil).toBe(CLEANING_WEEK_TICKS);
    runTo(simulation, 7, 9);
    expect(simulation.state.cleaning.plan?.totalPaid).toBe(weekly * 2);
  });

  it('impayé : l’abonnement est coupé', () => {
    const simulation = newSimulation('menage');
    simulation.dispatch({ type: 'SUBSCRIBE_CLEANING', plan: 'cleaning-daily' });
    // Juste avant la deuxième facture, il manque 1 € dans la caisse.
    runTo(simulation, 7, 7.5);
    simulation.state.gauges.treasury = planWeeklyPrice(simulation.state, 'cleaning-daily') - 1;
    const notes: Notification[] = [];
    for (let i = 0; i < 40 && simulation.state.cleaning.plan; i++) {
      if (simulation.state.events.pending)
        simulation.dispatch({ type: 'RESOLVE_EVENT', choiceIndex: 0 });
      notes.push(...simulation.step());
    }
    expect(simulation.state.cleaning.plan).toBeNull();
    expect(notes.some((n) => n.kind === 'CLEANING_CUT')).toBe(true);
  });

  it('change de formule ou résilie sans remboursement', () => {
    const simulation = newSimulation('menage');
    simulation.dispatch({ type: 'SUBSCRIBE_CLEANING', plan: 'cleaning-weekly' });
    expect(
      simulation.dispatch({ type: 'SUBSCRIBE_CLEANING', plan: 'cleaning-weekly' }).result.ok,
    ).toBe(false);
    expect(
      simulation.dispatch({ type: 'SUBSCRIBE_CLEANING', plan: 'cleaning-daily' }).result.ok,
    ).toBe(true);
    const view = viewOf(simulation).cleaning;
    expect(view.plan?.plan).toBe('cleaning-daily');
    expect(view.plans.find((p) => p.id === 'cleaning-daily')?.blocker).toBe('CURRENT');
    const treasury = simulation.state.gauges.treasury;
    expect(simulation.dispatch({ type: 'CANCEL_CLEANING' }).result.ok).toBe(true);
    expect(simulation.state.gauges.treasury).toBe(treasury);
    expect(simulation.dispatch({ type: 'CANCEL_CLEANING' }).result.ok).toBe(false);
  });

  it('les tarifs suivent la taille du bureau', () => {
    expect(cleaningVisitPrice('SEED')).toBeGreaterThan(cleaningVisitPrice('GARAGE'));
    expect(cleaningVisitPrice('SEED', 2)).toBe(
      cleaningVisitPrice('SEED') + 2 * CLEANING.extraRoomPrice,
    );
    const visit = cleaningVisitPrice('SERIES_A');
    expect(cleaningWeeklyPrice(getCleaningPlan('cleaning-daily'), visit)).toBeLessThan(5 * visit);
  });

  it('rejoue la même partie à l’identique (aucun tirage)', () => {
    const a = newSimulation('menage-replay');
    const b = newSimulation('menage-replay');
    for (const sim of [a, b]) {
      sim.dispatch({ type: 'CALL_CLEANING', express: false });
      runTo(sim, 2, 12);
    }
    expect(a.state.rng).toEqual(b.state.rng);
    expect(a.state.cleaning).toEqual(b.state.cleaning);
    expect(getClock(a.state).dayOfWeek).toBe(3);
  });
});
