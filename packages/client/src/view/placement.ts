/**
 * Règles de placement du mode construction (dans la grille, hors cloisons, sans chevauchement)
 * et disponibilité des objets de la boutique.
 * Utilisé par l'aperçu dans la scène et avant d'envoyer une commande. La simulation reste juge
 * des bornes et des chevauchements ; les cloisons et l'entrée sont des contraintes du décor.
 */
import { PHASES } from '@oss/shared';
import { itemCells } from '../ai/grid';
import { catalogItem, footprint, type CatalogItem } from './catalog';
import type { Cell, OfficeLayout } from './layout';
import type { GameView, PlacedItemView, Rotation } from './types';

export type PlacementError = 'unknownItem' | 'outOfBounds' | 'wall' | 'overlap' | 'entrance';

export interface PlacementRequest {
  readonly kind: string;
  readonly x: number;
  readonly z: number;
  readonly rotation: Rotation;
  /** Objet déplacé : il ne se bloque pas lui-même. */
  readonly ignoreId?: string;
}

export function checkPlacement(
  layout: OfficeLayout,
  items: readonly PlacedItemView[],
  request: PlacementRequest,
): PlacementError | null {
  const def = catalogItem(request.kind);
  if (!def) return 'unknownItem';
  const [w, d] = footprint(def, request.rotation);
  if (
    request.x < 0 ||
    request.z < 0 ||
    request.x + w > layout.width ||
    request.z + d > layout.depth
  ) {
    return 'outOfBounds';
  }
  const cells = itemCells({ id: '', ...request });
  const has = (list: readonly { x: number; z: number }[], x: number, z: number) =>
    list.some((cell) => cell.x === x && cell.z === z);

  for (const cell of cells) {
    if (has(layout.partitions, cell.x, cell.z)) return 'wall';
    if (cell.x === layout.entrance.x && cell.z === layout.entrance.z) return 'entrance';
  }
  // Même règle que la simulation : aucun chevauchement, tapis compris.
  for (const other of items) {
    if (other.id === request.ignoreId) continue;
    const otherCells = itemCells(other);
    if (cells.some((cell) => has(otherCells, cell.x, cell.z))) return 'overlap';
  }
  return null;
}

/**
 * Case libre la plus proche de `from` pour l'objet demandé (recherche en anneaux de plus en plus
 * larges). Sert à poser l'aperçu à un endroit valide dès qu'on choisit un objet. `null` si le
 * bureau n'a plus aucune place pour lui.
 */
export function nearestValidCell(
  layout: OfficeLayout,
  items: readonly PlacedItemView[],
  request: Omit<PlacementRequest, 'x' | 'z'>,
  from: Cell,
): Cell | null {
  const maxRadius = Math.max(layout.width, layout.depth);
  for (let radius = 0; radius <= maxRadius; radius++) {
    let best: Cell | null = null;
    let bestDistance = Infinity;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        // Seulement le bord de l'anneau : l'intérieur a déjà été testé.
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        const cell = { x: from.x + dx, z: from.z + dz };
        if (checkPlacement(layout, items, { ...request, ...cell }) !== null) continue;
        const distance = dx * dx + dz * dz;
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
export type ShopBlock = 'locked' | 'soldOut' | 'tooExpensive';

export interface ShopStatus {
  readonly owned: number;
  readonly block: ShopBlock | null;
}

/** Disponibilité d'un objet de la boutique pour la partie en cours. */
export function shopStatus(item: CatalogItem, view: GameView): ShopStatus {
  const owned = view.items.filter((placed) => placed.kind === item.kind).length;
  const block: ShopBlock | null =
    PHASES.indexOf(item.minPhase) > PHASES.indexOf(view.phase)
      ? 'locked'
      : owned >= item.maxCount
        ? 'soldOut'
        : view.gauges.treasury < item.price
          ? 'tooExpensive'
          : null;
  return { owned, block };
}
