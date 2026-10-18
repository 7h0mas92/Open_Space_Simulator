/**
 * Où poser les décorations de saison et la table d'anniversaire.
 *
 * Ces objets sont purement décoratifs : ils ne sont pas dans la simulation, ne coûtent rien et
 * ne se vendent pas. Ils occupent pourtant des cases (les personnages les contournent), donc on
 * ne les pose que sur des cases libres, sans jamais couper le chemin vers un meuble utile.
 * Fonction pure : même bureau, mêmes thèmes ⇒ même plan.
 */
import type { DecorTheme, MeetingFormatId } from '@oss/shared';
import { accessCell, buildNavGrid, NEIGHBORS_4, type NavGrid } from '../ai/grid';
import { roomAt, type Cell, type OfficeLayout, type Room, type RoomKind } from './layout';
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

/** Une place autour de la table de la salle de réunion, tournée vers son centre. */
export interface MeetingSeat {
  readonly cell: Cell;
  readonly center: { readonly x: number; readonly z: number };
}

/**
 * Aménagement de la salle de réunion : une table (rectangle de cases), des places autour et
 * des objets contre le mur du fond. Le rendu choisit les modèles selon la formule.
 */
export interface MeetingPlan {
  readonly format: MeetingFormatId;
  readonly room: Room;
  readonly table: {
    readonly x: number;
    readonly z: number;
    readonly width: number;
    readonly depth: number;
  };
  readonly seats: readonly MeetingSeat[];
  /** Cases contre le mur du fond, de gauche à droite, occupées par un objet. */
  readonly wall: readonly Cell[];
  /**
   * Écran de projection du Daily, au milieu du mur du fond (null si la salle est trop étroite) :
   * centre, rangée et largeur en cases. Le projecteur est suspendu au-dessus de la table.
   */
  readonly screen: { readonly x: number; readonly z: number; readonly cells: number } | null;
}

export interface DecorPlan {
  readonly themes: readonly DecorTheme[];
  readonly floor: readonly FloorDecor[];
  readonly party: PartySpot | null;
  readonly meeting: MeetingPlan | null;
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

  /** La case est-elle praticable, non réservée, et atteignable depuis l'entrée ? */
  canReach(cell: Cell): boolean {
    const grid = this.grid([]);
    if (!grid.walkable(cell.x, cell.z)) return false;
    return reachableTargets(grid, this.layout, [cell]) === 1;
  }

  isTaken(cell: Cell): boolean {
    return this.taken.has(key(cell));
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

/** Places autour de la table au plus : au-delà, les participants restent debout à côté. */
const MAX_MEETING_SEATS = 14;
/** Objets contre le mur du fond de la salle, selon la formule (la war room en est tapissée). */
const MEETING_WALL_PROPS: Record<MeetingFormatId, number> = {
  standup: 2,
  brainstorm: 3,
  aquarium: 2,
  zen: 3,
  'war-room': 9,
  boardroom: 3,
};

/**
 * Meuble la salle de réunion : la table au milieu, des objets contre le mur du fond (sauf devant
 * une porte), puis les places libres et atteignables autour de la table. Si le joueur a posé ses
 * propres meubles dans la salle, la table se réduit ou disparaît : on ne bloque jamais un chemin.
 */
function placeMeeting(
  planner: Planner,
  layout: OfficeLayout,
  format: MeetingFormatId,
): MeetingPlan | null {
  const room = layout.rooms.find((r) => r.kind === 'meeting');
  if (!room) return null;
  const width = room.width <= 3 ? 1 : room.width - 4;
  const depth = room.depth >= 4 ? 2 : 1;
  const tableX = room.x + Math.floor((room.width - width) / 2);
  const tableZ = room.z + 1 + (room.depth >= 5 ? 1 : 0);
  // Une table plus courte si la grande ne tient pas (meubles du joueur dans la salle).
  let table: MeetingPlan['table'] | null = null;
  for (let w = width; w >= 1 && !table; w--) {
    const x = tableX + Math.floor((width - w) / 2);
    const cells: Cell[] = [];
    for (let dz = 0; dz < depth; dz++)
      for (let dx = 0; dx < w; dx++) cells.push({ x: x + dx, z: tableZ + dz });
    if (planner.tryBlock(cells)) table = { x, z: tableZ, width: w, depth };
  }
  if (!table) return null;
  const center = { x: table.x + (table.width - 1) / 2, z: table.z + (table.depth - 1) / 2 };
  const inRoom = (cell: Cell) => roomAt(layout, cell) === room;

  // Mur du fond : pas devant une porte (une case voisine hors de la salle et sans cloison).
  const opening = (cell: Cell) =>
    NEIGHBORS_4.some(([dx, dz]) => {
      const next = { x: cell.x + dx, z: cell.z + dz };
      if (next.x < 0 || next.z < 0 || next.x >= layout.width || next.z >= layout.depth)
        return false;
      if (inRoom(next)) return false;
      return !layout.partitions.some((p) => p.x === next.x && p.z === next.z);
    });
  // L'écran du Daily d'abord, au milieu du mur du fond : les objets se rangent de part et d'autre.
  let screen: MeetingPlan['screen'] = null;
  const screenCells = room.width >= 6 ? 3 : 2;
  if (room.width >= 3) {
    // Au milieu si possible, sinon le plus près du milieu (pas devant une porte).
    const center = room.x + Math.floor((room.width - screenCells) / 2);
    const starts: number[] = [];
    for (let x = room.x; x + screenCells <= room.x + room.width; x++) starts.push(x);
    starts.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    for (const startX of starts) {
      const cells: Cell[] = [];
      for (let dx = 0; dx < screenCells; dx++) cells.push({ x: startX + dx, z: room.z });
      if (cells.some(opening) || !planner.tryBlock(cells)) continue;
      screen = { x: startX + (screenCells - 1) / 2, z: room.z, cells: screenCells };
      break;
    }
  }
  // Les coins d'abord, puis le milieu (sauf derrière l'écran), puis le reste.
  const middle = room.x + Math.floor((room.width - 1) / 2);
  const order = [room.x, room.x + room.width - 1, middle];
  for (let x = room.x; x < room.x + room.width; x++) if (!order.includes(x)) order.push(x);
  const wall: Cell[] = [];
  for (const x of order) {
    const cell = { x, z: room.z };
    if (wall.length >= MEETING_WALL_PROPS[format] || opening(cell)) continue;
    if (planner.tryBlock([cell])) wall.push(cell);
  }
  wall.sort((a, b) => a.x - b.x);

  // Places : les cases voisines de la table, dans la salle, encore libres et atteignables.
  const seats: MeetingSeat[] = [];
  const seen = new Set<string>();
  for (let z = table.z - 1; z <= table.z + table.depth; z++) {
    for (let x = table.x - 1; x <= table.x + table.width; x++) {
      const inside =
        x >= table.x && x < table.x + table.width && z >= table.z && z < table.z + table.depth;
      const corner =
        (x === table.x - 1 || x === table.x + table.width) &&
        (z === table.z - 1 || z === table.z + table.depth);
      const cell = { x, z };
      if (inside || corner || !inRoom(cell) || seen.has(key(cell))) continue;
      seen.add(key(cell));
      if (planner.isTaken(cell) || !planner.canReach(cell)) continue;
      if (seats.length < MAX_MEETING_SEATS) seats.push({ cell, center });
    }
  }
  for (const seat of seats) planner.keepFree(seat.cell);
  return { format, room, table, seats, wall, screen };
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
  meetingFormat: MeetingFormatId | null = null,
): DecorPlan {
  const planner = new Planner(layout, items);
  // La salle de réunion d'abord : ses meubles font partie du bureau, pas de la fête.
  const meeting = meetingFormat ? placeMeeting(planner, layout, meetingFormat) : null;
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
  return { themes, floor, party, meeting, blocked: planner.cells };
}

/** Clé de cache d'un plan : on ne reconstruit le décor que si elle change. */
export function decorKey(
  layout: OfficeLayout,
  items: readonly PlacedItemView[],
  themes: readonly DecorTheme[],
  birthday: boolean,
  meetingFormat: MeetingFormatId | null = null,
): string {
  const placed = items.map((i) => `${i.id}:${i.kind}:${i.x}:${i.z}:${i.rotation}`).join('|');
  return `${layout.phase}:${layout.width}#${themes.join(',')}#${birthday ? 1 : 0}#${meetingFormat ?? '-'}#${placed}`;
}
