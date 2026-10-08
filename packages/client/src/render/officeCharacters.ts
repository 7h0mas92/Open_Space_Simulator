/**
 * Les personnages de l'open space, choisis selon le profil du dev.
 *
 * Le pack Blocky Characters contient 18 personnages, mais la moitié ne colle pas à une startup
 * (pirate, ninja, zombies, policier, mannequin de crash-test…). Chaque profil pioche donc dans
 * sa propre liste de looks :
 * - des personnages Kenney adaptés au thème, complétés d'accessoires Three.js (barbe, casque,
 *   béret, badge, crabe Ferris…) ;
 * - des personnages construits en Three.js avec la même hiérarchie que les modèles Kenney
 *   (`root`, `torso`, `head`, `arm-left`…), ce qui leur permet de jouer les mêmes clips
 *   d'animation (marcher, s'asseoir, taper…) que les GLB.
 *
 * Chaque partie du corps est fusionnée en un seul maillage à couleurs de sommets : un
 * personnage coûte une dizaine d'appels de dessin, comme un modèle Kenney.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DevRole } from '../view/types';
import type { CharacterId } from './assetManifest';

/** Hauteur d'un personnage Blocky Characters dans ses propres unités (pieds → haut du crâne). */
export const BLOCKY_HEIGHT = 2.7;

/**
 * La tête des GLB Kenney est modélisée 10 fois trop grande puis réduite par un `scale` de 0.1
 * (que certains clips animent). Nos têtes suivent la même convention.
 */
const HEAD_SCALE = 0.1;

/** Accessoires Three.js, posés sur la tête ou le torse. */
export const ACCESSORIES = [
  'beard',
  'greyBeard',
  'glasses',
  'roundGlasses',
  'headset',
  'hood',
  'beret',
  'capBack',
  'crabOnHead',
  'crabOnShoulder',
  'badge',
  'tie',
  'blazer',
  'antenna',
  'visor',
] as const;
export type Accessory = (typeof ACCESSORIES)[number];

export type HairStyle = 'short' | 'long' | 'bun' | 'messy' | 'bald' | 'ponytail';

/** Tenue d'un personnage construit en Three.js. */
export interface Outfit {
  readonly skin: number;
  readonly hair: number;
  readonly hairStyle: HairStyle;
  readonly shirt: number;
  readonly sleeves: 'long' | 'short';
  readonly pants: number;
  readonly shoes: number;
  /** Corps en métal et visage écran (IA Agent). */
  readonly robot?: boolean;
  /** Corps translucide (Dev Fantôme). */
  readonly ghost?: boolean;
}

export type CharacterLook =
  | {
      readonly kind: 'kenney';
      readonly id: CharacterId;
      readonly accessories: readonly Accessory[];
    }
  | { readonly kind: 'built'; readonly outfit: Outfit; readonly accessories: readonly Accessory[] };

/** Personnages Kenney écartés car hors thème (gardés dans le manifeste, jamais tirés). */
export const OFF_THEME_CHARACTERS: readonly CharacterId[] = [
  'a', // naufragé en haillons
  'b', // salopette de plombier
  'd', // mannequin de crash-test
  'j', // policier
  'l', // zombie en costume
  'm', // aventurier
  'n', // geisha
  'o', // monstre du marais
  'p', // pirate
  'r', // ninja
];

const SKIN = { light: 0xf3c9a5, medium: 0xd9a066, tan: 0xb97b4f, dark: 0x7a4a2e } as const;
const HAIR = {
  black: 0x2b2420,
  brown: 0x6b4226,
  blond: 0xe0b45a,
  red: 0xb5532a,
  grey: 0xb9b9b9,
  pink: 0xe87fb0,
} as const;
const CLOTH = {
  black: 0x2f3240,
  grey: 0x8a8f9c,
  navy: 0x2f3f6b,
  denim: 0x4b6aa8,
  white: 0xf2efe8,
  green: 0x4caf6e,
  yellow: 0xf2c14e,
  orange: 0xe8742f,
  red: 0xc9443a,
  purple: 0x8f6ad8,
  beige: 0xc9b38f,
  pink: 0xf28fb1,
  teal: 0x3fa7a0,
} as const;

const kenney = (id: CharacterId, ...accessories: Accessory[]): CharacterLook => ({
  kind: 'kenney',
  id,
  accessories,
});
const built = (outfit: Outfit, ...accessories: Accessory[]): CharacterLook => ({
  kind: 'built',
  outfit,
  accessories,
});

/** Looks possibles pour chaque profil ; le dev garde toujours le même (tiré à l'embauche). */
export const ROLE_LOOKS: Readonly<Record<DevRole, readonly CharacterLook[]>> = {
  SENIOR_BEARD: [
    kenney('i', 'greyBeard'),
    kenney('k', 'beard'),
    built(
      {
        skin: SKIN.light,
        hair: HAIR.grey,
        hairStyle: 'bald',
        shirt: CLOTH.red,
        sleeves: 'long',
        pants: CLOTH.denim,
        shoes: CLOTH.black,
      },
      'greyBeard',
      'glasses',
    ),
    built(
      {
        skin: SKIN.tan,
        hair: HAIR.brown,
        hairStyle: 'bun',
        shirt: CLOTH.grey,
        sleeves: 'long',
        pants: CLOTH.black,
        shoes: CLOTH.black,
      },
      'beard',
      'hood',
    ),
  ],
  TEN_X: [
    kenney('c', 'headset'),
    built(
      {
        skin: SKIN.light,
        hair: HAIR.black,
        hairStyle: 'messy',
        shirt: CLOTH.black,
        sleeves: 'long',
        pants: CLOTH.grey,
        shoes: CLOTH.white,
      },
      'hood',
      'headset',
    ),
    built(
      {
        skin: SKIN.dark,
        hair: HAIR.black,
        hairStyle: 'short',
        shirt: CLOTH.teal,
        sleeves: 'short',
        pants: CLOTH.black,
        shoes: CLOTH.red,
      },
      'headset',
      'glasses',
    ),
  ],
  INTERN: [
    kenney('c', 'capBack', 'badge'),
    kenney('e', 'badge'),
    built(
      {
        skin: SKIN.medium,
        hair: HAIR.brown,
        hairStyle: 'short',
        shirt: CLOTH.green,
        sleeves: 'short',
        pants: CLOTH.denim,
        shoes: CLOTH.white,
      },
      'capBack',
      'badge',
    ),
    built(
      {
        skin: SKIN.light,
        hair: HAIR.blond,
        hairStyle: 'ponytail',
        shirt: CLOTH.yellow,
        sleeves: 'short',
        pants: CLOTH.denim,
        shoes: CLOTH.white,
      },
      'badge',
    ),
  ],
  RUSTACEAN: [
    built(
      {
        skin: SKIN.light,
        hair: HAIR.red,
        hairStyle: 'messy',
        shirt: CLOTH.orange,
        sleeves: 'long',
        pants: CLOTH.black,
        shoes: CLOTH.black,
      },
      'hood',
      'crabOnHead',
    ),
    built(
      {
        skin: SKIN.tan,
        hair: HAIR.black,
        hairStyle: 'long',
        shirt: CLOTH.black,
        sleeves: 'short',
        pants: CLOTH.grey,
        shoes: CLOTH.orange,
      },
      'roundGlasses',
      'crabOnShoulder',
    ),
    kenney('f', 'crabOnShoulder'),
  ],
  DESIGNER: [
    kenney('e', 'beret'),
    kenney('f', 'roundGlasses'),
    built(
      {
        skin: SKIN.light,
        hair: HAIR.black,
        hairStyle: 'long',
        shirt: CLOTH.black,
        sleeves: 'long',
        pants: CLOTH.black,
        shoes: CLOTH.white,
      },
      'beret',
      'roundGlasses',
    ),
    built(
      {
        skin: SKIN.dark,
        hair: HAIR.pink,
        hairStyle: 'bun',
        shirt: CLOTH.pink,
        sleeves: 'short',
        pants: CLOTH.white,
        shoes: CLOTH.black,
      },
      'glasses',
    ),
  ],
  PRODUCT_OWNER: [
    kenney('q', 'badge'),
    built(
      {
        skin: SKIN.medium,
        hair: HAIR.brown,
        hairStyle: 'short',
        shirt: CLOTH.white,
        sleeves: 'long',
        pants: CLOTH.beige,
        shoes: CLOTH.black,
      },
      'blazer',
      'badge',
    ),
    built(
      {
        skin: SKIN.light,
        hair: HAIR.blond,
        hairStyle: 'long',
        shirt: CLOTH.white,
        sleeves: 'long',
        pants: CLOTH.navy,
        shoes: CLOTH.black,
      },
      'blazer',
      'tie',
    ),
  ],
  AI_AGENT: [
    kenney('g', 'antenna'),
    kenney('h', 'antenna'),
    built(
      {
        skin: 0xc7ced9,
        hair: 0x9aa3b5,
        hairStyle: 'bald',
        shirt: 0x9aa3b5,
        sleeves: 'long',
        pants: 0x6c7487,
        shoes: 0x4a5163,
        robot: true,
      },
      'visor',
      'antenna',
    ),
  ],
  GHOST: [
    built(
      {
        skin: 0xe8f0ff,
        hair: 0xd5def0,
        hairStyle: 'messy',
        shirt: 0xd5def0,
        sleeves: 'long',
        pants: 0xc3cde3,
        shoes: 0xc3cde3,
        ghost: true,
      },
      'hood',
      'headset',
    ),
  ],
};

/** Look d'un dev : son profil choisit la liste, son tirage `look` (0 à 17) choisit dedans. */
export function lookFor(role: DevRole, look: number): CharacterLook {
  const looks = ROLE_LOOKS[role];
  const index = ((look % looks.length) + looks.length) % looks.length;
  // La liste n'est jamais vide (vérifié par les tests).
  return looks[index] as CharacterLook;
}

/** Clé de cache d'un look (deux devs au même look partagent les géométries). */
export function lookKey(look: CharacterLook): string {
  return look.kind === 'kenney'
    ? `kenney:${look.id}:${look.accessories.join(',')}`
    : `built:${JSON.stringify(look.outfit)}:${look.accessories.join(',')}`;
}

// ---------------------------------------------------------------------------------------------
// Assemblage : des boîtes colorées fusionnées par partie du corps.
// ---------------------------------------------------------------------------------------------

/** Boîtes d'une même partie, fusionnées en un seul maillage à la fin. */
class Parts {
  private readonly geometries: THREE.BufferGeometry[] = [];

  add(w: number, h: number, d: number, color: number, x: number, y: number, z: number): this {
    const geometry = new THREE.BoxGeometry(w, h, d);
    geometry.translate(x, y, z);
    const tint = new THREE.Color(color);
    const count = geometry.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) tint.toArray(colors, i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.geometries.push(geometry);
    return this;
  }

  get empty(): boolean {
    return this.geometries.length === 0;
  }

  /** Un seul maillage pour toutes les boîtes de la partie. */
  mesh(material: THREE.Material, name: string): THREE.Mesh {
    const merged = mergeGeometries(this.geometries) ?? new THREE.BufferGeometry();
    for (const geometry of this.geometries) geometry.dispose();
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}

const solid = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.85,
  metalness: 0.05,
  flatShading: true,
});
const metal = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.4,
  metalness: 0.45,
  flatShading: true,
});
const ghostly = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.6,
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
  emissive: 0x9fb4e0,
  emissiveIntensity: 0.25,
});
const glowing = new THREE.MeshStandardMaterial({
  vertexColors: true,
  emissive: 0x6fe3ff,
  emissiveIntensity: 0.9,
});

const EYE = 0x262a36;
const MOUTH = 0x8a3b32;
const CRAB = 0xe8582c;

/** Visage (yeux, bouche, sourcils) sur la face avant de la tête (z = 0.4). */
function face(parts: Parts, outfit: Outfit): void {
  if (outfit.robot) return;
  for (const x of [-0.17, 0.17]) {
    parts.add(0.14, 0.12, 0.02, 0xffffff, x, 0.42, 0.405);
    parts.add(0.07, 0.12, 0.03, EYE, x + (x > 0 ? -0.035 : 0.035), 0.42, 0.41);
    parts.add(0.16, 0.04, 0.02, outfit.hair, x, 0.53, 0.405);
  }
  parts.add(0.2, 0.05, 0.02, MOUTH, 0, 0.22, 0.405);
}

/** Cheveux selon la coiffure (la tête occupe -0.4…0.4 en x et z, 0…0.8 en y). */
function hair(parts: Parts, outfit: Outfit): void {
  const color = outfit.hair;
  switch (outfit.hairStyle) {
    case 'bald':
      parts.add(0.84, 0.25, 0.3, color, 0, 0.45, -0.28);
      return;
    case 'short':
      parts.add(0.86, 0.14, 0.86, color, 0, 0.83, 0);
      parts.add(0.86, 0.4, 0.1, color, 0, 0.6, -0.39);
      parts.add(0.86, 0.1, 0.06, color, 0, 0.72, 0.4);
      return;
    case 'messy':
      parts.add(0.88, 0.16, 0.88, color, 0, 0.84, 0);
      parts.add(0.2, 0.12, 0.2, color, -0.2, 0.96, 0.1);
      parts.add(0.2, 0.1, 0.2, color, 0.15, 0.95, -0.15);
      parts.add(0.88, 0.45, 0.12, color, 0, 0.58, -0.39);
      parts.add(0.5, 0.16, 0.06, color, -0.15, 0.68, 0.41);
      return;
    case 'long':
      parts.add(0.88, 0.14, 0.88, color, 0, 0.83, 0);
      parts.add(0.88, 0.95, 0.14, color, 0, 0.35, -0.38);
      for (const x of [-0.42, 0.42]) parts.add(0.08, 0.7, 0.5, color, x, 0.45, -0.14);
      parts.add(0.86, 0.12, 0.06, color, 0, 0.72, 0.4);
      return;
    case 'bun':
      parts.add(0.86, 0.14, 0.86, color, 0, 0.83, 0);
      parts.add(0.86, 0.4, 0.1, color, 0, 0.6, -0.39);
      parts.add(0.32, 0.26, 0.32, color, 0, 1.0, -0.12);
      return;
    case 'ponytail':
      parts.add(0.86, 0.14, 0.86, color, 0, 0.83, 0);
      parts.add(0.86, 0.45, 0.1, color, 0, 0.58, -0.39);
      parts.add(0.2, 0.55, 0.16, color, 0, 0.4, -0.52);
      parts.add(0.86, 0.1, 0.06, color, 0, 0.72, 0.4);
      return;
  }
}

/** Accessoires portés sur la tête, dans le repère de la tête (avant fusion). */
function headAccessory(parts: Parts, glow: Parts, accessory: Accessory, hairColor: number): void {
  switch (accessory) {
    case 'beard':
    case 'greyBeard': {
      const color =
        accessory === 'greyBeard' ? HAIR.grey : hairColor === HAIR.grey ? 0x6b4226 : hairColor;
      parts.add(0.84, 0.3, 0.12, color, 0, 0.12, 0.38);
      parts.add(0.6, 0.22, 0.12, color, 0, -0.08, 0.36);
      parts.add(0.08, 0.36, 0.5, color, -0.4, 0.2, 0.15);
      parts.add(0.08, 0.36, 0.5, color, 0.4, 0.2, 0.15);
      parts.add(0.3, 0.06, 0.04, color, 0, 0.3, 0.43);
      return;
    }
    case 'glasses':
      for (const x of [-0.17, 0.17]) {
        parts.add(0.22, 0.04, 0.03, EYE, x, 0.51, 0.43);
        parts.add(0.22, 0.04, 0.03, EYE, x, 0.33, 0.43);
        parts.add(0.04, 0.18, 0.03, EYE, x - 0.1, 0.42, 0.43);
        parts.add(0.04, 0.18, 0.03, EYE, x + 0.1, 0.42, 0.43);
      }
      parts.add(0.12, 0.03, 0.03, EYE, 0, 0.47, 0.43);
      return;
    case 'roundGlasses':
      for (const x of [-0.17, 0.17]) {
        parts.add(0.18, 0.04, 0.03, 0xc8935b, x, 0.53, 0.43);
        parts.add(0.18, 0.04, 0.03, 0xc8935b, x, 0.31, 0.43);
        parts.add(0.04, 0.16, 0.03, 0xc8935b, x - 0.11, 0.42, 0.43);
        parts.add(0.04, 0.16, 0.03, 0xc8935b, x + 0.11, 0.42, 0.43);
      }
      parts.add(0.1, 0.03, 0.03, 0xc8935b, 0, 0.47, 0.43);
      return;
    case 'headset':
      parts.add(0.94, 0.08, 0.14, 0x2f3240, 0, 0.94, 0);
      for (const x of [-0.46, 0.46]) {
        parts.add(0.06, 0.5, 0.12, 0x2f3240, x, 0.7, 0);
        parts.add(0.1, 0.26, 0.26, 0xe0584a, x, 0.4, 0);
      }
      parts.add(0.04, 0.04, 0.32, 0x2f3240, -0.48, 0.28, 0.2);
      return;
    case 'beret':
      parts.add(0.92, 0.12, 0.92, 0xc9443a, 0.04, 0.92, 0);
      parts.add(0.7, 0.08, 0.7, 0xc9443a, 0.08, 1.0, 0);
      parts.add(0.06, 0.08, 0.06, 0xc9443a, 0.08, 1.08, 0);
      return;
    case 'capBack':
      parts.add(0.88, 0.22, 0.88, 0x4f7fd9, 0, 0.88, 0);
      parts.add(0.6, 0.06, 0.32, 0x4f7fd9, 0, 0.8, -0.58);
      parts.add(0.14, 0.06, 0.14, 0xf2efe8, 0, 1.0, 0);
      return;
    case 'crabOnHead':
      crab(parts, 0, 0.9, 0, 1);
      return;
    case 'antenna':
      parts.add(0.06, 0.32, 0.06, 0x6c7487, 0, 0.96, 0);
      glow.add(0.14, 0.14, 0.14, 0x6fe3ff, 0, 1.16, 0);
      return;
    case 'visor':
      parts.add(0.8, 0.36, 0.04, 0x1d2a44, 0, 0.44, 0.405);
      for (const x of [-0.16, 0.16]) glow.add(0.14, 0.08, 0.02, 0x6fe3ff, x, 0.47, 0.43);
      glow.add(0.26, 0.04, 0.02, 0x6fe3ff, 0, 0.32, 0.43);
      return;
    default:
      return;
  }
}

/** Ferris, la mascotte de Rust : un petit crabe orange. */
function crab(parts: Parts, x: number, y: number, z: number, size: number): void {
  const s = size;
  parts.add(0.5 * s, 0.18 * s, 0.36 * s, CRAB, x, y + 0.13 * s, z);
  parts.add(0.36 * s, 0.08 * s, 0.26 * s, CRAB, x, y + 0.26 * s, z);
  for (const side of [-1, 1]) {
    parts.add(0.04 * s, 0.14 * s, 0.04 * s, EYE, x + side * 0.1 * s, y + 0.36 * s, z + 0.1 * s);
    parts.add(0.16 * s, 0.12 * s, 0.12 * s, CRAB, x + side * 0.36 * s, y + 0.2 * s, z + 0.14 * s);
    for (const leg of [-0.1, 0.06]) {
      parts.add(0.12 * s, 0.05 * s, 0.04 * s, CRAB, x + side * 0.3 * s, y + 0.04 * s, z + leg * s);
    }
  }
}

/** Accessoires portés sur le torse (repère du nœud `torso`, buste de 0.3 à 1.2 en y). */
function torsoAccessory(parts: Parts, accessory: Accessory, shirt: number): void {
  switch (accessory) {
    case 'hood':
      parts.add(0.66, 0.34, 0.2, darker(shirt), 0, 1.24, -0.3);
      parts.add(0.04, 0.3, 0.02, 0xf2efe8, -0.12, 1.02, 0.31);
      parts.add(0.04, 0.3, 0.02, 0xf2efe8, 0.12, 1.02, 0.31);
      parts.add(0.46, 0.22, 0.03, darker(shirt), 0, 0.5, 0.31);
      return;
    case 'badge':
      parts.add(0.04, 0.4, 0.02, 0x4f7fd9, -0.14, 1.0, 0.31);
      parts.add(0.04, 0.4, 0.02, 0x4f7fd9, 0.14, 1.0, 0.31);
      parts.add(0.26, 0.04, 0.02, 0x4f7fd9, 0, 0.8, 0.31);
      parts.add(0.22, 0.28, 0.03, 0xf2efe8, 0, 0.64, 0.32);
      parts.add(0.14, 0.05, 0.035, 0xe0584a, 0, 0.72, 0.32);
      return;
    case 'tie':
      parts.add(0.1, 0.08, 0.02, 0xc9443a, 0, 1.12, 0.31);
      parts.add(0.12, 0.5, 0.02, 0xc9443a, 0, 0.82, 0.31);
      return;
    case 'blazer':
      parts.add(0.28, 0.9, 0.62, 0x2f3f6b, -0.26, 0.75, 0);
      parts.add(0.28, 0.9, 0.62, 0x2f3f6b, 0.26, 0.75, 0);
      parts.add(0.82, 0.9, 0.2, 0x2f3f6b, 0, 0.75, -0.21);
      parts.add(0.08, 0.3, 0.02, 0x1e2a4d, -0.13, 1.02, 0.32);
      parts.add(0.08, 0.3, 0.02, 0x1e2a4d, 0.13, 1.02, 0.32);
      return;
    case 'crabOnShoulder':
      crab(parts, 0.6, 1.2, -0.05, 0.75);
      return;
    default:
      return;
  }
}

/** Accessoire porté sur les bras (manches du blazer). */
function armAccessory(parts: Parts, accessories: readonly Accessory[], side: 1 | -1): void {
  if (accessories.includes('blazer')) parts.add(0.42, 0.8, 0.42, 0x2f3f6b, side * 0.2, -0.32, 0);
}

function darker(color: number): number {
  return new THREE.Color(color).multiplyScalar(0.75).getHex();
}

const HEAD_ACCESSORIES = new Set<Accessory>([
  'beard',
  'greyBeard',
  'glasses',
  'roundGlasses',
  'headset',
  'beret',
  'capBack',
  'crabOnHead',
  'antenna',
  'visor',
]);

/**
 * Ajoute les accessoires à un personnage (Kenney ou construit) : ils sont accrochés aux nœuds
 * `head` et `torso`, et suivent donc les animations.
 */
export function addAccessories(
  character: THREE.Object3D,
  accessories: readonly Accessory[],
  colors: { readonly hair: number; readonly shirt: number },
): void {
  const head = character.getObjectByName('head');
  const torso = character.getObjectByName('torso');
  const onHead = new Parts();
  const glow = new Parts();
  const onTorso = new Parts();
  for (const accessory of accessories) {
    if (HEAD_ACCESSORIES.has(accessory)) headAccessory(onHead, glow, accessory, colors.hair);
    else torsoAccessory(onTorso, accessory, colors.shirt);
  }
  if (head) {
    // La tête est réduite à 0.1 : on agrandit le groupe d'autant pour travailler en unités réelles.
    const group = new THREE.Group();
    group.name = 'accessories';
    group.scale.setScalar(1 / HEAD_SCALE);
    if (!onHead.empty) group.add(onHead.mesh(solid, 'head-accessories'));
    if (!glow.empty) group.add(glow.mesh(glowing, 'head-glow'));
    head.add(group);
  }
  if (torso && !onTorso.empty) torso.add(onTorso.mesh(solid, 'torso-accessories'));
}

/**
 * Personnage construit en Three.js, avec la hiérarchie et les pivots des Blocky Characters :
 * les clips d'animation des GLB Kenney s'y appliquent tels quels.
 */
export function buildCharacter(outfit: Outfit, accessories: readonly Accessory[]): THREE.Group {
  const body = outfit.ghost ? ghostly : outfit.robot ? metal : solid;
  const skinColor = outfit.skin;
  const sleeveEnd = outfit.sleeves === 'long' ? -0.78 : -0.42;

  const root = new THREE.Group();
  root.name = 'root';

  for (const side of [1, -1] as const) {
    const leg = new Parts()
      .add(0.4, 0.82, 0.4, outfit.pants, 0, -0.41, 0)
      .add(0.42, 0.18, 0.46, outfit.shoes, 0, -0.91, 0.02);
    const node = leg.mesh(body, side === 1 ? 'leg-left' : 'leg-right');
    node.position.set(side * 0.2, 1, 0);
    root.add(node);
  }

  const torsoParts = new Parts().add(0.8, 0.9, 0.6, outfit.shirt, 0, 0.75, 0);
  if (!outfit.robot) torsoParts.add(0.3, 0.06, 0.02, skinColor, 0, 1.17, 0.305);
  else torsoParts.add(0.3, 0.3, 0.02, 0x1d2a44, 0, 0.85, 0.305);
  for (const accessory of accessories) {
    if (!HEAD_ACCESSORIES.has(accessory)) torsoAccessory(torsoParts, accessory, outfit.shirt);
  }
  const torso = torsoParts.mesh(body, 'torso');
  torso.position.set(0, 0.7, 0);
  root.add(torso);

  for (const side of [1, -1] as const) {
    // Le bras gauche (+x) s'étend de 0 à 0.4, le droit de -0.4 à 0 ; pivot à l'épaule.
    const x = side * 0.2;
    const arm = new Parts()
      .add(0.4, 0.1 - sleeveEnd, 0.4, outfit.shirt, x, (0.1 + sleeveEnd) / 2, 0)
      .add(0.38, sleeveEnd + 1, 0.38, skinColor, x, (sleeveEnd - 1) / 2, 0);
    armAccessory(arm, accessories, side);
    const node = arm.mesh(body, side === 1 ? 'arm-left' : 'arm-right');
    node.position.set(side * 0.4, 1.1, -0.1);
    torso.add(node);
  }

  const headParts = new Parts().add(0.8, 0.8, 0.8, skinColor, 0, 0.4, 0);
  face(headParts, outfit);
  if (!outfit.robot || outfit.hairStyle !== 'bald') hair(headParts, outfit);
  const headInner = headParts.mesh(body, 'head-shape');
  headInner.scale.setScalar(1 / HEAD_SCALE);
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 1.2, 0);
  head.scale.setScalar(HEAD_SCALE);
  head.add(headInner);
  torso.add(head);

  addAccessories(
    root,
    accessories.filter((accessory) => HEAD_ACCESSORIES.has(accessory)),
    { hair: outfit.hair, shirt: outfit.shirt },
  );

  const character = new THREE.Group();
  character.name = 'built-character';
  character.add(root);
  return character;
}

/** Couleurs de cheveux et de haut des personnages Kenney (pour assortir barbe et capuche). */
export const KENNEY_COLORS: Partial<Record<CharacterId, { hair: number; shirt: number }>> = {
  c: { hair: 0xb5532a, shirt: 0x4caf6e },
  e: { hair: 0x8a5a36, shirt: 0x8f6ad8 },
  f: { hair: 0x2b2420, shirt: 0x4caf6e },
  g: { hair: 0x9aa3b5, shirt: 0x9aa3b5 },
  h: { hair: 0x9aa3b5, shirt: 0x9aa3b5 },
  i: { hair: 0xb9b9b9, shirt: 0xbfdcf2 },
  k: { hair: 0x8a5a36, shirt: 0xc9443a },
  q: { hair: 0x2b2420, shirt: 0x2f3240 },
};
