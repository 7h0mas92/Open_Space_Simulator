import { describe, expect, it } from 'vitest';
import {
  GameStateSchema,
  LOBBY,
  LOBBY_DECOR,
  SECURITY_PLANS,
  SECURITY_WEEK_TICKS,
  getFurniture,
  weeklyFromMonthly,
  type GameState,
} from '@oss/shared';
import { canPlace, computeOfficeEffects } from '../../src/simulation/furniture';
import { monthlyExpenses, runwayMonths } from '../../src/simulation/economy';
import type { Simulation } from '../../src/simulation/simulation';
import { toGameView } from '../../src/view/adapter';
import { officeLayout } from '../../src/view/layout';
import { newSimulation } from './fixtures';

/** Startup riche en Seed, en planification. */
function richSeed(seed = 'lobby'): Simulation {
  const simulation = newSimulation(seed);
  simulation.state.phase = 'SEED';
  simulation.state.gauges.treasury = 1_000_000;
  return simulation;
}

const view = (state: GameState) =>
  toGameView(state, { speed: 1, running: false, card: () => undefined });

/** Lance le sprint et avance de `ticks` pas de simulation, sans carte d'événement. */
function advance(simulation: Simulation, ticks: number): void {
  if (simulation.state.stage === 'PLANNING')
    expect(simulation.dispatch({ type: 'START_SPRINT' }).result.ok).toBe(true);
  for (let i = 0; i < ticks; i++) {
    simulation.state.events.pending = null;
    simulation.step();
  }
}

describe('Hall d’entrée : aménagement', () => {
  it('pas de hall dans le garage, puis des travaux payés une fois dès la Seed', () => {
    const simulation = newSimulation('garage');
    simulation.state.gauges.treasury = 1_000_000;
    expect(simulation.dispatch({ type: 'BUILD_LOBBY' }).result).toEqual({
      ok: false,
      error: 'LOCKED',
    });
    simulation.state.phase = 'SEED';
    const before = simulation.state.gauges.treasury;
    expect(simulation.dispatch({ type: 'BUILD_LOBBY' }).result).toEqual({ ok: true });
    expect(simulation.state.gauges.treasury).toBe(before - LOBBY.price);
    expect(simulation.state.lobby).toEqual({ since: simulation.state.sprint, receptionists: 0 });
    expect(simulation.dispatch({ type: 'BUILD_LOBBY' }).result.ok).toBe(false);
  });

  it('refuse les travaux si la trésorerie ne les couvre pas', () => {
    const simulation = richSeed();
    simulation.state.gauges.treasury = LOBBY.price - 1;
    expect(simulation.dispatch({ type: 'BUILD_LOBBY' }).result).toEqual({
      ok: false,
      error: 'NOT_ENOUGH_MONEY',
    });
  });

  it('le hall passe devant le bureau, avec deux portes à badge et l’entrée au fond', () => {
    const base = officeLayout('SEED', 0, 0, 'graine');
    const layout = officeLayout('SEED', 0, 0, 'graine', true);
    expect(layout.depth).toBe(base.depth + LOBBY.depth);
    expect(layout.lobby?.wall).toBe(base.depth);
    expect(layout.lobby?.gates).toHaveLength(2);
    const [a, b] = layout.lobby?.gates ?? [];
    expect(b!.x - a!.x).toBe(1);
    // Les portes sont des trous dans la cloison du hall, qui court sur toute la largeur.
    const wall = layout.partitions.filter((cell) => cell.z === base.depth);
    expect(wall).toHaveLength(layout.width - 2);
    expect(wall.some((cell) => cell.x === a!.x || cell.x === b!.x)).toBe(false);
    expect(layout.entrance).toEqual({ x: 0, z: layout.depth - 1 });
    const hall = layout.rooms.find((room) => room.kind === 'lobby');
    expect(hall).toMatchObject({ x: 0, z: base.depth + 1, width: layout.width });
    // Le décor offert : comptoir, banquette et deux plantes, dans le hall.
    const decor = (layout.fixtures ?? []).filter((f) => f.key.startsWith('L-'));
    expect(decor.map((f) => f.kind)).toEqual([...LOBBY_DECOR]);
    for (const fixture of decor) expect(fixture.z).toBeGreaterThan(base.depth);
    // Le garage n'a jamais de hall.
    expect(officeLayout('GARAGE', 0, 0, '', true).lobby).toBeUndefined();
  });

  it('les portes ne tombent pas devant une cloison du bureau, même avec des annexes', () => {
    for (const phase of ['SEED', 'SERIES_A', 'UNICORN'] as const)
      for (const annexes of [0, 1, 3]) {
        const layout = officeLayout(phase, 2, annexes, 'graine', true);
        const blocked = new Set(layout.partitions.map((cell) => `${cell.x},${cell.z}`));
        for (const gate of layout.lobby?.gates ?? []) {
          expect(blocked.has(`${gate.x},${gate.z - 1}`)).toBe(false);
          expect(blocked.has(`${gate.x},${gate.z + 1}`)).toBe(false);
        }
      }
  });

  it('on peut meubler le hall, et déplacer son comptoir offert', () => {
    const simulation = richSeed();
    simulation.state.components.furniture = {};
    const plant = getFurniture('plant')!;
    const front = officeLayout('SEED').depth + 2;
    expect(canPlace(simulation.state, plant, 3, front, 0)).toBe(false);
    simulation.dispatch({ type: 'BUILD_LOBBY' });
    expect(canPlace(simulation.state, plant, 3, front, 0)).toBe(true);
    expect(
      simulation.dispatch({ type: 'MOVE_ANNEX_DECOR', key: 'L-0', x: 1, y: front, rotation: 1 })
        .result,
    ).toEqual({ ok: true });
    const desk = view(simulation.state).items.find((item) => item.annexDecor === 'L-0');
    expect(desk).toMatchObject({ kind: 'reception-desk', x: 1, z: front, rotation: 1 });
  });

  it('donne de la hype et du moral, et de la stabilité grâce aux portes à badge', () => {
    const simulation = richSeed();
    simulation.state.components.furniture = {};
    const before = computeOfficeEffects(simulation.state);
    simulation.dispatch({ type: 'BUILD_LOBBY' });
    const after = computeOfficeEffects(simulation.state);
    expect(after.hypePerDay - before.hypePerDay).toBeCloseTo(LOBBY.effects.hypePerDay);
    expect(after.moral - before.moral).toBeCloseTo(LOBBY.effects.moral);
    expect(after.stabilityPerDay - before.stabilityPerDay).toBeCloseTo(
      LOBBY.badgeEffects.stabilityPerDay,
    );
  });
});

describe('Hall d’entrée : secrétaires', () => {
  it('deux au plus, salaire compté dans les dépenses du mois', () => {
    const simulation = richSeed();
    expect(simulation.dispatch({ type: 'SET_RECEPTIONISTS', count: 1 }).result).toEqual({
      ok: false,
      error: 'NOT_ELIGIBLE',
    });
    simulation.dispatch({ type: 'BUILD_LOBBY' });
    const expenses = monthlyExpenses(simulation.state);
    const effects = computeOfficeEffects(simulation.state);
    expect(simulation.dispatch({ type: 'SET_RECEPTIONISTS', count: 2 }).result.ok).toBe(true);
    expect(monthlyExpenses(simulation.state) - expenses).toBe(2 * LOBBY.receptionistMonthly);
    const staffed = computeOfficeEffects(simulation.state);
    expect(staffed.teamProductivity - effects.teamProductivity).toBeCloseTo(
      2 * LOBBY.receptionistEffects.teamProductivity,
    );
    expect(simulation.dispatch({ type: 'SET_RECEPTIONISTS', count: 3 }).result.ok).toBe(false);
    expect(simulation.dispatch({ type: 'SET_RECEPTIONISTS', count: 0 }).result.ok).toBe(true);
    expect(monthlyExpenses(simulation.state)).toBe(expenses);
  });
});

describe('Hall d’entrée : service de sécurité', () => {
  it('trois formules aux prix du marché, payées chaque semaine', () => {
    expect(SECURITY_PLANS.map((plan) => [plan.id, plan.minPhase, plan.guard])).toEqual([
      ['security-alarm', 'SEED', 'none'],
      ['security-day', 'SEED', 'day'],
      ['security-24h', 'SERIES_A', 'always'],
    ]);
    for (const plan of SECURITY_PLANS)
      expect(plan.weeklyPrice).toBe(weeklyFromMonthly(plan.monthlyPrice));
    const prices = SECURITY_PLANS.map((plan) => plan.monthlyPrice);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it('il faut un hall, et la formule 24 h/24 attend la Série A', () => {
    const simulation = richSeed();
    expect(
      simulation.dispatch({ type: 'SUBSCRIBE_SECURITY', plan: 'security-day' }).result,
    ).toEqual({ ok: false, error: 'NOT_ELIGIBLE' });
    expect(view(simulation.state).lobby.plans[1]?.blocker).toBe('NO_LOBBY');
    simulation.dispatch({ type: 'BUILD_LOBBY' });
    expect(
      simulation.dispatch({ type: 'SUBSCRIBE_SECURITY', plan: 'security-24h' }).result,
    ).toEqual({ ok: false, error: 'LOCKED' });
    expect(view(simulation.state).lobby.plans[1]?.blocker).toBeNull();
  });

  it('première semaine payée à la souscription, puis chaque semaine, effets en plus', () => {
    const simulation = richSeed();
    simulation.dispatch({ type: 'BUILD_LOBBY' });
    const plan = SECURITY_PLANS[1]!;
    const effects = computeOfficeEffects(simulation.state);
    const before = simulation.state.gauges.treasury;
    expect(simulation.dispatch({ type: 'SUBSCRIBE_SECURITY', plan: plan.id }).result.ok).toBe(true);
    expect(simulation.state.gauges.treasury).toBe(before - plan.weeklyPrice);
    const guarded = computeOfficeEffects(simulation.state);
    expect(guarded.stabilityPerDay - effects.stabilityPerDay).toBeCloseTo(
      plan.effects.stabilityPerDay ?? 0,
    );
    // Le coût de la sécurité compte dans les mois de trésorerie.
    simulation.state.gauges.users = 0;
    const security = simulation.state.security!;
    const runway = runwayMonths(simulation.state);
    simulation.state.security = null;
    expect(runwayMonths(simulation.state)).toBeGreaterThan(runway);
    simulation.state.security = security;

    const due = security.paidUntil;
    advance(simulation, due - simulation.state.tick + 1);
    expect(simulation.state.security?.paidUntil).toBe(due + SECURITY_WEEK_TICKS);
    expect(simulation.state.security?.totalPaid).toBe(2 * plan.weeklyPrice);
  });

  it('contrat suspendu si la trésorerie ne couvre plus la semaine', () => {
    const simulation = richSeed();
    simulation.dispatch({ type: 'BUILD_LOBBY' });
    simulation.dispatch({ type: 'SUBSCRIBE_SECURITY', plan: 'security-day' });
    const due = simulation.state.security!.paidUntil;
    advance(simulation, due - simulation.state.tick - 1);
    expect(simulation.state.security).not.toBeNull();
    simulation.state.gauges.treasury = 10;
    advance(simulation, 2);
    expect(simulation.state.security).toBeNull();
  });

  it('changer de formule ou résilier ne rembourse rien', () => {
    const simulation = richSeed();
    simulation.dispatch({ type: 'BUILD_LOBBY' });
    simulation.dispatch({ type: 'SUBSCRIBE_SECURITY', plan: 'security-alarm' });
    const since = simulation.state.security!.since;
    expect(
      simulation.dispatch({ type: 'SUBSCRIBE_SECURITY', plan: 'security-alarm' }).result.ok,
    ).toBe(false);
    expect(
      simulation.dispatch({ type: 'SUBSCRIBE_SECURITY', plan: 'security-day' }).result.ok,
    ).toBe(true);
    expect(simulation.state.security).toMatchObject({ plan: 'security-day', since });
    const treasury = simulation.state.gauges.treasury;
    expect(simulation.dispatch({ type: 'CANCEL_SECURITY' }).result.ok).toBe(true);
    expect(simulation.state.security).toBeNull();
    expect(simulation.state.gauges.treasury).toBe(treasury);
    expect(simulation.dispatch({ type: 'CANCEL_SECURITY' }).result.ok).toBe(false);
  });
});

describe('Hall d’entrée : sauvegardes et replays', () => {
  it('une vieille sauvegarde n’a ni hall ni sécurité', () => {
    const simulation = richSeed();
    const raw = JSON.parse(JSON.stringify(simulation.state)) as Record<string, unknown>;
    delete raw.lobby;
    delete raw.security;
    const parsed = GameStateSchema.parse(raw);
    expect(parsed.lobby).toBeNull();
    expect(parsed.security).toBeNull();
  });

  it('aucun tirage : aménager le hall ne change pas la suite du hasard', () => {
    const a = richSeed('meme-graine');
    const b = richSeed('meme-graine');
    b.dispatch({ type: 'BUILD_LOBBY' });
    b.dispatch({ type: 'SUBSCRIBE_SECURITY', plan: 'security-alarm' });
    expect(b.state.rng).toEqual(a.state.rng);
  });
});
