import { z } from 'zod';
import type { Phase } from '../game.js';
import type { LocalizedText } from '../i18n.js';

/**
 * Ordinateurs des postes de travail : chaque bureau de dev et chaque bureau debout a le sien,
 * choisi dans le mode construction (bouton « Ordinateur » de l'objet sélectionné).
 *
 * - une tour posée au sol à côté du bureau, avec le clavier QWERTY sur le plateau : la tour sobre
 *   (d'origine, gratuite) ou l'une des trois tours gaming ;
 * - ou un portable pro en aluminium, posé à la place du clavier (le clavier disparaît).
 *
 * Un bureau sans choix enregistré a la tour sobre : les anciennes sauvegardes restent valides.
 * Changer d'ordinateur rembourse l'ancien au prix de revente et paie le nouveau ; sa valeur
 * suit le bureau (revente, inventaire). Aucun tirage aléatoire : replays et Daily inchangés.
 */

export const COMPUTER_IDS = [
  'tower',
  'gaming-neon',
  'gaming-liquid',
  'gaming-titan',
  'pro-laptop',
] as const;
export const ComputerIdSchema = z.enum(COMPUTER_IDS);
export type ComputerId = z.infer<typeof ComputerIdSchema>;

/** Ordinateur d'un bureau qui n'en a pas choisi. */
export const DEFAULT_COMPUTER: ComputerId = 'tower';

/** Meubles qui reçoivent un ordinateur (le bureau du garage garde son vieux portable). */
export const COMPUTER_DESKS: readonly string[] = ['desk', 'standing-desk'];

export interface ComputerEffects {
  /** Bonus de productivité du dev installé à ce poste (s'ajoute à celui du bureau). */
  seatProductivity?: number;
  /** Moral gagné chaque jour par chaque dev (effet de groupe, comme le mobilier). */
  moral?: number;
  /** Bonus de qualité de toute l'équipe (+0.003 = +0,3 %). */
  quality?: number;
  hypePerDay?: number;
}

export interface ComputerDefinition {
  id: ComputerId;
  name: LocalizedText;
  description: LocalizedText;
  price: number;
  minPhase: Phase;
  /** Portable : il se pose sur le plateau à la place du clavier. */
  laptop: boolean;
  effects: ComputerEffects;
}

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

export const COMPUTERS: readonly ComputerDefinition[] = [
  {
    id: 'tower',
    name: t('Tour sobre', 'Plain tower'),
    description: t(
      "Boîtier gris, une LED bleue, zéro fioriture. Livrée avec le bureau. Ça compile, c'est tout.",
      'Grey case, one blue LED, no frills. Comes with the desk. It compiles, that’s all.',
    ),
    price: 0,
    minPhase: 'GARAGE',
    laptop: false,
    effects: {},
  },
  {
    id: 'gaming-neon',
    name: t('Tour gaming « Néon »', '“Neon” gaming tower'),
    description: t(
      'Vitre latérale et trois ventilateurs RGB. +1 % de productivité au poste, léger +moral.',
      'Glass side panel and three RGB fans. +1% productivity at this desk, slight +morale.',
    ),
    price: 900,
    minPhase: 'GARAGE',
    laptop: false,
    effects: { seatProductivity: 0.01, moral: 0.02 },
  },
  {
    id: 'gaming-liquid',
    name: t('Tour gaming watercooling', 'Liquid-cooled gaming tower'),
    description: t(
      'Boîtier aquarium, boucle de refroidissement fluo. +2 % de productivité au poste, +moral.',
      'Fish-tank case, neon cooling loop. +2% productivity at this desk, +morale.',
    ),
    price: 2_200,
    minPhase: 'SEED',
    laptop: false,
    effects: { seatProductivity: 0.02, moral: 0.04 },
  },
  {
    id: 'gaming-titan',
    name: t('Tour gaming XXL « Titan »', '“Titan” XXL gaming tower'),
    description: t(
      'Un mètre de haut, chauffe le bureau en hiver. +3 % de productivité au poste, +moral, +hype.',
      'Waist-high, heats the office in winter. +3% productivity at this desk, +morale, +hype.',
    ),
    price: 4_500,
    minPhase: 'SERIES_A',
    laptop: false,
    effects: { seatProductivity: 0.03, moral: 0.05, hypePerDay: 0.005 },
  },
  {
    id: 'pro-laptop',
    name: t('MacBook Pro', 'MacBook Pro'),
    description: t(
      'Portable pro en aluminium, posé à la place du clavier. +1 % de productivité, +qualité, +hype en démo.',
      'Aluminium pro laptop, in place of the keyboard. +1% productivity, +quality, +hype at demos.',
    ),
    price: 2_800,
    minPhase: 'GARAGE',
    laptop: true,
    effects: { seatProductivity: 0.01, quality: 0.003, hypePerDay: 0.005 },
  },
];

export function getComputer(id: ComputerId | undefined): ComputerDefinition {
  return (
    COMPUTERS.find((c) => c.id === (id ?? DEFAULT_COMPUTER)) ?? (COMPUTERS[0] as ComputerDefinition)
  );
}

/** Ce meuble reçoit-il un ordinateur ? */
export function hasComputer(itemId: string): boolean {
  return COMPUTER_DESKS.includes(itemId);
}
