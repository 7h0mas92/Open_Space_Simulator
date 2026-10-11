import { describe, expect, it } from 'vitest';
import {
  FLOOR_MATERIALS,
  FLOOR_TINTS,
  FLOOR_TINT_NAMES,
  FLOOR_ZONES,
  GameStateSchema,
  floorFinishEffects,
  floorZones,
  getFloorMaterial,
  type GameState,
} from '@oss/shared';
import { computeOfficeEffects } from '../../src/simulation/furniture';
import type { Simulation } from '../../src/simulation/simulation';
import { toGameView } from '../../src/view/adapter';
import { newSimulation } from './fixtures';

function richGarage(seed = 'floors'): Simulation {
  const simulation = newSimulation(seed);
  simulation.state.gauges.treasury = 1_000_000;
  return simulation;
}

const view = (state: GameState) =>
  toGameView(state, { speed: 1, running: false, card: () => undefined }).floors;

describe('Sols : catalogue', () => {
  it('8 matières de plus en plus chères, chacune avec au moins 3 teintes sobres', () => {
    expect(FLOOR_MATERIALS).toHaveLength(8);
    const prices = FLOOR_MATERIALS.map((m) => m.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    for (const material of FLOOR_MATERIALS) {
      expect(material.tints.length).toBeGreaterThanOrEqual(3);
      expect(new Set(material.tints).size).toBe(material.tints.length);
      expect(material.effects.moral).toBeGreaterThan(0);
      expect(material.name.fr && material.name.en && material.description.en).toBeTruthy();
    }
    for (const tint of FLOOR_TINTS) expect(FLOOR_TINT_NAMES[tint].fr).toBeTruthy();
    // Chaque teinte sert au moins à une matière.
    const used = new Set(FLOOR_MATERIALS.flatMap((m) => m.tints));
    expect([...used].sort()).toEqual([...FLOOR_TINTS].sort());
  });

  it('les pièces suivent le bureau : cuisine et réunion en Seed, détente en Série A', () => {
    expect(floorZones({ phase: 'GARAGE', wings: 0, annexes: 0 })).toEqual(['open']);
    expect(floorZones({ phase: 'SEED', wings: 0, annexes: 0 })).toEqual([
      'open',
      'kitchen',
      'meeting',
    ]);
    expect(floorZones({ phase: 'SERIES_A', wings: 1, annexes: 2 })).toEqual([
      'open',
      'kitchen',
      'meeting',
      'lounge',
      'wing-1',
      'arcade',
      'garden',
    ]);
    expect(floorZones({ phase: 'UNICORN', wings: 9, annexes: 9 })).toEqual(
      FLOOR_ZONES.filter((zone) => zone !== 'lounge'),
    );
  });

  it('les effets ne comptent que les pièces qui existent', () => {
    const concrete = getFloorMaterial('concrete')!;
    const effects = floorFinishEffects(
      {
        open: { material: 'concrete', tint: 'grey' },
        kitchen: { material: 'concrete', tint: 'grey' },
      },
      { phase: 'GARAGE', wings: 0, annexes: 0 },
    );
    expect(effects.moral).toBeCloseTo(concrete.effects.moral);
    expect(effects.hypePerDay).toBeCloseTo(concrete.effects.hypePerDay ?? 0);
  });
});

describe('Sols : refaire une pièce', () => {
  it('poser un sol coûte son prix, change la pièce, sans rembourser l’ancien', () => {
    const simulation = richGarage();
    const before = simulation.state.gauges.treasury;
    const carpet = getFloorMaterial('carpet')!;
    const planks = getFloorMaterial('planks')!;
    expect(
      simulation.dispatch({ type: 'COVER_FLOOR', zone: 'open', material: 'carpet', tint: 'slate' })
        .result,
    ).toEqual({ ok: true });
    expect(simulation.state.floors).toEqual({ open: { material: 'carpet', tint: 'slate' } });
    // Même matière, autre teinte : c'est un nouveau sol.
    simulation.dispatch({ type: 'COVER_FLOOR', zone: 'open', material: 'carpet', tint: 'grey' });
    simulation.dispatch({ type: 'COVER_FLOOR', zone: 'open', material: 'planks', tint: 'walnut' });
    expect(simulation.state.gauges.treasury).toBe(before - 2 * carpet.price - planks.price);
    expect(view(simulation.state).zones).toEqual([
      { zone: 'open', finish: { material: 'planks', tint: 'walnut' } },
    ]);
  });

  it('refuse le même sol, une teinte hors matière, une pièce absente, une matière verrouillée', () => {
    const simulation = richGarage();
    simulation.dispatch({ type: 'COVER_FLOOR', zone: 'open', material: 'vinyl', tint: 'sage' });
    const cases = [
      [{ zone: 'open', material: 'vinyl', tint: 'sage' }, 'NOT_ELIGIBLE'],
      [{ zone: 'open', material: 'planks', tint: 'charcoal' }, 'NOT_FOUND'],
      [{ zone: 'kitchen', material: 'vinyl', tint: 'sand' }, 'NOT_FOUND'],
      [{ zone: 'open', material: 'marble', tint: 'white' }, 'LOCKED'],
    ] as const;
    for (const [command, error] of cases)
      expect(simulation.dispatch({ type: 'COVER_FLOOR', ...command }).result).toEqual({
        ok: false,
        error,
      });
    expect(view(simulation.state).locked).toEqual(['tiles', 'chevron', 'terrazzo', 'marble']);
    simulation.state.gauges.treasury = 10;
    expect(
      simulation.dispatch({ type: 'COVER_FLOOR', zone: 'open', material: 'vinyl', tint: 'grey' })
        .result,
    ).toEqual({ ok: false, error: 'NOT_ENOUGH_MONEY' });
  });

  it('chaque pièce refaite remonte le moral (et la qualité pour le carrelage)', () => {
    const simulation = richGarage();
    simulation.state.phase = 'SEED';
    const before = computeOfficeEffects(simulation.state);
    for (const zone of ['open', 'kitchen'] as const)
      simulation.dispatch({ type: 'COVER_FLOOR', zone, material: 'tiles', tint: 'white' });
    const after = computeOfficeEffects(simulation.state);
    const tiles = getFloorMaterial('tiles')!;
    expect(after.moral - before.moral).toBeCloseTo(2 * tiles.effects.moral);
    expect(after.quality - before.quality).toBeCloseTo(2 * (tiles.effects.quality ?? 0));
  });

  it('ne touche pas au RNG ; une vieille sauvegarde se recharge avec les sols d’origine', () => {
    const simulation = richGarage();
    const rng = [...simulation.state.rng];
    simulation.dispatch({ type: 'COVER_FLOOR', zone: 'open', material: 'concrete', tint: 'taupe' });
    expect(simulation.state.rng).toEqual(rng);
    const old = JSON.parse(JSON.stringify(newSimulation('old').state)) as Record<string, unknown>;
    delete old.floors;
    expect(GameStateSchema.parse(old).floors).toEqual({});
  });
});
