import { describe, expect, it } from 'vitest';
import { defaultCardLibrary } from '../../src/events/defaultCards';
import {
  marketShare,
  rivalExtraChurn,
  rivalsSprint,
  rivalUsers,
} from '../../src/simulation/rivals';
import { Simulation } from '../../src/simulation/simulation';
import { goalProgress } from '../../src/simulation/story';
import { maxTop, planSkyline, rivalTowerSpots } from '../../src/render/skyline';
import { officeLayout } from '../../src/view/layout';
import { makeContext } from './fixtures';

const cards = defaultCardLibrary();
const campaign = (seed = 'rivaux') =>
  Simulation.create({ seed, mode: 'STORY', mission: 'campaign' }, cards).state;

describe('Rivaux de l’histoire', () => {
  it('Synergix est là dès le prologue, seul', () => {
    const state = campaign();
    expect(state.story?.campaign?.rivals.map((r) => r.id)).toEqual(['synergix']);
  });

  it('une démo fait grandir les rivaux sans toucher au générateur de la partie', () => {
    const state = campaign();
    const rng = [...state.rng];
    const before = rivalUsers(state, 'synergix');
    rivalsSprint(state, makeContext(state));
    expect(state.rng).toEqual(rng);
    expect(rivalUsers(state, 'synergix')).toBeGreaterThan(before);
    expect(state.story?.campaign?.usersHistory).toHaveLength(1);
  });

  it('la même graine et le même sprint donnent les mêmes rivaux', () => {
    const a = campaign('x');
    const b = campaign('x');
    rivalsSprint(a, makeContext(a));
    rivalsSprint(b, makeContext(b));
    expect(a.story?.campaign?.rivals).toEqual(b.story?.campaign?.rivals);
  });

  it('Pivotly arrive à la guerre des prix, Gigacorp rachète Synergix ensuite', () => {
    const state = campaign();
    const story = state.story!.campaign!;
    story.act = 2;
    rivalsSprint(state, makeContext(state));
    expect(story.rivals.map((r) => r.id)).toEqual(['synergix', 'pivotly']);
    story.act = 3;
    state.sprint += 1;
    const ctx = makeContext(state);
    rivalsSprint(state, ctx);
    const synergix = story.rivals.find((r) => r.id === 'synergix');
    expect(synergix).toMatchObject({ alive: false, boughtBy: 'gigacorp' });
    expect(rivalUsers(state, 'gigacorp')).toBeGreaterThan(2_000_000);
    expect(ctx.outbox.some((n) => n.kind === 'RIVAL_ACTION')).toBe(true);
  });

  it('les rivaux prennent une part du marché et font partir des utilisateurs', () => {
    const state = campaign();
    state.gauges.users = 3_000;
    expect(marketShare(state)).toBeCloseTo(0.5);
    expect(rivalExtraChurn(state)).toBeGreaterThan(0);
    expect(goalProgress(state, { kind: 'marketShare', min: 0.3 }).met).toBe(true);
    expect(goalProgress(state, { kind: 'rivalUsers', rival: 'synergix' }).met).toBe(true);
    state.gauges.users = 1_000;
    expect(goalProgress(state, { kind: 'rivalUsers', rival: 'synergix' }).met).toBe(false);
  });

  it('les autres modes n’ont ni rival ni concurrence', () => {
    const state = Simulation.create({ seed: 'n', mode: 'NORMAL' }, cards).state;
    const before = structuredClone(state);
    rivalsSprint(state, makeContext(state));
    expect(state).toEqual(before);
    expect(rivalExtraChurn(state)).toBe(0);
    expect(marketShare(state)).toBe(1);
  });
});

describe('Tours des rivaux dans la ville', () => {
  it.each(['GARAGE', 'SEED', 'SERIES_A', 'UNICORN'] as const)(
    'en %s : jusqu’à 3 toits sur les côtés, enseigne sous la ligne des toits',
    (phase) => {
      const layout = officeLayout(phase);
      const spots = rivalTowerSpots(planSkyline(layout), layout);
      expect(spots.length).toBeGreaterThan(0);
      expect(spots.length).toBeLessThanOrEqual(3);
      const cx = (layout.width - 1) / 2;
      const cz = (layout.depth - 1) / 2;
      for (const spot of spots) {
        expect(spot.x < cx - 4).not.toBe(spot.z < cz - 4);
        expect(spot.limit).toBeLessThanOrEqual(maxTop(Math.hypot(spot.x - cx, spot.z - cz)));
      }
    },
  );
});
