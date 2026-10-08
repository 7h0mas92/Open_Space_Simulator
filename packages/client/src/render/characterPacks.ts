/**
 * Packs de personnages thématiques : Noël, Halloween, Pâques, super-héros, été, espace,
 * pirates, Moyen Âge, années 80 et cyberpunk.
 *
 * Un pack ne remplace pas les personnages : il les déguise. Chaque profil reçoit un costume
 * construit en Three.js (bonnet de Père Noël, tête de citrouille, oreilles de lapin, cape…)
 * par-dessus son look habituel, Kenney ou construit. Les costumes sont accrochés aux nœuds
 * animés (`head`, `torso`, bras, jambes) et suivent donc les clips d'animation.
 *
 * Les packs sont activés depuis le back-office ; quand plusieurs le sont, l'équipe se
 * répartit entre eux. Le pack « Base » (actif au départ) garde les looks habituels. Le pack « super-héros » invente ses héros : aucun nom, logo ou costume
 * d'une licence existante.
 */
import type { CharacterPackId, ThemedPackId } from '@oss/shared';
import * as THREE from 'three';
import type { DevRole } from '../view/types';
import {
  darker,
  EYE,
  HEAD_SCALE,
  lookFor,
  lookKey,
  Parts,
  solid,
  type Accessory,
  type CharacterLook,
} from './officeCharacters';

/** Pièces de costume portées sur la tête. */
export type HeadPiece =
  | 'santaHat'
  | 'santaBeard'
  | 'elfHat'
  | 'antlers'
  | 'beanie'
  | 'witchHat'
  | 'wizardHat'
  | 'pumpkinHead'
  | 'skullFace'
  | 'fangs'
  | 'devilHorns'
  | 'mummyWrap'
  | 'bunnyEars'
  | 'chickHat'
  | 'flowerCrown'
  | 'strawHat'
  | 'sunHat'
  | 'sunglasses'
  | 'spaceHelmet'
  | 'alienAntennae'
  | 'pirateHat'
  | 'bandana'
  | 'eyePatch'
  | 'knightHelmet'
  | 'crown'
  | 'jesterHat'
  | 'princessHat'
  | 'headband'
  | 'retroHeadphones'
  | 'cyberVisor'
  | 'mohawk';

/** Motifs dessinés sur la combinaison. */
export type SuitPattern =
  | 'xmas'
  | 'santa'
  | 'belt'
  | 'bones'
  | 'bandages'
  | 'dots'
  | 'egg'
  | 'vampire'
  | 'hawaii'
  | 'stripes'
  | 'space'
  | 'armor'
  | 'harlequin'
  | 'tracksuit'
  | 'neon';

export type TorsoExtra = 'bowTie' | 'lights' | 'scarf' | 'lifebuoy' | 'parrot';

export interface Costume {
  readonly head?: readonly HeadPiece[];
  /** Combinaison qui recouvre torse, bras et jambes. */
  readonly suit?: {
    readonly color: number;
    readonly trim: number;
    readonly pattern?: SuitPattern;
    /** Gants et bottes de la couleur `trim`. */
    readonly gloves?: boolean;
    readonly boots?: boolean;
    /** Jambes d'une autre couleur que le haut (pantalon). */
    readonly legs?: number;
  };
  readonly cape?: { readonly color: number; readonly collar?: boolean };
  /** Loup de super-héros, de cette couleur. */
  readonly mask?: number;
  /** Emblème inventé sur la poitrine. */
  readonly emblem?: {
    readonly shape: 'star' | 'bolt' | 'diamond';
    readonly color: number;
    readonly background: number;
  };
  /** Petits extras sur le torse. */
  readonly torso?: readonly TorsoExtra[];
}

const C = {
  beige: 0xd9c4a0,
  straw: 0xe3c27a,
  alien: 0x7ddc4a,
  steel: 0x9aa4b2,
  neonPink: 0xff3fa4,
  neonCyan: 0x2ef2ff,
  neonYellow: 0xfff23a,
  red: 0xd23c3c,
  white: 0xf7f4ee,
  green: 0x2f8f4e,
  darkGreen: 0x1f6b3a,
  gold: 0xf2c14e,
  brown: 0x7a4a2e,
  black: 0x24262f,
  purple: 0x6b3fa0,
  orange: 0xec7a1c,
  bone: 0xece6d6,
  pastelPink: 0xf6b8cf,
  pastelYellow: 0xf8e08e,
  pastelGreen: 0xb5e3b0,
  pastelBlue: 0xa9cdf2,
  lavender: 0xc9b6ec,
  navy: 0x26355f,
  teal: 0x1f8f8a,
  silver: 0xb7c0cc,
} as const;

/** Costume de chaque profil, pour chaque pack. */
export const PACK_COSTUMES: Readonly<Record<ThemedPackId, Readonly<Record<DevRole, Costume>>>> = {
  CHRISTMAS: {
    // Le Père Noël, évidemment.
    SENIOR_BEARD: {
      head: ['santaHat', 'santaBeard'],
      suit: { color: C.red, trim: C.white, pattern: 'santa', gloves: true, boots: true },
    },
    TEN_X: {
      head: ['santaHat'],
      suit: { color: C.darkGreen, trim: C.white, pattern: 'xmas' },
    },
    // Le lutin du Père Noël.
    INTERN: {
      head: ['elfHat'],
      suit: { color: C.green, trim: C.red, boots: true },
    },
    // Rudolph, qui veut réécrire le traîneau en Rust.
    RUSTACEAN: {
      head: ['antlers'],
      suit: { color: C.brown, trim: C.white, pattern: 'xmas' },
    },
    DESIGNER: {
      head: ['beanie'],
      suit: { color: C.white, trim: C.red, pattern: 'xmas' },
      torso: ['scarf'],
    },
    PRODUCT_OWNER: {
      head: ['santaHat'],
      suit: { color: C.navy, trim: C.white, pattern: 'xmas' },
    },
    // Le robot sert de sapin : guirlande lumineuse.
    AI_AGENT: { head: ['santaHat'], torso: ['lights'] },
    GHOST: { head: ['santaHat'], torso: ['scarf'] },
  },
  HALLOWEEN: {
    SENIOR_BEARD: {
      head: ['wizardHat'],
      suit: { color: C.purple, trim: C.gold },
      cape: { color: C.purple },
    },
    TEN_X: {
      head: ['fangs'],
      suit: { color: C.black, trim: C.white, pattern: 'vampire' },
      cape: { color: C.black, collar: true },
    },
    INTERN: {
      head: ['pumpkinHead'],
      suit: { color: C.black, trim: C.orange, pattern: 'belt' },
    },
    RUSTACEAN: {
      head: ['skullFace'],
      suit: { color: C.black, trim: C.bone, pattern: 'bones', gloves: true },
    },
    DESIGNER: {
      head: ['witchHat'],
      suit: { color: 0x3b2a55, trim: C.orange, boots: true },
    },
    PRODUCT_OWNER: {
      head: ['devilHorns'],
      suit: { color: C.red, trim: C.black, boots: true },
    },
    AI_AGENT: {
      head: ['mummyWrap'],
      suit: { color: C.bone, trim: 0xc9c2ae, pattern: 'bandages' },
    },
    GHOST: { head: ['pumpkinHead'] },
  },
  EASTER: {
    SENIOR_BEARD: {
      head: ['bunnyEars'],
      suit: { color: C.pastelYellow, trim: C.white, pattern: 'dots' },
    },
    TEN_X: {
      head: ['bunnyEars'],
      suit: { color: C.white, trim: C.pastelPink, pattern: 'egg', gloves: true, boots: true },
    },
    INTERN: {
      head: ['chickHat'],
      suit: { color: C.pastelYellow, trim: C.orange, boots: true },
    },
    RUSTACEAN: {
      head: ['bunnyEars'],
      suit: { color: C.pastelGreen, trim: C.white, pattern: 'dots' },
    },
    DESIGNER: {
      head: ['flowerCrown'],
      suit: { color: C.pastelPink, trim: C.white, pattern: 'dots' },
    },
    PRODUCT_OWNER: {
      head: ['bunnyEars'],
      suit: { color: C.lavender, trim: C.white, pattern: 'egg' },
      torso: ['bowTie'],
    },
    AI_AGENT: {
      head: ['bunnyEars'],
      suit: { color: C.pastelBlue, trim: C.white, pattern: 'dots' },
    },
    GHOST: { head: ['bunnyEars'], torso: ['bowTie'] },
  },
  SUPERHEROES: {
    SENIOR_BEARD: {
      suit: { color: C.darkGreen, trim: C.gold, pattern: 'belt', gloves: true, boots: true },
      cape: { color: C.gold },
      emblem: { shape: 'diamond', color: C.darkGreen, background: C.gold },
    },
    TEN_X: {
      suit: { color: 0x2f6fd6, trim: C.gold, pattern: 'belt', gloves: true, boots: true },
      mask: 0x2f6fd6,
      emblem: { shape: 'bolt', color: C.gold, background: C.navy },
    },
    // L'acolyte.
    INTERN: {
      suit: { color: C.green, trim: C.gold, pattern: 'belt', boots: true },
      mask: C.black,
      cape: { color: C.gold },
      emblem: { shape: 'star', color: C.green, background: C.gold },
    },
    RUSTACEAN: {
      suit: { color: C.orange, trim: C.black, pattern: 'belt', gloves: true, boots: true },
      mask: C.black,
      emblem: { shape: 'diamond', color: C.orange, background: C.black },
    },
    DESIGNER: {
      suit: { color: C.purple, trim: C.pastelPink, pattern: 'belt', boots: true },
      mask: C.pastelPink,
      cape: { color: C.pastelPink },
      emblem: { shape: 'star', color: C.purple, background: C.pastelPink },
    },
    PRODUCT_OWNER: {
      suit: { color: C.teal, trim: C.white, pattern: 'belt', gloves: true, boots: true },
      cape: { color: C.red },
      emblem: { shape: 'star', color: C.red, background: C.white },
    },
    AI_AGENT: {
      suit: { color: C.silver, trim: C.gold, pattern: 'belt', boots: true },
      emblem: { shape: 'bolt', color: 0x6fe3ff, background: C.navy },
    },
    GHOST: {
      suit: { color: C.black, trim: 0x4a4f63, pattern: 'belt', gloves: true, boots: true },
      mask: C.black,
      cape: { color: C.black, collar: true },
    },
  },
  SUMMER: {
    SENIOR_BEARD: {
      head: ['strawHat', 'sunglasses'],
      suit: { color: C.orange, trim: C.white, pattern: 'hawaii', legs: C.beige },
    },
    TEN_X: {
      head: ['sunglasses'],
      suit: { color: C.teal, trim: C.pastelYellow, pattern: 'hawaii', legs: C.beige },
    },
    INTERN: {
      head: ['sunglasses'],
      suit: { color: C.white, trim: C.navy, pattern: 'stripes', legs: C.pastelBlue },
      torso: ['lifebuoy'],
    },
    RUSTACEAN: {
      head: ['strawHat'],
      suit: { color: C.red, trim: C.white, pattern: 'hawaii', legs: C.beige },
    },
    DESIGNER: {
      head: ['sunHat', 'sunglasses'],
      suit: { color: C.white, trim: C.pastelPink, pattern: 'stripes', legs: C.white },
    },
    PRODUCT_OWNER: {
      head: ['sunglasses'],
      suit: { color: C.purple, trim: C.pastelPink, pattern: 'hawaii', legs: C.beige },
    },
    AI_AGENT: { head: ['sunglasses'], torso: ['lifebuoy'] },
    GHOST: { head: ['strawHat', 'sunglasses'] },
  },
  SPACE: {
    SENIOR_BEARD: {
      head: ['spaceHelmet'],
      suit: { color: C.white, trim: C.orange, pattern: 'space', gloves: true, boots: true },
    },
    TEN_X: {
      head: ['spaceHelmet'],
      suit: { color: C.orange, trim: C.white, pattern: 'space', gloves: true, boots: true },
    },
    // Le stagiaire vient d'une autre planète.
    INTERN: {
      head: ['alienAntennae'],
      suit: { color: C.alien, trim: C.purple, pattern: 'neon', boots: true },
    },
    RUSTACEAN: {
      head: ['spaceHelmet'],
      suit: { color: C.white, trim: C.red, pattern: 'space', gloves: true, boots: true },
    },
    DESIGNER: {
      head: ['spaceHelmet'],
      suit: { color: C.lavender, trim: C.white, pattern: 'space', gloves: true, boots: true },
    },
    PRODUCT_OWNER: {
      head: ['spaceHelmet'],
      suit: { color: C.navy, trim: C.gold, pattern: 'space', gloves: true, boots: true },
    },
    AI_AGENT: {
      suit: { color: C.silver, trim: C.neonCyan, pattern: 'neon', boots: true },
    },
    GHOST: { head: ['alienAntennae'] },
  },
  PIRATES: {
    // Le capitaine et son perroquet.
    SENIOR_BEARD: {
      head: ['pirateHat'],
      suit: { color: C.navy, trim: C.gold, pattern: 'belt', boots: true, legs: C.beige },
      torso: ['parrot'],
    },
    TEN_X: {
      head: ['bandana', 'eyePatch'],
      suit: { color: C.white, trim: C.red, pattern: 'stripes', legs: C.black },
    },
    INTERN: {
      head: ['bandana'],
      suit: { color: C.white, trim: C.navy, pattern: 'stripes', legs: C.beige },
    },
    RUSTACEAN: {
      head: ['pirateHat'],
      suit: { color: C.brown, trim: C.gold, pattern: 'belt', boots: true, legs: C.black },
    },
    DESIGNER: {
      head: ['pirateHat', 'eyePatch'],
      suit: { color: C.red, trim: C.black, pattern: 'belt', boots: true, legs: C.black },
    },
    PRODUCT_OWNER: {
      head: ['pirateHat', 'eyePatch'],
      suit: { color: C.black, trim: C.gold, pattern: 'belt', boots: true, legs: C.beige },
      torso: ['parrot'],
    },
    AI_AGENT: { head: ['bandana', 'eyePatch'] },
    GHOST: { head: ['pirateHat'] },
  },
  MEDIEVAL: {
    // L'enchanteur.
    SENIOR_BEARD: {
      head: ['wizardHat'],
      suit: { color: 0x2f4fa0, trim: C.gold },
      cape: { color: 0x2f4fa0 },
    },
    TEN_X: {
      head: ['knightHelmet'],
      suit: { color: C.steel, trim: C.gold, pattern: 'armor', gloves: true, boots: true },
    },
    // Le bouffon du roi.
    INTERN: {
      head: ['jesterHat'],
      suit: { color: C.purple, trim: C.gold, pattern: 'harlequin' },
    },
    RUSTACEAN: {
      head: ['knightHelmet'],
      suit: { color: C.steel, trim: C.orange, pattern: 'armor', gloves: true, boots: true },
    },
    DESIGNER: {
      head: ['princessHat'],
      suit: { color: C.pastelPink, trim: C.gold, pattern: 'belt' },
    },
    // Le roi, qui fixe les priorités.
    PRODUCT_OWNER: {
      head: ['crown'],
      suit: { color: C.purple, trim: C.gold, pattern: 'belt' },
      cape: { color: C.red, collar: true },
    },
    AI_AGENT: {
      suit: { color: C.steel, trim: C.gold, pattern: 'armor', boots: true },
    },
    GHOST: { head: ['knightHelmet'] },
  },
  RETRO_80S: {
    SENIOR_BEARD: {
      head: ['headband', 'sunglasses'],
      suit: { color: C.purple, trim: C.teal, pattern: 'tracksuit' },
    },
    TEN_X: {
      head: ['retroHeadphones'],
      suit: { color: C.teal, trim: C.neonPink, pattern: 'tracksuit' },
    },
    INTERN: {
      head: ['headband'],
      suit: { color: C.neonPink, trim: C.pastelYellow, pattern: 'tracksuit' },
    },
    RUSTACEAN: {
      head: ['retroHeadphones'],
      suit: { color: C.orange, trim: C.navy, pattern: 'tracksuit' },
    },
    DESIGNER: {
      head: ['headband', 'sunglasses'],
      suit: { color: C.pastelPink, trim: C.teal, pattern: 'tracksuit' },
    },
    // Veste blanche manches retroussées, façon série policière à Miami.
    PRODUCT_OWNER: {
      head: ['sunglasses'],
      suit: { color: C.white, trim: C.pastelPink, pattern: 'vampire', legs: C.white },
    },
    AI_AGENT: { head: ['retroHeadphones'] },
    GHOST: { head: ['headband'] },
  },
  CYBERPUNK: {
    SENIOR_BEARD: {
      head: ['cyberVisor'],
      suit: { color: C.black, trim: C.neonCyan, pattern: 'neon', boots: true },
    },
    TEN_X: {
      head: ['mohawk', 'cyberVisor'],
      suit: { color: C.black, trim: C.neonPink, pattern: 'neon', gloves: true, boots: true },
    },
    INTERN: {
      head: ['cyberVisor'],
      suit: { color: 0x2b1f3d, trim: C.neonYellow, pattern: 'neon', boots: true },
    },
    RUSTACEAN: {
      head: ['mohawk'],
      suit: { color: C.black, trim: C.orange, pattern: 'neon', gloves: true, boots: true },
    },
    DESIGNER: {
      head: ['mohawk', 'sunglasses'],
      suit: { color: 0x2b1f3d, trim: C.neonPink, pattern: 'neon', boots: true },
    },
    PRODUCT_OWNER: {
      head: ['cyberVisor'],
      suit: { color: C.navy, trim: C.neonYellow, pattern: 'neon', boots: true },
      cape: { color: C.black, collar: true },
    },
    AI_AGENT: {
      suit: { color: C.black, trim: C.neonCyan, pattern: 'neon', boots: true },
    },
    GHOST: { head: ['cyberVisor'] },
  },
};

/** Un look et le costume éventuel qu'il porte. */
export interface ThemedLook {
  readonly look: CharacterLook;
  readonly costume: Costume | null;
}

/** Pièces qui cachent tout le haut du crâne : chapeaux, oreilles et accessoires de tête rangés. */
const HATS = new Set<HeadPiece>([
  'santaHat',
  'elfHat',
  'antlers',
  'beanie',
  'witchHat',
  'wizardHat',
  'bunnyEars',
  'chickHat',
  'flowerCrown',
  'devilHorns',
  'strawHat',
  'sunHat',
  'alienAntennae',
  'pirateHat',
  'bandana',
  'crown',
  'jesterHat',
  'princessHat',
  'headband',
  'retroHeadphones',
  'mohawk',
  'spaceHelmet',
]);
/** Pièces qui recouvrent tout le visage (on retire aussi lunettes et barbe). */
const FULL_HEAD = new Set<HeadPiece>(['pumpkinHead', 'skullFace', 'mummyWrap', 'knightHelmet']);
const HAT_ACCESSORIES = new Set<Accessory>(['beret', 'capBack', 'headset', 'crabOnHead']);
const FACE_ACCESSORIES = new Set<Accessory>([
  ...HAT_ACCESSORIES,
  'antenna',
  'beard',
  'greyBeard',
  'glasses',
  'roundGlasses',
  'visor',
]);
const GLASSES = new Set<Accessory>(['glasses', 'roundGlasses', 'visor']);
/** Pièces portées sur les yeux (on retire les lunettes du look). */
const EYEWEAR = new Set<HeadPiece>(['sunglasses', 'eyePatch', 'cyberVisor']);
/** Ce que la combinaison recouvre (le crabe Ferris, lui, reste sur l'épaule). */
const SUIT_HIDES = new Set<Accessory>(['hood', 'badge', 'tie', 'blazer']);

/**
 * Look d'un dev selon les packs actifs : sans pack, son look habituel ; sinon, son tirage
 * choisit aussi le pack, et il porte le costume de son profil par-dessus son look.
 */
export function themedLookFor(
  role: DevRole,
  look: number,
  packs: readonly CharacterPackId[],
): ThemedLook {
  const base = lookFor(role, look);
  // Aucun pack actif : on retombe sur les looks habituels, comme avec « Base ».
  if (packs.length === 0) return { look: base, costume: null };
  const pack = packs[Math.abs(look) % packs.length] as CharacterPackId;
  if (pack === 'BASE') return { look: base, costume: null };
  const costume = PACK_COSTUMES[pack][role];
  const head = costume.head ?? [];
  const hidden = (accessory: Accessory) =>
    (head.some((piece) => FULL_HEAD.has(piece)) && FACE_ACCESSORIES.has(accessory)) ||
    ((head.some((piece) => HATS.has(piece)) ||
      costume.mask !== undefined ||
      costume.cape?.collar === true) &&
      HAT_ACCESSORIES.has(accessory)) ||
    ((costume.mask !== undefined || head.some((piece) => EYEWEAR.has(piece))) &&
      GLASSES.has(accessory)) ||
    (costume.suit !== undefined && SUIT_HIDES.has(accessory)) ||
    (costume.cape !== undefined && accessory === 'hood');
  return {
    look: { ...base, accessories: base.accessories.filter((accessory) => !hidden(accessory)) },
    costume,
  };
}

/** Clé de cache d'un look costumé. */
export function themedLookKey(themed: ThemedLook): string {
  return `${lookKey(themed.look)}|${JSON.stringify(themed.costume)}`;
}

// ---------------------------------------------------------------------------------------------
// Construction des costumes (unités du personnage Blocky, tête de 0.8 de côté).
// ---------------------------------------------------------------------------------------------

/** Lumières, yeux de citrouille, nez de renne : visibles même la nuit. */
const lit = new THREE.MeshBasicMaterial({ vertexColors: true });
/** Bulle de casque, voile : verre teinté. */
const glassy = new THREE.MeshStandardMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.3,
  roughness: 0.1,
  depthWrite: false,
});

/** Chapeau conique fait de couches de plus en plus petites, penché vers `lean` en x. */
function cone(
  parts: Parts,
  color: number,
  base: number,
  layers: number,
  y: number,
  lean: number,
): void {
  for (let i = 0; i < layers; i += 1) {
    const size = base * (1 - i / layers) + 0.08;
    parts.add(size, 0.18, size, color, lean * i, y + i * 0.17, -0.02 * i);
  }
}

function headPiece(parts: Parts, glow: Parts, glass: Parts, piece: HeadPiece): void {
  switch (piece) {
    case 'strawHat':
      parts.add(1.3, 0.06, 1.3, C.straw, 0, 0.84, 0);
      parts.add(0.86, 0.24, 0.86, C.straw, 0, 0.98, 0);
      parts.add(0.88, 0.07, 0.88, C.red, 0, 0.9, 0);
      return;
    case 'sunHat':
      parts.add(1.4, 0.05, 1.4, C.pastelPink, 0, 0.84, 0);
      parts.add(0.86, 0.22, 0.86, C.pastelPink, 0, 0.96, 0);
      parts.add(0.88, 0.07, 0.88, C.white, 0, 0.9, 0);
      parts.add(0.16, 0.12, 0.06, C.pastelYellow, 0.3, 0.92, 0.44);
      return;
    case 'sunglasses':
      for (const x of [-0.17, 0.17]) parts.add(0.26, 0.14, 0.03, 0x15171f, x, 0.43, 0.43);
      parts.add(0.86, 0.04, 0.03, 0x15171f, 0, 0.48, 0.43);
      return;
    case 'spaceHelmet':
      // Casque d'astronaute : bulle de verre, col et antenne.
      glass.add(1.08, 1.0, 1.08, 0xbfe3f2, 0, 0.46, 0);
      parts.add(1.12, 0.12, 1.12, C.white, 0, -0.02, 0);
      parts.add(0.06, 0.26, 0.06, C.silver, 0.36, 1.06, -0.3);
      glow.add(0.1, 0.1, 0.1, 0xff4d4d, 0.36, 1.22, -0.3);
      return;
    case 'alienAntennae':
      for (const side of [-1, 1]) {
        parts.add(0.06, 0.4, 0.06, C.alien, side * 0.2, 1.0, 0);
        glow.add(0.14, 0.14, 0.14, C.alien, side * 0.24, 1.24, 0);
      }
      return;
    case 'pirateHat':
      parts.add(1.2, 0.08, 0.9, C.black, 0, 0.86, 0);
      parts.add(0.9, 0.3, 0.7, C.black, 0, 1.02, 0);
      parts.add(0.2, 0.26, 0.08, C.black, 0, 1.06, 0.44);
      parts.add(0.12, 0.12, 0.02, C.white, 0, 1.06, 0.49);
      parts.add(1.22, 0.04, 0.92, C.gold, 0, 0.9, 0);
      return;
    case 'bandana':
      parts.add(0.88, 0.24, 0.88, C.red, 0, 0.78, 0);
      for (const x of [-0.24, 0.1, 0.3]) parts.add(0.08, 0.08, 0.02, C.white, x, 0.8, 0.445);
      parts.add(0.12, 0.3, 0.08, C.red, 0.1, 0.6, -0.48);
      return;
    case 'eyePatch':
      parts.add(0.86, 0.04, 0.04, C.black, 0, 0.56, 0.43);
      parts.add(0.2, 0.18, 0.04, C.black, -0.17, 0.43, 0.435);
      return;
    case 'knightHelmet':
      parts.add(0.94, 0.94, 0.94, C.steel, 0, 0.44, 0);
      parts.add(0.7, 0.06, 0.02, EYE, 0, 0.46, 0.475);
      for (const x of [-0.12, 0.12]) parts.add(0.04, 0.2, 0.02, EYE, x, 0.26, 0.475);
      parts.add(0.1, 0.94, 0.1, C.gold, 0, 0.44, 0.44);
      parts.add(0.12, 0.3, 0.5, C.red, 0, 1.02, -0.1);
      return;
    case 'crown':
      parts.add(0.84, 0.16, 0.84, C.gold, 0, 0.88, 0);
      for (const [x, z] of [
        [-0.36, 0.36],
        [0.36, 0.36],
        [-0.36, -0.36],
        [0.36, -0.36],
        [0, 0.36],
      ] as const) {
        parts.add(0.12, 0.16, 0.12, C.gold, x, 1.02, z);
      }
      glow.add(0.1, 0.1, 0.02, 0xff2d55, 0, 0.88, 0.43);
      return;
    case 'jesterHat':
      parts.add(0.9, 0.18, 0.9, C.purple, 0, 0.86, 0);
      for (const side of [-1, 1]) {
        parts.add(0.3, 0.2, 0.3, side < 0 ? C.purple : C.gold, side * 0.36, 1.02, 0);
        parts.add(0.2, 0.2, 0.2, side < 0 ? C.purple : C.gold, side * 0.56, 1.12, 0);
        parts.add(0.12, 0.12, 0.12, C.gold, side * 0.68, 1.04, 0);
      }
      return;
    case 'princessHat':
      cone(parts, C.pastelPink, 0.6, 7, 0.86, -0.04);
      glass.add(0.06, 0.9, 0.5, 0xffffff, -0.28, 1.1, -0.2);
      return;
    case 'headband':
      parts.add(0.88, 0.1, 0.88, C.neonPink, 0, 0.7, 0);
      return;
    case 'retroHeadphones':
      parts.add(0.92, 0.05, 0.1, C.silver, 0, 0.92, 0);
      for (const x of [-0.46, 0.46]) {
        parts.add(0.05, 0.5, 0.08, C.silver, x, 0.68, 0);
        parts.add(0.1, 0.28, 0.28, C.orange, x, 0.42, 0);
      }
      return;
    case 'cyberVisor':
      parts.add(0.9, 0.2, 0.06, C.black, 0, 0.44, 0.42);
      glow.add(0.8, 0.08, 0.02, C.neonCyan, 0, 0.44, 0.455);
      for (const x of [-0.45, 0.45]) parts.add(0.04, 0.2, 0.5, C.black, x, 0.44, 0.18);
      return;
    case 'mohawk':
      for (let i = 0; i < 4; i += 1)
        glow.add(0.14, 0.3 - Math.abs(i - 1.5) * 0.06, 0.18, C.neonPink, 0, 0.95, 0.28 - i * 0.2);
      return;
    case 'santaHat':
      parts.add(0.92, 0.14, 0.92, C.white, 0, 0.84, 0);
      cone(parts, C.red, 0.78, 4, 0.98, -0.07);
      parts.add(0.2, 0.2, 0.2, C.white, -0.34, 1.62, -0.08);
      return;
    case 'santaBeard':
      parts.add(0.9, 0.42, 0.16, C.white, 0, 0.12, 0.38);
      parts.add(0.7, 0.3, 0.16, C.white, 0, -0.22, 0.34);
      parts.add(0.36, 0.2, 0.14, C.white, 0, -0.44, 0.3);
      parts.add(0.1, 0.4, 0.5, C.white, -0.43, 0.25, 0.15);
      parts.add(0.1, 0.4, 0.5, C.white, 0.43, 0.25, 0.15);
      parts.add(0.5, 0.08, 0.05, C.white, 0, 0.3, 0.44);
      return;
    case 'elfHat':
      parts.add(0.9, 0.12, 0.9, C.red, 0, 0.84, 0);
      cone(parts, C.green, 0.8, 5, 0.97, 0.08);
      parts.add(0.14, 0.14, 0.14, C.gold, 0.42, 1.78, -0.1);
      return;
    case 'antlers':
      for (const side of [-1, 1]) {
        parts.add(0.08, 0.42, 0.08, C.brown, side * 0.26, 1.0, 0);
        parts.add(0.24, 0.07, 0.07, C.brown, side * 0.38, 1.1, 0);
        parts.add(0.07, 0.18, 0.07, C.brown, side * 0.48, 1.2, 0);
        parts.add(0.07, 0.16, 0.07, C.brown, side * 0.26, 1.28, 0);
      }
      glow.add(0.16, 0.14, 0.08, 0xff2d2d, 0, 0.32, 0.44);
      return;
    case 'beanie':
      parts.add(0.9, 0.3, 0.9, C.red, 0, 0.86, 0);
      parts.add(0.92, 0.1, 0.92, C.white, 0, 0.74, 0);
      parts.add(0.92, 0.05, 0.92, C.white, 0, 0.92, 0);
      parts.add(0.22, 0.2, 0.22, C.white, 0, 1.1, 0);
      return;
    case 'witchHat':
      parts.add(1.3, 0.06, 1.3, C.black, 0, 0.84, 0);
      parts.add(0.86, 0.12, 0.86, C.orange, 0, 0.92, 0);
      cone(parts, C.black, 0.7, 5, 1.04, -0.05);
      return;
    case 'wizardHat':
      parts.add(1.2, 0.06, 1.2, C.purple, 0, 0.84, 0);
      cone(parts, C.purple, 0.8, 6, 0.95, 0.05);
      parts.add(0.12, 0.12, 0.04, C.gold, 0.1, 1.1, 0.33);
      parts.add(0.08, 0.08, 0.04, C.gold, -0.12, 1.3, 0.28);
      parts.add(0.08, 0.08, 0.04, C.gold, 0.2, 1.48, 0.2);
      return;
    case 'pumpkinHead':
      parts.add(0.98, 0.9, 0.98, C.orange, 0, 0.42, 0);
      for (const x of [-0.25, 0.25]) parts.add(0.08, 0.92, 1.0, 0xd0640f, x, 0.42, 0);
      parts.add(0.12, 0.18, 0.12, C.darkGreen, 0, 0.96, 0);
      for (const x of [-0.2, 0.2]) glow.add(0.18, 0.14, 0.02, 0xffc23a, x, 0.52, 0.5);
      glow.add(0.1, 0.08, 0.02, 0xffc23a, 0, 0.38, 0.5);
      glow.add(0.5, 0.1, 0.02, 0xffc23a, 0, 0.22, 0.5);
      return;
    case 'skullFace':
      parts.add(0.84, 0.82, 0.06, C.bone, 0, 0.4, 0.41);
      for (const x of [-0.18, 0.18]) parts.add(0.2, 0.2, 0.02, EYE, x, 0.46, 0.445);
      parts.add(0.1, 0.1, 0.02, EYE, 0, 0.3, 0.445);
      for (const x of [-0.15, -0.05, 0.05, 0.15]) parts.add(0.04, 0.12, 0.02, EYE, x, 0.14, 0.445);
      return;
    case 'fangs':
      for (const x of [-0.07, 0.07]) parts.add(0.05, 0.1, 0.03, C.white, x, 0.16, 0.42);
      return;
    case 'devilHorns':
      for (const side of [-1, 1]) {
        parts.add(0.14, 0.18, 0.14, C.red, side * 0.28, 0.88, 0.05);
        parts.add(0.1, 0.14, 0.1, C.red, side * 0.32, 1.02, 0.05);
        parts.add(0.06, 0.1, 0.06, C.red, side * 0.36, 1.12, 0.05);
      }
      return;
    case 'mummyWrap':
      for (const y of [0.08, 0.22, 0.6, 0.74]) parts.add(0.88, 0.1, 0.88, C.bone, 0, y, 0);
      parts.add(0.88, 0.1, 0.88, 0xc9c2ae, 0.02, 0.33, 0);
      parts.add(0.88, 0.06, 0.88, C.bone, 0, 0.84, 0);
      return;
    case 'bunnyEars':
      parts.add(0.86, 0.08, 0.3, C.white, 0, 0.84, 0);
      for (const side of [-1, 1]) {
        parts.add(0.24, 0.86, 0.1, C.white, side * 0.22, 1.28, 0);
        parts.add(0.12, 0.64, 0.02, C.pastelPink, side * 0.22, 1.28, 0.06);
      }
      return;
    case 'chickHat':
      parts.add(0.84, 0.42, 0.84, C.pastelYellow, 0, 0.98, 0);
      parts.add(0.16, 0.08, 0.14, C.orange, 0, 0.96, 0.48);
      for (const x of [-0.16, 0.16]) parts.add(0.08, 0.08, 0.02, EYE, x, 1.06, 0.43);
      parts.add(0.16, 0.12, 0.08, C.pastelYellow, 0, 1.24, 0);
      return;
    case 'flowerCrown': {
      parts.add(0.9, 0.06, 0.9, C.darkGreen, 0, 0.84, 0);
      const colors = [C.pastelPink, C.pastelYellow, C.white, C.lavender, C.pastelBlue];
      const spots: [number, number][] = [
        [-0.36, 0.36],
        [0, 0.42],
        [0.36, 0.36],
        [0.42, 0],
        [0.36, -0.36],
        [0, -0.42],
        [-0.36, -0.36],
        [-0.42, 0],
      ];
      spots.forEach(([x, z], i) =>
        parts.add(0.16, 0.12, 0.16, colors[i % colors.length] ?? C.white, x, 0.9, z),
      );
      return;
    }
  }
}

/** Loup de super-héros : un bandeau sur les yeux, avec des yeux blancs par-dessus. */
function mask(parts: Parts, color: number): void {
  parts.add(0.86, 0.2, 0.04, color, 0, 0.43, 0.42);
  for (const side of [-1, 1]) {
    parts.add(0.04, 0.12, 0.6, color, side * 0.43, 0.45, 0.1);
    parts.add(0.13, 0.07, 0.02, C.white, side * 0.17, 0.43, 0.445);
  }
}

/** Emblème inventé (étoile, éclair, losange) sur un médaillon. */
function emblem(parts: Parts, def: NonNullable<Costume['emblem']>): void {
  const z = 0.335;
  const y = 0.86;
  parts.add(0.48, 0.36, 0.02, def.background, 0, y, z);
  parts.add(0.36, 0.48, 0.02, def.background, 0, y, z);
  const front = z + 0.012;
  const px = (x: number, dy: number, w: number, h: number) =>
    parts.add(w, h, 0.02, def.color, x, y + dy, front);
  switch (def.shape) {
    case 'star':
      px(0, 0.03, 0.3, 0.08);
      px(0, 0.03, 0.08, 0.3);
      px(-0.08, -0.1, 0.08, 0.1);
      px(0.08, -0.1, 0.08, 0.1);
      return;
    case 'bolt':
      px(0.05, 0.1, 0.09, 0.16);
      px(0, 0, 0.22, 0.07);
      px(-0.05, -0.1, 0.09, 0.16);
      return;
    case 'diamond':
      px(0, 0.16, 0.08, 0.08);
      px(0, 0.08, 0.2, 0.08);
      px(0, 0, 0.3, 0.08);
      px(0, -0.08, 0.2, 0.08);
      px(0, -0.16, 0.08, 0.08);
      return;
  }
}

/** Motif sur le devant de la combinaison (repère du torse : buste de 0.3 à 1.2 en y). */
function pattern(parts: Parts, glow: Parts, suit: NonNullable<Costume['suit']>): void {
  const z = 0.33;
  switch (suit.pattern) {
    case 'xmas':
      parts.add(0.86, 0.08, 0.02, suit.trim, 0, 1.02, z);
      parts.add(0.86, 0.08, 0.02, suit.trim, 0, 0.46, z);
      parts.add(0.3, 0.08, 0.02, C.green, 0, 0.62, z + 0.005);
      parts.add(0.2, 0.08, 0.02, C.green, 0, 0.7, z + 0.005);
      parts.add(0.1, 0.08, 0.02, C.green, 0, 0.78, z + 0.005);
      glow.add(0.06, 0.06, 0.02, C.gold, 0, 0.85, z + 0.01);
      for (const x of [-0.3, 0.3]) parts.add(0.06, 0.06, 0.02, suit.trim, x, 0.72, z);
      return;
    case 'santa':
      parts.add(0.14, 0.9, 0.02, suit.trim, 0, 0.75, z);
      parts.add(0.86, 0.12, 0.02, C.black, 0, 0.5, z + 0.005);
      parts.add(0.16, 0.14, 0.02, C.gold, 0, 0.5, z + 0.01);
      return;
    case 'belt':
      parts.add(0.86, 0.1, 0.66, suit.trim, 0, 0.38, 0);
      parts.add(0.14, 0.12, 0.02, darker(suit.trim), 0, 0.38, z + 0.005);
      return;
    case 'bones':
      parts.add(0.06, 0.7, 0.02, suit.trim, 0, 0.72, z);
      for (const y of [0.98, 0.86, 0.74, 0.62]) parts.add(0.5, 0.05, 0.02, suit.trim, 0, y, z);
      parts.add(0.36, 0.12, 0.02, suit.trim, 0, 0.42, z);
      return;
    case 'bandages':
      for (const y of [1.08, 0.88, 0.68, 0.48]) parts.add(0.86, 0.05, 0.66, suit.trim, 0, y, 0);
      return;
    case 'dots':
      for (const [x, y] of [
        [-0.24, 1.0],
        [0.18, 0.92],
        [-0.08, 0.72],
        [0.26, 0.6],
        [-0.26, 0.48],
        [0.06, 0.4],
      ] as const) {
        parts.add(0.1, 0.1, 0.02, suit.trim, x, y, z);
      }
      return;
    case 'egg':
      // Un gros œuf de Pâques peint sur le ventre.
      parts.add(0.2, 0.08, 0.02, C.white, 0, 0.98, z);
      parts.add(0.32, 0.1, 0.02, C.pastelBlue, 0, 0.9, z);
      parts.add(0.38, 0.1, 0.02, C.white, 0, 0.8, z);
      parts.add(0.38, 0.1, 0.02, C.pastelPink, 0, 0.7, z);
      parts.add(0.32, 0.1, 0.02, C.pastelYellow, 0, 0.6, z);
      parts.add(0.2, 0.08, 0.02, C.white, 0, 0.52, z);
      return;
    case 'hawaii':
      for (const [x, y] of [
        [-0.26, 1.02],
        [0.2, 0.96],
        [-0.04, 0.8],
        [0.28, 0.64],
        [-0.24, 0.56],
        [0.04, 0.42],
      ] as const) {
        parts.add(0.14, 0.06, 0.02, suit.trim, x, y, z);
        parts.add(0.06, 0.14, 0.02, suit.trim, x, y, z);
        parts.add(0.04, 0.04, 0.025, C.gold, x, y, z + 0.005);
      }
      parts.add(0.3, 0.12, 0.02, darker(suit.color), 0, 1.14, z);
      return;
    case 'stripes':
      for (const y of [1.06, 0.88, 0.7, 0.52, 0.34])
        parts.add(0.86, 0.07, 0.66, suit.trim, 0, y, 0);
      return;
    case 'space':
      parts.add(0.4, 0.26, 0.08, C.silver, 0, 0.8, z + 0.02);
      for (const [x, color] of [
        [-0.1, 0xff4d4d],
        [0, 0x6dff7a],
        [0.1, 0x4dd2ff],
      ] as const) {
        glow.add(0.06, 0.06, 0.02, color, x, 0.84, z + 0.07);
      }
      parts.add(0.16, 0.1, 0.02, suit.trim, -0.26, 1.06, z);
      parts.add(0.86, 0.08, 0.66, suit.trim, 0, 0.4, 0);
      return;
    case 'armor':
      parts.add(0.6, 0.5, 0.06, darker(suit.color), 0, 0.86, z + 0.01);
      parts.add(0.06, 0.5, 0.02, suit.trim, 0, 0.86, z + 0.045);
      parts.add(0.86, 0.1, 0.66, suit.trim, 0, 0.42, 0);
      for (const x of [-0.42, 0.42]) parts.add(0.12, 0.16, 0.66, darker(suit.color), x, 1.16, 0);
      return;
    case 'harlequin':
      parts.add(0.425, 0.94, 0.65, suit.trim, 0.21, 0.75, 0);
      for (const y of [1.05, 0.75, 0.45]) parts.add(0.1, 0.1, 0.02, C.gold, 0, y, z + 0.005);
      return;
    case 'tracksuit':
      parts.add(0.04, 0.9, 0.02, C.white, -0.12, 0.75, z);
      parts.add(0.86, 0.12, 0.66, suit.trim, 0, 1.0, 0);
      return;
    case 'neon':
      glow.add(0.04, 0.8, 0.02, suit.trim, -0.2, 0.75, z);
      glow.add(0.04, 0.8, 0.02, suit.trim, 0.2, 0.75, z);
      glow.add(0.86, 0.04, 0.66, suit.trim, 0, 0.4, 0);
      return;
    case 'vampire':
      parts.add(0.26, 0.5, 0.02, suit.trim, 0, 0.95, z);
      parts.add(0.1, 0.1, 0.02, 0xb3122e, 0, 1.1, z + 0.005);
      return;
    case undefined:
      return;
  }
}

/** Guirlande lumineuse enroulée autour du torse. */
function lights(glow: Parts): void {
  const colors = [0xff4d4d, 0xffd84d, 0x4dd2ff, 0x6dff7a];
  for (let i = 0; i < 8; i += 1) {
    const y = 1.1 - i * 0.1;
    const x = -0.36 + i * 0.1;
    glow.add(0.08, 0.08, 0.04, colors[i % colors.length] ?? 0xffffff, x, y, 0.33);
  }
  for (let i = 0; i < 6; i += 1) {
    glow.add(
      0.08,
      0.08,
      0.04,
      colors[(i + 2) % colors.length] ?? 0xffffff,
      0.34 - i * 0.13,
      0.5,
      0.33,
    );
  }
}

function torsoExtra(parts: Parts, glow: Parts, extra: TorsoExtra): void {
  switch (extra) {
    case 'bowTie':
      parts.add(0.12, 0.12, 0.03, C.pastelPink, -0.08, 1.1, 0.32);
      parts.add(0.12, 0.12, 0.03, C.pastelPink, 0.08, 1.1, 0.32);
      parts.add(0.06, 0.06, 0.04, 0xe07aa0, 0, 1.1, 0.33);
      return;
    case 'lights':
      lights(glow);
      return;
    case 'lifebuoy':
      // Bouée autour de la taille, rayée rouge et blanc.
      for (const [w, d, x, z, color] of [
        [1.1, 0.2, 0, 0.42, C.red],
        [1.1, 0.2, 0, -0.42, C.white],
        [0.2, 0.64, 0.55, 0, C.white],
        [0.2, 0.64, -0.55, 0, C.red],
      ] as const) {
        parts.add(w, 0.2, d, color, x, 0.42, z);
      }
      return;
    case 'parrot':
      // Perroquet sur l'épaule gauche.
      parts.add(0.22, 0.3, 0.22, C.red, 0.6, 1.36, -0.02);
      parts.add(0.2, 0.18, 0.2, C.red, 0.6, 1.58, 0.02);
      parts.add(0.08, 0.06, 0.1, C.gold, 0.6, 1.56, 0.16);
      parts.add(0.04, 0.04, 0.02, EYE, 0.7, 1.62, 0.08);
      parts.add(0.06, 0.26, 0.2, 0x2f6fd6, 0.72, 1.34, -0.04);
      parts.add(0.16, 0.24, 0.06, C.green, 0.6, 1.14, -0.14);
      return;
    case 'scarf':
      parts.add(0.88, 0.14, 0.68, C.red, 0, 1.16, 0);
      parts.add(0.16, 0.4, 0.04, C.red, 0.2, 0.92, 0.34);
      parts.add(0.16, 0.06, 0.05, C.white, 0.2, 0.76, 0.34);
      return;
  }
}

function attach(node: THREE.Object3D | undefined, parts: Parts, name: string, glow?: Parts): void {
  if (!node) return;
  if (!parts.empty) node.add(parts.mesh(solid, name));
  if (glow && !glow.empty) {
    const mesh = glow.mesh(lit, `${name}-glow`);
    mesh.castShadow = false;
    node.add(mesh);
  }
}

/**
 * Habille un personnage (Kenney ou construit) de son costume : chaque pièce est accrochée au
 * nœud animé qui la porte.
 */
export function dressUp(character: THREE.Object3D, costume: Costume): void {
  const node = (name: string) => character.getObjectByName(name);

  const head = new Parts();
  const headGlow = new Parts();
  const headGlass = new Parts();
  for (const piece of costume.head ?? []) headPiece(head, headGlow, headGlass, piece);
  if (costume.mask !== undefined) mask(head, costume.mask);
  const headNode = node('head');
  if (headNode) {
    // La tête est réduite à 0.1 (convention des GLB) : on travaille en unités réelles.
    const group = new THREE.Group();
    group.name = 'costume';
    group.scale.setScalar(1 / HEAD_SCALE);
    headNode.add(group);
    attach(group, head, 'costume-head', headGlow);
    if (!headGlass.empty) group.add(headGlass.mesh(glassy, 'costume-glass'));
  }

  const torso = new Parts();
  const torsoGlow = new Parts();
  const suit = costume.suit;
  if (suit) {
    torso.add(0.84, 0.94, 0.64, suit.color, 0, 0.75, 0);
    pattern(torso, torsoGlow, suit);
  }
  if (costume.emblem) emblem(torso, costume.emblem);
  if (costume.cape) {
    const { color, collar } = costume.cape;
    torso.add(0.86, 1.5, 0.06, color, 0, 0.45, -0.36);
    torso.add(0.9, 0.12, 0.12, color, 0, 1.2, -0.3);
    if (collar) {
      for (const side of [-1, 1]) torso.add(0.3, 0.42, 0.06, color, side * 0.32, 1.32, -0.24);
    }
  }
  for (const extra of costume.torso ?? []) torsoExtra(torso, torsoGlow, extra);
  attach(node('torso'), torso, 'costume-torso', torsoGlow);

  if (!suit) return;
  for (const side of [1, -1] as const) {
    // Arlequin : un bras et une jambe de chaque couleur.
    const limb = suit.pattern === 'harlequin' && side === 1 ? suit.trim : suit.color;
    const arm = new Parts().add(0.44, 0.92, 0.44, limb, side * 0.2, -0.34, 0);
    const armGlow = new Parts();
    if (suit.gloves) arm.add(0.42, 0.24, 0.42, suit.trim, side * 0.2, -0.9, 0);
    // Bande sur l'extérieur du bras et de la jambe (survêtement, néons).
    const stripe = suit.pattern === 'tracksuit' ? arm : suit.pattern === 'neon' ? armGlow : null;
    stripe?.add(
      0.02,
      0.9,
      0.1,
      suit.pattern === 'tracksuit' ? C.white : suit.trim,
      side * 0.43,
      -0.34,
      0,
    );
    attach(node(side === 1 ? 'arm-left' : 'arm-right'), arm, 'costume-arm', armGlow);
    const legColor =
      suit.pattern === 'harlequin'
        ? side === 1
          ? suit.color
          : suit.trim
        : (suit.legs ?? suit.color);
    const leg = new Parts().add(0.44, 0.82, 0.44, legColor, 0, -0.4, 0);
    const legGlow = new Parts();
    if (suit.boots) leg.add(0.46, 0.24, 0.5, suit.trim, 0, -0.88, 0.02);
    const legStripe = suit.pattern === 'tracksuit' ? leg : suit.pattern === 'neon' ? legGlow : null;
    legStripe?.add(
      0.02,
      0.8,
      0.1,
      suit.pattern === 'tracksuit' ? C.white : suit.trim,
      side * 0.23,
      -0.4,
      0,
    );
    attach(node(side === 1 ? 'leg-left' : 'leg-right'), leg, 'costume-leg', legGlow);
  }
}
