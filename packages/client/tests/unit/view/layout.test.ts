import { ANNEXES, ANNEX_KINDS, PHASES } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildNavGrid } from '../../../src/ai/grid';
import { FIXTURE_PRIMITIVES } from '../../../src/render/annexDecor';
import { FLOOR_STYLES } from '../../../src/render/office';
import { checkPlacement } from '../../../src/view/placement';
import {
  ROOM_KINDS,
  ROOM_STYLES,
  officeLayout,
  roomAt,
  type Cell,
  type OfficeLayout,
} from '../../../src/view/layout';

/** Cases praticables atteignables depuis l'entrée (parcours en largeur). */
function reachable(layout: OfficeLayout): Set<string> {
  const grid = buildNavGrid(layout, []);
  const key = (cell: Cell) => `${cell.x},${cell.z}`;
  const seen = new Set([key(layout.entrance)]);
  const queue: Cell[] = [layout.entrance];
  while (queue.length > 0) {
    const cell = queue.shift()!;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const next = { x: cell.x + dx, z: cell.z + dz };
      if (!grid.walkable(next.x, next.z) || seen.has(key(next))) continue;
      seen.add(key(next));
      queue.push(next);
    }
  }
  return seen;
}

describe('Annexes du bureau', () => {
  it('chaque annexe ajoute une bande de pièce sur toute la largeur', () => {
    const base = officeLayout('SERIES_A');
    for (let annexes = 1; annexes <= ANNEXES.max; annexes++) {
      const layout = officeLayout('SERIES_A', 0, annexes);
      expect(layout.depth).toBe(base.depth + annexes * ANNEXES.depth);
      expect(layout.maxTeam).toBe(base.maxTeam + annexes * ANNEXES.teamPerAnnex);
      const kinds = layout.rooms.map((room) => room.kind);
      expect(kinds).toEqual([...base.rooms.map((r) => r.kind), ...ANNEX_KINDS.slice(0, annexes)]);
    }
    // Au-delà du maximum, le bureau ne grandit plus.
    expect(officeLayout('SERIES_A', 0, 9).depth).toBe(officeLayout('SERIES_A', 0, 3).depth);
  });

  it('toutes les salles restent accessibles, ailes et annexes comprises', () => {
    for (const phase of ['SERIES_A', 'UNICORN'] as const) {
      const layout = officeLayout(phase, 2, 3, 'graine');
      const seen = reachable(layout);
      for (const room of layout.rooms) {
        const inside = [...seen].some((k) => {
          const [x, z] = k.split(',').map(Number) as [number, number];
          return roomAt(layout, { x, z }) === room;
        });
        expect(inside, `${phase} ${room.kind}`).toBe(true);
      }
    }
  });

  it('le décor fixe est dans son annexe, bloque la grille et la construction', () => {
    const layout = officeLayout('SERIES_A', 0, 3);
    const fixtures = layout.fixtures ?? [];
    expect(fixtures.length).toBeGreaterThanOrEqual(ANNEXES.max * 4);
    const grid = buildNavGrid(layout, []);
    for (const fixture of fixtures) {
      expect(ANNEX_KINDS).toContain(roomAt(layout, fixture)?.kind);
      expect(grid.walkable(fixture.x, fixture.z)).toBe(false);
    }
    const first = fixtures[0]!;
    expect(checkPlacement(layout, [], { kind: 'plant', x: first.x, z: first.z, rotation: 0 })).toBe(
      'wall',
    );
  });

  it('chaque objet du décor des annexes a une forme distincte', () => {
    const signature = (build: () => THREE.Group) => {
      const group = build();
      const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
      return `${group.children.length}:${size.toArray().map((v) => v.toFixed(2))}`;
    };
    const shapes = Object.values(FIXTURE_PRIMITIVES).map(signature);
    expect(new Set(shapes).size).toBe(shapes.length);
  });
});

describe('Décor des pièces', () => {
  it('chaque type de pièce a autant de sols que de styles annoncés', () => {
    for (const kind of ROOM_KINDS) expect(FLOOR_STYLES[kind]).toHaveLength(ROOM_STYLES[kind]);
  });

  it('le décor dépend de la graine, et reste celui d’origine sans graine', () => {
    for (const phase of PHASES) {
      expect(officeLayout(phase).rooms.every((room) => (room.style ?? 0) === 0)).toBe(true);
    }
    const styles = (seed: string) =>
      officeLayout('UNICORN', 0, 0, seed)
        .rooms.map((room) => room.style)
        .join('');
    expect(styles('a')).toBe(styles('a'));
    const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(styles);
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });
});
