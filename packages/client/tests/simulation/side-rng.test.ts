import { describe, expect, it } from 'vitest';
import { Rng, sideRng } from '../../src/simulation/rng';

describe('sideRng', () => {
  it('garde exactement le format de graine historique', () => {
    const a = sideRng('seed-1', 'tasks', 'topup', 3, 12);
    const b = Rng.fromSeed('seed-1#tasks#topup#3#12');
    expect([a.next(), a.next()]).toEqual([b.next(), b.next()]);
  });
});
