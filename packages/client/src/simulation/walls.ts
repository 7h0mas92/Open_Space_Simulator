import {
  PHASES,
  annexCount,
  getWallFinish,
  wallFinishEffects,
  wallZoneExists,
  type CommandError,
  type CommandResult,
  type GameState,
  type WallFinish,
  type WallFinishEffects,
  type WallOffice,
  type WallZone,
} from '@oss/shared';
import { addMoney } from './helpers';

/*
 * Peintures et papiers peints des murs (catalogue dans `shared/sim/walls.ts`). Une commande
 * couvre une zone de mur ; l'effet de chaque zone couverte s'ajoute à celui du mobilier dans
 * `computeOfficeEffects`. Aucun tirage : une partie sans revêtement reste identique.
 */

// Comme `phaseIndex` de furniture.ts, qui importe ce module (pas d'import circulaire).
const phaseIndex = (phase: GameState['phase']) => PHASES.indexOf(phase);

/** Le bureau vu par les murs : phase, ailes des filiales, annexes. */
export function wallOffice(state: GameState): WallOffice {
  return {
    phase: state.phase,
    wings: state.ventures.length,
    annexes: annexCount(state.fundingRounds),
  };
}

export type WallBlocker = Extract<
  CommandError,
  'NOT_FOUND' | 'WRONG_STAGE' | 'LOCKED' | 'NOT_ELIGIBLE' | 'NOT_ENOUGH_MONEY'
>;

/** Pourquoi on ne peut pas poser ce revêtement sur cette zone (`null` si c'est possible). */
export function wallFinishBlocker(
  state: GameState,
  zone: WallZone,
  finish: WallFinish | undefined,
): WallBlocker | null {
  if (!finish || !wallZoneExists(zone, wallOffice(state))) return 'NOT_FOUND';
  if (state.stage === 'PITCH') return 'WRONG_STAGE';
  if (phaseIndex(state.phase) < phaseIndex(finish.minPhase)) return 'LOCKED';
  if (state.walls[zone] === finish.id) return 'NOT_ELIGIBLE';
  if (state.gauges.treasury < finish.price) return 'NOT_ENOUGH_MONEY';
  return null;
}

/** Peint ou tapisse une zone de mur. L'ancien revêtement part à la benne, sans remboursement. */
export function coverWall(state: GameState, zone: WallZone, finishId: string): CommandResult {
  const finish = getWallFinish(finishId);
  const blocker = wallFinishBlocker(state, zone, finish);
  if (blocker || !finish) return { ok: false, error: blocker ?? 'NOT_FOUND' };
  addMoney(state, -finish.price);
  state.walls = { ...state.walls, [zone]: finish.id };
  return { ok: true };
}

/** Effets des murs couverts, chaque jour. */
export function wallEffects(state: GameState): Required<WallFinishEffects> {
  return wallFinishEffects(state.walls, wallOffice(state));
}
