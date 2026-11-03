import { GAME, type GameMode } from '../game.js';

/**
 * Mode illimité : la partie ne s'arrête plus au bout des 18 mois. Elle dure tant que la
 * trésorerie tient (ou jusqu'à une IPO, un rachat accepté). Après le 39e sprint, la
 * concurrence se réveille : les frais fixes montent et les utilisateurs partent plus vite,
 * un peu plus à chaque sprint, pour que la partie finisse un jour et que chaque sprint tenu
 * compte au classement.
 */
export const ENDLESS = {
  /**
   * Plafond technique du nombre de sprints (environ 385 ans de jeu) : il n'est jamais atteint
   * en pratique, mais garde `totalSprints` un entier et les schémas bornés.
   */
  sprintCap: 9999,
  /** La pression commence après ce sprint (la fin d'une partie normale). */
  pressureAfterSprint: GAME.totalSprints,
  /**
   * Frais fixes : +4 % par sprint au-delà du 39e, plus une part qui croît avec le carré
   * (+0,4 % × sprints²) : x2,2 après 6 mois, x4,8 après 1 an, x17 après 2 ans.
   */
  fixedCostGrowthPerSprint: 0.04,
  fixedCostGrowthSquared: 0.004,
  /**
   * Les investisseurs se lassent : une levée finance 18 mois de dépenses, divisés par
   * (1 + 5 % par sprint au-delà du 39e) : 8 mois après 6 mois, 4 mois après 2 ans.
   */
  raiseFatiguePerSprint: 0.05,
  /** Départs quotidiens d'utilisateurs ajoutés par sprint au-delà du 39e. */
  churnPerSprint: 0.00004,
  /** Un message de la concurrence tous les 13 sprints (6 mois). */
  milestoneSprints: 13,
  /** Seuils des succès du mode illimité (sprints joués). */
  achievementSprints: { twoYears: 52, threeYears: 78, fiveYears: 130 },
} as const;

export function isEndless(mode: GameMode): boolean {
  return mode === 'ENDLESS';
}

/**
 * Sprints joués au-delà des 18 mois (0 avant, et toujours 0 hors mode illimité). Plus il est
 * grand, plus la concurrence pèse.
 */
export function endlessPressure(
  mode: GameMode,
  sprint: number,
  /** Saison libre de l'histoire en actes : la pression part de ce sprint (`freeSeasonStart`). */
  since: number | null = null,
): number {
  if (since !== null) return Math.max(0, sprint - since);
  return isEndless(mode) ? Math.max(0, sprint - ENDLESS.pressureAfterSprint) : 0;
}

/** Multiplicateur des frais fixes de la phase en mode illimité (1 sans pression). */
export function endlessCostMultiplier(
  mode: GameMode,
  sprint: number,
  since: number | null = null,
): number {
  const pressure = endlessPressure(mode, sprint, since);
  return (
    1 +
    pressure * ENDLESS.fixedCostGrowthPerSprint +
    pressure * pressure * ENDLESS.fixedCostGrowthSquared
  );
}

/** Part du montant habituel d'une levée encore accordée par les investisseurs (1 sans pression). */
export function endlessRaiseShare(
  mode: GameMode,
  sprint: number,
  since: number | null = null,
): number {
  return 1 / (1 + endlessPressure(mode, sprint, since) * ENDLESS.raiseFatiguePerSprint);
}

/** Départs quotidiens d'utilisateurs ajoutés par la concurrence (0 sans pression). */
export function endlessExtraChurn(
  mode: GameMode,
  sprint: number,
  since: number | null = null,
): number {
  return endlessPressure(mode, sprint, since) * ENDLESS.churnPerSprint;
}
