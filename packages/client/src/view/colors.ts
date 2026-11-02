/**
 * Teintes des couleurs de mobilier. La simulation ne connaît que l'identifiant de la couleur
 * (`FURNITURE_COLORS`) ; le rendu repeint les matériaux listés dans `paint` du catalogue et
 * l'interface affiche ces teintes dans le nuancier.
 */
import { FURNITURE_COLORS, type FurnitureColor } from '@oss/shared';

export { FURNITURE_COLORS, type FurnitureColor };

/** Teinte de chaque couleur (`natural` n'en a pas : on garde celles du modèle). */
export const COLOR_HEX: Record<Exclude<FurnitureColor, 'natural'>, number> = {
  white: 0xf1eee6,
  graphite: 0x3e4352,
  walnut: 0x6e4529,
  red: 0xd9493b,
  orange: 0xee8a35,
  yellow: 0xf2c641,
  green: 0x4fa865,
  teal: 0x2b9e98,
  blue: 0x3f73d0,
  purple: 0x8460c9,
  pink: 0xec8cb0,
  gold: 0xd4a72c,
  neon: 0x39ff8a,
};

/** Teinte CSS d'une pastille du nuancier. */
export function swatchCss(color: FurnitureColor): string {
  if (color === 'natural') return 'linear-gradient(135deg, #e6a063 50%, #f05f57 50%)';
  return `#${COLOR_HEX[color].toString(16).padStart(6, '0')}`;
}

/** Les matériaux suivant le premier sont assombris pour garder le relief du modèle. */
export const SECONDARY_SHADE = 0.72;
