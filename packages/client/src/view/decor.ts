/**
 * Où poser les décorations de saison et la table d'anniversaire.
 *
 * Ces objets sont purement décoratifs : ils ne sont pas dans la simulation, ne coûtent rien et
 * ne se vendent pas. Ils occupent pourtant des cases (les personnages les contournent), donc on
 * ne les pose que sur des cases libres, sans jamais couper le chemin vers un meuble utile.
 * Fonction pure : même bureau, mêmes thèmes ⇒ même plan.
 */
import type { DecorTheme } from '@oss/shared';
import { accessCell, buildNavGrid, NEIGHBORS_4, type NavGrid } from '../ai/grid';
import { roomAt, type Cell, type OfficeLayout, type RoomKind } from './layout';
import type { PlacedItemView } from './types';

/** Une décoration posée au sol : `index` choisit le modèle parmi ceux du thème. */
export interface FloorDecor {
  readonly theme: DecorTheme;
  readonly index: number;
  readonly cell: Cell;
}

/** La table d'anniversaire : deux cases, de `cell` à `cell.x + 1`. */
export interface PartySpot {
  readonly cell: Cell;
  /** Case devant la table, où l'on vient prendre du gâteau. */
  readonly access: Cell;
  /** Centre de la table (pour se tourner vers elle). */
  readonly center: { readonly x: number; readonly z: number };
}

export interface DecorPlan {
  readonly themes: readonly DecorTheme[];
  readonly floor: readonly FloorDecor[];
  readonly party: PartySpot | null;
  /** Cases occupées par les décorations et la table (obstacles pour les personnages). */
  readonly blocked: readonly Cell[];
}

/** Une décoration au sol toutes les `FLOOR_SPACING` cases le long des murs du fond. */
const FLOOR_SPACING = 3;
/** Salles où l'on préfère installer la table d'anniversaire, dans l'ordre. */
const PARTY_ROOMS: readonly RoomKind[] = ['canteen', 'kitchen', 'lounge', 'open'];

const key = (cell: Cell) => `${cell.x},${cell.z}`;

/** Nombre de cases utiles (accès aux meubles, entrée) encore atteignables depuis l'entrée. */
function reachableTargets(grid: NavGrid, layout: OfficeLayout, targets: readonly Cell[]): number {
  const start = grid.nearestWalkable(layout.entrance);
  if (!start) return 0;
  const seen = new Set<string>([key(start)]);
  const queue: Cell[] = [start];
  for (const cell of queue) {
    for (const [dx, dz] of NEIGHBORS_4) {
      const next = { x: cell.x + dx, z: cell.z + dz };
      if (!grid.walkable(next.x, next.z) || seen.has(key(next))) continue;
      seen.add(key(next));
      queue.push(next);
    }
  }
  return targets.filter((cell) => seen.has(key(cell))).length;
}

class Planner {
  private readonly taken = new Set<string>();
  private readonly blocked: Cell[] = [];
  private readonly targets: Cell[];
  private readonly reachable: number;

  constructor(
    private readonly layout: OfficeLayout,
    private readonly items: readonly PlacedItemView[],
  ) {
    this.targets = [layout.entrance, ...items.map((item) => accessCell(item))];
    for (const cell of layout.partitions) this.taken.add(key(cell));
    for (const target of this.targets) this.taken.add(key(target));
    // L'entrée et ses abords restent dégagés.
    for (const [dx, dz] of NEIGHBORS_4)
      this.taken.add(key({ x: layout.entrance.x + dx, z: layout.entrance.z + dz }));
    this.reachable = reachableTargets(this.grid([]), layout, this.targets);
  }

  /** Les cases sont-elles libres, et les bloquer laisse-t-il tout atteignable ? */
  tryBlock(cells: readonly Cell[]): boolean {
    const grid = this.grid([]);
    for (const cell of cells) {
      if (!grid.walkable(cell.x, cell.z) || this.taken.has(key(cell))) return false;
    }
    if (reachableTargets(this.grid(cells), this.layout, this.targets) < this.reachable)
      return false;
    for (const cell of cells) {
      this.taken.add(key(cell));
      this.blocked.push(cell);
    }
    return true;
  }

  /** Réserve une case sans la bloquer (devant la table d'anniversaire). */
  keepFree(cell: Cell): void {
    this.taken.add(key(cell));
  }

  get cells(): readonly Cell[] {
    return this.blocked;
  }

  private grid(extra: readonly Cell[]): NavGrid {
    const grid = buildNavGrid(this.layout, this.items);
    for (const cell of [...this.blocked, ...extra]) grid.block(cell.x, cell.z);
    return grid;
  }
}

function placeParty(planner: Planner, layout: OfficeLayout): PartySpot | null {
  for (const kind of PARTY_ROOMS) {
    for (const room of layout.rooms.filter((r) => r.kind === kind)) {
      // Pas contre le mur du fond (on voit la table de face) ; on y accède par l'avant.
      for (let z = room.z + 1; z <= room.z + room.depth - 2; z++) {
        for (let x = room.x; x <= room.x + room.width - 2; x++) {
          const cells = [
            { x, z },
            { x: x + 1, z },
          ];
          if (cells.some((cell) => roomAt(layout, cell)?.kind !== kind)) continue;
          const access = { x, z: z + 1 };
          if (!planner.tryBlock(cells)) continue;
          planner.keepFree(access);
          return { cell: { x, z }, access, center: { x: x + 0.5, z } };
        }
      }
    }
  }
  return null;
}

/** Cases candidates le long des murs du fond (là où l'on voit le mieux depuis la caméra). */
function wallCells(layout: OfficeLayout): Cell[] {
  const cells: Cell[] = [];
  for (let x = 1; x < layout.width; x += FLOOR_SPACING) cells.push({ x, z: 0 });
  for (let z = FLOOR_SPACING; z < layout.depth - 1; z += FLOOR_SPACING) cells.push({ x: 0, z });
  // Coins des autres salles (cuisine, réunion…), contre leur cloison du fond.
  for (const room of layout.rooms) {
    if (room.kind === 'open') continue;
    cells.push({ x: room.x + room.width - 1, z: room.z });
  }
  return cells;
}

/**
 * Plan des décorations : la table d'anniversaire d'abord (si c'est un jour de fête), puis les
 * décorations au sol, réparties à tour de rôle entre les thèmes actifs.
 */
export function planDecor(
  layout: OfficeLayout,
  items: readonly PlacedItemView[],
  themes: readonly DecorTheme[],
  birthday: boolean,
  floorModels: (theme: DecorTheme) => number,
): DecorPlan {
  const planner = new Planner(layout, items);
  const party = birthday ? placeParty(planner, layout) : null;
  const floor: FloorDecor[] = [];
  if (themes.length > 0) {
    const used = new Map<DecorTheme, number>();
    let turn = 0;
    for (const cell of wallCells(layout)) {
      const theme = themes[turn % themes.length];
      if (!theme || !planner.tryBlock([cell])) continue;
      const index = used.get(theme) ?? 0;
      used.set(theme, index + 1);
      floor.push({ theme, index: index % Math.max(1, floorModels(theme)), cell });
      turn++;
    }
  }
  return { themes, floor, party, blocked: planner.cells };
}

/** Clé de cache d'un plan : on ne reconstruit le décor que si elle change. */
export function decorKey(
  layout: OfficeLayout,
  items: readonly PlacedItemView[],
  themes: readonly DecorTheme[],
  birthday: boolean,
): string {
  const placed = items.map((i) => `${i.id}:${i.kind}:${i.x}:${i.z}:${i.rotation}`).join('|');
  return `${layout.phase}#${themes.join(',')}#${birthday ? 1 : 0}#${placed}`;
}
