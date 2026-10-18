/**
 * Géométrie des murs fins : les cloisons du plan et les murs posés par le joueur.
 *
 * Chaque mur occupe une case de la grille (il bloque le passage), mais il est dessiné comme un
 * mur fin qui passe au milieu de la case. Pour qu'il n'y ait jamais de jour entre deux murs, on
 * regarde les voisins de chaque case : un mur se prolonge jusqu'au bord de sa case du côté d'un
 * voisin qui va vers lui, et jusque dans le mur extérieur quand il le touche.
 *
 * Fonctions pures, sans Three.js : le rendu (`render/partitions.ts`) dessine ces tronçons, et le
 * placement (`view/placement.ts`) s'en sert pour laisser libre la demi-case de part et d'autre.
 */
import { catalogItem } from './catalog';
import type { FurnitureColor } from './colors';
import type { OfficeLayout } from './layout';
import type { PlacedItemView } from './types';

export type PartitionKind = 'solid' | 'glass';
/** Sens d'un mur : 0 le long de x, 1 le long de z. */
export type PartitionAxis = 0 | 1;

/** Épaisseur d'un mur fin plein. */
export const PARTITION_THICKNESS = 0.12;
/** Un mur qui touche le mur extérieur s'y enfonce un peu : pas de fente au raccord. */
const OUTER_REACH = 0.1;

/** Une case de mur fin. */
export interface PartitionCell {
  readonly x: number;
  readonly z: number;
  readonly kind: PartitionKind;
  /** Sens choisi par le joueur ; `null` pour une cloison du plan (déduit de ses voisines). */
  readonly axis: PartitionAxis | null;
  readonly color: FurnitureColor;
}

/** Un tronçon droit : de `from` à `to` le long de son axe, à la position `at` de l'autre axe. */
export interface PartitionSegment {
  readonly axis: PartitionAxis;
  readonly from: number;
  readonly to: number;
  readonly at: number;
}

/** Forme d'une case : ses tronçons, et s'il s'agit d'un raccord (angle, T, croix). */
export interface PartitionShape {
  readonly cell: PartitionCell;
  readonly segments: readonly PartitionSegment[];
  readonly junction: boolean;
}

/** Cloisons du plan et murs fins posés par le joueur. */
export function partitionCells(
  layout: OfficeLayout,
  items: readonly PlacedItemView[],
): PartitionCell[] {
  const cells: PartitionCell[] = layout.partitions.map((cell) => ({
    x: cell.x,
    z: cell.z,
    kind: 'solid',
    axis: null,
    color: 'natural',
  }));
  for (const item of items) {
    const kind = catalogItem(item.kind)?.partition;
    if (!kind || item.host) continue;
    cells.push({
      x: item.x,
      z: item.z,
      kind,
      axis: (item.rotation % 2) as PartitionAxis,
      color: item.color,
    });
  }
  return cells;
}

const key = (x: number, z: number) => `${x},${z}`;

/** Les quatre voisins : sens de l'axe, et pas le long de cet axe. */
const SIDES = [
  { axis: 0, dx: 1, dz: 0 },
  { axis: 0, dx: -1, dz: 0 },
  { axis: 1, dx: 0, dz: 1 },
  { axis: 1, dx: 0, dz: -1 },
] as const;

/**
 * Tronçons de chaque case. Une case pousse un bras vers un côté si ce côté est dans son propre
 * sens, ou si la case voisine de ce côté est un mur qui va vers elle. Le sens d'une cloison du
 * plan est celui de ses voisines du plan (le long de x par défaut).
 */
export function partitionShapes(
  cells: readonly PartitionCell[],
  layout: Pick<OfficeLayout, 'width' | 'depth'>,
): PartitionShape[] {
  const byKey = new Map(cells.map((cell) => [key(cell.x, cell.z), cell]));
  const planned = (x: number, z: number) => byKey.get(key(x, z))?.axis === null;
  const axesOf = (cell: PartitionCell): ReadonlySet<PartitionAxis> => {
    if (cell.axis !== null) return new Set([cell.axis]);
    const axes = new Set<PartitionAxis>();
    for (const side of SIDES) if (planned(cell.x + side.dx, cell.z + side.dz)) axes.add(side.axis);
    return axes.size > 0 ? axes : new Set([0]);
  };
  const axes = new Map(cells.map((cell) => [cell, axesOf(cell)]));

  return cells.map((cell) => {
    const own = axes.get(cell) as ReadonlySet<PartitionAxis>;
    // Bras vers chaque côté : [+x, -x, +z, -z].
    const arms = SIDES.map((side) => {
      if (own.has(side.axis)) return true;
      const neighbour = byKey.get(key(cell.x + side.dx, cell.z + side.dz));
      return neighbour !== undefined && (axes.get(neighbour)?.has(side.axis) ?? false);
    });
    const [east, west, south, north] = arms;
    // Jusqu'au bord de la case, ou dans le mur extérieur au bord du bureau.
    const edge = (along: number, sign: 1 | -1, last: number) =>
      along + sign * 0.5 + (along === (sign > 0 ? last : 0) ? sign * OUTER_REACH : 0);
    const half = PARTITION_THICKNESS / 2;
    const segments: PartitionSegment[] = [];
    const hasX = east || west;
    if (hasX) {
      segments.push({
        axis: 0,
        from: west ? edge(cell.x, -1, layout.width - 1) : cell.x - half,
        to: east ? edge(cell.x, 1, layout.width - 1) : cell.x + half,
        at: cell.z,
      });
    }
    const zEdge = (sign: 1 | -1) => edge(cell.z, sign, layout.depth - 1);
    if (hasX) {
      // Le tronçon le long de x occupe déjà le centre : les bras le long de z partent de ses faces.
      if (north) segments.push({ axis: 1, from: zEdge(-1), to: cell.z - half, at: cell.x });
      if (south) segments.push({ axis: 1, from: cell.z + half, to: zEdge(1), at: cell.x });
    } else if (north || south) {
      segments.push({
        axis: 1,
        from: north ? zEdge(-1) : cell.z - half,
        to: south ? zEdge(1) : cell.z + half,
        at: cell.x,
      });
    }
    return { cell, segments, junction: Boolean(hasX && (north || south)) };
  });
}

/**
 * Le tronçon traverse-t-il l'emprise d'un objet (coordonnées de la scène) ? Longer le mur par un
 * bord est permis : un objet occupe la demi-case de part et d'autre d'un mur fin.
 */
export function segmentCrosses(
  bounds: {
    readonly minX: number;
    readonly maxX: number;
    readonly minZ: number;
    readonly maxZ: number;
  },
  segment: PartitionSegment,
): boolean {
  // Une demi-épaisseur de marge : un meuble peut s'adosser au mur fin.
  const margin = 0.07;
  const [lowAlong, highAlong, lowAcross, highAcross] =
    segment.axis === 0
      ? [bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ]
      : [bounds.minZ, bounds.maxZ, bounds.minX, bounds.maxX];
  return (
    lowAcross < segment.at &&
    segment.at < highAcross &&
    lowAlong < segment.to - margin &&
    segment.from + margin < highAlong
  );
}
