import type { GameMode } from '../game.js';
import { BALANCE } from './balance.js';

/**
 * Difficulté d'un mode de jeu : quelques multiplicateurs appliqués par la simulation à
 * l'argent, aux crises, aux pannes et aux levées de fonds.
 *
 * Le profil neutre (`NEUTRAL`) vaut 1 partout (0 pour la barre des investisseurs) : multiplier
 * par 1 ou ajouter 0 ne change aucun nombre, donc les modes Normal, Daily, Stagiaires Only et
 * Défi 3 sprints jouent exactement comme avant (replays, Daily et scores inchangés).
 *
 * Réglages mesurés par `pnpm balance` (section « Difficulté par mode »), voir `docs/balance.md`.
 */
export interface DifficultyProfile {
  /** Trésorerie de départ, en multiple des 2 M€ levés. */
  treasury: number;
  /** Cartes tirées au hasard au plus par sprint (la panne du vendredi peut en ajouter une). */
  eventsPerSprint: number;
  /** Multiplicateur de la chance de tirer une carte à chaque heure ouvrée. */
  eventChance: number;
  /** Multiplicateur des seuls effets négatifs des cartes (affichés déjà ajustés). */
  badEffects: number;
  /** Multiplicateur des dépenses mensuelles (salaires, frais, hébergement, prêt). */
  expenses: number;
  /** Multiplicateur des revenus mensuels (abonnements des utilisateurs). */
  revenue: number;
  /** Multiplicateur des chances de panne (dette technique, vendredi 17h). */
  outages: number;
  /** Ajouté à la barre d'intérêt que l'investisseur attend à chaque tour de table. */
  pitchBar: number;
}

const NEUTRAL: DifficultyProfile = {
  treasury: 1,
  eventsPerSprint: BALANCE.events.maxPerSprint,
  eventChance: 1,
  badEffects: 1,
  expenses: 1,
  revenue: 1,
  outages: 1,
  pitchBar: 0,
};

export const DIFFICULTY = {
  /**
   * Facile : pour apprendre, sans être gagné d'avance. Un peu plus d'argent et des crises
   * adoucies, mais autant de cartes qu'en Normal, et une gestion ratée finit quand même mal.
   */
  EASY: {
    ...NEUTRAL,
    treasury: 1.1,
    badEffects: 0.85,
  },
  NORMAL: NEUTRAL,
  /**
   * Hardcore : pas de pause, moins d'argent, des salaires plus chers, des clients qui paient
   * moins, plus de crises et plus de pannes, des investisseurs plus exigeants. Gagner reste
   * possible, mais chaque décision compte.
   */
  HARDCORE: {
    ...NEUTRAL,
    treasury: 0.75,
    eventsPerSprint: 4,
    eventChance: 1.5,
    badEffects: 1.3,
    expenses: 1.15,
    revenue: 0.85,
    outages: 1.5,
    pitchBar: 0.3,
  },
} as const satisfies Partial<Record<GameMode, DifficultyProfile>>;

/** Difficulté d'un mode : les modes sans réglage propre jouent comme le Normal. */
export function difficultyOf(mode: GameMode): DifficultyProfile {
  return mode === 'EASY' || mode === 'HARDCORE' ? DIFFICULTY[mode] : NEUTRAL;
}
