/**
 * Règles de placement du mode construction (dans la grille, hors cloisons, sans chevauchement).
 * Utilisé par l'aperçu en temps réel dans la scène et par la validation des commandes.
 */
import { itemCells } from '../ai/grid';
import { catalogItem, footprint } from './catalog';
import type { OfficeLayout } from './layout';
import type { PlacedItemView, Rotation } from './types';

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
  // Les tapis se posent sous les meubles, et inversement.
  const isRug = request.kind === 'rug';
  for (const other of items) {
    if (other.id === request.ignoreId) continue;
    if (isRug !== (other.kind === 'rug')) continue;
    const otherCells = itemCells(other);
    if (cells.some((cell) => has(otherCells, cell.x, cell.z))) return 'overlap';
  }
  return null;
}
