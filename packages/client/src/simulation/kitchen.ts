import { INVENTORY_MAX, LEGACY_KITCHEN_ITEMS, type GameState } from '@oss/shared';
import { createEntity, query } from './ecs';

/**
 * Cuisine séparée : avant, un objet de cuisine était un meuble et son appareil d'un seul bloc
 * (« Cafetière », « Machine à café premium », « Micro-ondes »). Une vieille sauvegarde qui en
 * contient retrouve à la place un meuble de cuisine avec l'appareil posé dessus, au même endroit,
 * de la même couleur, avec le même effet de jeu (le meuble ajoute seulement son léger +moral).
 *
 * L'appareil garde le prix payé (revente inchangée) ; le meuble est offert (prix 0). Un combiné
 * rangé dans l'inventaire devient l'appareil rangé, plus le meuble s'il reste de la place.
 * Aucun tirage aléatoire. Renvoie le nombre d'objets convertis (0 pour une sauvegarde récente).
 */
export function migrateLegacyKitchen(state: GameState): number {
  let converted = 0;
  for (const id of query(state, 'furniture')) {
    const placed = state.components.furniture[id];
    const legacy = placed ? LEGACY_KITCHEN_ITEMS[placed.itemId] : undefined;
    if (!placed || !legacy) continue;
    // L'entité devient le meuble ; l'appareil est une nouvelle entité posée sur son plateau.
    const price = placed.purchasePrice;
    placed.itemId = legacy.cabinet;
    placed.purchasePrice = 0;
    const appliance = createEntity(state);
    state.components.furniture[appliance] = {
      itemId: legacy.appliance,
      x: placed.x,
      y: placed.y,
      rotation: 0,
      purchasePrice: price,
      hostId: id,
      slot: 0,
    };
    converted += 1;
  }
  const stored = state.inventory;
  for (let index = 0; index < stored.length; index++) {
    const item = stored[index];
    const legacy = item ? LEGACY_KITCHEN_ITEMS[item.itemId] : undefined;
    if (!item || !legacy) continue;
    stored[index] = { itemId: legacy.appliance, purchasePrice: item.purchasePrice };
    if (stored.length < INVENTORY_MAX)
      stored.push({
        itemId: legacy.cabinet,
        purchasePrice: 0,
        ...(item.color ? { color: item.color } : {}),
      });
    converted += 1;
  }
  return converted;
}
