import {
  COLOR_UNLOCKS,
  prestigeEarned,
  rewardUnlocked,
  type FurnitureColor,
  type GameState,
  type StoryRewardId,
} from '@oss/shared';

/*
 * Récompenses du mode Histoire utilisées dans une partie (`state.unlocks`, fixées à son
 * lancement) : un contenu attaché à une récompense n'est en vente que si elle est débloquée.
 * Dans la longue partie avec arbre R&D, les récompenses des objectifs remplis s'y ajoutent
 * (branche Prestige). Module sans dépendance, lu par le mobilier, les murs, les sols et le mode Histoire.
 */

/** La récompense est-elle débloquée dans cette partie ? (Sans récompense : toujours.) */
export function hasUnlock(state: GameState, reward: StoryRewardId | undefined): boolean {
  if (rewardUnlocked(state.unlocks, reward)) return true;
  // Arbre R&D, branche Prestige : dans la longue partie, la récompense d'un objectif rempli se
  // débloque tout de suite (seulement dans les parties qui ont l'arbre).
  const campaign = state.story?.campaign;
  return (
    reward !== undefined &&
    campaign?.research !== undefined &&
    prestigeEarned(campaign.done, reward)
  );
}

/** La couleur est-elle proposée dans cette partie ? (Or et Néon : récompenses de la campagne.) */
export function colorUnlocked(state: GameState, color: FurnitureColor | undefined): boolean {
  return color === undefined || hasUnlock(state, COLOR_UNLOCKS[color]);
}
