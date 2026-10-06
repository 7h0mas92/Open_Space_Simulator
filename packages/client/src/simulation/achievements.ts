import { ACHIEVEMENTS, getAchievement, type GameState } from '@oss/shared';
import { notify, type SimContext } from './helpers';

/** Succès vérifiés à partir de l'état (les autres sont débloqués par des cartes). */
const CHECKED = ACHIEVEMENTS.filter((achievement) => achievement.check !== undefined);

/** Débloque un succès (une seule fois) et prévient le joueur. */
export function unlockAchievement(state: GameState, ctx: SimContext, id: string): void {
  if (state.achievements.includes(id)) return;
  state.achievements.push(id);
  const achievement = getAchievement(id);
  if (achievement) notify(state, ctx, 'ACHIEVEMENT_UNLOCKED', achievement.title);
}

/**
 * Vérifie les succès après chaque pas et chaque commande. Les conditions ne font que lire
 * l'état : le rejeu côté serveur retrouve donc exactement les mêmes succès.
 */
export function checkAchievements(state: GameState, ctx: SimContext): void {
  for (const achievement of CHECKED) {
    if (!state.achievements.includes(achievement.id) && achievement.check?.(state))
      unlockAchievement(state, ctx, achievement.id);
  }
}
