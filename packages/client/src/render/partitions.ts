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
import { COLOR_HEX, type FurnitureColor } from '../view/colors';
import {
  PARTITION_THICKNESS,
  type PartitionCell,
  type PartitionKind,
  type PartitionSegment,
  type PartitionShape,
} from '../view/partitions';
import { Pieces } from './pieces';
import { material, PALETTE, WALL_HEIGHT } from './primitives';

export {
  PARTITION_THICKNESS,
  partitionCells,
  partitionShapes,
  type PartitionAxis,
  type PartitionCell,
  type PartitionKind,
  type PartitionSegment,
  type PartitionShape,
} from '../view/partitions';

/** Hauteur des murs fins pleins : à mi-hauteur, on voit par-dessus depuis la caméra iso. */
export const PARTITION_HEIGHT = 1.3;
/** Épaisseur du cadre d'un mur vitré (le verre est plus fin). */
const FRAME_THICKNESS = 0.08;
const GLASS_THICKNESS = 0.025;
const RAIL = 0.07;
const MULLION = 0.04;

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
