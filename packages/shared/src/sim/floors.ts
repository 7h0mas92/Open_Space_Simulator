import { z } from 'zod';
import type { StoryRewardId } from '../story/rewards.js';
import { PHASES, type Phase } from '../game.js';
import type { LocalizedText } from '../i18n.js';
import { ANNEX_KINDS, ANNEXES } from './funding.js';
import { VENTURES } from './ventures.js';
import type { WallOffice } from './walls.js';

/**
 * Revêtements de sol achetés dans le mode construction : une matière (lino, moquette, béton
 * ciré, parquet, carrelage...) et une teinte sobre au choix, posées pièce par pièce.
 *
 * Une zone de sol par pièce : l'open space, la cuisine, la salle de réunion, le coin détente
 * (Série A), la cantine (Licorne), chaque aile de filiale et chaque annexe. Une pièce sans
 * revêtement garde son sol d'origine (celui tiré de la graine). Chaque zone couverte a un
 * petit effet réel (moral, parfois qualité ou hype). Aucun tirage aléatoire : une partie sans
 * nouveau sol reste identique (replays, Daily).
 */

export const FLOOR_ZONES = [
  'open',
  'kitchen',
  'meeting',
  'lounge',
  'canteen',
  'wing-1',
  'wing-2',
  'wing-3',
  'arcade',
  'garden',
  'auditorium',
] as const;
export const FloorZoneSchema = z.enum(FLOOR_ZONES);
export type FloorZone = z.infer<typeof FloorZoneSchema>;

export const FLOOR_MATERIAL_IDS = [
  'vinyl',
  'carpet',
  'concrete',
  'tiles',
  'planks',
  'chevron',
  'terrazzo',
  'marble',
  // Récompenses du mode Histoire
  'datacenter',
  'checker',
] as const;
export const FloorMaterialIdSchema = z.enum(FLOOR_MATERIAL_IDS);
export type FloorMaterialId = z.infer<typeof FloorMaterialIdSchema>;

/** Teintes sobres : des neutres pour la plupart des matières, des essences pour le bois. */
export const FLOOR_TINTS = [
  'white',
  'pearl',
  'sand',
  'taupe',
  'grey',
  'slate',
  'sage',
  'charcoal',
  'oak-light',
  'oak',
  'oak-smoked',
  'walnut',
] as const;
export const FloorTintSchema = z.enum(FLOOR_TINTS);
export type FloorTint = z.infer<typeof FloorTintSchema>;

/** Un sol posé : sa matière et sa teinte. */
export const FloorFinishSchema = z.object({
  material: FloorMaterialIdSchema,
  tint: FloorTintSchema,
});
export type FloorFinish = z.infer<typeof FloorFinishSchema>;

/** Sol de chaque pièce (pièce absente : le sol d'origine). */
export const FloorFinishesSchema = z.partialRecord(FloorZoneSchema, FloorFinishSchema);
export type FloorFinishes = z.infer<typeof FloorFinishesSchema>;

/** Effets d'une pièce couverte, chaque jour (mêmes unités que le mobilier et les murs). */
export interface FloorMaterialEffects {
  readonly moral: number;
  readonly quality?: number;
  readonly hypePerDay?: number;
}

export interface FloorMaterial {
  readonly id: FloorMaterialId;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  /** Prix pour couvrir une pièce (l'ancien sol n'est pas remboursé). */
  readonly price: number;
  readonly minPhase: Phase;
  /** Teintes proposées, la première est celle choisie par défaut. */
  readonly tints: readonly [FloorTint, ...FloorTint[]];
  readonly effects: FloorMaterialEffects;
  /** Récompense du mode Histoire qui la débloque (absent : en vente pour tous). */
  readonly unlock?: StoryRewardId;
}

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

/** Nom de chaque teinte (le même pour toutes les matières). */
export const FLOOR_TINT_NAMES: Record<FloorTint, LocalizedText> = {
  white: t('Blanc cassé', 'Off-white'),
  pearl: t('Gris perle', 'Pearl grey'),
  sand: t('Sable', 'Sand'),
  taupe: t('Taupe', 'Taupe'),
  grey: t('Gris', 'Grey'),
  slate: t('Bleu ardoise', 'Slate blue'),
  sage: t('Vert sauge', 'Sage green'),
  charcoal: t('Anthracite', 'Charcoal'),
  'oak-light': t('Chêne clair', 'Light oak'),
  oak: t('Chêne naturel', 'Natural oak'),
  'oak-smoked': t('Chêne fumé', 'Smoked oak'),
  walnut: t('Noyer', 'Walnut'),
};

const WOODS = ['oak', 'oak-light', 'oak-smoked', 'walnut'] as const;

/** Les matières, de la moins chère à la plus chère. */
export const FLOOR_MATERIALS: readonly FloorMaterial[] = [
  {
    id: 'vinyl',
    name: t('Sol vinyle', 'Vinyl flooring'),
    description: t(
      'Se nettoie d’un coup d’éponge, même après le pot de départ.',
      'Wipes clean with a sponge, even after the farewell drinks.',
    ),
    price: 300,
    minPhase: 'GARAGE',
    tints: ['pearl', 'sand', 'sage', 'grey'],
    effects: { moral: 0.015 },
  },
  {
    id: 'carpet',
    name: t('Moquette en dalles', 'Carpet tiles'),
    description: t(
      'Étouffe le bruit des claviers mécaniques. Et des disputes.',
      'Muffles mechanical keyboards. And arguments.',
    ),
    price: 600,
    minPhase: 'GARAGE',
    tints: ['grey', 'pearl', 'charcoal', 'slate', 'sand'],
    effects: { moral: 0.025 },
  },
  {
    id: 'concrete',
    name: t('Béton ciré', 'Polished concrete'),
    description: t(
      'Look loft industriel : +hype, les investisseurs se croient à Berlin.',
      'Industrial loft look: +hype, investors think they’re in Berlin.',
    ),
    price: 900,
    minPhase: 'GARAGE',
    tints: ['grey', 'pearl', 'taupe', 'charcoal'],
    effects: { moral: 0.02, hypePerDay: 0.002 },
  },
  {
    id: 'tiles',
    name: t('Carrelage grand format', 'Large-format tiles'),
    description: t(
      'Joints fins, carreaux bien alignés : la designeuse approuve le padding.',
      'Thin grout, perfectly aligned: the designer approves the padding.',
    ),
    price: 1200,
    minPhase: 'SEED',
    tints: ['white', 'pearl', 'sand', 'charcoal'],
    effects: { moral: 0.02, quality: 0.002 },
  },
  {
    id: 'planks',
    name: t('Parquet en lames', 'Plank parquet'),
    description: t(
      'Du vrai bois sous les pieds : on s’y sent chez soi, un peu trop.',
      'Real wood underfoot: feels like home, maybe too much.',
    ),
    price: 1500,
    minPhase: 'GARAGE',
    tints: WOODS,
    effects: { moral: 0.03 },
  },
  {
    id: 'chevron',
    name: t('Parquet en chevrons', 'Chevron parquet'),
    description: t(
      'Le point de Hongrie des appartements haussmanniens : +hype aux visites.',
      'The Parisian apartment classic: +hype during office tours.',
    ),
    price: 3000,
    minPhase: 'SEED',
    tints: WOODS,
    effects: { moral: 0.035, hypePerDay: 0.003 },
  },
  {
    id: 'terrazzo',
    name: t('Terrazzo', 'Terrazzo'),
    description: t(
      'Éclats de pierre dans le béton : sobre, mais ça se remarque.',
      'Stone chips set in concrete: understated, yet noticed.',
    ),
    price: 4500,
    minPhase: 'SERIES_A',
    tints: ['white', 'pearl', 'sand', 'charcoal'],
    effects: { moral: 0.04, hypePerDay: 0.004 },
  },
  {
    id: 'marble',
    name: t('Marbre poli', 'Polished marble'),
    description: t(
      'Grandes dalles veinées : le hall d’une licorne, l’écho en prime.',
      'Large veined slabs: a unicorn’s lobby, echo included.',
    ),
    price: 7000,
    minPhase: 'UNICORN',
    tints: ['white', 'pearl', 'charcoal'],
    effects: { moral: 0.045, hypePerDay: 0.007 },
  },
  {
    id: 'datacenter',
    name: t('Dalles techniques', 'Raised floor tiles'),
    description: t(
      'Récompense du mode Histoire : dalles perforées de salle des serveurs, voyants compris.',
      'Story mode reward: perforated server-room tiles, status lights included.',
    ),
    price: 1800,
    minPhase: 'GARAGE',
    tints: ['grey', 'pearl', 'charcoal', 'slate'],
    effects: { moral: 0.03, quality: 0.002 },
    unlock: 'floor-datacenter',
  },
  {
    id: 'checker',
    name: t('Damier rétro', 'Retro checkerboard'),
    description: t(
      'Récompense du mode Histoire : le damier noir et blanc d’une salle d’arcade.',
      'Story mode reward: an arcade’s black-and-white checkerboard.',
    ),
    price: 2500,
    minPhase: 'GARAGE',
    tints: ['charcoal', 'slate', 'sage', 'taupe'],
    effects: { moral: 0.035, hypePerDay: 0.003 },
    unlock: 'floor-checker',
  },
];

const MATERIALS_BY_ID = new Map(FLOOR_MATERIALS.map((material) => [material.id, material]));

export function getFloorMaterial(id: string): FloorMaterial | undefined {
  return MATERIALS_BY_ID.get(id as FloorMaterialId);
}

/** La teinte est-elle proposée pour cette matière ? */
export function floorTintAllowed(material: FloorMaterial, tint: string): tint is FloorTint {
  return (material.tints as readonly string[]).includes(tint);
}

/** Même matière et même teinte ? */
export function sameFloor(a: FloorFinish | undefined, b: FloorFinish | undefined): boolean {
  return !!a && !!b && a.material === b.material && a.tint === b.tint;
}

const phaseIndex = (phase: Phase) => PHASES.indexOf(phase);

/**
 * La pièce existe-t-elle dans ce bureau ? Cuisine et salle de réunion arrivent en Seed ; le
 * coin détente n'existe qu'en Série A (la Licorne a une cantine à la place) ; puis les ailes
 * des filiales et les annexes. Le bureau vu par les sols est le même que celui des murs.
 */
export function floorZoneExists(zone: FloorZone, office: WallOffice): boolean {
  const phase = phaseIndex(office.phase);
  switch (zone) {
    case 'open':
      return true;
    case 'kitchen':
    case 'meeting':
      return phase >= phaseIndex('SEED');
    case 'lounge':
      return office.phase === 'SERIES_A';
    case 'canteen':
      return phase >= phaseIndex('UNICORN');
    case 'wing-1':
    case 'wing-2':
    case 'wing-3':
      return Math.min(office.wings, VENTURES.maxFounded) >= Number(zone.slice('wing-'.length));
    default: {
      const annex = ANNEX_KINDS.indexOf(zone);
      return annex >= 0 && annex < Math.min(office.annexes, ANNEXES.max);
    }
  }
}

/** Pièces du bureau qui peuvent recevoir un sol, dans l'ordre d'affichage. */
export function floorZones(office: WallOffice): FloorZone[] {
  return FLOOR_ZONES.filter((zone) => floorZoneExists(zone, office));
}

/** Effets cumulés des sols posés dans les pièces qui existent. */
export function floorFinishEffects(
  finishes: FloorFinishes,
  office: WallOffice,
): Required<FloorMaterialEffects> {
  const total = { moral: 0, quality: 0, hypePerDay: 0 };
  for (const zone of FLOOR_ZONES) {
    const finish = finishes[zone];
    const material = finish ? getFloorMaterial(finish.material) : undefined;
    if (!material || !floorZoneExists(zone, office)) continue;
    total.moral += material.effects.moral;
    total.quality += material.effects.quality ?? 0;
    total.hypePerDay += material.effects.hypePerDay ?? 0;
  }
  return total;
}
