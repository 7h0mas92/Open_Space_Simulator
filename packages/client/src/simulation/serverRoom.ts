/**
 * Salle des serveurs côté simulation : effets du matériel des salles qui tournent et économies
 * d'hébergement. Les règles (ce qu'il faut pour qu'une salle tourne) sont dans `@oss/shared`
 * (`serverRoom.ts`), partagées avec l'interface. L'abonnement fibre est un abonnement comme les
 * autres (`subscriptions.ts`). Aucun tirage aléatoire.
 */
import {
  HOSTING_SAVING_MAX,
  getFurniture,
  serverRooms,
  type FurnitureEffects,
  type GameState,
  type ServerRoomItem,
  type ServerRoomStatus,
} from '@oss/shared';
import { query } from './ecs';

/** Objets posés, dans l'ordre d'achat, sous la forme attendue par `serverRooms`. */
export function serverRoomItems(state: GameState): ServerRoomItem[] {
  return query(state, 'furniture').flatMap((id) => {
    const placed = state.components.furniture[id];
    if (!placed) return [];
    return [
      {
        id,
        itemId: placed.itemId,
        ...(placed.hostId !== undefined ? { hostId: placed.hostId } : {}),
      },
    ];
  });
}

/** Les salles des serveurs posées, leur matériel et ce qui leur manque. */
export function serverRoomStatuses(state: GameState): ServerRoomStatus[] {
  return serverRooms(serverRoomItems(state));
}

/** Effets du matériel installé dans les salles qui tournent (les autres surchauffent). */
export function serverGearEffects(state: GameState): FurnitureEffects[] {
  const effects: FurnitureEffects[] = [];
  for (const room of serverRoomStatuses(state)) {
    if (!room.running) continue;
    for (const id of room.gear) {
      const placed = state.components.furniture[id];
      const item = placed ? getFurniture(placed.itemId) : undefined;
      if (item) effects.push(item.effects);
    }
  }
  return effects;
}

/** Part de la facture d'hébergement épargnée grâce aux serveurs maison (plafonnée). */
export function hostingSaving(state: GameState): number {
  const total = serverGearEffects(state).reduce((sum, e) => sum + (e.hostingSaving ?? 0), 0);
  return Math.min(HOSTING_SAVING_MAX, total);
}
