import {
  PHASES,
  floorFinishEffects,
  floorTintAllowed,
  floorZoneExists,
  getFloorMaterial,
  sameFloor,
  type CommandResult,
  type FloorFinish,
  type FloorMaterialEffects,
  type FloorZone,
  type GameState,
} from '@oss/shared';
import { addMoney } from './helpers';
import { wallOffice, type WallBlocker } from './walls';

/*
 * Sols des pièces (catalogue dans `shared/sim/floors.ts`). Une commande pose une matière et une
 * teinte dans une pièce ; l'effet de chaque pièce couverte s'ajoute à celui du mobilier dans
 * `computeOfficeEffects`. Aucun tirage : une partie sans nouveau sol reste identique.
 */

const phaseIndex = (phase: GameState['phase']) => PHASES.indexOf(phase);

/** Pourquoi on ne peut pas poser ce sol dans cette pièce (`null` si c'est possible). */
export function floorBlocker(
  state: GameState,
  zone: FloorZone,
  finish: FloorFinish,
): WallBlocker | null {
  const material = getFloorMaterial(finish.material);
  if (!material || !floorTintAllowed(material, finish.tint)) return 'NOT_FOUND';
  if (!floorZoneExists(zone, wallOffice(state))) return 'NOT_FOUND';
  if (state.stage === 'PITCH') return 'WRONG_STAGE';
  if (phaseIndex(state.phase) < phaseIndex(material.minPhase)) return 'LOCKED';
  if (sameFloor(state.floors[zone], finish)) return 'NOT_ELIGIBLE';
  if (state.gauges.treasury < material.price) return 'NOT_ENOUGH_MONEY';
  return null;
}

/** Pose un sol dans une pièce. L'ancien sol part à la benne, sans remboursement. */
export function coverFloor(state: GameState, zone: FloorZone, finish: FloorFinish): CommandResult {
  const blocker = floorBlocker(state, zone, finish);
  const material = getFloorMaterial(finish.material);
  if (blocker || !material) return { ok: false, error: blocker ?? 'NOT_FOUND' };
  addMoney(state, -material.price);
  state.floors = { ...state.floors, [zone]: { material: finish.material, tint: finish.tint } };
  return { ok: true };
}

/** Effets des sols posés, chaque jour. */
export function floorEffects(state: GameState): Required<FloorMaterialEffects> {
  return floorFinishEffects(state.floors, wallOffice(state));
}
