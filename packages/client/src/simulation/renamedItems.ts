import { currentFurnitureId, type Command, type GameState } from '@oss/shared';

/**
 * Objets renommés depuis la sortie du jeu (les casques antibruit devenus écouteurs sans fil,
 * voir `LEGACY_FURNITURE_IDS`). Une ancienne sauvegarde ou un ancien journal de commandes garde
 * les anciens identifiants : on les traduit ici, sans rien changer d'autre à la partie.
 */

/** Remplace, dans l'état, les identifiants d'objets renommés (objets posés et inventaire). */
export function migrateRenamedItems(state: GameState): void {
  for (const furniture of Object.values(state.components.furniture))
    furniture.itemId = currentFurnitureId(furniture.itemId);
  for (const stored of state.inventory) stored.itemId = currentFurnitureId(stored.itemId);
}

/** La même commande, avec l'identifiant actuel de l'objet qu'elle vise. */
export function migrateCommand(command: Command): Command {
  if (!('itemId' in command)) return command;
  const itemId = currentFurnitureId(command.itemId);
  return itemId === command.itemId ? command : { ...command, itemId };
}
