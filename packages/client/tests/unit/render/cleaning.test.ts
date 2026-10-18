import { describe, expect, it } from 'vitest';
import { buildNavGrid } from '../../../src/ai/grid';
import { LITTER_MAX, litterCount, litterSpots } from '../../../src/render/cleaning';
import { officeLayout } from '../../../src/view/layout';

describe('Déchets au sol', () => {
  const layout = officeLayout('SEED');
  const grid = buildNavGrid(layout, []);

  it('tombent sur des cases libres, jamais sur l’entrée, toujours aux mêmes places', () => {
    const spots = litterSpots('graine', grid, layout.entrance);
    expect(spots.length).toBeGreaterThan(10);
    expect(spots.length).toBeLessThanOrEqual(LITTER_MAX);
    for (const spot of spots) {
      expect(grid.walkable(spot.cell.x, spot.cell.z)).toBe(true);
      expect(spot.cell).not.toEqual(layout.entrance);
      expect(Math.abs(spot.x - spot.cell.x)).toBeLessThan(0.5);
    }
    expect(litterSpots('graine', grid, layout.entrance)).toEqual(spots);
    expect(litterSpots('autre', grid, layout.entrance)).not.toEqual(spots);
    expect(new Set(spots.map((spot) => spot.kind)).size).toBeGreaterThan(3);
  });

  it('sont plus nombreux quand le bureau est plus sale', () => {
    expect(litterCount(40, 0)).toBe(0);
    expect(litterCount(40, 50)).toBe(20);
    expect(litterCount(40, 100)).toBe(40);
    expect(litterCount(40, 140)).toBe(40);
  });
});
