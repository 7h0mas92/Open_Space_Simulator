import { FURNITURE_CATALOG } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { catalogItem } from '../../../src/view/catalog';
import { officeLayout } from '../../../src/view/layout';
import {
  checkPlacement,
  nearestValidCell,
  resolveAccessory,
  shopStatus,
  slotPosition,
} from '../../../src/view/placement';
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
      { id: 'a', kind: 'plant', x: 3, z: 3, rotation: 0, resale: 0, color: 'natural', host: null },
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
    const full: PlacedItemView[] = [
      { id: 'a', kind: 'plant', x: 0, z: 0, rotation: 0, resale: 0, color: 'natural', host: null },
    ];
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
      color: 'natural' as const,
      host: null,
    }));
    expect(shopStatus(desk, { ...view, items }).block).toBe('soldOut');
  });
});

describe('accessoires', () => {
  const desk: PlacedItemView = {
    id: 'd',
    kind: 'desk',
    x: 2,
    z: 2,
    rotation: 0,
    resale: 0,
    color: 'natural',
    host: null,
  };
  const duck = (slot: number): PlacedItemView => ({
    ...desk,
    id: `duck${slot}`,
    kind: 'rubber-duck',
    host: { id: 'd', slot },
  });

  it('chaque meuble à plateau a autant d’emplacements que la simulation en accepte', () => {
    for (const item of FURNITURE_CATALOG) {
      const slots = 'surfaceSlots' in item ? item.surfaceSlots : 0;
      expect(catalogItem(item.id)?.surface?.length ?? 0, item.id).toBe(slots);
      // Un accessoire n'a pas de plateau, et il est rangé dans son rayon.
      if ('accessory' in item) {
        expect(slots).toBe(0);
        expect(catalogItem(item.id)?.category).toBe('accessory');
      }
    }
  });

  it('se pose sur un meuble à plateau, jamais au sol', () => {
    expect(checkPlacement(layout, [desk], { kind: 'rubber-duck', x: 5, z: 5, rotation: 0 })).toBe(
      'noSurface',
    );
    expect(resolveAccessory([desk], { x: 3, z: 2 })).toEqual({ host: { id: 'd', slot: 1 } });
    // Emplacement le plus proche pris : on prend l'autre ; plus rien : le meuble est plein.
    expect(resolveAccessory([desk, duck(1)], { x: 3, z: 2 })).toEqual({
      host: { id: 'd', slot: 0 },
    });
    expect(
      checkPlacement(layout, [desk, duck(0), duck(1)], {
        kind: 'rubber-duck',
        x: 2,
        z: 2,
        rotation: 0,
      }),
    ).toBe('surfaceFull');
    // L'accessoire déplacé libère sa propre place, et ne bloque pas le sol.
    expect(resolveAccessory([desk, duck(0), duck(1)], { x: 2, z: 2, ignoreId: 'duck0' })).toEqual({
      host: { id: 'd', slot: 0 },
    });
    expect(checkPlacement(layout, [duck(0)], { ...plant, x: 2, z: 2 })).toBeNull();
  });

  it('les emplacements tournent avec le meuble', () => {
    const [x0, , z0] = slotPosition(desk, 0)!;
    const turned = slotPosition({ ...desk, rotation: 2 }, 0)!;
    // Un demi-tour renvoie l'emplacement de l'autre côté du centre du bureau (2.5, 2).
    expect(turned[0]).toBeCloseTo(2 * 2.5 - x0);
    expect(turned[2]).toBeCloseTo(2 * 2 - z0);
  });
});
