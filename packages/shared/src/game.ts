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

/** Règles de jeu propres à chaque mode, lues partout au lieu de tester le nom du mode. */
export interface ModeRules {
  /** Carte dans le menu (le mode Histoire a son propre écran et pas de classement). */
  readonly inMenu: boolean;
  /**
   * Récompenses du mode Histoire utilisables (objets, couleurs, bonus de départ). Ni le Daily
   * (même partie pour tout le monde), ni les missions elles-mêmes (équilibrées pareil pour tous).
   */
  readonly storyUnlocks: boolean;
  /** Arbre de compétences ouvert (fermé au Daily, pour des parties comparables). */
  readonly skills: boolean;
  /** Le joueur peut mettre le temps en pause pendant l'exécution. */
  readonly canPause: boolean;
  /** Une carte événement arrête le temps (sinon elle se résout seule au bout d'un moment). */
  readonly cardsPauseTime: boolean;
  /** Mode construction ouvert pendant l'exécution. */
  readonly buildDuringRun: boolean;
  /** Le guide ouvre ses chapitres en pleine partie. */
  readonly guide: boolean;
}

const STANDARD: ModeRules = {
  inMenu: true,
  storyUnlocks: true,
  skills: true,
  canPause: true,
  cardsPauseTime: true,
  buildDuringRun: true,
  guide: true,
};

/** Hardcore : temps réel, sans pause, sans construction en cours de sprint ni guide. */
const REAL_TIME: Partial<ModeRules> = {
  canPause: false,
  cardsPauseTime: false,
  buildDuringRun: false,
  guide: false,
};

export const MODE_RULES: Readonly<Record<GameMode, ModeRules>> = {
  EASY: STANDARD,
  NORMAL: STANDARD,
  HARDCORE: { ...STANDARD, ...REAL_TIME },
  INTERNS_ONLY: STANDARD,
  SHIP_IN_3: STANDARD,
  ENDLESS: STANDARD,
  DAILY: { ...STANDARD, storyUnlocks: false, skills: false },
  STORY: { ...STANDARD, inMenu: false, storyUnlocks: false },
  CAREER: { ...STANDARD, storyUnlocks: false },
};

export function modeRules(mode: GameMode): ModeRules {
  return MODE_RULES[mode];
}

/** Modes proposés en cartes dans le menu. */
export const MENU_MODES = GAME_MODES.filter(
  (mode): mode is Exclude<GameMode, 'STORY'> => MODE_RULES[mode].inMenu,
);

/** Modes où les récompenses du mode Histoire sont utilisables. */
export const UNLOCK_MODES: readonly GameMode[] = GAME_MODES.filter(
  (mode) => MODE_RULES[mode].storyUnlocks,
);

export const PHASES = ['GARAGE', 'SEED', 'SERIES_A', 'UNICORN', 'END'] as const;
export const PhaseSchema = z.enum(PHASES);
export type Phase = z.infer<typeof PhaseSchema>;

export const OUTCOMES = ['BANKRUPTCY', 'IPO', 'ACQUISITION', 'ZOMBIE'] as const;
export const OutcomeSchema = z.enum(OUTCOMES);
export type Outcome = z.infer<typeof OutcomeSchema>;

export const SPEEDS = [0, 1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];
