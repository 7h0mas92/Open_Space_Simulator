import { ANNEXES, ANNEX_KINDS, PHASES } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildNavGrid } from '../../../src/ai/grid';
import { ANNEX_DECOR_PRIMITIVES } from '../../../src/render/annexDecor';
import { FLOOR_STYLES } from '../../../src/render/office';
import { checkPlacement } from '../../../src/view/placement';
import type { PlacedItemView } from '../../../src/view/types';
import {
  ROOM_KINDS,
  ROOM_STYLES,
  layoutOf,
  officeLayout,
  yieldToItems,
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

  it('le décor offert est dans son annexe, sans bloquer le plan lui-même', () => {
    const layout = officeLayout('SERIES_A', 0, 3);
    const fixtures = layout.fixtures ?? [];
    expect(fixtures.length).toBeGreaterThanOrEqual(ANNEXES.max * 4);
    expect(new Set(fixtures.map((fixture) => fixture.key)).size).toBe(fixtures.length);
    for (const fixture of fixtures) expect(ANNEX_KINDS).toContain(roomAt(layout, fixture)?.kind);
    // Ce sont des objets posés (voir l'adaptateur) : seuls eux bloquent la grille.
    const first = fixtures[0]!;
    expect(buildNavGrid(layout, []).walkable(first.x, first.z)).toBe(true);
    const placed = {
      id: 'annex:0-0',
      kind: first.kind,
      x: first.x,
      z: first.z,
      rotation: 0 as const,
    };
    expect(buildNavGrid(layout, [placed]).walkable(first.x, first.z)).toBe(false);
    expect(
      checkPlacement(layout, [{ ...placed, resale: 0, color: 'natural', host: null }], {
        kind: 'plant',
        x: first.x,
        z: first.z,
        rotation: 0,
      }),
    ).toBe('overlap');
  });

  it('chaque objet du décor des annexes a une forme distincte', () => {
    const signature = (build: () => THREE.Group) => {
      const group = build();
      const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
      return `${group.children.length}:${size.toArray().map((v) => v.toFixed(2))}`;
    };
    const shapes = Object.values(ANNEX_DECOR_PRIMITIVES).map(signature);
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

describe('Le plan cède la place aux meubles posés', () => {
  const view = (phase: (typeof PHASES)[number], wings: number, items: PlacedItemView[]) => ({
    phase,
    seed: 'graine',
    group: { wings },
    funding: { annexes: 2 },
    items,
  });
  const glass = (x: number, z: number): PlacedItemView =>
    ({
      id: `mur-${x}-${z}`,
      kind: 'glass-partition',
      x,
      z,
      rotation: 1,
      host: null,
    }) as PlacedItemView;
  const benchOf = (layout: OfficeLayout) => layout.fixtures?.find((f) => f.kind === 'bench');

  it('une aile de filiale ne pose plus le banc du jardin dans un mur vitré', () => {
    // Avec une filiale, la case est libre : le mur vitré y est accepté.
    const before = officeLayout('UNICORN', 1, 2, 'graine');
    const target = benchOf(officeLayout('UNICORN', 2, 2, 'graine'))!;
    expect(benchOf(before)).not.toEqual(target);
    const wall = glass(target.x, target.z);
    expect(checkPlacement(before, [], wall)).toBeNull();

    // Une deuxième filiale décale le décor : le banc tomberait dans le mur, il se pousse.
    const after = layoutOf(view('UNICORN', 2, [wall]));
    const bench = benchOf(after)!;
    expect(bench).toBeDefined();
    expect(bench).not.toMatchObject({ x: wall.x, z: wall.z });
    expect(bench.z).toBe(target.z);
    expect(after.partitions).toContainEqual({ x: bench.x, z: bench.z - 1 });
    for (const fixture of after.fixtures ?? [])
      expect({ x: fixture.x, z: fixture.z }).not.toEqual({ x: wall.x, z: wall.z });
    // Sa nouvelle case est bloquée comme avant.
    expect(checkPlacement(after, [wall], glass(bench.x, bench.z))).toBe('wall');
  });

  it('une nouvelle phase ne fait pas passer une cloison à travers un meuble', () => {
    const seed = officeLayout('SEED');
    const series = officeLayout('SERIES_A');
    const cell = series.partitions.find(
      (p) =>
        p.x < seed.width && p.z < seed.depth && checkPlacement(seed, [], glass(p.x, p.z)) === null,
    )!;
    expect(cell).toBeDefined();
    const after = yieldToItems(series, [glass(cell.x, cell.z)]);
    expect(after.partitions).not.toContainEqual(cell);
    expect(after.partitions).toHaveLength(series.partitions.length - 1);
  });

  it('sans conflit, le plan reste celui d’origine', () => {
    const layout = officeLayout('UNICORN', 1, 2, 'graine');
    expect(yieldToItems(layout, [])).toBe(layout);
    expect(yieldToItems(layout, [glass(3, 3)])).toBe(layout);
  });
});
