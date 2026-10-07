import { describe, expect, it } from 'vitest';
import { catalogItem } from '../../../src/view/catalog';
import { officeLayout } from '../../../src/view/layout';
import { checkPlacement, nearestValidCell, shopStatus } from '../../../src/view/placement';
import type { PlacedItemView } from '../../../src/view/types';
import { officeSimulation, SEED_OFFICE, viewOf } from '../fixtures/game';

const layout = officeLayout('SEED');
const plant = { kind: 'plant', rotation: 0 } as const;

describe('nearestValidCell', () => {
  it('garde la case visée si elle est libre', () => {
    const from = nearestValidCell(layout, [], plant, { x: 3, z: 3 });
    expect(from).toEqual({ x: 3, z: 3 });
  });

  it('trouve la case libre la plus proche quand la case visée est prise', () => {
    const items: PlacedItemView[] = [
      { id: 'a', kind: 'plant', x: 3, z: 3, rotation: 0, resale: 0 },
    ];
    const cell = nearestValidCell(layout, items, plant, { x: 3, z: 3 });
    expect(cell).not.toBeNull();
    expect(checkPlacement(layout, items, { ...plant, ...cell! })).toBeNull();
    expect(Math.max(Math.abs(cell!.x - 3), Math.abs(cell!.z - 3))).toBe(1);
  });

  it('ramène dans le bureau une case visée hors de la grille', () => {
    const cell = nearestValidCell(layout, [], plant, { x: -4, z: -4 });
    expect(cell).not.toBeNull();
    expect(checkPlacement(layout, [], { ...plant, ...cell! })).toBeNull();
  });

  it('renvoie null quand il n’y a plus aucune place', () => {
    const tiny = { ...officeLayout('GARAGE'), width: 1, depth: 1, entrance: { x: 9, z: 9 } };
    const full: PlacedItemView[] = [{ id: 'a', kind: 'plant', x: 0, z: 0, rotation: 0, resale: 0 }];
    expect(nearestValidCell(tiny, full, plant, { x: 0, z: 0 })).toBeNull();
  });
});

describe('shopStatus', () => {
  const view = viewOf(officeSimulation(SEED_OFFICE));

  it('compte les exemplaires posés', () => {
    const status = shopStatus(catalogItem('desk')!, view);
    expect(status.owned).toBe(view.items.filter((i) => i.kind === 'desk').length);
    expect(status.block).toBeNull();
  });

  it('bloque les objets d’une phase plus avancée, puis ceux qui sont trop chers', () => {
    expect(shopStatus(catalogItem('slide')!, view).block).toBe('locked');
    const broke = { ...view, gauges: { ...view.gauges, treasury: 10 } };
    expect(shopStatus(catalogItem('desk')!, broke).block).toBe('tooExpensive');
  });

  it('bloque un objet dont le maximum est atteint', () => {
    const desk = catalogItem('desk')!;
    const items = Array.from({ length: desk.maxCount }, (_, i) => ({
      id: `d${i}`,
      kind: 'desk',
      x: 0,
      z: 0,
      rotation: 0 as const,
      resale: 0,
    }));
    expect(shopStatus(desk, { ...view, items }).block).toBe('soldOut');
  });
});
