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

  it('compte aussi les exemplaires rangés dans l’inventaire', () => {
    const trashcan = catalogItem('trashcan')!;
    const inventory = [{ kind: 'trashcan', color: 'natural' as const, count: 2, resale: 45 }];
    const status = shopStatus(trashcan, { ...view, items: [], inventory });
    expect(status).toEqual({ owned: 2, block: 'soldOut' });
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
      // Les places pour l'électroménager sont prises parmi celles du plateau.
      const appliances = 'applianceSlots' in item ? item.applianceSlots : 0;
      expect(appliances, item.id).toBeLessThanOrEqual(slots);
      // Un accessoire n'a pas de plateau, et il est rangé dans son rayon.
      if ('accessory' in item) {
        expect(slots).toBe(0);
        expect(catalogItem(item.id)?.category).toBe(
          'appliance' in item || item.id === 'toaster' || item.id === 'blender'
            ? 'appliance'
            : 'projector' in item
              ? 'devices'
              : 'serverGear' in item
                ? 'servers'
                : 'accessory',
        );
      }
    }
  });

  it('pose l’électroménager sur un meuble de cuisine, pas sur un bureau', () => {
    const counter: PlacedItemView = { ...desk, id: 'k', kind: 'kitchen-doors', x: 6, z: 2 };
    const oven = (slot: number): PlacedItemView => ({
      ...desk,
      id: `oven${slot}`,
      kind: 'microwave-oven',
      host: { id: 'k', slot },
    });
    const request = { kind: 'kettle', rotation: 0 as const };
    expect(checkPlacement(layout, [desk], { ...request, x: 2, z: 2 })).toBe('noCounter');
    expect(checkPlacement(layout, [desk], { ...request, x: 9, z: 9 })).toBe('noCounter');
    expect(resolveAccessory([counter], { ...request, x: 6, z: 2 })).toMatchObject({
      host: { id: 'k' },
    });
    expect(checkPlacement(layout, [counter, oven(0), oven(1)], { ...request, x: 6, z: 2 })).toBe(
      'surfaceFull',
    );
    // Un petit accessoire va aussi sur le plan de travail.
    expect(resolveAccessory([counter, oven(0)], { x: 6, z: 2 })).toEqual({
      host: { id: 'k', slot: 1 },
    });
  });

  it('installe le matériel serveur dans une salle des serveurs, et rien d’autre', () => {
    const closet: PlacedItemView = { ...desk, id: 's', kind: 'server-closet', x: 6, z: 2 };
    const rack = { kind: 'rack-server', rotation: 0 as const };
    expect(checkPlacement(layout, [desk], { ...rack, x: 2, z: 2 })).toBe('noServerRoom');
    expect(checkPlacement(layout, [desk], { ...rack, x: 9, z: 9 })).toBe('noServerRoom');
    expect(resolveAccessory([closet], { ...rack, x: 7, z: 2 })).toMatchObject({
      host: { id: 's' },
    });
    expect(checkPlacement(layout, [closet], { kind: 'rubber-duck', x: 7, z: 2, rotation: 0 })).toBe(
      'noSurface',
    );
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
      checkPlacement(layout, [desk, duck(0), duck(1), duck(2)], {
        kind: 'rubber-duck',
        x: 2,
        z: 2,
        rotation: 0,
      }),
    ).toBe('surfaceFull');
    // L'accessoire déplacé libère sa propre place, et ne bloque pas le sol.
    expect(
      resolveAccessory([desk, duck(0), duck(1), duck(2)], { x: 2, z: 2, ignoreId: 'duck0' }),
    ).toEqual({ host: { id: 'd', slot: 0 } });
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

describe('fenêtres', () => {
  const view = (kind: string, x: number, z: number, rotation: 0 | 1): PlacedItemView => ({
    id: `${kind}@${x},${z}`,
    kind,
    x,
    z,
    rotation,
    resale: 0,
    color: 'natural',
    host: null,
  });

  it('sont rangées dans leur propre rayon et se fixent au mur', () => {
    for (const kind of ['window-small', 'window-medium', 'window-large', 'glass-wall']) {
      expect(catalogItem(kind)?.category).toBe('window');
      expect(catalogItem(kind)?.wall).toBe(true);
    }
    const request = { kind: 'window-medium', rotation: 0 } as const;
    expect(checkPlacement(layout, [], { ...request, x: 2, z: 0 })).toBeNull();
    expect(checkPlacement(layout, [], { ...request, x: 2, z: 3 })).toBe('noWall');
    expect(checkPlacement(layout, [], { ...request, x: 2, z: 0, rotation: 2 })).toBe('noWall');
    expect(checkPlacement(layout, [], { ...request, x: layout.width - 1, z: 0 })).toBe(
      'outOfBounds',
    );
    expect(checkPlacement(layout, [], { kind: 'glass-wall', x: 0, z: 2, rotation: 1 })).toBeNull();
  });

  it('ne gênent que les fenêtres du même mur', () => {
    const glass = view('glass-wall', 2, 0, 0);
    expect(checkPlacement(layout, [glass], { kind: 'window-small', x: 3, z: 0, rotation: 0 })).toBe(
      'overlap',
    );
    expect(
      checkPlacement(layout, [glass], { kind: 'window-small', x: 0, z: 0, rotation: 1 }),
    ).toBeNull();
    // Une plante se pose devant la baie, la baie derrière la plante.
    expect(checkPlacement(layout, [glass], { ...plant, x: 2, z: 0 })).toBeNull();
    expect(
      checkPlacement(layout, [view('plant', 4, 0, 0)], {
        kind: 'glass-wall',
        x: 4,
        z: 0,
        rotation: 0,
      }),
    ).toBeNull();
  });
});

describe('murs fins', () => {
  const garage = officeLayout('GARAGE');
  const wall = (id: string, x: number, z: number, rotation: 0 | 1): PlacedItemView => ({
    id,
    kind: 'thin-wall',
    x,
    z,
    rotation,
    resale: 0,
    color: 'natural',
    host: null,
  });

  it('se posent sur une case libre, dans les deux sens', () => {
    expect(checkPlacement(garage, [], { kind: 'thin-wall', x: 3, z: 2, rotation: 0 })).toBeNull();
    expect(
      checkPlacement(garage, [], { kind: 'glass-partition', x: 3, z: 2, rotation: 1 }),
    ).toBeNull();
  });

  it('refusent de fermer un coin du bureau : il faut laisser une porte', () => {
    // Le coin du fond à droite (x 6-7, z 0-1) : deux murs le ferment presque.
    const items = [wall('a', 5, 0, 1), wall('b', 5, 1, 1), wall('c', 6, 2, 0)];
    expect(checkPlacement(garage, items, { kind: 'thin-wall', x: 7, z: 2, rotation: 0 })).toBe(
      'blocksPath',
    );
    // Déplacer un des murs ailleurs rouvre le passage.
    expect(
      checkPlacement(garage, items, { kind: 'thin-wall', x: 7, z: 2, rotation: 0, ignoreId: 'c' }),
    ).toBeNull();
  });

  it('un mur au bout d’une rangée ne gêne pas tant qu’on peut en faire le tour', () => {
    const items = [wall('a', 2, 0, 1), wall('b', 2, 1, 1)];
    expect(
      checkPlacement(garage, items, { kind: 'thin-wall', x: 2, z: 2, rotation: 1 }),
    ).toBeNull();
  });
});
