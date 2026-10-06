import { z } from 'zod';

/**
 * Constantes de jeu partagées. Les valeurs d'équilibrage détaillées seront
 * ajoutées par l'étape « Simulation ».
 */
export const GAME = {
  /** 18 mois de jeu. */
  totalSprints: 39,
  /** Durée d'un sprint en semaines simulées. */
  sprintWeeks: 2,
  /** Durée réelle approximative d'un sprint à vitesse x1, en secondes. */
  sprintRealSecondsAtX1: 180,
  /** Fonds levés au démarrage, en euros. */
  startingTreasury: 2_000_000,
  /** Nombre d'emplacements de sauvegarde par joueur. */
  saveSlots: 5,
} as const;

export const GAME_MODES = ['NORMAL', 'HARDCORE', 'INTERNS_ONLY', 'SHIP_IN_3', 'DAILY'] as const;
export const GameModeSchema = z.enum(GAME_MODES);
export type GameMode = z.infer<typeof GameModeSchema>;

export const PHASES = ['GARAGE', 'SEED', 'SERIES_A', 'UNICORN', 'END'] as const;
export const PhaseSchema = z.enum(PHASES);
export type Phase = z.infer<typeof PhaseSchema>;

export const OUTCOMES = ['BANKRUPTCY', 'IPO', 'ACQUISITION', 'ZOMBIE'] as const;
export const OutcomeSchema = z.enum(OUTCOMES);
export type Outcome = z.infer<typeof OutcomeSchema>;

export const SPEEDS = [0, 1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];
