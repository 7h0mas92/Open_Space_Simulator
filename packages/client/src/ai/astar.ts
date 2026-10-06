/**
 * Pathfinding A* sur la grille, en 8 directions, sans couper les coins.
 *
 * - Heuristique « octile » : exacte sur une grille 8 directions sans obstacle.
 * - `extraCost` permet l'évitement entre personnages : une case occupée coûte plus cher,
 *   le chemin la contourne si un détour raisonnable existe.
 */
import type { Cell } from '../view/layout';
import type { NavGrid } from './grid';

const SQRT2 = Math.SQRT2;

const DIRECTIONS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
] as const;

export function octile(a: Cell, b: Cell): number {
  const dx = Math.abs(a.x - b.x);
  const dz = Math.abs(a.z - b.z);
  return Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz);
}

/** File de priorité minimale (tas binaire) sur des indices de cases. */
export class MinHeap {
  private readonly nodes: { item: number; score: number }[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(item: number, score: number): void {
    const nodes = this.nodes;
    nodes.push({ item, score });
    let i = nodes.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.score(parent) <= this.score(i)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  /** Retire et renvoie l'élément de plus petit score (-1 si le tas est vide). */
  pop(): number {
    const nodes = this.nodes;
    const top = nodes[0];
    if (!top) return -1;
    this.swap(0, nodes.length - 1);
    nodes.pop();
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < nodes.length && this.score(left) < this.score(smallest)) smallest = left;
      if (right < nodes.length && this.score(right) < this.score(smallest)) smallest = right;
      if (smallest === i) return top.item;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private score(index: number): number {
    return this.nodes[index]?.score ?? Infinity;
  }

  private swap(a: number, b: number): void {
    const nodeA = this.nodes[a];
    const nodeB = this.nodes[b];
    if (!nodeA || !nodeB) return;
    this.nodes[a] = nodeB;
    this.nodes[b] = nodeA;
  }
}

export interface PathOptions {
  /** Coût supplémentaire pour entrer dans une case (évitement). */
  readonly extraCost?: (cell: Cell) => number;
  /** Garde-fou contre les recherches trop longues. */
  readonly maxIterations?: number;
}

/**
 * Chemin de `start` à `goal` (case de départ exclue, case d'arrivée incluse).
 * Renvoie `[]` si on est déjà arrivé, `null` si l'arrivée est inaccessible.
 */
export function findPath(
  grid: NavGrid,
  start: Cell,
  goal: Cell,
  options: PathOptions = {},
): Cell[] | null {
  if (start.x === goal.x && start.z === goal.z) return [];
  if (!grid.walkable(goal.x, goal.z)) return null;

  const width = grid.width;
  const total = width * grid.depth;
  const index = (x: number, z: number) => z * width + x;
  const gScore = new Float64Array(total).fill(Infinity);
  const cameFrom = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const open = new MinHeap();
  const startIndex = index(start.x, start.z);
  const goalIndex = index(goal.x, goal.z);
  const maxIterations = options.maxIterations ?? total * 8;

  gScore[startIndex] = 0;
  open.push(startIndex, octile(start, goal));

  let iterations = 0;
  while (open.size > 0 && iterations++ < maxIterations) {
    const current = open.pop();
    if (current === goalIndex) break;
    if (closed[current]) continue;
    closed[current] = 1;
    const cx = current % width;
    const cz = (current - cx) / width;

    for (const [dx, dz, cost] of DIRECTIONS) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (!grid.walkable(nx, nz)) continue;
      // Pas de diagonale qui frôle un obstacle : le personnage traverserait un coin de meuble.
      if (dx !== 0 && dz !== 0 && (!grid.walkable(cx + dx, cz) || !grid.walkable(cx, cz + dz))) {
        continue;
      }
      const next = index(nx, nz);
      if (closed[next]) continue;
      const cell = { x: nx, z: nz };
      const tentative = (gScore[current] ?? Infinity) + cost + (options.extraCost?.(cell) ?? 0);
      if (tentative < (gScore[next] ?? Infinity)) {
        gScore[next] = tentative;
        cameFrom[next] = current;
        open.push(next, tentative + octile(cell, goal));
      }
    }
  }

  if (cameFrom[goalIndex] === -1) return null;
  const path: Cell[] = [];
  for (let at = goalIndex; at !== startIndex && at !== -1; at = cameFrom[at] ?? -1) {
    const x = at % width;
    path.push({ x, z: (at - x) / width });
  }
  return path.reverse();
}
