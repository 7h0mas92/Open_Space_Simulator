/**
 * Grille de navigation : quelles cases sont praticables.
 * Construite à partir du plan du bureau (cloisons) et des objets posés.
 */
import { catalogItem, footprint } from '../view/catalog';
import { fixtureCells, type Cell, type OfficeLayout } from '../view/layout';
import type { PlacedItemView } from '../view/types';

/** Ce qu'il faut savoir d'un objet pour connaître son emprise au sol. */
export type ItemPlacement = Pick<PlacedItemView, 'id' | 'kind' | 'x' | 'z' | 'rotation'>;

/** Objets qu'on peut traverser (tapis, casque posé sur un bureau…). */
const WALKABLE_KINDS = new Set(['rug', 'noise-headsets']);

export const NEIGHBORS_4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export class NavGrid {
  private readonly blocked: Uint8Array;

  constructor(
    readonly width: number,
    readonly depth: number,
  ) {
    this.blocked = new Uint8Array(width * depth);
  }

  inside(x: number, z: number): boolean {
    return x >= 0 && z >= 0 && x < this.width && z < this.depth;
  }

  walkable(x: number, z: number): boolean {
    return this.inside(x, z) && this.blocked[z * this.width + x] === 0;
  }

  block(x: number, z: number): void {
    if (this.inside(x, z)) this.blocked[z * this.width + x] = 1;
  }

  /** Case praticable et libre la plus proche (parcours en largeur), ou `null`. */
  nearestWalkable(from: Cell, isFree: (cell: Cell) => boolean = () => true): Cell | null {
    const seen = new Uint8Array(this.width * this.depth);
    const queue: Cell[] = [from];
    if (this.inside(from.x, from.z)) seen[from.z * this.width + from.x] = 1;
    for (const cell of queue) {
      if (this.walkable(cell.x, cell.z) && isFree(cell)) return cell;
      for (const [dx, dz] of NEIGHBORS_4) {
        const x = cell.x + dx;
        const z = cell.z + dz;
        if (!this.inside(x, z) || seen[z * this.width + x]) continue;
        seen[z * this.width + x] = 1;
        queue.push({ x, z });
      }
    }
    return null;
  }
}

/** Cases couvertes par un objet posé. */
export function itemCells(item: ItemPlacement): Cell[] {
  const def = catalogItem(item.kind);
  const [w, d] = def ? footprint(def, item.rotation) : [1, 1];
  const cells: Cell[] = [];
  for (let dx = 0; dx < w; dx++) {
    for (let dz = 0; dz < d; dz++) cells.push({ x: item.x + dx, z: item.z + dz });
  }
  return cells;
}

/** Direction « avant » d'un objet selon sa rotation (quart de tour anti-horaire vu du dessus). */
export function frontDirection(rotation: number): readonly [number, number] {
  const directions = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ] as const;
  return directions[((rotation % 4) + 4) % 4] ?? directions[0];
}

/** Case où se tient un personnage qui utilise l'objet : devant son milieu. */
export function accessCell(item: ItemPlacement): Cell {
  const def = catalogItem(item.kind);
  const [w, d] = def ? footprint(def, item.rotation) : [1, 1];
  const [fx, fz] = frontDirection(item.rotation);
  const midX = item.x + Math.floor((w - 1) / 2);
  const midZ = item.z + Math.floor((d - 1) / 2);
  if (fx === 0) return { x: midX, z: fz > 0 ? item.z + d : item.z - 1 };
  return { x: fx > 0 ? item.x + w : item.x - 1, z: midZ };
}

export function buildNavGrid(layout: OfficeLayout, items: readonly ItemPlacement[]): NavGrid {
  const grid = new NavGrid(layout.width, layout.depth);
  for (const cell of [...layout.partitions, ...fixtureCells(layout)]) grid.block(cell.x, cell.z);
  for (const item of items) {
    // Tapis et casques se traversent ; les accessoires sont posés sur les meubles et les
    // fenêtres sont dans les murs.
    const def = catalogItem(item.kind);
    if (WALKABLE_KINDS.has(item.kind) || def?.accessory || def?.wall) continue;
    for (const cell of itemCells(item)) grid.block(cell.x, cell.z);
  }
  return grid;
}
