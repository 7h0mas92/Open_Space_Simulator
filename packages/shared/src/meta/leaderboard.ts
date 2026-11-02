import type { GameMode } from '../game.js';
import { isEndless } from '../sim/endless.js';

/** Ce qu'il faut d'une partie pour la classer. */
export interface RankedGame {
  readonly valuation: number;
  readonly sprintsPlayed: number;
  /** Date de la partie (ISO) : à égalité, la plus ancienne passe devant. */
  readonly createdAt: string;
}

/**
 * Ordre d'un classement : la valorisation finale, sauf en mode illimité où comptent d'abord
 * les sprints tenus (la partie finit presque toujours en faillite, à 0 €), puis la
 * valorisation. Même règle sur le serveur et pour le classement de l'appareil.
 */
export function compareGames(mode: GameMode | null): (a: RankedGame, b: RankedGame) => number {
  return (a, b) =>
    (mode !== null && isEndless(mode) ? b.sprintsPlayed - a.sprintsPlayed : 0) ||
    b.valuation - a.valuation ||
    a.createdAt.localeCompare(b.createdAt);
}

/** Modes absents du classement global : le Facile et l'Illimité ont leur propre onglet. */
export const GLOBAL_EXCLUDED_MODES: readonly GameMode[] = ['EASY', 'ENDLESS'];
