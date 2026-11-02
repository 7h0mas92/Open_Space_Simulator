import { z } from 'zod';
import { PHASES, type Phase } from '../game.js';
import type { LocalizedText } from '../i18n.js';
import { ANNEX_KINDS, ANNEXES } from './funding.js';
import { VENTURES } from './ventures.js';
import type { StoryRewardId } from '../story/rewards.js';

/**
 * Revêtements des murs : peintures et papiers peints achetés dans le mode construction.
 *
 * Le bureau n'a que deux vrais murs, au fond et à gauche (les murs avant sont bas pour que la
 * caméra isométrique voie l'intérieur). Chacun est découpé en zones, une par pièce qui le
 * touche : le mur du fond de l'open space, celui de la cuisine, celui de chaque aile de
 * filiale ; le mur de gauche de l'open space et celui de chaque annexe. Une zone garde son
 * revêtement quand le bureau s'agrandit (le mur de l'open space s'allonge avec lui).
 *
 * Chaque zone couverte a un petit effet réel (moral, parfois qualité ou hype), plus fort pour
 * les papiers peints chers. Aucun tirage aléatoire : une partie sans revêtement reste
 * identique (replays, Daily).
 */

/** Zones de mur : `back` (mur du fond, le long de x) ou `left` (mur de gauche, le long de z). */
export const WALL_ZONES = [
  'back-open',
  'back-kitchen',
  'back-wing-1',
  'back-wing-2',
  'back-wing-3',
  'left-open',
  'left-arcade',
  'left-garden',
  'left-auditorium',
] as const;
export const WallZoneSchema = z.enum(WALL_ZONES);
export type WallZone = z.infer<typeof WallZoneSchema>;

export const WALL_FINISH_IDS = [
  // Peintures
  'cream',
  'sage',
  'teal',
  'terracotta',
  'mustard',
  'blush',
  'navy',
  'anthracite',
  // Papiers peints, du moins cher au plus cher
  'stripes',
  'dots',
  'herringbone',
  'brick',
  'jungle',
  'wainscot',
  'chalkboard',
  'artdeco',
  'coderain',
  // Récompenses du mode Histoire
  'blueprint',
  'postit',
] as const;
export const WallFinishIdSchema = z.enum(WALL_FINISH_IDS);
export type WallFinishId = z.infer<typeof WallFinishIdSchema>;

/** Revêtement de chaque zone de mur (zone absente : le mur crème d'origine). */
export const WallFinishesSchema = z.partialRecord(WallZoneSchema, WallFinishIdSchema);
export type WallFinishes = z.infer<typeof WallFinishesSchema>;

/** Effets d'une zone couverte, chaque jour (mêmes unités que le mobilier). */
export interface WallFinishEffects {
  readonly moral: number;
  readonly quality?: number;
  readonly hypePerDay?: number;
}

export interface WallFinish {
  readonly id: WallFinishId;
  readonly kind: 'paint' | 'wallpaper';
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  /** Prix pour couvrir une zone de mur (l'ancien revêtement n'est pas remboursé). */
  readonly price: number;
  readonly minPhase: Phase;
  readonly effects: WallFinishEffects;
  /** Récompense du mode Histoire qui le débloque (absent : en vente pour tous). */
  readonly unlock?: StoryRewardId;
}

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

const PAINT_PRICE = 400;
const PAINT_EFFECTS: WallFinishEffects = { moral: 0.02 };

const paint = (id: WallFinishId, name: LocalizedText, description: LocalizedText): WallFinish => ({
  id,
  kind: 'paint',
  name,
  description,
  price: PAINT_PRICE,
  minPhase: 'GARAGE',
  effects: PAINT_EFFECTS,
});

export const WALL_FINISHES: readonly WallFinish[] = [
  paint(
    'cream',
    t('Crème d’origine', 'Original cream'),
    t('Le blanc cassé du bail commercial. Rassurant.', 'The lease’s eggshell. Reassuring.'),
  ),
  paint(
    'sage',
    t('Vert sauge', 'Sage green'),
    t('Validé par trois comptes Instagram de déco.', 'Approved by three interior Instagrams.'),
  ),
  paint(
    'teal',
    t('Bleu canard', 'Teal'),
    t('Le canard en plastique s’y sent chez lui.', 'The rubber duck feels right at home.'),
  ),
  paint(
    'terracotta',
    t('Terracotta', 'Terracotta'),
    t('Ambiance « on a levé à Marseille ».', '“We raised in Marseille” vibes.'),
  ),
  paint(
    'mustard',
    t('Jaune moutarde', 'Mustard yellow'),
    t('Réveille mieux que le café. Presque.', 'Wakes you up better than coffee. Almost.'),
  ),
  paint(
    'blush',
    t('Rose poudré', 'Blush pink'),
    t('La designeuse a enfin dit « oui ».', 'The designer finally said “yes”.'),
  ),
  paint(
    'navy',
    t('Bleu nuit', 'Midnight blue'),
    t('Comme le mode sombre, mais en vrai.', 'Like dark mode, but in real life.'),
  ),
  paint(
    'anthracite',
    t('Anthracite', 'Charcoal'),
    t('Sobre, sérieux, prêt pour la due diligence.', 'Sober, serious, due-diligence ready.'),
  ),
  {
    id: 'stripes',
    kind: 'wallpaper',
    name: t('Rayures tennis', 'Pinstripes'),
    description: t(
      'Deux tons, des lignes bien droites. Contrairement au code.',
      'Two tones, perfectly straight lines. Unlike the code.',
    ),
    price: 900,
    minPhase: 'GARAGE',
    effects: { moral: 0.03 },
  },
  {
    id: 'dots',
    kind: 'wallpaper',
    name: t('Pois rétro', 'Retro polka dots'),
    description: t(
      'Chaque pois est un ticket Jira. Ne comptez pas.',
      'Every dot is a Jira ticket. Don’t count them.',
    ),
    price: 1200,
    minPhase: 'GARAGE',
    effects: { moral: 0.03 },
  },
  {
    id: 'herringbone',
    kind: 'wallpaper',
    name: t('Chevrons', 'Herringbone'),
    description: t(
      'Motif graphique qui fait « agence de design ».',
      'A graphic pattern that screams “design agency”.',
    ),
    price: 1800,
    minPhase: 'GARAGE',
    effects: { moral: 0.035 },
  },
  {
    id: 'brick',
    kind: 'wallpaper',
    name: t('Briques de loft', 'Loft brick'),
    description: t(
      'Fausses briques, vraie crédibilité : +hype, on se croirait à Brooklyn.',
      'Fake bricks, real credibility: +hype, feels like Brooklyn.',
    ),
    price: 2500,
    minPhase: 'GARAGE',
    effects: { moral: 0.035, hypePerDay: 0.003 },
  },
  {
    id: 'jungle',
    kind: 'wallpaper',
    name: t('Jungle tropicale', 'Tropical jungle'),
    description: t(
      'Feuilles de palmier géantes : on oublie qu’il pleut sur la ville.',
      'Giant palm leaves: you forget it’s raining outside.',
    ),
    price: 3500,
    minPhase: 'SEED',
    effects: { moral: 0.045 },
  },
  {
    id: 'wainscot',
    kind: 'wallpaper',
    name: t('Lambris en chêne', 'Oak wainscoting'),
    description: t(
      'Boiseries et moulures : le bureau ressemble à un cabinet d’avocats.',
      'Panelling and mouldings: the office looks like a law firm.',
    ),
    price: 4000,
    minPhase: 'SEED',
    effects: { moral: 0.04, hypePerDay: 0.002 },
  },
  {
    id: 'chalkboard',
    kind: 'wallpaper',
    name: t('Mur tableau noir', 'Chalkboard wall'),
    description: t(
      'Les devs y dessinent l’archi avant de coder : +qualité.',
      'Devs sketch the architecture before coding: +quality.',
    ),
    price: 4500,
    minPhase: 'SEED',
    effects: { moral: 0.025, quality: 0.003 },
  },
  {
    id: 'artdeco',
    kind: 'wallpaper',
    name: t('Art déco doré', 'Gilded art deco'),
    description: t(
      'Éventails dorés sur fond vert : les investisseurs adorent.',
      'Golden fans on deep green: investors love it.',
    ),
    price: 6500,
    minPhase: 'SERIES_A',
    effects: { moral: 0.05, hypePerDay: 0.006 },
  },
  {
    id: 'coderain',
    kind: 'wallpaper',
    name: t('Pluie de code', 'Code rain'),
    description: t(
      'Du code vert qui ruisselle : personne ne sait ce qu’il fait, comme en prod.',
      'Green code raining down: nobody knows what it does, just like prod.',
    ),
    price: 8000,
    minPhase: 'UNICORN',
    effects: { moral: 0.05, hypePerDay: 0.008 },
  },
  {
    id: 'blueprint',
    kind: 'wallpaper',
    name: t('Plans du garage', 'Garage blueprints'),
    description: t(
      'Récompense du mode Histoire : les plans de la v1 au feutre blanc sur fond bleu.',
      'Story mode reward: the v1 plans in white marker on blue.',
    ),
    price: 1500,
    minPhase: 'GARAGE',
    effects: { moral: 0.035, quality: 0.002 },
    unlock: 'wall-blueprint',
  },
  {
    id: 'postit',
    kind: 'wallpaper',
    name: t('Mur de post-it', 'Sticky-note wall'),
    description: t(
      'Récompense du mode Histoire : des centaines de post-it de rétrospectives.',
      'Story mode reward: hundreds of retrospective sticky notes.',
    ),
    price: 3000,
    minPhase: 'GARAGE',
    effects: { moral: 0.04, quality: 0.003 },
    unlock: 'wall-postit',
  },
];

const FINISHES_BY_ID = new Map(WALL_FINISHES.map((finish) => [finish.id, finish]));

export function getWallFinish(id: string): WallFinish | undefined {
  return FINISHES_BY_ID.get(id as WallFinishId);
}

/** Le bureau tel que le voient les murs : phase, ailes de filiales et annexes. */
export interface WallOffice {
  readonly phase: Phase;
  readonly wings: number;
  readonly annexes: number;
  /** Hall d'entrée aménagé (absent : pas de hall). */
  readonly lobby?: boolean;
}

const phaseIndex = (phase: Phase) => PHASES.indexOf(phase);

/** La zone existe-t-elle dans ce bureau ? (La cuisine arrive en Seed, les ailes et annexes après.) */
export function wallZoneExists(zone: WallZone, office: WallOffice): boolean {
  if (zone === 'back-open' || zone === 'left-open') return true;
  if (zone === 'back-kitchen') return phaseIndex(office.phase) >= phaseIndex('SEED');
  if (zone.startsWith('back-wing-')) {
    const wing = Number(zone.slice('back-wing-'.length));
    return Math.min(office.wings, VENTURES.maxFounded) >= wing;
  }
  const annex = ANNEX_KINDS.indexOf(zone.slice('left-'.length) as (typeof ANNEX_KINDS)[number]);
  return annex >= 0 && annex < Math.min(office.annexes, ANNEXES.max);
}

/** Zones de mur du bureau, dans l'ordre d'affichage. */
export function wallZones(office: WallOffice): WallZone[] {
  return WALL_ZONES.filter((zone) => wallZoneExists(zone, office));
}

/** Effets cumulés des revêtements posés sur les zones qui existent. */
export function wallFinishEffects(
  finishes: WallFinishes,
  office: WallOffice,
): Required<WallFinishEffects> {
  const total = { moral: 0, quality: 0, hypePerDay: 0 };
  for (const zone of WALL_ZONES) {
    const finish = finishes[zone] ? getWallFinish(finishes[zone]) : undefined;
    if (!finish || !wallZoneExists(zone, office)) continue;
    total.moral += finish.effects.moral;
    total.quality += finish.effects.quality ?? 0;
    total.hypePerDay += finish.effects.hypePerDay ?? 0;
  }
  return total;
}
