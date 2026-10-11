import { z } from 'zod';
import type { Phase } from '../game.js';
import type { LocalizedText } from '../i18n.js';

/**
 * Écrans des postes de travail, choisis séparément du bureau.
 *
 * Un bureau de dev ou un bureau debout porte un écran : un modèle (5 au choix, dont un
 * incurvé), une taille (3 par modèle) et une fixation (pied ou bras articulé). Le choix est
 * gardé sur le meuble lui-même (champ `monitor` du composant `furniture`) : il le suit quand on
 * le déplace, le range ou le revend. Absent, c'est l'écran livré avec le bureau (bureautique
 * 27 pouces sur pied) : les anciennes sauvegardes, les replays et le Daily ne changent pas.
 *
 * Chaque écran a un effet réel sur le dev assis devant (productivité, parfois qualité, moral ou
 * dette), le bras articulé le fatigue un peu moins. L'écran livré n'apporte rien de plus que le
 * bureau. Aucun tirage aléatoire.
 */

export const MONITOR_MODELS = ['office', 'portrait', 'gaming', 'slim', 'curved'] as const;
export const MonitorModelSchema = z.enum(MONITOR_MODELS);
export type MonitorModel = z.infer<typeof MonitorModelSchema>;

export const MONITOR_SIZES = ['small', 'medium', 'large'] as const;
export const MonitorSizeSchema = z.enum(MONITOR_SIZES);
export type MonitorSize = z.infer<typeof MonitorSizeSchema>;

/** Fixation : le pied d'origine du modèle, ou un bras articulé pincé au bord du bureau. */
export const MONITOR_MOUNTS = ['stand', 'arm'] as const;
export const MonitorMountSchema = z.enum(MONITOR_MOUNTS);
export type MonitorMount = z.infer<typeof MonitorMountSchema>;

/** Écran posé sur un bureau, avec ce qu'il a coûté (la moitié est rendue à la revente). */
export const MonitorSetupSchema = z.object({
  model: MonitorModelSchema,
  size: MonitorSizeSchema,
  mount: MonitorMountSchema,
  price: z.number().nonnegative(),
});
export type MonitorSetup = z.infer<typeof MonitorSetupSchema>;

/** Choix d'un écran, sans son prix. */
export type MonitorChoice = Pick<MonitorSetup, 'model' | 'size' | 'mount'>;

/** L'écran livré avec chaque bureau (gratuit, sans effet de plus que le bureau). */
export const DEFAULT_MONITOR: Readonly<MonitorChoice> = {
  model: 'office',
  size: 'medium',
  mount: 'stand',
};

/** Effets d'un écran, pour le dev assis devant (mêmes unités que le mobilier). */
export interface MonitorEffects {
  /** Ajouté au bonus de productivité du poste (+0.02 = +2 %). */
  readonly productivity: number;
  /** Bonus de qualité de toute l'équipe. */
  readonly quality?: number;
  /** Moral gagné chaque jour par chaque dev. */
  readonly moral?: number;
  /** Dette technique chaque jour (négatif : elle baisse). */
  readonly debtPerDay?: number;
}

export interface MonitorDefinition {
  readonly id: MonitorModel;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly minPhase: Phase;
  /** Diagonale de chaque taille, en pouces. */
  readonly inches: readonly [number, number, number];
  /** Prix de chaque taille, sur pied. */
  readonly prices: readonly [number, number, number];
  /** Effets de chaque taille. */
  readonly effects: readonly [MonitorEffects, MonitorEffects, MonitorEffects];
}

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

export const MONITORS: readonly MonitorDefinition[] = [
  {
    id: 'office',
    name: t('Écran bureautique', 'Office monitor'),
    description: t(
      'Celui livré avec le bureau. Bords épais, pied carré, fait le travail.',
      'The one that came with the desk. Thick bezels, square foot, does the job.',
    ),
    minPhase: 'GARAGE',
    inches: [24, 27, 32],
    prices: [120, 180, 260],
    effects: [{ productivity: 0 }, { productivity: 0 }, { productivity: 0.01 }],
  },
  {
    id: 'portrait',
    name: t('Écran pivoté vertical', 'Vertical pivot monitor'),
    description: t(
      'Tourné à la verticale : tout le fichier tient à l’écran, la dette baisse un peu.',
      'Turned upright: the whole file fits on screen, debt goes down a little.',
    ),
    minPhase: 'GARAGE',
    inches: [24, 27, 32],
    prices: [200, 280, 380],
    effects: [
      { productivity: 0.01, debtPerDay: -0.01 },
      { productivity: 0.015, debtPerDay: -0.015 },
      { productivity: 0.02, debtPerDay: -0.02 },
    ],
  },
  {
    id: 'gaming',
    name: t('Écran gaming 165 Hz', '165 Hz gaming monitor'),
    description: t(
      'Pied en V et liseré lumineux. « C’est pour compiler plus vite. » +productivité, +moral.',
      'V-shaped foot and a light strip. “It compiles faster.” +productivity, +morale.',
    ),
    minPhase: 'GARAGE',
    inches: [24, 27, 32],
    prices: [300, 420, 600],
    effects: [
      { productivity: 0.02, moral: 0.01 },
      { productivity: 0.025, moral: 0.01 },
      { productivity: 0.03, moral: 0.015 },
    ],
  },
  {
    id: 'slim',
    name: t('Écran pro ultra-fin', 'Ultra-thin pro monitor'),
    description: t(
      'Bords invisibles, pied en aluminium, couleurs calibrées : +qualité de l’équipe.',
      'Invisible bezels, aluminium foot, calibrated colours: +team quality.',
    ),
    minPhase: 'SEED',
    inches: [24, 27, 32],
    prices: [350, 480, 650],
    effects: [
      { productivity: 0.01, quality: 0.003 },
      { productivity: 0.015, quality: 0.004 },
      { productivity: 0.02, quality: 0.005 },
    ],
  },
  {
    id: 'curved',
    name: t('Écran incurvé ultra-large', 'Curved ultrawide monitor'),
    description: t(
      'Trois fenêtres côte à côte sans tourner la tête. Le plus productif de la boutique.',
      'Three windows side by side without turning your head. The most productive in the shop.',
    ),
    minPhase: 'SEED',
    inches: [34, 38, 45],
    prices: [700, 950, 1300],
    effects: [{ productivity: 0.03 }, { productivity: 0.04 }, { productivity: 0.05 }],
  },
];

/** Bras articulé : supplément et fatigue en moins pour le dev assis devant (0.05 = −5 %). */
export const MONITOR_ARM = { price: 150, energySaving: 0.05 } as const;

const BY_MODEL = new Map<string, MonitorDefinition>(MONITORS.map((m) => [m.id, m]));

export function getMonitor(model: string): MonitorDefinition | undefined {
  return BY_MODEL.get(model);
}

const sizeIndex = (size: MonitorSize): 0 | 1 | 2 => MONITOR_SIZES.indexOf(size) as 0 | 1 | 2;

/** Prix d'un écran (taille et fixation comprises). */
export function monitorPrice(choice: MonitorChoice): number {
  const model = getMonitor(choice.model);
  if (!model) return 0;
  return model.prices[sizeIndex(choice.size)] + (choice.mount === 'arm' ? MONITOR_ARM.price : 0);
}

/** Diagonale d'un écran, en pouces. */
export function monitorInches(choice: Pick<MonitorChoice, 'model' | 'size'>): number {
  return getMonitor(choice.model)?.inches[sizeIndex(choice.size)] ?? 0;
}

/** Effets d'un écran pour le dev assis devant, fixation comprise. */
export function monitorEffects(
  choice: MonitorChoice,
): Required<MonitorEffects> & { energySaving: number } {
  const effects = getMonitor(choice.model)?.effects[sizeIndex(choice.size)];
  return {
    productivity: effects?.productivity ?? 0,
    quality: effects?.quality ?? 0,
    moral: effects?.moral ?? 0,
    debtPerDay: effects?.debtPerDay ?? 0,
    energySaving: choice.mount === 'arm' ? MONITOR_ARM.energySaving : 0,
  };
}

/** Deux choix d'écran identiques ? */
export function sameMonitor(a: MonitorChoice, b: MonitorChoice): boolean {
  return a.model === b.model && a.size === b.size && a.mount === b.mount;
}
