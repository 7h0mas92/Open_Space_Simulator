import { GameStateSchema, projectionPairs, type GameState } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { computeOfficeEffects } from '../../src/simulation/furniture';
import type { Simulation } from '../../src/simulation/simulation';
import { activeProjections } from '../../src/simulation/projection';
import { newSimulation } from './fixtures';

/** Identifiants des objets posés de ce type, dans l'ordre d'achat. */
function idsOf(state: GameState, itemId: string): string[] {
  return Object.entries(state.components.furniture)
    .filter(([, f]) => f.itemId === itemId)
    .map(([id]) => id);
}

/**
 * Bureau vide en Série A : un écran déroulant contre le mur du fond (tourné vers la salle) et
 * un bureau 5 cases plus loin, tourné vers l'écran, avec un projecteur posé dessus.
 */
function projectionRoom(seed: string, projectorRotation = 0) {
  const simulation = newSimulation(seed);
  const { state } = simulation;
  state.phase = 'SERIES_A';
  state.components.furniture = {};
  state.gauges.treasury = 1_000_000;
  const buy = (itemId: string, x: number, y: number, rotation: number) =>
    simulation.dispatch({ type: 'BUY_FURNITURE', itemId, x, y, rotation }).result;
  expect(buy('projection-screen-small', 4, 0, 0).ok).toBe(true);
  expect(buy('desk', 4, 5, 2).ok).toBe(true);
  const desk = idsOf(state, 'desk')[0]!;
  const result = simulation.dispatch({
    type: 'BUY_ACCESSORY',
    itemId: 'projector',
    hostId: desk,
    slot: 0,
    rotation: projectorRotation,
  }).result;
  expect(result.ok).toBe(true);
  return {
    simulation,
    state,
    projector: idsOf(state, 'projector')[0]!,
    screen: idsOf(state, 'projection-screen-small')[0]!,
  };
}

function switchProjector(simulation: Simulation, furnitureId: string, on: boolean) {
  return simulation.dispatch({ type: 'SWITCH_PROJECTOR', furnitureId, on }).result;
}

describe('Projecteur et écran déroulant', () => {
  it('un projecteur posé s’allume et déroule l’écran en face de lui', () => {
    const { state, projector, screen } = projectionRoom('projector-on');
    expect(state.components.furniture[projector]?.on).toBe(true);
    expect(activeProjections(state)).toEqual([
      { projector, screen, distance: expect.closeTo(5) as number },
    ]);
  });

  it('éteint, l’écran s’enroule et aucun des deux ne donne son effet', () => {
    const { simulation, state, projector } = projectionRoom('projector-off');
    const on = computeOfficeEffects(state);
    expect(switchProjector(simulation, projector, false).ok).toBe(true);
    expect(state.components.furniture[projector]?.on).toBeUndefined();
    const off = computeOfficeEffects(state);
    expect(activeProjections(state)).toEqual([]);
    // Petit écran : +0,6 % de qualité, +0,02 hype par jour ; projecteur : -0,4 % de productivité.
    expect(on.quality - off.quality).toBeCloseTo(0.006);
    expect(on.hypePerDay - off.hypePerDay).toBeCloseTo(0.02);
    expect(on.teamProductivity - off.teamProductivity).toBeCloseTo(-0.004);
    expect(switchProjector(simulation, projector, true).ok).toBe(true);
    expect(computeOfficeEffects(state).quality).toBeCloseTo(on.quality);
  });

  it('un projecteur tourné vers le mur opposé ne projette rien', () => {
    const { state, projector } = projectionRoom('projector-away', 2);
    expect(state.components.furniture[projector]?.on).toBe(true);
    expect(activeProjections(state)).toEqual([]);
  });

  it('seul un projecteur sert d’interrupteur', () => {
    const { simulation, screen } = projectionRoom('projector-switch');
    expect(switchProjector(simulation, screen, true)).toEqual({
      ok: false,
      error: 'NOT_ELIGIBLE',
    });
    expect(switchProjector(simulation, 'e99999', true)).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('l’état allumé survit à la sauvegarde', () => {
    const { state, projector } = projectionRoom('projector-save');
    const loaded = GameStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(loaded.components.furniture[projector]?.on).toBe(true);
  });

  it('un projecteur de plafond passe au-dessus d’un bureau et vise depuis sa case', () => {
    const { simulation, state } = projectionRoom('ceiling-projector');
    // Le projecteur de bureau est rangé : seul celui du plafond éclairera l’écran.
    const desk = idsOf(state, 'desk')[0]!;
    const onDesk = idsOf(state, 'projector')[0]!;
    expect(switchProjector(simulation, onDesk, false).ok).toBe(true);
    const buy = (x: number, y: number, rotation: number) =>
      simulation.dispatch({ type: 'BUY_FURNITURE', itemId: 'ceiling-projector', x, y, rotation })
        .result;
    // Au-dessus du bureau (case 4, 5) : le mobilier ne le gêne pas.
    expect(buy(4, 5, 2).ok).toBe(true);
    // Deux objets du plafond ne se chevauchent pas.
    expect(buy(4, 5, 2)).toEqual({ ok: false, error: 'INVALID_PLACEMENT' });
    const ceiling = idsOf(state, 'ceiling-projector')[0]!;
    expect(state.components.furniture[ceiling]?.on).toBe(true);
    expect(activeProjections(state).map((p) => p.projector)).toEqual([ceiling]);
    // Un meuble peut toujours se poser sous un objet du plafond.
    expect(
      simulation.dispatch({ type: 'MOVE_FURNITURE', furnitureId: desk, x: 4, y: 5, rotation: 2 })
        .result.ok,
    ).toBe(true);
  });
});

describe('projectionPairs', () => {
  const screen = (id: string, x: number, y: number, rotation = 0) => ({
    id,
    itemId: 'projection-screen-medium',
    x,
    y,
    rotation,
  });
  const table = (id: string, x: number, y: number, rotation = 2) => ({
    id,
    itemId: 'desk',
    x,
    y,
    rotation,
  });
  const projector = (id: string, hostId: string, on = true) => ({
    id,
    itemId: 'projector',
    x: 0,
    y: 0,
    rotation: 0,
    hostId,
    on,
  });

  it('un écran ne sert qu’un projecteur, le plus ancien', () => {
    const pairs = projectionPairs([
      screen('s', 4, 0),
      table('t1', 4, 4),
      table('t2', 6, 6),
      projector('p1', 't1'),
      projector('p2', 't2'),
    ]);
    expect(pairs.map((p) => [p.projector, p.screen])).toEqual([['p1', 's']]);
  });

  it('chaque projecteur prend l’écran libre le plus proche', () => {
    const pairs = projectionPairs([
      screen('far', 4, 0),
      screen('near', 4, 2),
      table('t1', 4, 6),
      table('t2', 5, 7),
      projector('p1', 't1'),
      projector('p2', 't2'),
    ]);
    expect(pairs.map((p) => [p.projector, p.screen])).toEqual([
      ['p1', 'near'],
      ['p2', 'far'],
    ]);
  });

  it('ni trop loin, ni trop près, ni derrière la toile, ni éteint', () => {
    expect(projectionPairs([screen('s', 4, 0), table('t', 4, 12), projector('p', 't')])).toEqual(
      [],
    );
    expect(projectionPairs([screen('s', 4, 0), table('t', 4, 1), projector('p', 't')])).toEqual([]);
    // L'écran regarde le mur du fond : le projecteur est derrière lui.
    expect(projectionPairs([screen('s', 4, 0, 2), table('t', 4, 5), projector('p', 't')])).toEqual(
      [],
    );
    expect(
      projectionPairs([screen('s', 4, 0), table('t', 4, 5), projector('p', 't', false)]),
    ).toEqual([]);
  });
});
