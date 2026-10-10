import { describe, expect, it } from 'vitest';
import { buildNavGrid } from '../../../src/ai/grid';
import { wallSpans } from '../../../src/render/office';
import { officeLayout } from '../../../src/view/layout';
import type { PlacedItemView } from '../../../src/view/types';
import { aimWindow, snapToWall, wallOpenings } from '../../../src/view/windows';

const layout = officeLayout('SEED');

const item = (kind: string, x: number, z: number, rotation: 0 | 1): PlacedItemView => ({
  id: `${kind}@${x},${z}`,
  kind,
  x,
  z,
  rotation,
  resale: 0,
  color: 'natural',
  host: null,
});

describe('fenêtres dans les murs', () => {
  it('liste les ouvertures de chaque mur, sans le mobilier', () => {
    const items = [
      item('desk', 3, 3, 0),
      item('glass-wall', 0, 4, 1),
      item('window-large', 5, 0, 0),
      item('window-small', 1, 0, 0),
    ];
    expect(wallOpenings(items)).toEqual([
      { kind: 'window-small', wall: 0, start: 1, length: 1, full: false },
      { kind: 'window-large', wall: 0, start: 5, length: 3, full: false },
      { kind: 'glass-wall', wall: 1, start: 4, length: 2, full: true },
    ]);
  });

  it('accroche la fenêtre visée au mur le plus proche, centrée, sans dépasser', () => {
    expect(aimWindow(layout, 'window-large', { x: 6, z: 2 })).toEqual({
      cell: { x: 5, z: 0 },
      rotation: 0,
    });
    expect(aimWindow(layout, 'window-large', { x: 1, z: 5 })).toEqual({
      cell: { x: 0, z: 4 },
      rotation: 1,
    });
    expect(aimWindow(layout, 'window-large', { x: layout.width - 1, z: 0 })).toEqual({
      cell: { x: layout.width - 3, z: 0 },
      rotation: 0,
    });
    // Au clavier, la fenêtre glisse le long de son mur.
    expect(snapToWall(layout, 'window-medium', { x: 0, z: 3 }, 1)).toEqual({
      cell: { x: 0, z: 3 },
      rotation: 1,
    });
    expect(snapToWall(layout, 'window-medium', { x: 4, z: 3 }, 0).cell).toEqual({ x: 4, z: 0 });
  });

  it('perce le mur seulement là où une fenêtre est posée', () => {
    expect(wallSpans(8, [], 0)).toEqual([[0, 8]]);
    const openings = wallOpenings([item('window-medium', 2, 0, 0), item('window-small', 7, 0, 0)]);
    expect(wallSpans(8, openings, 0)).toEqual([
      [0, 2],
      [4, 7],
    ]);
    expect(wallSpans(6, openings, 1)).toEqual([[0, 6]]);
  });

  it('laisse passer les personnages devant les fenêtres', () => {
    const grid = buildNavGrid(layout, [item('glass-wall', 2, 0, 0)]);
    expect(grid.walkable(2, 0)).toBe(true);
    expect(grid.walkable(3, 0)).toBe(true);
  });
});
