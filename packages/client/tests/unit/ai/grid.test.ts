import { describe, expect, it } from 'vitest';
import {
  accessCell,
  accessPoint,
  buildNavGrid,
  frontDirection,
  itemCells,
  NavGrid,
} from '../../../src/ai/grid';
import { officeLayout } from '../../../src/view/layout';

describe('grille de navigation', () => {
  it('bloque les cloisons et les meubles, pas les tapis', () => {
    const layout = officeLayout('SEED');
    const grid = buildNavGrid(layout, [
      { id: 'd', kind: 'desk', x: 1, z: 1, rotation: 0 },
      { id: 'r', kind: 'rug', x: 4, z: 4, rotation: 0 },
    ]);
    expect(grid.walkable(1, 1)).toBe(false);
    expect(grid.walkable(2, 1)).toBe(false);
    expect(grid.walkable(4, 4)).toBe(true);
    expect(grid.walkable(10, 0)).toBe(false); // cloison
    expect(grid.walkable(10, 2)).toBe(true); // porte
    expect(grid.walkable(-1, 0)).toBe(false);
  });

  it('calcule l’emprise et la case d’accès selon la rotation', () => {
    const desk = { id: 'd', kind: 'desk', x: 2, z: 2, rotation: 0 as const };
    expect(itemCells(desk)).toEqual([
      { x: 2, z: 2 },
      { x: 3, z: 2 },
    ]);
    expect(accessCell(desk)).toEqual({ x: 2, z: 3 });
    expect(itemCells({ ...desk, rotation: 1 })).toEqual([
      { x: 2, z: 2 },
      { x: 2, z: 3 },
    ]);
    expect(accessCell({ ...desk, rotation: 1 })).toEqual({ x: 3, z: 2 });
    expect(accessCell({ ...desk, rotation: 2 })).toEqual({ x: 2, z: 1 });
    expect(accessCell({ ...desk, rotation: 3 })).toEqual({ x: 1, z: 2 });
    expect(frontDirection(-1)).toEqual([-1, 0]);
  });

  it('décalé d’une demi-case, un objet bloque les cases qu’il chevauche', () => {
    const desk = { id: 'd', kind: 'desk', x: 2.5, z: 2, rotation: 0 as const };
    expect(itemCells(desk)).toEqual([
      { x: 2, z: 2 },
      { x: 3, z: 2 },
      { x: 4, z: 2 },
    ]);
    // On s'assoit au point exact (la chaise), depuis une case entière de la grille.
    expect(accessPoint(desk)).toEqual({ x: 2.5, z: 3 });
    expect(accessCell(desk)).toEqual({ x: 3, z: 3 });
    const front = { ...desk, x: 2, z: 2.5 };
    expect(accessPoint(front)).toEqual({ x: 2, z: 3.5 });
    expect(accessCell(front)).toEqual({ x: 2, z: 4 });
    expect(new NavGrid(5, 5).walkable(2.5, 2)).toBe(false);
  });

  it('trouve la case libre la plus proche', () => {
    const grid = new NavGrid(3, 3);
    grid.block(1, 1);
    expect(grid.nearestWalkable({ x: 1, z: 1 })).not.toBeNull();
    expect(grid.nearestWalkable({ x: 0, z: 0 }, (c) => c.x === 2 && c.z === 2)).toEqual({
      x: 2,
      z: 2,
    });
    expect(grid.nearestWalkable({ x: 0, z: 0 }, () => false)).toBeNull();
  });
});
