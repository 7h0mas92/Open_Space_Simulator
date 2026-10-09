import { z } from 'zod';
import type { Phase } from '../game.js';
import type { LocalizedText } from '../i18n.js';

/**
 * Animaux de compagnie : des chats qui se baladent dans l'open space.
 *
 * On n'adopte pas un chat sur un coup de tête : il faut d'abord avoir posé dans le bureau une
 * litière, une gamelle (eau et croquettes) et un arbre à chat (objets du mode construction,
 * voir `petNeed` dans `furniture.ts`). L'adoption coûte cher (vétérinaire, vaccins, puce) et le
 * bureau accueille au plus 5 chats.
 *
 * Un chat bien installé remonte le moral de l'équipe et fait le buzz sur les réseaux, mais il
 * dort sur les claviers (un peu moins de productivité). Si l'on retire son équipement après
 * l'adoption, il boude : le moral baisse au lieu de monter.
 *
 * Aucun tirage aléatoire : le nom du chat est dérivé de la graine par un hachage, jamais par le
 * RNG de la partie. Une partie sans chat reste identique (replays, Daily).
 */

export const PET_COATS = ['ginger', 'black', 'white', 'tabby', 'siamese', 'calico'] as const;
export const PetCoatSchema = z.enum(PET_COATS);
export type PetCoat = z.infer<typeof PetCoatSchema>;

/** Équipement indispensable à l'adoption : un objet de chaque sorte doit être posé. */
export const PET_NEEDS = ['litter', 'bowl', 'tree'] as const;
export type PetNeed = (typeof PET_NEEDS)[number];

export const PetSchema = z.object({
  /** Identifiant stable (`cat-1`, `cat-2`…), qui sert aussi de graine à son animation. */
  id: z.string(),
  coat: PetCoatSchema,
  name: z.string(),
  adoptedSprint: z.number().int(),
});
export type Pet = z.infer<typeof PetSchema>;

/** Effets d'un chat sur l'équipe, chaque jour (mêmes unités que le mobilier). */
export interface PetEffects {
  moral: number;
  hypePerDay: number;
  teamProductivity: number;
}

export const PETS = {
  /** Nombre maximum de chats dans le bureau. */
  max: 5,
  /** Prix d'une adoption : frais de refuge, vétérinaire, vaccins, puce, assurance. */
  price: 5000,
  minPhase: 'GARAGE' as Phase,
  /** Chat heureux (litière, gamelle et arbre à chat posés). */
  happy: { moral: 0.15, hypePerDay: 0.03, teamProductivity: -0.004 } satisfies PetEffects,
  /** Chat qui boude (il lui manque une partie de son équipement). */
  sulking: { moral: -0.2, hypePerDay: 0, teamProductivity: -0.004 } satisfies PetEffects,
  /** Moral perdu par chaque dev quand un chat est confié à une famille. */
  rehomeMoral: -5,
} as const;

/** Noms de chats, piochés par hachage de la graine. */
export const PET_NAMES = [
  'Segfault',
  'Kernel',
  'Pixel',
  'Sudo',
  'Null',
  'Cookie',
  'Patch',
  'Async',
  'Lambda',
  'Mochi',
  'Tofu',
  'Biscotte',
  'Croquette',
  'Bash',
  'Ruby',
  'Docker',
  'Linus',
  'Grace',
  'Ada',
  'Captcha',
  'Ctrl',
  'Regex',
  'Debug',
  'Commit',
  'Merge',
  'Sprint',
  'Kanban',
  'Wifi',
  'Byte',
  'Pancake',
] as const;

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

/** Libellé de chaque robe de chat. */
export const PET_COAT_NAMES: Record<PetCoat, LocalizedText> = {
  ginger: t('Roux', 'Ginger'),
  black: t('Noir', 'Black'),
  white: t('Blanc', 'White'),
  tabby: t('Tigré', 'Tabby'),
  siamese: t('Siamois', 'Siamese'),
  calico: t('Écaille de tortue', 'Calico'),
};
