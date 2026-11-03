import { z } from 'zod';
import type { LocalizedText } from '../i18n.js';

/**
 * Les startups rivales de l'histoire « Ctrl+Alt+Fonder » (mode Histoire, longue partie). Toutes
 * inventées : aucun nom ni logo réel.
 *
 * Elles sont simulées à côté de la startup du joueur, une fois par démo, sur une graine à part
 * (`<graine>#rival#<sprint>`) : le générateur de la partie n'est jamais touché, et les autres
 * modes ne les voient pas. Leurs utilisateurs freinent la croissance du joueur (marché partagé).
 */

export const RIVAL_IDS = [
  'synergix',
  'pivotly',
  'gigacorp',
  'quantik',
  'hyperlane',
  'blitzly',
] as const;
export const RivalIdSchema = z.enum(RIVAL_IDS);
export type RivalId = z.infer<typeof RivalIdSchema>;

/** Actions possibles d'un rival, annoncées par notification à la démo. */
export const RIVAL_ACTIONS = [
  'copy',
  'poach',
  'lawsuit',
  'priceCut',
  'pivot',
  'clone',
  'adBlitz',
] as const;
export const RivalActionSchema = z.enum(RIVAL_ACTIONS);
export type RivalAction = z.infer<typeof RivalActionSchema>;

export interface RivalProfile {
  readonly id: RivalId;
  readonly name: string;
  readonly icon: string;
  /** Son caractère, pour le panneau « Marché ». */
  readonly tagline: LocalizedText;
  /** Acte où il entre en jeu (0 = dès le prologue ; `NEWCOMER` : en Saison libre). */
  readonly fromAct: number;
  /** Utilisateurs à son arrivée. */
  readonly startUsers: number;
  /** Croissance par sprint (modèle logistique) et plafond d'utilisateurs. */
  readonly growth: number;
  readonly cap: number;
  /** Chance par sprint de lancer une action contre le joueur. */
  readonly aggression: number;
  readonly actions: readonly RivalAction[];
  /** Couleur de son enseigne dans la ville. */
  readonly color: string;
}

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

/** `fromAct` des startups de la Saison libre : elles n'arrivent jamais pendant l'histoire. */
export const NEWCOMER = 99;

export const RIVALS: readonly RivalProfile[] = [
  {
    id: 'synergix',
    name: 'Synergix',
    icon: '🦊',
    tagline: t(
      'Bastien Lemaître copie tout ce que tu livres, en plus brillant.',
      'Bastien Lemaître copies everything you ship, only shinier.',
    ),
    fromAct: 0,
    startUsers: 3_000,
    growth: 0.26,
    cap: 1_200_000,
    aggression: 0.3,
    actions: ['copy', 'poach', 'lawsuit'],
    color: '#ff5a5f',
  },
  {
    id: 'pivotly',
    name: 'Pivotly',
    icon: '🌀',
    tagline: t(
      'Change de produit tous les deux sprints et casse les prix.',
      'Changes products every other sprint and slashes prices.',
    ),
    fromAct: 2,
    startUsers: 250_000,
    growth: 0.12,
    cap: 3_000_000,
    aggression: 0.35,
    actions: ['priceCut', 'pivot', 'priceCut'],
    color: '#a66bff',
  },
  {
    id: 'gigacorp',
    name: 'Gigacorp',
    icon: '🏢',
    tagline: t(
      'La big tech qui rachète Synergix et clone ton produit.',
      'The big tech that buys Synergix and clones your product.',
    ),
    fromAct: 3,
    startUsers: 2_000_000,
    growth: 0.05,
    cap: 8_000_000,
    aggression: 0.35,
    actions: ['clone', 'adBlitz', 'poach'],
    color: '#4aa8ff',
  },
  {
    id: 'quantik',
    name: 'Quantik',
    icon: '⚛️',
    tagline: t(
      'Promet « l’IA quantique » à chaque réunion. Personne ne sait ce que c’est.',
      'Promises “quantum AI” in every meeting. Nobody knows what it is.',
    ),
    fromAct: NEWCOMER,
    startUsers: 400_000,
    growth: 0.18,
    cap: 6_000_000,
    aggression: 0.4,
    actions: ['copy', 'adBlitz', 'poach'],
    color: '#2ed3b7',
  },
  {
    id: 'hyperlane',
    name: 'Hyperlane',
    icon: '🚀',
    tagline: t(
      'Lève 1 milliard avant d’avoir un produit. Débauche à prix d’or.',
      'Raises a billion before having a product. Poaches at any price.',
    ),
    fromAct: NEWCOMER,
    startUsers: 600_000,
    growth: 0.2,
    cap: 9_000_000,
    aggression: 0.45,
    actions: ['poach', 'priceCut', 'adBlitz'],
    color: '#ff9f1c',
  },
  {
    id: 'blitzly',
    name: 'Blitzly',
    icon: '⚡',
    tagline: t(
      'Clone tout en 48 h et l’offre gratuitement. Le cauchemar des licornes.',
      'Clones anything in 48 hours and gives it away. Every unicorn’s nightmare.',
    ),
    fromAct: NEWCOMER,
    startUsers: 900_000,
    growth: 0.22,
    cap: 12_000_000,
    aggression: 0.5,
    actions: ['clone', 'priceCut', 'lawsuit'],
    color: '#f15bb5',
  },
];

/** Startups qui arrivent en Saison libre, dans cet ordre. */
export const NEWCOMER_RIVALS: readonly RivalId[] = ['quantik', 'hyperlane', 'blitzly'];

export const RIVAL_RULES = {
  /** Sprints gardés dans l'historique d'utilisateurs (courbes du panneau « Marché »). */
  historyLength: 30,
  /** Hasard de croissance par sprint, en plus ou en moins. */
  noise: 0.04,
  /** Bonus de croissance de Synergix quand le joueur le dépasse (il copie). */
  copierBoost: 0.06,
  /** Pivot de Pivotly tous les 2 sprints : ses utilisateurs sont multipliés entre ces bornes. */
  pivotRange: [0.75, 1.4] as const,
  /**
   * En dessous de ce nombre d'utilisateurs et de cette part de son record, un rival fait
   * faillite (sauf Gigacorp).
   */
  bankruptBelow: 50_000,
  bankruptDrop: 0.3,
  /** Valorisation par utilisateur (avant la hype). */
  valuationPerUser: 450,
  /** Départs quotidiens d'utilisateurs du joueur par point de part de marché des rivaux. */
  dailyChurnPerRivalShare: 0.0012,
  /** Effets des actions. */
  effects: {
    copyHype: -4,
    poachMoral: -15,
    lawsuitTreasuryShare: 0.02,
    lawsuitMax: 250_000,
    priceCutUsers: -0.03,
    cloneHype: -6,
    cloneUsers: -0.02,
    adBlitzHype: -3,
  },
} as const;

export function getRival(id: RivalId): RivalProfile {
  const rival = RIVALS.find((r) => r.id === id);
  if (!rival) throw new Error(`Rival inconnu : ${id}`);
  return rival;
}

export const RivalStateSchema = z.object({
  id: RivalIdSchema,
  users: z.number().nonnegative(),
  valuation: z.number().nonnegative(),
  /** Hype du rival (0 à 100). */
  hype: z.number().min(0).max(100),
  headcount: z.number().int().nonnegative(),
  /** Faux après une faillite ou un rachat. */
  alive: z.boolean(),
  /** Racheté par un autre rival (Synergix par Gigacorp). */
  boughtBy: RivalIdSchema.nullable(),
  /** Dernière action contre le joueur, et son sprint. */
  lastAction: RivalActionSchema.nullable(),
  lastActionSprint: z.number().int().nullable(),
  /** Utilisateurs à chaque démo (les plus récents à la fin). */
  history: z.array(z.number()),
});
export type RivalState = z.infer<typeof RivalStateSchema>;
