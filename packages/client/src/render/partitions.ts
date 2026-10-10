/**
 * Murs fins : les cloisons du plan (entre l'open space, la cuisine, les salles…) et les murs que
 * le joueur pose lui-même, pleins ou vitrés.
 *
 * Chaque mur occupe une case de la grille (il bloque le passage), mais il est dessiné comme un
 * mur fin qui passe au milieu de la case. Pour qu'il n'y ait jamais de jour entre deux murs, on
 * regarde les voisins de chaque case : un mur se prolonge jusqu'au bord de sa case du côté d'un
 * voisin qui va vers lui, et jusque dans le mur extérieur quand il le touche. Les angles, les
 * T et les croix se raccordent donc d'eux-mêmes.
 *
 * Toutes les pièces sont fusionnées par matériau : quelques appels de dessin pour tout le bureau.
 */
import * as THREE from 'three';
import { catalogItem } from '../view/catalog';
import { COLOR_HEX, type FurnitureColor } from '../view/colors';
import type { OfficeLayout } from '../view/layout';
import type { PlacedItemView } from '../view/types';
import { Pieces } from './pieces';
import { material, PALETTE, WALL_HEIGHT } from './primitives';

export type PartitionKind = 'solid' | 'glass';
/** Sens d'un mur : 0 le long de x, 1 le long de z. */
export type PartitionAxis = 0 | 1;

/** Hauteur des murs fins pleins : à mi-hauteur, on voit par-dessus depuis la caméra iso. */
export const PARTITION_HEIGHT = 1.3;
/** Épaisseur d'un mur fin plein. */
export const PARTITION_THICKNESS = 0.12;
/** Épaisseur du cadre d'un mur vitré (le verre est plus fin). */
const FRAME_THICKNESS = 0.08;
const GLASS_THICKNESS = 0.025;
const RAIL = 0.07;
const MULLION = 0.04;
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

/** Teinte choisie par le joueur, ou la couleur d'origine. */
function tinted(base: number, color: FurnitureColor): number {
  return color === 'natural' ? base : COLOR_HEX[color];
}

/** Verre des murs vitrés intérieurs : à peine teinté, on voit à travers. */
export const partitionGlass = new THREE.MeshStandardMaterial({
  color: 0xcfe9f5,
  roughness: 0.05,
  metalness: 0.1,
  transparent: true,
  opacity: 0.24,
  depthWrite: false,
  side: THREE.DoubleSide,
});
partitionGlass.name = 'partitionGlass';

/** Boîte d'un tronçon : longueur le long de son axe, largeur `width` en travers. */
function segmentBox(
  pieces: Pieces,
  segment: PartitionSegment,
  width: number,
  height: number,
  y: number,
  mat: number | THREE.Material,
  from = segment.from,
  to = segment.to,
): void {
  const length = to - from;
  if (length <= 0.001) return;
  const middle = (from + to) / 2;
  if (segment.axis === 0) pieces.box(length, height, width, mat, [middle, y, segment.at]);
  else pieces.box(width, height, length, mat, [segment.at, y, middle]);
}

/** Mur plein : plâtre, plinthe sombre et chapeau en bois clair. */
function addSolid(pieces: Pieces, segment: PartitionSegment, color: FurnitureColor): void {
  const plaster = material(tinted(PALETTE.plaster, color));
  segmentBox(pieces, segment, PARTITION_THICKNESS, PARTITION_HEIGHT - 0.03, 0, plaster);
  segmentBox(pieces, segment, PARTITION_THICKNESS + 0.016, 0.08, 0, PALETTE.slate);
  segmentBox(
    pieces,
    segment,
    PARTITION_THICKNESS + 0.03,
    0.03,
    PARTITION_HEIGHT - 0.03,
    PALETTE.birch,
  );
}

/** Clé d'un bout de tronçon : son axe, sa ligne et sa position le long de l'axe. */
const endKey = (segment: PartitionSegment, end: number) =>
  `${segment.axis}:${segment.at}:${Math.round(end * 1000)}`;

/**
 * Bouts de tronçons vitrés partagés par deux tronçons alignés : la vitre continue d'une case à
 * l'autre, sans montant entre les deux.
 */
function sharedEnds(segments: readonly PartitionSegment[]): Set<string> {
  const seen = new Set<string>();
  const shared = new Set<string>();
  for (const segment of segments) {
    for (const end of [segment.from, segment.to]) {
      const id = endKey(segment, end);
      if (seen.has(id)) shared.add(id);
      seen.add(id);
    }
  }
  return shared;
}

/**
 * Vitrage de `bottom` à `top` : traverses en bas et en haut, verre entre les deux, et un montant
 * à chaque bout libre du tronçon (aucun là où la vitre continue dans la case voisine).
 */
function addGlass(
  pieces: Pieces,
  segment: PartitionSegment,
  frame: THREE.Material,
  bottom: number,
  top: number,
  shared: ReadonlySet<string> = new Set(),
): void {
  const height = top - bottom;
  segmentBox(pieces, segment, FRAME_THICKNESS, RAIL, bottom, frame);
  segmentBox(pieces, segment, FRAME_THICKNESS, RAIL, top - RAIL, frame);
  segmentBox(pieces, segment, GLASS_THICKNESS, height - 2 * RAIL, bottom + RAIL, partitionGlass);
  for (const end of [segment.from, segment.to]) {
    if (shared.has(endKey(segment, end))) continue;
    const at = Math.min(segment.to - MULLION / 2, Math.max(segment.from + MULLION / 2, end));
    segmentBox(
      pieces,
      segment,
      FRAME_THICKNESS,
      height,
      bottom,
      frame,
      at - MULLION / 2,
      at + MULLION / 2,
    );
  }
}

/** Poteau d'un raccord vitré (angle, T, croix), qui cache le croisement des vitres. */
function addPost(
  pieces: Pieces,
  cell: PartitionCell,
  frame: THREE.Material,
  bottom: number,
  top: number,
): void {
  pieces.box(FRAME_THICKNESS, top - bottom, FRAME_THICKNESS, frame, [cell.x, bottom, cell.z]);
}

function frameMaterial(color: FurnitureColor): THREE.Material {
  return material(tinted(PALETTE.metal, color));
}

/** Tous les murs fins du bureau, fusionnés par matériau. */
export function buildPartitions(shapes: readonly PartitionShape[]): THREE.Group {
  const pieces = new Pieces('all');
  const shared = sharedEnds(
    shapes.filter((shape) => shape.cell.kind === 'glass').flatMap((shape) => shape.segments),
  );
  for (const { cell, segments, junction } of shapes) {
    if (cell.kind === 'solid') {
      for (const segment of segments) addSolid(pieces, segment, cell.color);
      continue;
    }
    const frame = frameMaterial(cell.color);
    for (const segment of segments) addGlass(pieces, segment, frame, 0, WALL_HEIGHT, shared);
    if (junction) addPost(pieces, cell, frame, 0, WALL_HEIGHT);
  }
  const group = pieces.build('partitions');
  group.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = node.material !== partitionGlass;
      node.receiveShadow = true;
    }
  });
  return group;
}

/** Vitres posées sur des murs pleins (salle de réunion vitrée), jusqu'au plafond. */
export function buildGlassTops(
  shapes: readonly PartitionShape[],
  top = WALL_HEIGHT - 0.05,
): THREE.Group {
  const pieces = new Pieces('all');
  const frame = material(PALETTE.metal);
  const shared = sharedEnds(shapes.flatMap((shape) => shape.segments));
  for (const { cell, segments, junction } of shapes) {
    for (const segment of segments) addGlass(pieces, segment, frame, PARTITION_HEIGHT, top, shared);
    if (junction) addPost(pieces, cell, frame, PARTITION_HEIGHT, top);
  }
  return pieces.build('glass-tops');
}

/**
 * Un mur fin seul, sur une case, le long de x : aperçu du mode construction, vignette du
 * catalogue. Le plâtre (`plaster`) ou le cadre en aluminium (`metal`) gardent leur matériau nommé, pour être
 * repeints comme les autres objets.
 */
export function partitionPiece(kind: PartitionKind): THREE.Group {
  const pieces = new Pieces([kind === 'solid' ? PALETTE.plaster : PALETTE.metal]);
  const segment: PartitionSegment = { axis: 0, from: -0.5, to: 0.5, at: 0 };
  if (kind === 'solid') {
    segmentBox(pieces, segment, PARTITION_THICKNESS, PARTITION_HEIGHT - 0.03, 0, PALETTE.plaster);
    segmentBox(pieces, segment, PARTITION_THICKNESS + 0.016, 0.08, 0, PALETTE.slate);
    segmentBox(
      pieces,
      segment,
      PARTITION_THICKNESS + 0.03,
      0.03,
      PARTITION_HEIGHT - 0.03,
      PALETTE.birch,
    );
  } else {
    addGlass(pieces, segment, material(PALETTE.metal), 0, WALL_HEIGHT);
  }
  return pieces.build(kind === 'solid' ? 'thin-wall' : 'glass-partition');
}
