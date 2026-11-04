import { CLEANING, type GameState } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { binCut } from '../../src/simulation/cleaning';

/** État minimal : seules les poubelles posées comptent. */
function withBins(count: number): GameState {
  const furniture = Object.fromEntries(
    Array.from({ length: count }, (_, i) => [`e${i}`, { itemId: 'trashcan' }]),
  );
  return {
    entities: Object.keys(furniture),
    components: { furniture },
  } as unknown as GameState;
}

describe('poubelles', () => {
  it('chaque poubelle retient 10 % de la saleté, 3 au plus', () => {
    expect(binCut(withBins(0))).toBe(0);
    expect(binCut(withBins(1))).toBeCloseTo(CLEANING.binCut);
    expect(binCut(withBins(3))).toBeCloseTo(0.3);
    expect(binCut(withBins(5))).toBeCloseTo(0.3);
  });
});
