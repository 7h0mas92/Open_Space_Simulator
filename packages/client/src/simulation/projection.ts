/**
 * Projecteurs et écrans déroulants côté simulation : interrupteur du projecteur et effets des
 * projections en cours. Les règles d'association (quel projecteur éclaire quel écran) sont dans
 * `@oss/shared` (`projection.ts`), partagées avec le rendu. Aucun tirage aléatoire.
 */
import {
  getFurniture,
  projectionPairs,
  type CommandResult,
  type EntityId,
  type FurnitureEffects,
  type GameState,
  type ProjectionItem,
  type ProjectionPair,
} from '@oss/shared';
import { query } from './ecs';

/** Objets posés, dans l'ordre d'achat, sous la forme attendue par `projectionPairs`. */
export function projectionItems(state: GameState): ProjectionItem[] {
  return query(state, 'furniture').flatMap((id) => {
    const placed = state.components.furniture[id];
    if (!placed) return [];
    return [
      {
        id,
        itemId: placed.itemId,
        x: placed.x,
        y: placed.y,
        rotation: placed.rotation,
        ...(placed.hostId !== undefined ? { hostId: placed.hostId } : {}),
        ...(placed.on ? { on: true } : {}),
      },
    ];
  });
}

/** Projections en cours : chaque projecteur allumé et l'écran qu'il a déroulé. */
export function activeProjections(state: GameState): ProjectionPair[] {
  return projectionPairs(projectionItems(state));
}

/** Allume ou éteint un projecteur posé. */
export function switchProjector(
  state: GameState,
  furnitureId: EntityId,
  on: boolean,
): CommandResult {
  const placed = state.components.furniture[furnitureId];
  if (!placed) return { ok: false, error: 'NOT_FOUND' };
  if (getFurniture(placed.itemId)?.projector !== true) return { ok: false, error: 'NOT_ELIGIBLE' };
  if (on) placed.on = true;
  else delete placed.on;
  return { ok: true };
}

/**
 * Effets des projections en cours : ceux du projecteur et ceux de l'écran déroulé. Un
 * projecteur éteint, ou sans écran en face, et un écran enroulé ne comptent pas.
 */
export function projectionEffects(state: GameState): FurnitureEffects[] {
  const effects: FurnitureEffects[] = [];
  for (const pair of activeProjections(state)) {
    for (const id of [pair.projector, pair.screen]) {
      const placed = state.components.furniture[id];
      const item = placed ? getFurniture(placed.itemId) : undefined;
      if (item) effects.push(item.effects);
    }
  }
  return effects;
}
