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
  /**
   * Durée réelle approximative d'un sprint à vitesse x1, en secondes (5 minutes : une minute de
   * jeu dure environ 15 ms, l'horloge défile donc minute par minute à l'écran).
   */
  sprintRealSecondsAtX1: 300,
  /** Fonds levés au démarrage, en euros. */
  startingTreasury: 2_000_000,
  /** Nombre d'emplacements de sauvegarde par joueur. */
  saveSlots: 5,
} as const;

export const GAME_MODES = [
  'EASY',
  'NORMAL',
  'HARDCORE',
  'INTERNS_ONLY',
  'SHIP_IN_3',
  'ENDLESS',
  'DAILY',
  'STORY',
  'CAREER',
] as const;
export const GameModeSchema = z.enum(GAME_MODES);
export type GameMode = z.infer<typeof GameModeSchema>;

/**
 * Modes proposés en cartes dans le menu. Le mode Histoire a son propre écran (chapitres et
 * missions, voir `story/campaign.ts`) et n'a pas de classement.
 */
export const MENU_MODES = GAME_MODES.filter(
  (mode): mode is Exclude<GameMode, 'STORY'> => mode !== 'STORY',
);

/**
 * Modes où les récompenses du mode Histoire sont utilisables (objets, couleurs, bonus de
 * départ). Ni le Daily (même partie pour tout le monde), ni les missions elles-mêmes (elles
 * restent équilibrées pareil pour tous).
 */
export const UNLOCK_MODES: readonly GameMode[] = [
  'EASY',
  'NORMAL',
  'HARDCORE',
  'INTERNS_ONLY',
  'SHIP_IN_3',
  'ENDLESS',
];

export const PHASES = ['GARAGE', 'SEED', 'SERIES_A', 'UNICORN', 'END'] as const;
export const PhaseSchema = z.enum(PHASES);
export type Phase = z.infer<typeof PhaseSchema>;

export const OUTCOMES = ['BANKRUPTCY', 'IPO', 'ACQUISITION', 'ZOMBIE'] as const;
export const OutcomeSchema = z.enum(OUTCOMES);
export type Outcome = z.infer<typeof OutcomeSchema>;

export const SPEEDS = [0, 1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];
