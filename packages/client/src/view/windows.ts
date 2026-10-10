/**
 * Fenêtres : objets du mode construction fixés dans un des deux murs du fond (les locaux n'en
 * ont aucune au départ). Rotation 0 : mur du fond, le long de x, sur la rangée z = 0.
 * Rotation 1 : mur de gauche, le long de z, sur la colonne x = 0. Le rendu perce le mur là où
 * une fenêtre est posée, et la ville se voit à travers.
 */
import { catalogItem } from './catalog';
import type { Cell, OfficeLayout } from './layout';
import type { PlacedItemView, Rotation } from './types';

/** 0 : mur du fond, 1 : mur de gauche (c'est aussi la rotation de la fenêtre). */
export type WallSide = 0 | 1;

/** Une fenêtre vue depuis le mur : où elle commence et sur combien de cases. */
export interface WallOpening {
  readonly kind: string;
  readonly wall: WallSide;
  readonly start: number;
  readonly length: number;
  /** Baie vitrée du sol au plafond. */
  readonly full: boolean;
}

export function isWallItem(kind: string): boolean {
  return catalogItem(kind)?.wall === true;
}

/** Fenêtres posées, triées par mur puis par position. */
export function wallOpenings(items: readonly PlacedItemView[]): WallOpening[] {
  const openings: WallOpening[] = [];
  for (const item of items) {
    const def = catalogItem(item.kind);
    if (!def?.wall || (item.rotation !== 0 && item.rotation !== 1)) continue;
    openings.push({
      kind: item.kind,
      wall: item.rotation,
      start: item.rotation === 0 ? item.x : item.z,
      length: def.size[0],
      full: item.kind === 'glass-wall',
    });
  }
  return openings.sort((a, b) => a.wall - b.wall || a.start - b.start);
}

/** Longueur d'un mur, en cases. */
export function wallLength(layout: OfficeLayout, wall: WallSide): number {
  return wall === 0 ? layout.width : layout.depth;
}

/** Mur le plus proche d'une case (le mur du fond en cas d'égalité). */
export function nearestWall(cell: Cell): WallSide {
  return cell.z <= cell.x ? 0 : 1;
}

/**
 * Accroche une fenêtre au mur `wall` : elle commence à la position de la case le long du mur,
 * sans dépasser du mur.
 */
export function snapToWall(
  layout: OfficeLayout,
  kind: string,
  cell: Cell,
  wall: WallSide,
): { readonly cell: Cell; readonly rotation: Rotation } {
  const length = catalogItem(kind)?.size[0] ?? 1;
  const along = wall === 0 ? cell.x : cell.z;
  const start = Math.max(0, Math.min(along, wallLength(layout, wall) - length));
  return { cell: wall === 0 ? { x: start, z: 0 } : { x: 0, z: start }, rotation: wall };
}

/**
 * Fenêtre visée à la souris ou au doigt : sur le mur le plus proche de la case, centrée sur
 * elle.
 */
export function aimWindow(
  layout: OfficeLayout,
  kind: string,
  cell: Cell,
): { readonly cell: Cell; readonly rotation: Rotation } {
  const wall = nearestWall(cell);
  const half = Math.floor(((catalogItem(kind)?.size[0] ?? 1) - 1) / 2);
  const centered = wall === 0 ? { x: cell.x - half, z: 0 } : { x: 0, z: cell.z - half };
  return snapToWall(layout, kind, centered, wall);
}
