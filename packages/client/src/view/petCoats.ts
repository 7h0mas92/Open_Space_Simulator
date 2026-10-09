/**
 * Robes des chats : couleurs lues par le rendu (modèle 3D en formes Three.js) et par
 * l'interface (pastilles du choix de la robe). La simulation ne connaît que l'identifiant.
 */
import { PET_COATS, type PetCoat } from '@oss/shared';

export { PET_COATS, type PetCoat };

export interface CoatColors {
  /** Couleur principale du pelage. */
  readonly base: number;
  /** Ventre, museau et pattes. */
  readonly belly: number;
  /** Rayures, extrémités (siamois) ou taches (écaille de tortue). */
  readonly accent: number;
  readonly pattern: 'solid' | 'stripes' | 'points' | 'patches';
  /** Couleur des yeux. */
  readonly eyes: number;
  /** Deuxième couleur de taches (écaille de tortue). */
  readonly accent2?: number;
}

export const COAT_COLORS: Record<PetCoat, CoatColors> = {
  ginger: {
    base: 0xe0893c,
    belly: 0xf6dcb8,
    accent: 0xb9622a,
    pattern: 'stripes',
    eyes: 0x6fa83a,
  },
  black: { base: 0x26262d, belly: 0x2f2f37, accent: 0x1b1b20, pattern: 'solid', eyes: 0xe8c832 },
  white: { base: 0xf4f2ee, belly: 0xffffff, accent: 0xe6e2da, pattern: 'solid', eyes: 0x4a8fd8 },
  tabby: { base: 0x8e8a84, belly: 0xd9d4cb, accent: 0x4c4945, pattern: 'stripes', eyes: 0x9bbf3a },
  siamese: {
    base: 0xefe2cb,
    belly: 0xf7eedf,
    accent: 0x5a4232,
    pattern: 'points',
    eyes: 0x4a8fd8,
  },
  calico: {
    base: 0xf4eee4,
    belly: 0xffffff,
    accent: 0xe08a3c,
    accent2: 0x2c2a2a,
    pattern: 'patches',
    eyes: 0xd9a531,
  },
};

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** Pastille CSS d'une robe (dégradé pour les robes à motifs). */
export function coatSwatchCss(coat: PetCoat): string {
  const c = COAT_COLORS[coat];
  switch (c.pattern) {
    case 'solid':
      return hex(c.base);
    case 'stripes':
      return `repeating-linear-gradient(135deg, ${hex(c.base)} 0 4px, ${hex(c.accent)} 4px 7px)`;
    case 'points':
      return `radial-gradient(circle at 50% 45%, ${hex(c.base)} 40%, ${hex(c.accent)} 75%)`;
    case 'patches':
      return `conic-gradient(${hex(c.base)} 0 35%, ${hex(c.accent)} 35% 65%, ${hex(c.accent2 ?? c.accent)} 65% 85%, ${hex(c.base)} 85%)`;
  }
}
