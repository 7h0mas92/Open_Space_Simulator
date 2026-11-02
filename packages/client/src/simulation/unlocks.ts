import {
  COLOR_UNLOCKS,
  rewardUnlocked,
  type FurnitureColor,
  type GameState,
  type StoryRewardId,
} from '@oss/shared';

/*
 * Récompenses du mode Histoire utilisées dans une partie (`state.unlocks`, fixées à son
 * lancement) : un contenu attaché à une récompense n'est en vente que si elle est débloquée.
 * Module sans dépendance, lu par le mobilier, les murs, les sols et le mode Histoire.
 */

/** La récompense est-elle débloquée dans cette partie ? (Sans récompense : toujours.) */
export function hasUnlock(state: GameState, reward: StoryRewardId | undefined): boolean {
  return rewardUnlocked(state.unlocks, reward);
}

/** La couleur est-elle proposée dans cette partie ? (Or et Néon : récompenses de la campagne.) */
export function colorUnlocked(state: GameState, color: FurnitureColor | undefined): boolean {
  return color === undefined || hasUnlock(state, COLOR_UNLOCKS[color]);
}
