import { describe, expect, it } from 'vitest';
import {
  GameStateSchema,
  WALL_FINISHES,
  WALL_ZONES,
  getWallFinish,
  wallFinishEffects,
  wallZones,
  type GameState,
} from '@oss/shared';
import { computeOfficeEffects } from '../../src/simulation/furniture';
import type { Simulation } from '../../src/simulation/simulation';
import { toGameView } from '../../src/view/adapter';
import { newSimulation } from './fixtures';

function richGarage(seed = 'walls'): Simulation {
  const simulation = newSimulation(seed);
  simulation.state.gauges.treasury = 1_000_000;
  return simulation;
}

const view = (state: GameState) =>
  toGameView(state, { speed: 1, running: false, card: () => undefined }).walls;

describe('Murs : catalogue', () => {
  it('8 peintures au même prix, puis des papiers peints de plus en plus chers', () => {
    const paints = WALL_FINISHES.filter((f) => f.kind === 'paint');
    // Les papiers peints gagnés en mode Histoire viennent en plus.
    const papers = WALL_FINISHES.filter((f) => f.kind === 'wallpaper' && !f.unlock);
    expect(paints).toHaveLength(8);
    expect(new Set(paints.map((f) => f.price)).size).toBe(1);
    expect(papers.length).toBeGreaterThanOrEqual(8);
    const prices = papers.map((f) => f.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(Math.min(...prices)).toBeGreaterThan(paints[0]!.price);
    for (const finish of WALL_FINISHES) {
      expect(finish.effects.moral).toBeGreaterThan(0);
      expect(finish.name.fr && finish.name.en && finish.description.en).toBeTruthy();
    }
  });

  it('les zones de mur suivent le bureau : cuisine en Seed, ailes et annexes ensuite', () => {
    expect(wallZones({ phase: 'GARAGE', wings: 0, annexes: 0 })).toEqual([
      'back-open',
      'left-open',
    ]);
    expect(wallZones({ phase: 'SEED', wings: 0, annexes: 0 })).toEqual([
      'back-open',
      'back-kitchen',
      'left-open',
    ]);
    expect(wallZones({ phase: 'UNICORN', wings: 9, annexes: 9 })).toEqual([...WALL_ZONES]);
    expect(wallZones({ phase: 'SERIES_A', wings: 1, annexes: 2 })).toEqual([
      'back-open',
      'back-kitchen',
      'back-wing-1',
      'left-open',
      'left-arcade',
      'left-garden',
    ]);
  });

  it('les effets ne comptent que les zones qui existent', () => {
    const brick = getWallFinish('brick')!;
    const effects = wallFinishEffects(
      { 'back-open': 'brick', 'back-kitchen': 'brick' },
      { phase: 'GARAGE', wings: 0, annexes: 0 },
    );
    expect(effects.moral).toBeCloseTo(brick.effects.moral);
    expect(effects.hypePerDay).toBeCloseTo(brick.effects.hypePerDay ?? 0);
  });
});

describe('Murs : peindre et tapisser', () => {
  it('peindre une zone coûte son prix et change le mur, sans rembourser l’ancien', () => {
    const simulation = richGarage();
    const before = simulation.state.gauges.treasury;
    expect(
      simulation.dispatch({ type: 'COVER_WALL', zone: 'back-open', finish: 'teal' }).result,
    ).toEqual({ ok: true });
    expect(simulation.state.walls).toEqual({ 'back-open': 'teal' });
    expect(simulation.state.gauges.treasury).toBe(before - getWallFinish('teal')!.price);
    simulation.dispatch({ type: 'COVER_WALL', zone: 'back-open', finish: 'brick' });
    expect(simulation.state.gauges.treasury).toBe(
      before - getWallFinish('teal')!.price - getWallFinish('brick')!.price,
    );
    expect(view(simulation.state).zones).toEqual([
      { zone: 'back-open', finish: 'brick' },
      { zone: 'left-open', finish: null },
    ]);
  });

  it('refuse le même revêtement, une zone absente, un papier peint pas encore débloqué', () => {
    const simulation = richGarage();
    simulation.dispatch({ type: 'COVER_WALL', zone: 'left-open', finish: 'sage' });
    const cases = [
      [{ zone: 'left-open', finish: 'sage' }, 'NOT_ELIGIBLE'],
      [{ zone: 'back-kitchen', finish: 'sage' }, 'NOT_FOUND'],
      [{ zone: 'back-open', finish: 'coderain' }, 'LOCKED'],
    ] as const;
    for (const [command, error] of cases)
      expect(simulation.dispatch({ type: 'COVER_WALL', ...command }).result).toEqual({
        ok: false,
        error,
      });
    expect(view(simulation.state).locked).toContain('coderain');
    simulation.state.gauges.treasury = 10;
    expect(
      simulation.dispatch({ type: 'COVER_WALL', zone: 'back-open', finish: 'cream' }).result,
    ).toEqual({ ok: false, error: 'NOT_ENOUGH_MONEY' });
  });

  it('chaque zone couverte remonte le moral (et la qualité pour le tableau noir)', () => {
    const simulation = richGarage();
    simulation.state.phase = 'SEED';
    const before = computeOfficeEffects(simulation.state);
    simulation.dispatch({ type: 'COVER_WALL', zone: 'back-open', finish: 'chalkboard' });
    simulation.dispatch({ type: 'COVER_WALL', zone: 'left-open', finish: 'chalkboard' });
    const after = computeOfficeEffects(simulation.state);
    const chalk = getWallFinish('chalkboard')!;
    expect(after.moral - before.moral).toBeCloseTo(2 * chalk.effects.moral);
    expect(after.quality - before.quality).toBeCloseTo(2 * (chalk.effects.quality ?? 0));
  });

  it('ne touche pas au RNG ; une vieille sauvegarde se recharge avec les murs d’origine', () => {
    const simulation = richGarage();
    const rng = [...simulation.state.rng];
    simulation.dispatch({ type: 'COVER_WALL', zone: 'back-open', finish: 'dots' });
    expect(simulation.state.rng).toEqual(rng);
    const old = JSON.parse(JSON.stringify(newSimulation('old').state)) as Record<string, unknown>;
    delete old.walls;
    expect(GameStateSchema.parse(old).walls).toEqual({});
  });
});
