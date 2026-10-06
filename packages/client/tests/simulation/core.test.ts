import { GameStateSchema } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import {
  addComponent,
  createEntity,
  destroyEntity,
  getComponent,
  hasComponent,
  query,
} from '../../src/simulation/ecs';
import { formatMoney, text } from '../../src/simulation/helpers';
import { log10Approx, round, softSigmoid } from '../../src/simulation/math';
import { Rng, seedToState } from '../../src/simulation/rng';
import { createEmptyState } from '../../src/simulation/state';
import { clockAt } from '../../src/simulation/time';

describe('Rng (générateur seedable)', () => {
  it('donne la même suite pour la même graine', () => {
    const a = Rng.fromSeed('daily-2026-10-06');
    const b = Rng.fromSeed('daily-2026-10-06');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((n) => n >= 0 && n < 1)).toBe(true);
  });

  it('donne des suites différentes pour des graines différentes', () => {
    expect(Rng.fromSeed('a').next()).not.toBe(Rng.fromSeed('b').next());
  });

  it("écrit son état dans le tableau fourni (l'état de jeu)", () => {
    const state = seedToState('x');
    const before = [...state];
    new Rng(state).next();
    expect(state).not.toEqual(before);
    // Reprendre depuis l'état sauvegardé redonne la même suite.
    const copy = [...state] as typeof state;
    expect(new Rng(state).next()).toBe(new Rng(copy).next());
  });

  it('respecte les bornes des tirages', () => {
    const rng = Rng.fromSeed('bounds');
    for (let i = 0; i < 200; i++) {
      const n = rng.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
      const r = rng.range(-1, 1);
      expect(r).toBeGreaterThanOrEqual(-1);
      expect(r).toBeLessThan(1);
    }
    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(1)).toBe(true);
  });

  it('tire selon les poids et mélange sans perdre d’élément', () => {
    const rng = Rng.fromSeed('weights');
    expect(rng.weighted(['a', 'b'], (x) => (x === 'b' ? 1 : 0))).toBe('b');
    expect(rng.weighted(['a'], () => 0)).toBeUndefined();
    expect(rng.shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(() => rng.pick([])).toThrow();
  });
});

describe('ECS', () => {
  it('crée, interroge et détruit des entités', () => {
    const state = createEmptyState({ seed: 's', mode: 'NORMAL' });
    const a = createEntity(state);
    const b = createEntity(state);
    expect([a, b]).toEqual(['e1', 'e2']);
    addComponent(state, a, 'worker', { taskId: null });
    addComponent(state, a, 'remote', true);
    addComponent(state, b, 'worker', { taskId: null });
    expect(query(state, 'worker')).toEqual([a, b]);
    expect(query(state, 'worker', 'remote')).toEqual([a]);
    expect(getComponent(state, a, 'worker')).toEqual({ taskId: null });
    expect(hasComponent(state, b, 'remote')).toBe(false);
    destroyEntity(state, a);
    expect(query(state, 'worker')).toEqual([b]);
  });
});

describe('Horloge simulée', () => {
  it('commence le lundi à 8h et suit les jours', () => {
    expect(clockAt(1, 0)).toMatchObject({
      dayInSprint: 0,
      dayOfWeek: 1,
      hour: 8,
      isWeekend: false,
    });
    // Vendredi 17h = 4 jours et 9 heures après lundi 8h.
    const friday = clockAt(1, (4 * 24 + 9) * 2);
    expect(friday).toMatchObject({ dayOfWeek: 5, hour: 17, isFriday17: true });
    expect(clockAt(1, 5 * 24 * 2).isWeekend).toBe(true);
    expect(clockAt(2, 0).day).toBe(14);
  });
});

describe('Outils', () => {
  it('formate les montants dans les deux langues', () => {
    expect(formatMoney(1_234_567, 'fr')).toBe('1,2 M€');
    expect(formatMoney(1_234_567, 'en')).toBe('€1.2M');
    expect(formatMoney(2_500_000_000, 'fr')).toBe('2,5 Md€');
    expect(formatMoney(-4500, 'fr')).toBe('-5 k€');
    expect(formatMoney(12, 'en')).toBe('€12');
  });

  it('remplit les textes bilingues', () => {
    expect(text(['{a} et {b}', '{a} and {b}'], { a: 1, b: { fr: 'deux', en: 'two' } })).toEqual({
      fr: '1 et deux',
      en: '1 and two',
    });
    expect(text(['{inconnu}', '{unknown}'])).toEqual({ fr: '{inconnu}', en: '{unknown}' });
  });

  it('calcule des maths déterministes', () => {
    expect(log10Approx(0)).toBe(0);
    expect(log10Approx(1000)).toBe(3);
    expect(log10Approx(5000)).toBeCloseTo(3.44, 1);
    expect(softSigmoid(0)).toBe(0.5);
    expect(softSigmoid(100)).toBeGreaterThan(0.99);
    expect(softSigmoid(-100)).toBeLessThan(0.01);
    expect(round(1.23456)).toBe(1.23);
    expect(round(1.26, 1)).toBe(1.3);
    expect(round(1.6, 0)).toBe(2);
    expect(round(1.23456, 3)).toBe(1.235);
  });

  it('produit un état vide conforme au schéma partagé', () => {
    expect(() =>
      GameStateSchema.parse(createEmptyState({ seed: 's', mode: 'SHIP_IN_3' })),
    ).not.toThrow();
    expect(createEmptyState({ seed: 's', mode: 'SHIP_IN_3' }).totalSprints).toBe(3);
  });
});
