/**
 * Plan du bureau pour chaque phase : taille de la grille, salles et cloisons.
 * Le bureau s'agrandit à chaque levée de fonds (Garage → Seed → Série A → Licorne), puis
 * d'une annexe à chaque tour suivant (Série B, C, D) et d'une aile par filiale.
 *
 * Les cloisons occupent des cases entières (plus simple pour le pathfinding) ; les portes sont
 * des trous dans ces cloisons. Les murs extérieurs sont dessinés autour de la grille.
 */
import {
  ANNEXES,
  ANNEX_KINDS,
  VENTURES,
  hashString,
  officeDepthWithAnnexes,
  officeWidthWithWings,
  type AnnexKind,
  type Phase,
} from '@oss/shared';

export interface Cell {
  readonly x: number;
  readonly z: number;
}

export const ROOM_KINDS = [
  'open',
  'meeting',
  'kitchen',
  'lounge',
  'canteen',
  'incubator',
  ...ANNEX_KINDS,
] as const;
export type RoomKind = (typeof ROOM_KINDS)[number];

/** Nombre de décors de sol (`FLOOR_STYLES` dans render/office.ts) par type de pièce. */
export const ROOM_STYLES: Record<RoomKind, number> = {
  open: 4,
  meeting: 3,
  kitchen: 3,
  lounge: 3,
  canteen: 3,
  incubator: 3,
  arcade: 1,
  garden: 1,
  auditorium: 1,
};

export interface Room {
  readonly kind: RoomKind;
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  /**
   * Décor de la pièce (sol), tiré de la graine de la partie : d'une partie à l'autre, la
   * cuisine peut être en damier ou en terre cuite. 0 = décor d'origine.
   */
  readonly style?: number;
}

/** Objets fixes d'une annexe (bornes d'arcade, arbres, scène) : décor sur une case bloquée. */
export const FIXTURE_KINDS = [
  'arcade-cabinet',
  'pinball',
  'neon-sign',
  'tree',
  'planter',
  'bench',
  'fountain',
  'stage',
  'lectern',
  'speaker',
  'projection-screen',
] as const;
export type FixtureKind = (typeof FIXTURE_KINDS)[number];

export interface Fixture {
  readonly kind: FixtureKind;
  readonly x: number;
  readonly z: number;
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
  /** Décor fixe des annexes : ces cases sont bloquées comme des cloisons. */
  readonly fixtures?: readonly Fixture[];
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
    entrance: { x: 0, z: 5 },
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
/** Décor fixe d'une annexe, aligné contre sa cloison du fond (hors des portes). */
const ANNEX_FIXTURES: Record<AnnexKind, readonly FixtureKind[]> = {
  arcade: ['arcade-cabinet', 'arcade-cabinet', 'neon-sign', 'pinball', 'arcade-cabinet'],
  garden: ['tree', 'bench', 'fountain', 'planter', 'tree'],
  auditorium: ['speaker', 'stage', 'projection-screen', 'lectern', 'speaker'],
};

/** Portes d'une cloison horizontale : près des deux bords, décalées si une cloison les bouche. */
function annexDoors(width: number, blocked: (cell: Cell) => boolean, z: number): number[] {
  return [2, width - 4].map((x) => (blocked({ x, z: z - 1 }) ? Math.min(width - 2, x + 1) : x));
}

/** Petit hachage stable (graine + pièce) pour choisir un décor sans toucher au hasard du jeu. */
function roomStyle(seed: string, kind: RoomKind, index: number): number {
  if (!seed) return 0;
  return hashString(`${seed}#room#${kind}#${index}`) % ROOM_STYLES[kind];
}

/**
 * Plan du bureau. Chaque filiale fondée ajoute une aile « incubateur » à droite du bureau :
 * une cloison percée de deux portes, puis une salle de toute la profondeur. Chaque tour de
 * table à partir de la Série B ajoute une annexe à l'avant, sur toute la largeur : salle
 * d'arcade, puis jardin intérieur, puis auditorium, chacune avec son décor fixe.
 *
 * `seed` (facultatif) varie le décor de sol de chaque pièce d'une partie à l'autre.
 */
export function officeLayout(phase: Phase, wings = 0, annexes = 0, seed = ''): OfficeLayout {
  const base = LAYOUTS[phase];
  const count = Math.max(0, Math.min(wings, VENTURES.maxFounded));
  const annexCount = Math.max(0, Math.min(annexes, ANNEXES.max));
  const rooms: Room[] = [...base.rooms];
  const partitions: Cell[] = [...base.partitions];
  const fixtures: Fixture[] = [];
  const blocked = (cell: Cell) => partitions.some((p) => p.x === cell.x && p.z === cell.z);
  for (let i = 0; i < count; i++) {
    const wall = base.width + i * VENTURES.wingWidth;
    // Deux portes, décalées si la case voisine de l'autre côté est une cloison.
    const doors = [2, base.depth - 3].map((z) =>
      blocked({ x: wall - 1, z }) ? Math.min(base.depth - 1, z + 1) : z,
    );
    partitions.push(...wallZ(wall, 0, base.depth - 1, doors));
    rooms.push({
      kind: 'incubator',
      x: wall + 1,
      z: 0,
      width: VENTURES.wingWidth - 1,
      depth: base.depth,
    });
  }
  const width = officeWidthWithWings(base.width, count);
  for (let i = 0; i < annexCount; i++) {
    const kind = ANNEX_KINDS[i] ?? 'arcade';
    const wall = base.depth + i * ANNEXES.depth;
    const doors = annexDoors(width, blocked, wall);
    partitions.push(...wallX(wall, 0, width - 1, doors));
    rooms.push({ kind, x: 0, z: wall + 1, width, depth: ANNEXES.depth - 1 });
    // Décor fixe contre la cloison, une case sur deux, loin des portes.
    const slots: number[] = [];
    for (let x = 4; x <= width - 6; x += 2)
      if (doors.every((door) => Math.abs(door - x) > 1)) slots.push(x);
    const props = ANNEX_FIXTURES[kind];
    // Les objets se répartissent sur toute la largeur de la salle.
    props.forEach((fixture, index) => {
      const slot = slots[Math.floor(((index + 0.5) * slots.length) / props.length)];
      if (slot !== undefined && !fixtures.some((f) => f.x === slot && f.z === wall + 1))
        fixtures.push({ kind: fixture, x: slot, z: wall + 1 });
    });
  }
  if (count === 0 && annexCount === 0 && !seed) return base;
  return {
    ...base,
    width,
    depth: officeDepthWithAnnexes(base.depth, annexCount),
    maxTeam: base.maxTeam + count * VENTURES.teamPerWing + annexCount * ANNEXES.teamPerAnnex,
    rooms: rooms.map((room, index) => ({ ...room, style: roomStyle(seed, room.kind, index) })),
    partitions,
    fixtures,
  };
}

/** Cases bloquées par le décor fixe des annexes. */
export function fixtureCells(layout: OfficeLayout): readonly Cell[] {
  return layout.fixtures ?? [];
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

/** Plan du bureau d'un instantané : phase, ailes des filiales, annexes et décor des pièces. */
export function layoutOf(view: {
  readonly phase: Phase;
  readonly seed: string;
  readonly group: { readonly wings: number };
  readonly funding: { readonly annexes: number };
}): OfficeLayout {
  return officeLayout(view.phase, view.group.wings, view.funding.annexes, view.seed);
}
