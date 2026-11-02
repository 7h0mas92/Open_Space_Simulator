import { describe, expect, it } from 'vitest';
import {
  FIBRE_WEEK_TICKS,
  FURNITURE_CATALOG,
  GameStateSchema,
  HOSTING_SAVING_MAX,
  getFurniture,
  type Command,
  type GameState,
} from '@oss/shared';
import { canPlace, computeOfficeEffects } from '../../src/simulation/furniture';
import { hostingCost, monthlyExpenses } from '../../src/simulation/economy';
import { hostingSaving, serverRoomStatuses } from '../../src/simulation/serverRoom';
import { CardLibrary } from '../../src/events/library';
import { Simulation } from '../../src/simulation/simulation';
import { toGameView } from '../../src/view/adapter';
import { newSimulation } from './fixtures';

/** Startup riche en Série A, en planification, bureau vide. */
function richOffice(seed = 'servers'): Simulation {
  const simulation = newSimulation(seed);
  simulation.state.phase = 'SERIES_A';
  simulation.state.components.furniture = {};
  simulation.state.gauges.treasury = 1_000_000;
  return simulation;
}

/** Identifiants des objets posés de ce type, dans l'ordre d'achat. */
function idsOf(state: GameState, itemId: string): string[] {
  return Object.entries(state.components.furniture)
    .filter(([, f]) => f.itemId === itemId)
    .map(([id]) => id);
}

/** Achète un objet et le pose sur la première case libre ; renvoie son identifiant. */
function buyAnywhere(simulation: Simulation, itemId: string): string {
  const item = getFurniture(itemId);
  if (!item) throw new Error(`objet inconnu : ${itemId}`);
  for (let y = 0; y < 14; y++)
    for (let x = 0; x < 20; x++) {
      if (!canPlace(simulation.state, item, x, y, 0)) continue;
      const command: Command = { type: 'BUY_FURNITURE', itemId, x, y, rotation: 0 };
      expect(simulation.dispatch(command).result).toEqual({ ok: true });
      return idsOf(simulation.state, itemId).at(-1) ?? '';
    }
  throw new Error(`pas de place pour ${itemId}`);
}

function install(simulation: Simulation, itemId: string, hostId: string, slot: number) {
  return simulation.dispatch({ type: 'BUY_ACCESSORY', itemId, hostId, slot, rotation: 0 }).result;
}

/** Une salle qui tourne : baie, switch, box fibre et climatisation. */
function runningRoom(simulation: Simulation): string {
  const room = buyAnywhere(simulation, 'server-room');
  expect(install(simulation, 'rack-server', room, 0).ok).toBe(true);
  expect(install(simulation, 'network-switch', room, 1).ok).toBe(true);
  expect(install(simulation, 'precision-cooling', room, 2).ok).toBe(true);
  expect(install(simulation, 'fibre-router', room, 3).ok).toBe(true);
  return room;
}

/** Lance le sprint et avance de `ticks` pas de simulation. */
function advance(simulation: Simulation, ticks: number): void {
  if (simulation.state.stage === 'PLANNING')
    expect(simulation.dispatch({ type: 'START_SPRINT' }).result.ok).toBe(true);
  // Pas de carte d'événement ni de fin de sprint pour ce test : on avance tick par tick.
  for (let i = 0; i < ticks; i++) {
    simulation.state.events.pending = null;
    simulation.step();
  }
}

describe('Salle des serveurs : catalogue et pose du matériel', () => {
  it('deux salles (Seed et Série A) et dix équipements, tous rangés dans le rayon Serveurs', () => {
    const rooms = FURNITURE_CATALOG.filter((item) => 'serverRoom' in item);
    expect(rooms.map((item) => [item.id, item.minPhase, item.surfaceSlots])).toEqual([
      ['server-closet', 'SEED', 4],
      ['server-room', 'SERIES_A', 8],
    ]);
    const gear = FURNITURE_CATALOG.filter((item) => 'serverGear' in item);
    expect(gear).toHaveLength(10);
    for (const item of gear) expect('accessory' in item && item.accessory).toBe(true);
  });

  it('le matériel serveur ne va que dans une salle, et la salle n’accueille que lui', () => {
    const simulation = richOffice();
    const room = buyAnywhere(simulation, 'server-room');
    const desk = buyAnywhere(simulation, 'desk');
    expect(install(simulation, 'rack-server', desk, 0)).toEqual({
      ok: false,
      error: 'INVALID_PLACEMENT',
    });
    expect(
      simulation.dispatch({
        type: 'BUY_ACCESSORY',
        itemId: 'rubber-duck',
        hostId: room,
        slot: 0,
        rotation: 0,
      }).result,
    ).toEqual({ ok: false, error: 'INVALID_PLACEMENT' });
    expect(install(simulation, 'rack-server', room, 7).ok).toBe(true);
    expect(install(simulation, 'ups-unit', room, 7)).toEqual({
      ok: false,
      error: 'INVALID_PLACEMENT',
    });
    expect(install(simulation, 'ups-unit', room, 8)).toEqual({
      ok: false,
      error: 'INVALID_PLACEMENT',
    });
  });
});

describe('Salle des serveurs : ce qu’il faut pour qu’elle tourne', () => {
  it('sans climatisation, les serveurs surchauffent et ne donnent rien', () => {
    const simulation = richOffice();
    const { state } = simulation;
    const before = computeOfficeEffects(state);
    const room = buyAnywhere(simulation, 'server-room');
    install(simulation, 'rack-server', room, 0);
    install(simulation, 'network-switch', room, 1);
    install(simulation, 'ups-unit', room, 2);
    expect(serverRoomStatuses(state)[0]).toMatchObject({ running: false, missing: ['cooling'] });
    expect(computeOfficeEffects(state).stabilityPerDay).toBeCloseTo(before.stabilityPerDay);
    expect(hostingSaving(state)).toBe(0);

    install(simulation, 'precision-cooling', room, 3);
    expect(serverRoomStatuses(state)[0]).toMatchObject({ running: true, missing: [] });
    // Baie 0,15 + switch 0,04 + onduleur 0,1 + clim 0,02.
    expect(computeOfficeEffects(state).stabilityPerDay - before.stabilityPerDay).toBeCloseTo(0.31);
    expect(hostingSaving(state)).toBeCloseTo(0.06);
  });

  it('les serveurs allègent la facture d’hébergement, jusqu’au plafond', () => {
    const simulation = richOffice();
    const { state } = simulation;
    state.gauges.users = 100_000;
    const full = hostingCost(state);
    const expenses = monthlyExpenses(state);
    const room = runningRoom(simulation);
    for (let slot = 4; slot < 8; slot++)
      expect(install(simulation, 'blade-server', room, slot).ok).toBe(true);
    // 6 % + 4 x 12 % = 54 %, plafonné à 40 %.
    expect(hostingSaving(state)).toBe(HOSTING_SAVING_MAX);
    expect(hostingCost(state)).toBeCloseTo(full * (1 - HOSTING_SAVING_MAX));
    expect(expenses - monthlyExpenses(state)).toBeCloseTo(full * HOSTING_SAVING_MAX);
  });

  it('ranger la salle range son matériel avec elle, et ses effets disparaissent', () => {
    const simulation = richOffice();
    const { state } = simulation;
    const room = runningRoom(simulation);
    expect(simulation.dispatch({ type: 'STORE_FURNITURE', furnitureId: room }).result.ok).toBe(
      true,
    );
    expect(state.inventory).toHaveLength(5);
    expect(serverRoomStatuses(state)).toEqual([]);
    expect(hostingSaving(state)).toBe(0);
  });
});

describe('Abonnement internet (fibre)', () => {
  const subs = (state: GameState) =>
    toGameView(state, { speed: 1, running: false, card: () => undefined }).subscriptions;
  const internet = (state: GameState) => subs(state).services.find((s) => s.id === 'internet');
  const subscribeTo = (simulation: Simulation, offer: string) =>
    simulation.dispatch({ type: 'SUBSCRIBE', offer }).result;

  it('il faut une box fibre posée dans une salle des serveurs', () => {
    const simulation = richOffice();
    expect(subscribeTo(simulation, 'fibre-pro')).toEqual({ ok: false, error: 'NOT_ELIGIBLE' });
    expect(internet(simulation.state)?.offers.map((offer) => offer.blocker)).toEqual([
      'REQUIREMENT',
      'REQUIREMENT',
      'REQUIREMENT',
    ]);
    expect(subscribeTo(simulation, 'offre-inconnue')).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('la première semaine est payée à la souscription, puis chaque semaine de jeu', () => {
    const simulation = richOffice();
    const { state } = simulation;
    runningRoom(simulation);
    const before = computeOfficeEffects(state);
    const treasury = state.gauges.treasury;
    expect(subscribeTo(simulation, 'fibre-pro').ok).toBe(true);
    expect(treasury - state.gauges.treasury).toBe(900);
    expect(state.subscriptions).toEqual([
      { offer: 'fibre-pro', paidUntil: FIBRE_WEEK_TICKS, since: state.sprint, totalPaid: 900 },
    ]);
    const after = computeOfficeEffects(state);
    expect(after.teamProductivity - before.teamProductivity).toBeCloseTo(0.02);
    expect(after.stabilityPerDay - before.stabilityPerDay).toBeCloseTo(0.06);
    expect(internet(state)?.current).toMatchObject({ active: true, nextBillDays: 7 });
    expect(subs(state)).toMatchObject({ count: 1, monthlyTotal: (900 * 30) / 7 });

    // La semaine suivante est facturée au premier pas du 8e jour.
    advance(simulation, FIBRE_WEEK_TICKS);
    expect(state.subscriptions[0]?.totalPaid).toBe(900);
    advance(simulation, 1);
    expect(state.subscriptions[0]?.paidUntil).toBe(2 * FIBRE_WEEK_TICKS);
    expect(state.subscriptions[0]?.totalPaid).toBe(1800);
  });

  it('changer d’offre repart pour une semaine, résilier coupe la ligne sans remboursement', () => {
    const simulation = richOffice();
    const { state } = simulation;
    runningRoom(simulation);
    subscribeTo(simulation, 'fibre-essential');
    expect(subscribeTo(simulation, 'fibre-essential')).toEqual({
      ok: false,
      error: 'NOT_ELIGIBLE',
    });
    const treasury = state.gauges.treasury;
    expect(subscribeTo(simulation, 'fibre-dedicated').ok).toBe(true);
    expect(treasury - state.gauges.treasury).toBe(2500);
    expect(state.subscriptions).toHaveLength(1);
    expect(state.subscriptions[0]).toMatchObject({ offer: 'fibre-dedicated', totalPaid: 2900 });
    const paid = state.gauges.treasury;
    expect(
      simulation.dispatch({ type: 'CANCEL_SUBSCRIPTION', service: 'internet' }).result.ok,
    ).toBe(true);
    expect(state.subscriptions).toEqual([]);
    expect(state.gauges.treasury).toBe(paid);
    expect(
      simulation.dispatch({ type: 'CANCEL_SUBSCRIPTION', service: 'internet' }).result,
    ).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('la fibre dédiée n’ouvre qu’en Série A', () => {
    const simulation = richOffice();
    simulation.state.phase = 'SEED';
    const room = buyAnywhere(simulation, 'server-closet');
    install(simulation, 'fibre-router', room, 0);
    expect(subscribeTo(simulation, 'fibre-dedicated')).toEqual({ ok: false, error: 'LOCKED' });
    expect(subscribeTo(simulation, 'fibre-pro').ok).toBe(true);
  });

  it('sans box, la ligne est payée mais ne donne rien ; sans argent, l’opérateur la coupe', () => {
    const simulation = richOffice();
    const { state } = simulation;
    runningRoom(simulation);
    subscribeTo(simulation, 'fibre-pro');
    const box = idsOf(state, 'fibre-router')[0] ?? '';
    const withBox = computeOfficeEffects(state).teamProductivity;
    simulation.dispatch({ type: 'SELL_FURNITURE', furnitureId: box });
    expect(withBox - computeOfficeEffects(state).teamProductivity).toBeCloseTo(0.02);
    expect(internet(state)?.current?.active).toBe(false);

    advance(simulation, FIBRE_WEEK_TICKS);
    state.gauges.treasury = 100;
    advance(simulation, 1);
    expect(state.subscriptions).toEqual([]);
    expect(state.notifications.at(-1)?.kind).toBe('FIBRE_CUT');
  });

  it('les anciennes commandes de la fibre marchent encore (vieux replays)', () => {
    const simulation = richOffice();
    const { state } = simulation;
    runningRoom(simulation);
    expect(simulation.dispatch({ type: 'SUBSCRIBE_FIBRE', plan: 'fibre-pro' }).result.ok).toBe(
      true,
    );
    expect(state.subscriptions[0]?.offer).toBe('fibre-pro');
    expect(simulation.dispatch({ type: 'CANCEL_FIBRE' }).result.ok).toBe(true);
    expect(state.subscriptions).toEqual([]);
  });

  it('une vieille sauvegarde n’a pas d’abonnement ; son ancienne fibre est reprise', () => {
    const simulation = newSimulation('old-save');
    const legacy = structuredClone(simulation.state) as Partial<GameState>;
    delete legacy.fibre;
    delete legacy.subscriptions;
    const parsed = GameStateSchema.parse(legacy);
    expect(parsed.fibre).toBeNull();
    expect(parsed.subscriptions).toEqual([]);

    parsed.fibre = { plan: 'fibre-pro', paidUntil: 336, since: 2, totalPaid: 1800 };
    const restored = Simulation.restore(parsed, new CardLibrary([]));
    expect(restored.state.fibre).toBeNull();
    expect(restored.state.subscriptions).toEqual([
      { offer: 'fibre-pro', paidUntil: 336, since: 2, totalPaid: 1800 },
    ]);
  });
});
