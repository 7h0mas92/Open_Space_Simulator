/**
 * Règles de placement du mode construction (dans la grille, hors cloisons, sans chevauchement)
 * et disponibilité des objets de la boutique.
 * Utilisé par l'aperçu dans la scène et avant d'envoyer une commande. La simulation reste juge
 * des bornes et des chevauchements ; les cloisons et l'entrée sont des contraintes du décor.
 */
import { PHASES } from '@oss/shared';
import {
  boundsOverlap,
  buildNavGrid,
  itemBounds,
  itemCells,
  NEIGHBORS_4,
  type ItemPlacement,
  type NavGrid,
} from '../ai/grid';
import { catalogItem, footprint, type CatalogItem } from './catalog';
import type { Cell, OfficeLayout } from './layout';
import {
  partitionCells,
  partitionShapes,
  segmentCrosses,
  type PartitionSegment,
} from './partitions';
import type { GameView, ItemHost, PlacedItemView, Rotation } from './types';
import { researchNeed } from './research';

export type PlacementError =
  | 'unknownItem'
  | 'outOfBounds'
  | 'wall'
  | 'overlap'
  | 'entrance'
  | 'noSurface'
  | 'surfaceFull'
  | 'noCounter'
  | 'noServerRoom'
  | 'noWall'
  | 'blocksPath';

export interface PlacementRequest {
  readonly kind: string;
  readonly x: number;
  readonly z: number;
  readonly rotation: Rotation;
  /** Objet déplacé : il ne se bloque pas lui-même. */
  readonly ignoreId?: string;
}

/**
 * Un objet peut-il se poser sur une demi-case ? Oui, sauf les fenêtres (fixées dans le mur) et
 * les murs fins (raccordés à leurs voisins case par case). Un accessoire suit son meuble.
 */
export function snapsToHalf(kind: string): boolean {
  const def = catalogItem(kind);
  return Boolean(def && !def.wall && !def.partition && !def.accessory);
}

/** Pas de la grille pour cet objet : une demi-case, ou une case entière. */
export function gridStep(kind: string): number {
  return snapsToHalf(kind) ? 0.5 : 1;
}

/** Position la plus proche sur la grille de cet objet. */
export function snapToGrid(kind: string, point: { readonly x: number; readonly z: number }): Cell {
  const step = gridStep(kind);
  return { x: Math.round(point.x / step) * step, z: Math.round(point.z / step) * step };
}

/** Tronçons des murs fins (plan et murs posés), mis en cache pour une même liste d'objets. */
const segmentCache = new WeakMap<
  readonly PlacedItemView[],
  { layout: OfficeLayout; segments: readonly PartitionSegment[] }
>();

function partitionSegments(
  layout: OfficeLayout,
  items: readonly PlacedItemView[],
): readonly PartitionSegment[] {
  const cached = segmentCache.get(items);
  if (cached?.layout === layout) return cached.segments;
  const segments = partitionShapes(partitionCells(layout, items), layout).flatMap(
    (shape) => shape.segments,
  );
  segmentCache.set(items, { layout, segments });
  return segments;
}

export function checkPlacement(
  layout: OfficeLayout,
  items: readonly PlacedItemView[],
  request: PlacementRequest,
): PlacementError | null {
  const def = catalogItem(request.kind);
  if (!def) return 'unknownItem';
  if (def.accessory) {
    const resolved = resolveAccessory(items, request);
    return 'error' in resolved ? resolved.error : null;
  }
  if (def.wall) return checkWallPlacement(layout, items, request);
  const [w, d] = footprint(def, request.rotation);
  if (
    request.x < 0 ||
    request.z < 0 ||
    request.x + w > layout.width ||
    request.z + d > layout.depth
  ) {
    return 'outOfBounds';
  }
  // Hors grille (une fenêtre ou un mur fin sur une demi-case) : refusé comme la simulation.
  const step = gridStep(request.kind);
  if (request.x % step !== 0 || request.z % step !== 0) return 'outOfBounds';
  const placement = { id: '', ...request };
  const bounds = itemBounds(placement);
  const cells = itemCells(placement);

  if (def.partition) {
    // Un mur fin occupe sa case : pas sur une autre cloison ni sur l'entrée, et ses tronçons
    // (raccords aux voisins compris) ne traversent aucun meuble.
    for (const cell of cells) {
      if (layout.partitions.some((p) => p.x === cell.x && p.z === cell.z)) return 'wall';
      if (cell.x === layout.entrance.x && cell.z === layout.entrance.z) return 'entrance';
    }
  } else {
    if (partitionSegments(layout, items).some((segment) => segmentCrosses(bounds, segment)))
      return 'wall';
    const entrance = itemBounds({ id: '', kind: '', ...layout.entrance, rotation: 0 });
    if (boundsOverlap(bounds, entrance)) return 'entrance';
  }
  const others = items.filter((other) => other.id !== request.ignoreId);
  const ownSegments = def.partition
    ? partitionShapes(
        partitionCells(layout, [
          ...others,
          { ...placement, resale: 0, color: 'natural', host: null },
        ]),
        layout,
      )
        .filter(({ cell }) => cell.x === request.x && cell.z === request.z)
        .flatMap((shape) => shape.segments)
    : [];
  // Même règle que la simulation : aucun chevauchement, tapis compris.
  for (const other of others) {
    const otherDef = catalogItem(other.kind);
    if (other.host || otherDef?.wall) continue;
    // Le plafond et le sol sont deux étages : un objet du plafond ne gêne que ceux du plafond.
    // Sauf un mur vitré, qui monte jusqu'au plafond.
    const fullHeight = otherDef?.partition === 'glass' || def.partition === 'glass';
    if ((otherDef?.ceiling ?? false) !== def.ceiling && !fullHeight) continue;
    const otherBounds = itemBounds(other);
    if (def.partition && !otherDef?.partition) {
      // On pose un mur fin : un meuble n'est gênant que s'il est sur le trait du mur.
      if (ownSegments.some((segment) => segmentCrosses(otherBounds, segment))) return 'overlap';
      continue;
    }
    // Un mur fin déjà posé est compté avec les cloisons ci-dessus.
    if (otherDef?.partition && !def.partition) continue;
    if (boundsOverlap(bounds, otherBounds)) return 'overlap';
  }
  if (def.partition && closesOff(layout, items, cells, request.ignoreId)) return 'blocksPath';
  return null;
}

/** Cases praticables atteignables depuis l'entrée. */
function reachableFromEntrance(grid: NavGrid, layout: OfficeLayout): Set<string> {
  const start = grid.nearestWalkable(layout.entrance);
  const seen = new Set<string>();
  if (!start) return seen;
  const queue: Cell[] = [start];
  seen.add(`${start.x},${start.z}`);
  for (const cell of queue) {
    for (const [dx, dz] of NEIGHBORS_4) {
      const x = cell.x + dx;
      const z = cell.z + dz;
      if (!grid.walkable(x, z) || seen.has(`${x},${z}`)) continue;
      seen.add(`${x},${z}`);
      queue.push({ x, z });
    }
  }
  return seen;
}

/**
 * Un mur fin ne doit enfermer aucune case : sinon un dev (ou un chat) ne pourrait plus
 * rejoindre son bureau. Vrai si, une fois le mur posé, des cases jusque-là atteignables depuis
 * l'entrée ne le sont plus (en dehors des cases du mur lui-même).
 */
function closesOff(
  layout: OfficeLayout,
  items: readonly PlacedItemView[],
  cells: readonly Cell[],
  ignoreId?: string,
): boolean {
  const others = items.filter((item) => item.id !== ignoreId);
  const grid = buildNavGrid(layout, others);
  const before = reachableFromEntrance(grid, layout);
  const covered = cells.filter((cell) => before.has(`${cell.x},${cell.z}`)).length;
  for (const cell of cells) grid.block(cell.x, cell.z);
  return reachableFromEntrance(grid, layout).size < before.size - covered;
}

/**
 * Une fenêtre se fixe contre le mur du fond (rotation 0, z = 0) ou le mur de gauche (rotation 1,
 * x = 0), sans dépasser du mur ni chevaucher une autre fenêtre du même mur. Le mobilier posé
 * devant ne la gêne pas.
 */
function checkWallPlacement(
  layout: OfficeLayout,
  items: readonly PlacedItemView[],
  request: PlacementRequest,
): PlacementError | null {
  const { rotation } = request;
  if (rotation === 0 ? request.z !== 0 : rotation !== 1 || request.x !== 0) return 'noWall';
  const cells = itemCells({ id: '', ...request });
  if (cells.some((cell) => cell.x >= layout.width || cell.z >= layout.depth || cell.x < 0))
    return 'outOfBounds';
  for (const other of items) {
    if (other.id === request.ignoreId || other.rotation !== rotation) continue;
    if (!catalogItem(other.kind)?.wall) continue;
    const otherCells = itemCells(other);
    if (cells.some((cell) => otherCells.some((o) => o.x === cell.x && o.z === cell.z)))
      return 'overlap';
  }
  return null;
}

/**
 * Position d'un emplacement d'accessoire dans le monde [x, hauteur, z] : le point `surface`
 * du catalogue, tourné avec le meuble (même convention que `itemMatrix` du rendu).
 */
export function slotPosition(
  host: ItemPlacement,
  slot: number,
): readonly [number, number, number] | null {
  const def = catalogItem(host.kind);
  const local = def?.surface?.[slot];
  if (!def || !local) return null;
  const [w, d] = footprint(def, host.rotation);
  const angle = (host.rotation * Math.PI) / 2;
  const cos = Math.round(Math.cos(angle));
  const sin = Math.round(Math.sin(angle));
  const [x, y, z] = local;
  return [host.x + (w - 1) / 2 + x * cos + z * sin, y, host.z + (d - 1) / 2 - x * sin + z * cos];
}

/**
 * Emplacements libres d'un meuble (celui de l'accessoire déplacé compte comme libre). Pour un
 * appareil électroménager, seulement les premiers, prévus pour lui (`applianceSlots`).
 */
export function freeSlots(
  items: readonly PlacedItemView[],
  host: PlacedItemView,
  ignoreId?: string,
  appliance = false,
): number[] {
  const def = catalogItem(host.kind);
  const count = appliance ? (def?.applianceSlots ?? 0) : (def?.surface?.length ?? 0);
  const used = new Set(
    items
      .filter((item) => item.host?.id === host.id && item.id !== ignoreId)
      .map((item) => item.host?.slot),
  );
  return Array.from({ length: count }, (_, slot) => slot).filter((slot) => !used.has(slot));
}

/**
 * Où poser un accessoire visé sur la case (x, z) : le meuble à plateau qui couvre la case, et
 * son emplacement libre le plus proche du centre de la case. Un appareil électroménager (`kind`)
 * demande un meuble de cuisine (ou un autre plateau prévu pour lui) ; le matériel serveur, une
 * salle des serveurs, qui n'accueille rien d'autre.
 */
export function resolveAccessory(
  items: readonly PlacedItemView[],
  request: Pick<PlacementRequest, 'x' | 'z' | 'ignoreId'> & { readonly kind?: string },
):
  | { readonly host: ItemHost }
  | { readonly error: 'noSurface' | 'surfaceFull' | 'noCounter' | 'noServerRoom' } {
  const def = request.kind ? catalogItem(request.kind) : undefined;
  const appliance = def?.appliance ?? false;
  const gear = Boolean(def?.serverGear);
  // Le meuble sous le point visé (bords compris : le point est souvent le centre d'une case).
  const host = items.find((item) => {
    if (item.host) return false;
    const bounds = itemBounds(item);
    return (
      request.x >= bounds.minX &&
      request.x <= bounds.maxX &&
      request.z >= bounds.minZ &&
      request.z <= bounds.maxZ
    );
  });
  const hostDef = host ? catalogItem(host.kind) : undefined;
  if (gear && !hostDef?.serverRoom) return { error: 'noServerRoom' };
  if (!host || !hostDef?.surface?.length || (hostDef.serverRoom && !gear))
    return { error: appliance ? 'noCounter' : 'noSurface' };
  if (appliance && hostDef.applianceSlots === 0) return { error: 'noCounter' };
  let best: ItemHost | null = null;
  let bestDistance = Infinity;
  for (const slot of freeSlots(items, host, request.ignoreId, appliance)) {
    const position = slotPosition(host, slot);
    if (!position) continue;
    const distance = (position[0] - request.x) ** 2 + (position[2] - request.z) ** 2;
    if (distance < bestDistance) {
      best = { id: host.id, slot };
      bestDistance = distance;
    }
  }
  return best ? { host: best } : { error: 'surfaceFull' };
}

/**
 * Place libre la plus proche de `from` pour l'objet demandé (recherche en anneaux de plus en
 * plus larges, par demi-case pour les objets qui s'y posent). Sert à poser l'aperçu à un endroit
 * valide dès qu'on choisit un objet. À distance égale, une case entière passe avant une
 * demi-case. `null` si le bureau n'a plus aucune place pour lui.
 */
export function nearestValidCell(
  layout: OfficeLayout,
  items: readonly PlacedItemView[],
  request: Omit<PlacementRequest, 'x' | 'z'>,
  from: Cell,
): Cell | null {
  const step = gridStep(request.kind);
  const start = snapToGrid(request.kind, from);
  const maxRadius = Math.max(layout.width, layout.depth) / step;
  for (let radius = 0; radius <= maxRadius; radius++) {
    let best: Cell | null = null;
    let bestDistance = Infinity;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        // Seulement le bord de l'anneau : l'intérieur a déjà été testé.
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        const cell = { x: start.x + dx * step, z: start.z + dz * step };
        if (checkPlacement(layout, items, { ...request, ...cell }) !== null) continue;
        const offGrid = Number.isInteger(cell.x) && Number.isInteger(cell.z) ? 0 : 0.01;
        const distance = dx * dx + dz * dz + offGrid;
        if (distance < bestDistance) {
          best = cell;
          bestDistance = distance;
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/** Pourquoi un objet ne peut pas être acheté (ou `null` s'il est disponible). */
/** `storyLocked` : récompense du mode Histoire pas débloquée (ou pas utilisable dans ce mode). */
export type ShopBlock = 'locked' | 'storyLocked' | 'researchLocked' | 'soldOut' | 'tooExpensive';

export interface ShopStatus {
  readonly owned: number;
  readonly block: ShopBlock | null;
}

/** Disponibilité d'un objet de la boutique pour la partie en cours. */
export function shopStatus(item: CatalogItem, view: GameView): ShopStatus {
  // Les objets rangés dans l'inventaire comptent aussi dans le maximum.
  const owned =
    view.items.filter((placed) => placed.kind === item.kind && !placed.annexDecor).length +
    view.inventory.reduce((sum, stored) => sum + (stored.kind === item.kind ? stored.count : 0), 0);
  const block: ShopBlock | null =
    item.unlock !== null && !view.unlocks.includes(item.unlock)
      ? 'storyLocked'
      : // La phase d'abord : c'est l'étape la plus lointaine, l'arbre R&D vient ensuite.
        PHASES.indexOf(item.minPhase) > PHASES.indexOf(view.phase)
        ? 'locked'
        : researchNeed(view, `item:${item.kind}`)
          ? 'researchLocked'
          : owned >= item.maxCount
            ? 'soldOut'
            : view.gauges.treasury < item.price
              ? 'tooExpensive'
              : null;
  return { owned, block };
}
