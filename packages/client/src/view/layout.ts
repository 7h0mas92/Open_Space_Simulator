/**
 * Plan du bureau pour chaque phase : taille de la grille, salles et cloisons.
 * Le bureau s'agrandit à chaque levée de fonds (Garage → Seed → Série A → Licorne).
 *
 * Les cloisons occupent des cases entières (plus simple pour le pathfinding) ; les portes sont
 * des trous dans ces cloisons. Les murs extérieurs sont dessinés autour de la grille.
 */
import type { Phase } from '@oss/shared';

export interface Cell {
  readonly x: number;
  readonly z: number;
}

export const ROOM_KINDS = ['open', 'meeting', 'kitchen', 'lounge', 'canteen'] as const;
export type RoomKind = (typeof ROOM_KINDS)[number];

export interface Room {
  readonly kind: RoomKind;
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
}

export interface OfficeLayout {
  readonly phase: Phase;
  readonly width: number;
  readonly depth: number;
  /** Équipe maximale de la phase (rappel du cahier des charges). */
  readonly maxTeam: number;
  readonly rooms: readonly Room[];
  /** Cases occupées par une cloison intérieure. */
  readonly partitions: readonly Cell[];
  /** Case d'entrée : les personnages y apparaissent et y disparaissent. */
  readonly entrance: Cell;
}

/** Cloison horizontale (le long de x) avec des portes aux abscisses données. */
function wallX(z: number, fromX: number, toX: number, doors: readonly number[]): Cell[] {
  const cells: Cell[] = [];
  for (let x = fromX; x <= toX; x++) if (!doors.includes(x)) cells.push({ x, z });
  return cells;
}

/** Cloison verticale (le long de z) avec des portes aux profondeurs données. */
function wallZ(x: number, fromZ: number, toZ: number, doors: readonly number[]): Cell[] {
  const cells: Cell[] = [];
  for (let z = fromZ; z <= toZ; z++) if (!doors.includes(z)) cells.push({ x, z });
  return cells;
}

const UNICORN: OfficeLayout = {
  phase: 'UNICORN',
  width: 28,
  depth: 20,
  maxTeam: 30,
  rooms: [
    { kind: 'open', x: 0, z: 0, width: 18, depth: 20 },
    { kind: 'kitchen', x: 19, z: 0, width: 9, depth: 6 },
    { kind: 'meeting', x: 19, z: 7, width: 9, depth: 5 },
    { kind: 'canteen', x: 19, z: 13, width: 9, depth: 7 },
  ],
  partitions: [
    ...wallZ(18, 0, 19, [3, 9, 16]),
    ...wallX(6, 19, 27, [22]),
    ...wallX(12, 19, 27, [24]),
  ],
  entrance: { x: 0, z: 19 },
};

const LAYOUTS: Record<Phase, OfficeLayout> = {
  GARAGE: {
    phase: 'GARAGE',
    width: 8,
    depth: 6,
    maxTeam: 2,
    rooms: [{ kind: 'open', x: 0, z: 0, width: 8, depth: 6 }],
    partitions: [],
    entrance: { x: 7, z: 5 },
  },
  SEED: {
    phase: 'SEED',
    width: 14,
    depth: 10,
    maxTeam: 6,
    rooms: [
      { kind: 'open', x: 0, z: 0, width: 10, depth: 10 },
      { kind: 'kitchen', x: 11, z: 0, width: 3, depth: 5 },
      { kind: 'meeting', x: 11, z: 6, width: 3, depth: 4 },
    ],
    partitions: [...wallZ(10, 0, 9, [2, 7]), ...wallX(5, 11, 13, [])],
    entrance: { x: 0, z: 9 },
  },
  SERIES_A: {
    phase: 'SERIES_A',
    width: 20,
    depth: 14,
    maxTeam: 15,
    rooms: [
      { kind: 'open', x: 0, z: 0, width: 13, depth: 14 },
      { kind: 'kitchen', x: 14, z: 0, width: 6, depth: 5 },
      { kind: 'meeting', x: 14, z: 6, width: 6, depth: 4 },
      { kind: 'lounge', x: 14, z: 11, width: 6, depth: 3 },
    ],
    partitions: [
      ...wallZ(13, 0, 13, [2, 8, 12]),
      ...wallX(5, 14, 19, [16]),
      ...wallX(10, 14, 19, [17]),
    ],
    entrance: { x: 0, z: 13 },
  },
  UNICORN,
  // La phase finale garde le décor de la Licorne.
  END: { ...UNICORN, phase: 'END' },
};
export function officeLayout(phase: Phase): OfficeLayout {
  return LAYOUTS[phase];
}

export function roomAt(layout: OfficeLayout, cell: Cell): Room | undefined {
  // Les salles fermées sont listées après l'open space : on cherche depuis la fin.
  for (const room of [...layout.rooms].reverse()) {
    if (
      cell.x >= room.x &&
      cell.x < room.x + room.width &&
      cell.z >= room.z &&
      cell.z < room.z + room.depth
    ) {
      return room;
    }
  }
  return undefined;
}
