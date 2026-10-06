import { describe, expect, it } from 'vitest';
import { findPath, MinHeap, octile } from '../../../src/ai/astar';
import { NavGrid } from '../../../src/ai/grid';

/** Construit une grille à partir d'un dessin : `#` = mur, `.` = libre. */
function gridFrom(drawing: string): NavGrid {
  const rows = drawing
    .trim()
    .split('\n')
    .map((row) => row.trim());
  const grid = new NavGrid(rows[0]!.length, rows.length);
  rows.forEach((row, z) => [...row].forEach((char, x) => char === '#' && grid.block(x, z)));
  return grid;
}

describe('A*', () => {
  it('trouve la ligne droite sur une grille vide', () => {
    const grid = gridFrom('.....\n.....\n.....');
    const path = findPath(grid, { x: 0, z: 1 }, { x: 4, z: 1 });
    expect(path).toEqual([
      { x: 1, z: 1 },
      { x: 2, z: 1 },
      { x: 3, z: 1 },
      { x: 4, z: 1 },
    ]);
  });

  it('utilise les diagonales', () => {
    const grid = gridFrom('....\n....\n....\n....');
    expect(findPath(grid, { x: 0, z: 0 }, { x: 3, z: 3 })).toHaveLength(3);
  });

  it('contourne un mur sans couper les coins', () => {
    const grid = gridFrom(`
      .....
      .###.
      .....
    `);
    const path = findPath(grid, { x: 2, z: 0 }, { x: 2, z: 2 })!;
    expect(path.at(-1)).toEqual({ x: 2, z: 2 });
    for (const cell of path) expect(grid.walkable(cell.x, cell.z)).toBe(true);
    // Chaque pas diagonal doit avoir ses deux voisins orthogonaux libres.
    let previous = { x: 2, z: 0 };
    for (const cell of path) {
      if (cell.x !== previous.x && cell.z !== previous.z) {
        expect(grid.walkable(cell.x, previous.z)).toBe(true);
        expect(grid.walkable(previous.x, cell.z)).toBe(true);
      }
      previous = cell;
    }
  });

  it('renvoie null si la destination est inaccessible', () => {
    const grid = gridFrom(`
      ..#..
      ..#..
      ..#..
    `);
    expect(findPath(grid, { x: 0, z: 0 }, { x: 4, z: 0 })).toBeNull();
    expect(findPath(grid, { x: 0, z: 0 }, { x: 2, z: 0 })).toBeNull();
  });

  it('renvoie un chemin vide si on est déjà arrivé', () => {
    expect(findPath(gridFrom('..'), { x: 1, z: 0 }, { x: 1, z: 0 })).toEqual([]);
  });

  it('évite les cases coûteuses (autres personnages) quand un détour existe', () => {
    const grid = gridFrom('.....\n.....\n.....');
    const busy = { x: 2, z: 1 };
    const path = findPath(
      grid,
      { x: 0, z: 1 },
      { x: 4, z: 1 },
      {
        extraCost: (cell) => (cell.x === busy.x && cell.z === busy.z ? 10 : 0),
      },
    )!;
    expect(path).not.toContainEqual(busy);
    expect(path.at(-1)).toEqual({ x: 4, z: 1 });
  });

  it('heuristique octile', () => {
    expect(octile({ x: 0, z: 0 }, { x: 3, z: 0 })).toBe(3);
    expect(octile({ x: 0, z: 0 }, { x: 2, z: 2 })).toBeCloseTo(2 * Math.SQRT2);
  });

  it('le tas binaire rend les éléments par score croissant', () => {
    const heap = new MinHeap();
    [5, 1, 4, 2, 3].forEach((score) => heap.push(score * 10, score));
    const out: number[] = [];
    while (heap.size > 0) out.push(heap.pop());
    expect(out).toEqual([10, 20, 30, 40, 50]);
  });
});
