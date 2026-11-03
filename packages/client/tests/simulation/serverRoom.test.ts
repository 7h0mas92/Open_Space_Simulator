import { describe, expect, it } from 'vitest';
import {
  FIBRE_WEEK_TICKS,
  FURNITURE_CATALOG,
  GameStateSchema,
  HOSTING_SAVING_MAX,
  SERVER_HEAT,
  getFurniture,
  roomTemperature,
  type Command,
  type GameState,
} from '@oss/shared';
import { canPlace, computeOfficeEffects } from '../../src/simulation/furniture';
import { hostingCost, monthlyExpenses } from '../../src/simulation/economy';
import { hostingSaving, serverRoomStatuses } from '../../src/simulation/serverRoom';
import { Simulation } from '../../src/simulation/simulation';
import { CardLibrary } from '../../src/events/library';
import { toGameView } from '../../src/view/adapter';
import { makeContext, newSimulation } from './fixtures';
import { generateDev, hireDev } from '../../src/simulation/devs';

/** Startup riche en Série A, en planification, bureau vide, en hiver (date dans la graine). */
function richOffice(seed = 'servers-2026-01-05'): Simulation {
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

const view = (state: GameState) =>
  toGameView(state, { speed: 1, running: false, card: () => undefined }).servers;

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
  it('deux salles (Seed et Série A) et treize équipements, tous rangés dans le rayon Serveurs', () => {
    const rooms = FURNITURE_CATALOG.filter((item) => 'serverRoom' in item);
    expect(rooms.map((item) => [item.id, item.minPhase, item.surfaceSlots])).toEqual([
      ['server-closet', 'SEED', 4],
      ['server-room', 'SERIES_A', 8],
    ]);
    const gear = FURNITURE_CATALOG.filter((item) => 'serverGear' in item);
    expect(gear).toHaveLength(13);
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
  it('sans climatisation, les serveurs surchauffent : aucun effet et la prod en pâtit', () => {
    const simulation = richOffice();
    const { state } = simulation;
    const before = computeOfficeEffects(state);
    const room = buyAnywhere(simulation, 'server-room');
    install(simulation, 'rack-server', room, 0);
    install(simulation, 'network-switch', room, 1);
    install(simulation, 'ups-unit', room, 2);
    expect(serverRoomStatuses(state)[0]).toMatchObject({
      running: false,
      missing: ['cooling'],
      level: 'overheat',
    });
    expect(computeOfficeEffects(state).stabilityPerDay - before.stabilityPerDay).toBeCloseTo(
      SERVER_HEAT.overheatStability,
    );
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
    // Les lames chauffent : une clim en rangée en plus pour tenir la salle au frais.
    expect(install(simulation, 'inrow-cooling', room, 4).ok).toBe(true);
    for (let slot = 5; slot < 8; slot++)
      expect(install(simulation, 'blade-server', room, slot).ok).toBe(true);
    expect(serverRoomStatuses(state)[0]?.level).toBe('cool');
    // 6 % + 3 x 12 % = 42 %, plafonné à 40 %.
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

describe('Salle des serveurs : température et supervision', () => {
  it('la température suit la chaleur sur le froid, avec 3 °C de plus en été', () => {
    expect(roomTemperature(0, 0)).toBe(18);
    expect(roomTemperature(3, 15)).toBeCloseTo(20);
    expect(roomTemperature(15, 15)).toBeCloseTo(28);
    expect(roomTemperature(15, 15, true)).toBeCloseTo(31);
    expect(roomTemperature(3, 0)).toBe(45);
  });

  it('une salle qui chauffe ne donne qu’une partie de ses effets, la sonde en sauve un peu', () => {
    const simulation = richOffice();
    const { state } = simulation;
    const before = computeOfficeEffects(state).stabilityPerDay;
    const room = buyAnywhere(simulation, 'server-closet');
    simulation.state.phase = 'SERIES_A';
    install(simulation, 'rack-server', room, 0);
    install(simulation, 'network-switch', room, 1);
    install(simulation, 'split-ac', room, 2);
    // Baie 3 kW + switch 0,3 kW sur un split de 5 kW : 24,6 °C, ça va.
    expect(serverRoomStatuses(state)[0]).toMatchObject({ level: 'cool', efficiency: 1 });
    expect(computeOfficeEffects(state).stabilityPerDay - before).toBeCloseTo(0.19);
    // Une deuxième baie : 6,3 kW pour 5 kW, 30,6 °C. Elle chauffe, la moitié des effets.
    install(simulation, 'rack-server', room, 3);
    expect(serverRoomStatuses(state)[0]).toMatchObject({ level: 'warm', efficiency: 0.5 });
    expect(computeOfficeEffects(state).stabilityPerDay - before).toBeCloseTo(0.34 * 0.5);
    expect(hostingSaving(state)).toBeCloseTo(0.06);
  });

  it('la surchauffe coupe tout ; avec une sonde, on est prévenu et la casse est limitée', () => {
    const simulation = richOffice();
    const { state } = simulation;
    const room = buyAnywhere(simulation, 'server-closet');
    install(simulation, 'gpu-server', room, 0);
    install(simulation, 'network-switch', room, 1);
    install(simulation, 'split-ac', room, 2);
    // 10,3 kW sur 5 kW : 38,6 °C.
    expect(serverRoomStatuses(state)[0]).toMatchObject({ level: 'overheat', running: false });
    expect(hostingSaving(state)).toBe(0);
    advance(simulation, 1);
    expect(state.serverHeat[room]).toBe('overheat');
    // Sans sonde, aucune alerte.
    expect(state.notifications.some((n) => n.kind === 'SERVER_ROOM_OVERHEAT')).toBe(false);

    const unmonitored = computeOfficeEffects(state).stabilityPerDay;
    install(simulation, 'server-monitoring', room, 3);
    expect(computeOfficeEffects(state).stabilityPerDay - unmonitored).toBeCloseTo(
      SERVER_HEAT.overheatStabilityMonitored - SERVER_HEAT.overheatStability,
    );
    expect(view(state).rooms[0]).toMatchObject({ monitored: true, level: 'overheat' });

    // On retire le GPU pour une baie : la sonde annonce le retour au calme.
    const gpu = idsOf(state, 'gpu-server')[0] ?? '';
    simulation.dispatch({ type: 'SELL_FURNITURE', furnitureId: gpu });
    install(simulation, 'rack-server', room, 0);
    advance(simulation, 1);
    expect(state.serverHeat[room]).toBe('cool');
    expect(state.notifications.at(-1)?.kind).toBe('SERVER_ROOM_COOL');
  });

  it('l’été réchauffe la salle', () => {
    const winter = richOffice('heat-2026-01-05');
    const summer = richOffice('heat-2026-07-06');
    for (const simulation of [winter, summer]) {
      const room = buyAnywhere(simulation, 'server-closet');
      install(simulation, 'rack-server', room, 0);
      install(simulation, 'network-switch', room, 1);
      install(simulation, 'split-ac', room, 2);
    }
    const [cold] = serverRoomStatuses(winter.state);
    const [hot] = serverRoomStatuses(summer.state);
    expect((hot?.temperature ?? 0) - (cold?.temperature ?? 0)).toBeCloseTo(SERVER_HEAT.summer);
    expect(view(summer.state).summer).toBe(true);
  });

  it('une vieille sauvegarde n’a pas de températures retenues', () => {
    const simulation = newSimulation('old-heat');
    const legacy = structuredClone(simulation.state) as Partial<GameState>;
    delete legacy.serverHeat;
    expect(GameStateSchema.parse(legacy).serverHeat).toEqual({});
  });
});

describe('Abonnement internet', () => {
  const subs = (state: GameState) =>
    toGameView(state, { speed: 1, running: false, card: () => undefined }).subscriptions;
  const internet = (state: GameState) => subs(state).services.find((s) => s.id === 'internet');
  const subscribeTo = (simulation: Simulation, offer: string) =>
    simulation.dispatch({ type: 'SUBSCRIBE', offer }).result;

  it('six offres de la box 4G à la fibre dédiée, prix mensuels prélevés chaque semaine', () => {
    const offers = internet(richOffice().state)?.offers ?? [];
    expect(offers.map((offer) => [offer.id, offer.price, offer.maxUsers])).toEqual([
      ['wifi-4g', 9, 3],
      ['wifi-5g', 14, 6],
      ['fibre-essential', 11, 10],
      ['fibre-pro', 28, 25],
      ['fibre-dedicated', 208, 60],
      ['fibre-dedicated-10g', 607, 200],
    ]);
    expect(offers.every((offer) => offer.periodDays === 7)).toBe(true);
    expect(offers.find((offer) => offer.id === 'fibre-pro')).toMatchObject({
      setupFee: 99,
      firstPayment: 28 + 99,
    });
  });

  it('la box 4G se prend dès le garage, sans salle des serveurs', () => {
    const simulation = newSimulation('garage-2026-01-05');
    const { state } = simulation;
    expect(state.phase).toBe('GARAGE');
    expect(subscribeTo(simulation, 'fibre-essential')).toEqual({ ok: false, error: 'LOCKED' });
    const treasury = state.gauges.treasury;
    expect(subscribeTo(simulation, 'wifi-4g').ok).toBe(true);
    expect(treasury - state.gauges.treasury).toBe(9);
    expect(internet(state)?.current).toMatchObject({ active: true, penalty: 0 });
    expect(subs(state).users).toBe(1);
    expect(subscribeTo(simulation, 'offre-inconnue')).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('la fibre dédiée demande une box fibre dans une salle et paie sa mise en service', () => {
    const simulation = richOffice();
    const { state } = simulation;
    expect(subscribeTo(simulation, 'fibre-dedicated')).toEqual({
      ok: false,
      error: 'NOT_ELIGIBLE',
    });
    expect(internet(state)?.offers.map((offer) => offer.blocker)).toEqual([
      null,
      null,
      null,
      null,
      'REQUIREMENT',
      'LOCKED',
    ]);
    runningRoom(simulation);
    const before = computeOfficeEffects(state);
    const treasury = state.gauges.treasury;
    expect(subscribeTo(simulation, 'fibre-dedicated').ok).toBe(true);
    expect(treasury - state.gauges.treasury).toBe(208 + 1500);
    expect(state.subscriptions).toEqual([
      {
        offer: 'fibre-dedicated',
        paidUntil: FIBRE_WEEK_TICKS,
        since: state.sprint,
        totalPaid: 1708,
        saturated: false,
      },
    ]);
    const after = computeOfficeEffects(state);
    expect(after.teamProductivity - before.teamProductivity).toBeCloseTo(0.03);
    expect(internet(state)?.current).toMatchObject({ active: true, nextBillDays: 7 });

    // La semaine suivante est facturée au premier pas du 8e jour, sans mise en service.
    advance(simulation, FIBRE_WEEK_TICKS);
    expect(state.subscriptions[0]?.totalPaid).toBe(1708);
    advance(simulation, 1);
    expect(state.subscriptions[0]?.paidUntil).toBe(2 * FIBRE_WEEK_TICKS);
    expect(state.subscriptions[0]?.totalPaid).toBe(1708 + 208);
  });

  it('trop de salariés pour l’offre : la ligne sature et ralentit toute l’équipe', () => {
    const simulation = richOffice();
    const { state } = simulation;
    expect(Object.keys(state.components.identity)).toHaveLength(1);
    const before = computeOfficeEffects(state).teamProductivity;
    subscribeTo(simulation, 'wifi-4g');
    expect(computeOfficeEffects(state).teamProductivity - before).toBeCloseTo(0.005);
    // Trois recrues : 4 salariés pour 3, charge 1,33, soit -5 % de productivité.
    const ctx = makeContext(state);
    for (const role of ['SENIOR_BEARD', 'INTERN', 'DESIGNER'] as const) {
      const profile = generateDev(ctx.rng, role);
      hireDev(state, ctx, profile, profile.askingSalary);
    }
    expect(internet(state)?.current?.penalty).toBeCloseTo(0.05);
    expect(computeOfficeEffects(state).teamProductivity - before).toBeCloseTo(-0.05);
    advance(simulation, 1);
    expect(state.notifications.some((n) => n.kind === 'INTERNET_SATURATED')).toBe(true);
    expect(state.subscriptions[0]?.saturated).toBe(true);
    // Une offre plus grosse règle le problème.
    subscribeTo(simulation, 'wifi-5g');
    advance(simulation, 1);
    expect(state.subscriptions[0]?.saturated).toBe(false);
    expect(internet(state)?.current?.penalty).toBe(0);
    // Le réseau redevient fluide quand l'équipe rapetisse : on est prévenu.
    subscribeTo(simulation, 'wifi-4g');
    advance(simulation, 1);
    expect(state.subscriptions[0]?.saturated).toBe(true);
    const leaving = Object.keys(state.components.identity).at(-1) ?? '';
    expect(simulation.dispatch({ type: 'FIRE_DEV', devId: leaving }).result.ok).toBe(true);
    advance(simulation, 1);
    expect(state.notifications.some((n) => n.kind === 'INTERNET_OK')).toBe(true);
  });

  it('changer d’offre repart pour une semaine, résilier coupe la ligne sans remboursement', () => {
    const simulation = richOffice();
    const { state } = simulation;
    subscribeTo(simulation, 'fibre-essential');
    expect(subscribeTo(simulation, 'fibre-essential')).toEqual({
      ok: false,
      error: 'NOT_ELIGIBLE',
    });
    const treasury = state.gauges.treasury;
    expect(subscribeTo(simulation, 'fibre-pro').ok).toBe(true);
    expect(treasury - state.gauges.treasury).toBe(28 + 99);
    expect(state.subscriptions).toHaveLength(1);
    expect(state.subscriptions[0]).toMatchObject({ offer: 'fibre-pro', totalPaid: 11 + 28 + 99 });
    const paid = state.gauges.treasury;
    expect(
      simulation.dispatch({ type: 'CANCEL_SUBSCRIPTION', service: 'internet' }).result.ok,
    ).toBe(true);
    expect(state.subscriptions).toEqual([]);
    expect(state.gauges.treasury).toBe(paid);
  });

  it('sans box, la fibre dédiée est payée mais ne donne rien ; sans argent, l’opérateur coupe', () => {
    const simulation = richOffice();
    const { state } = simulation;
    runningRoom(simulation);
    subscribeTo(simulation, 'fibre-dedicated');
    const box = idsOf(state, 'fibre-router')[0] ?? '';
    const withBox = computeOfficeEffects(state).teamProductivity;
    simulation.dispatch({ type: 'SELL_FURNITURE', furnitureId: box });
    expect(withBox - computeOfficeEffects(state).teamProductivity).toBeCloseTo(0.03);
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
