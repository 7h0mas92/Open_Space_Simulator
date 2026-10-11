import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  buildPartitions,
  partitionCells,
  partitionShapes,
  PARTITION_THICKNESS,
  type PartitionCell,
  type PartitionSegment,
} from '../../../src/render/partitions';
import { buildPrimitive } from '../../../src/render/primitives';
import { CATALOG } from '../../../src/view/catalog';
import { officeLayout } from '../../../src/view/layout';
import type { PlacedItemView } from '../../../src/view/types';

const ROOM = { width: 10, depth: 10 };

const placed = (x: number, z: number, axis: 0 | 1, kind: 'solid' | 'glass' = 'solid') =>
  ({ x, z, kind, axis, color: 'natural' }) satisfies PartitionCell;
const planned = (x: number, z: number) =>
  ({ x, z, kind: 'solid', axis: null, color: 'natural' }) satisfies PartitionCell;

/** Étendue d'un tronçon le long de x et de z. */
function extent(segment: PartitionSegment) {
  const half = PARTITION_THICKNESS / 2;
  const along = [segment.from, segment.to] as const;
  const across = [segment.at - half, segment.at + half] as const;
  return segment.axis === 0 ? { x: along, z: across } : { x: across, z: along };
}

/** Le point (x, z) est-il couvert par un des tronçons ? */
function covered(segments: readonly PartitionSegment[], x: number, z: number): boolean {
  return segments.some((segment) => {
    const box = extent(segment);
    return (
      x >= box.x[0] - 1e-6 && x <= box.x[1] + 1e-6 && z >= box.z[0] - 1e-6 && z <= box.z[1] + 1e-6
    );
  });
}

describe('murs fins : raccords', () => {
  it('deux murs alignés se touchent au bord de leurs cases, sans jour entre eux', () => {
    const shapes = partitionShapes([placed(3, 3, 0), placed(4, 3, 0)], ROOM);
    const segments = shapes.flatMap((shape) => shape.segments);
    // Tout le long de la ligne, de 2,5 à 4,5, il y a du mur.
    for (let x = 2.5; x <= 4.5; x += 0.05) expect(covered(segments, x, 3), `x=${x}`).toBe(true);
  });

  it('un angle se ferme : le mur vertical rejoint le mur horizontal', () => {
    const shapes = partitionShapes([placed(3, 3, 0), placed(3, 4, 1)], ROOM);
    const corner = shapes.find((shape) => shape.cell.z === 3);
    expect(corner?.junction).toBe(true);
    const segments = shapes.flatMap((shape) => shape.segments);
    for (let z = 3; z <= 4.5; z += 0.05) expect(covered(segments, 3, z), `z=${z}`).toBe(true);
  });

  it('deux murs parallèles côte à côte ne sont pas reliés par une traverse', () => {
    const shapes = partitionShapes([placed(3, 3, 0), placed(3, 4, 0)], ROOM);
    for (const shape of shapes) {
      expect(shape.junction).toBe(false);
      expect(shape.segments.every((segment) => segment.axis === 0)).toBe(true);
    }
  });

  it('une cloison du plan prend le sens de ses voisines et rejoint un mur posé contre elle', () => {
    const cells = [planned(5, 2), planned(5, 3), planned(5, 4), placed(4, 3, 0)];
    const shapes = partitionShapes(cells, ROOM);
    const middle = shapes.find((shape) => shape.cell.x === 5 && shape.cell.z === 3);
    expect(middle?.junction).toBe(true);
    const segments = shapes.flatMap((shape) => shape.segments);
    for (let x = 3.5; x <= 5; x += 0.05) expect(covered(segments, x, 3), `x=${x}`).toBe(true);
    for (let z = 1.5; z <= 4.5; z += 0.05) expect(covered(segments, 5, z), `z=${z}`).toBe(true);
  });

  it('un mur qui touche le mur du fond s’y enfonce : aucune fente au raccord', () => {
    const [shape] = partitionShapes([placed(4, 0, 1)], ROOM);
    const segment = shape?.segments[0];
    expect(segment?.from).toBeLessThan(-0.5);
  });

  it('chaque cloison du plan de la Série A touche ses voisines, sans jour', () => {
    const layout = officeLayout('SERIES_A');
    const shapes = partitionShapes(partitionCells(layout, []), layout);
    const segments = shapes.flatMap((shape) => shape.segments);
    const cells = new Set(layout.partitions.map((cell) => `${cell.x},${cell.z}`));
    for (const cell of layout.partitions) {
      for (const [dx, dz] of [
        [1, 0],
        [0, 1],
      ] as const) {
        if (!cells.has(`${cell.x + dx},${cell.z + dz}`)) continue;
        // Le milieu de la frontière entre deux cloisons voisines est couvert.
        expect(covered(segments, cell.x + dx / 2, cell.z + dz / 2), `${cell.x},${cell.z}`).toBe(
          true,
        );
      }
    }
  });
});

describe('murs fins : objets du mode construction', () => {
  it('le mur fin et le mur fin vitré sont au rayon Cloisons, repeignables', () => {
    for (const [kind, partition] of [
      ['thin-wall', 'solid'],
      ['glass-partition', 'glass'],
    ] as const) {
      const item = CATALOG.find((entry) => entry.kind === kind);
      expect(item?.category).toBe('partition');
      expect(item?.partition).toBe(partition);
      expect(item?.size).toEqual([1, 1]);
      expect(item?.paint.length).toBeGreaterThan(0);
    }
  });

  it('les murs posés rejoignent les cloisons du plan, avec leur couleur', () => {
    const layout = officeLayout('SEED');
    const items: PlacedItemView[] = [
      {
        id: 'w',
        kind: 'glass-partition',
        x: 2,
        z: 3,
        rotation: 1,
        resale: 0,
        color: 'blue',
        host: null,
      },
      { id: 'p', kind: 'plant', x: 4, z: 4, rotation: 0, resale: 0, color: 'natural', host: null },
    ];
    const cells = partitionCells(layout, items);
    expect(cells).toHaveLength(layout.partitions.length + 1);
    expect(cells.at(-1)).toEqual({ x: 2, z: 3, kind: 'glass', axis: 1, color: 'blue' });
  });

  it('les formes de l’aperçu tiennent dans une case et montent jusqu’à leur hauteur', () => {
    for (const [model, height] of [
      ['thinWall', 1.3],
      ['glassPartition', 2.2],
    ] as const) {
      const box = new THREE.Box3().setFromObject(buildPrimitive(model));
      expect(box.max.x - box.min.x).toBeCloseTo(1, 2);
      expect(box.max.z - box.min.z).toBeLessThan(0.2);
      expect(box.max.y).toBeCloseTo(height, 2);
    }
  });

  it('tous les murs du bureau tiennent en quelques maillages', () => {
    const layout = officeLayout('UNICORN');
    const group = buildPartitions(partitionShapes(partitionCells(layout, []), layout));
    expect(group.children.length).toBeGreaterThan(0);
    expect(group.children.length).toBeLessThanOrEqual(4);
  });
});
