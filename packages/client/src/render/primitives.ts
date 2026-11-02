/**
 * Formes Three.js qui remplacent les modèles absents des packs Kenney (babyfoot, toboggan,
 * sieste-pod, bureau debout, station d'écouteurs, baie de serveurs, meubles de cuisine et
 * électroménager (voir `kitchenFurniture.ts`), frigo à boissons, cactus, écran de métriques,
 * ramen, écouteurs et mini-cactus de bureau, tapis de souris, clavier
 * QWERTY (voir `keyboard.ts`), litières, gamelles, arbres à chat, canapé et bibliothèque
 * détaillés, plantes d'intérieur (voir `plants.ts`)) et servent de secours si un GLB ne se charge pas.
 * Chaque forme assemble des primitives (boîtes, cylindres) dans la palette low-poly du
 * Furniture Kit, en unités de grille : une case mesure 1 x 1, l'objet est posé au sol (y = 0)
 * et regarde vers +z, comme les modèles Kenney.
 */
import * as THREE from 'three';
import type { MissingAssetId } from './assetManifest';
import {
  blender,
  bookStack,
  deskEarbuds,
  deskLamp,
  miniSpeaker,
  mug,
  retroRadio,
  rubberDuck,
  secondScreen,
  teddyBear,
  toaster,
  trophy,
} from './deskAccessories';
import { detailedBookcase, detailedSofa } from './furnitureDetail';
import { ipoBell, unicornStatue } from './storyRewards';
import {
  canteenTable,
  doorCabinet,
  drawerCabinet,
  drinksFridge,
  dripCoffeeMaker,
  electricKettle,
  espressoMachine,
  hutchCabinet,
  kitchenIsland,
  microwaveOven,
  riceCooker,
  sinkUnit,
  tallCabinet,
} from './kitchenFurniture';
import { babyfoot, floorSpeaker, napPod, pedalBin, roundRug, slide } from './loungeFurniture';
import {
  catBowl,
  catFeeder,
  catTreeLarge,
  catTreeMedium,
  catTreeSmall,
  litterCovered,
  litterOpen,
  litterRobot,
} from './petFurniture';
import {
  ergonomicChair,
  earbudsDock,
  mediaConsole,
  officeChair,
  officeDesk,
  serverRack,
  standingDesk,
  trestleDesk,
} from './workFurniture';
import { qwertyKeyboard } from './keyboard';
import { partitionPiece } from './partitions';
import { ANNEX_DECOR_PRIMITIVES } from './annexDecor';
import { receptionDesk } from './lobbyFurniture';
import { liquidTower, neonTower, plainTower, proLaptop, titanTower } from './computers';
import {
  projectionScreenLarge,
  projectionScreenMedium,
  projectionScreenSmall,
  videoProjector,
  ceilingProjector,
} from './projectionModels';
import {
  backupNas,
  bladeServer,
  fibreRouter,
  fireSuppression,
  firewallUnit,
  gpuServer,
  networkSwitch,
  precisionCooling,
  rackServer,
  serverCloset,
  serverRoom,
  upsUnit,
} from './serverRoom';
import {
  bonsai,
  fiddleLeafFig,
  giantMonstera,
  kentiaPalm,
  oliveTree,
  planterBox,
  pothos,
  snakePlant,
} from './plants';

export const PALETTE = {
  wood: 0xc8935b,
  woodDark: 0x8a5a36,
  metal: 0x9aa3b5,
  dark: 0x343a4f,
  white: 0xf2efe8,
  green: 0x4caf6e,
  red: 0xe0584a,
  blue: 0x4f7fd9,
  yellow: 0xf5b942,
  purple: 0x8f6ad8,
  skin: 0xf0c39a,
  chrome: 0xd5dbe3,
  coffee: 0x5a3622,
  terracotta: 0xc2643f,
  cactus: 0x5c9e52,
  screen: 0x1d2a44,
  pink: 0xf28fb1,
  gold: 0xe8b93c,
  orange: 0xf08a2e,
  sand: 0xe6d3a3,
  sisal: 0xcdb07c,
  plush: 0xe9dcc4,
  slate: 0x7a8196,
  mauve: 0xc48bb8,
  mint: 0x7cc8b4,
  water: 0x5aa9e0,
  fabric: 0x9cabc0,
  fabricDark: 0x7e8da4,
  birch: 0xe6c79a,
  birchDark: 0xc9a46f,
  chairFabric: 0x4f5668,
  chairFabricDark: 0x3a4050,
  cabinet: 0xe4e8e1,
  cushion: 0xd9734e,
  rug: 0xb5543c,
  teddy: 0xb07a4a,
  ceramic: 0xebe6dc,
  concrete: 0xaba69d,
  wicker: 0xa88a5a,
  plaster: 0xd8d2c4,
} as const;

/** Nom de chaque couleur de la palette : il sert à repérer les matériaux à repeindre. */
const PALETTE_NAMES = new Map<number, string>(
  Object.entries(PALETTE).map(([name, color]) => [color, name]),
);

const materials = new Map<number, THREE.MeshStandardMaterial>();

/** Matériau partagé par couleur (moins d'appels de dessin, moins de mémoire). */
export function material(color: number): THREE.MeshStandardMaterial {
  let found = materials.get(color);
  if (!found) {
    found = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0.05,
      flatShading: true,
    });
    found.name = PALETTE_NAMES.get(color) ?? '';
    materials.set(color, found);
  }
  return found;
}

const glowMaterials = new Map<number, THREE.MeshStandardMaterial>();

/** Matériau lumineux (voyants, écrans) : visible même dans l'ombre ou la nuit. */
function glow(color: number): THREE.MeshStandardMaterial {
  let found = glowMaterials.get(color);
  if (!found) {
    found = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 });
    glowMaterials.set(color, found);
  }
  return found;
}

/** Verre teinté, partagé (porte du frigo, verseuse de la cafetière). */
export const glass = new THREE.MeshStandardMaterial({
  color: 0xbfe3f2,
  roughness: 0.1,
  metalness: 0.1,
  transparent: true,
  opacity: 0.35,
});

function box(
  w: number,
  h: number,
  d: number,
  color: number | THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    typeof color === 'number' ? material(color) : color,
  );
  mesh.position.set(x, y + h / 2, z);
  return mesh;
}

function cylinder(radius: number, length: number, color: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 8), material(color));
}

/** Cylindre (ou tronc de cône) vertical posé sur `y`, centré en (x, z). */
function post(
  top: number,
  bottom: number,
  h: number,
  color: number | THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  segments = 8,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(top, bottom, h, segments),
    typeof color === 'number' ? material(color) : color,
  );
  mesh.position.set(x, y + h / 2, z);
  return mesh;
}

/** Petite boîte lumineuse (voyant, barre de graphique). */
function light(w: number, h: number, d: number, color: number, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glow(color));
  mesh.position.set(x, y + h / 2, z);
  return mesh;
}

/** Mini-cactus dans un godet : de quoi décorer un coin de bureau. */
function miniCactus(): THREE.Group {
  const group = new THREE.Group();
  group.add(post(0.06, 0.05, 0.08, PALETTE.terracotta, 0, 0, 0, 8));
  group.add(post(0.052, 0.052, 0.01, PALETTE.coffee, 0, 0.075, 0, 8));
  group.add(post(0.03, 0.034, 0.12, PALETTE.cactus, 0, 0.08, 0, 6));
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), material(PALETTE.cactus));
  top.position.set(0, 0.2, 0);
  group.add(top);
  // Un seul bras, et une petite fleur rose au sommet.
  group.add(box(0.04, 0.025, 0.025, PALETTE.cactus, 0.04, 0.12, 0));
  group.add(post(0.014, 0.014, 0.05, PALETTE.cactus, 0.06, 0.12, 0, 6));
  group.add(post(0.018, 0.01, 0.02, PALETTE.pink, 0, 0.225, 0, 5));
  return group;
}

/**
 * Tapis de souris sombre à liseré bleu : il fait ressortir la souris Kenney, grise comme le
 * clavier, à côté de laquelle elle se perdait. Très plat : la souris se pose dessus (y = 0,012).
 */
function mousePad(): THREE.Group {
  const group = new THREE.Group();
  group.add(box(0.19, 0.008, 0.17, PALETTE.blue, 0, 0, 0));
  group.add(box(0.17, 0.012, 0.15, PALETTE.dark, 0, 0, 0));
  return group;
}

/** Cactus de bureau en pot de terre cuite, avec deux bras et une fleur rose. */
function cactus(): THREE.Group {
  const group = new THREE.Group();
  group.add(post(0.17, 0.13, 0.22, PALETTE.terracotta, 0, 0, 0, 8));
  group.add(post(0.185, 0.185, 0.05, PALETTE.terracotta, 0, 0.2, 0, 8));
  group.add(post(0.15, 0.15, 0.02, PALETTE.coffee, 0, 0.23, 0, 8));
  group.add(post(0.075, 0.08, 0.42, PALETTE.cactus, 0, 0.24, 0, 6));
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 4), material(PALETTE.cactus));
  top.position.set(0, 0.66, 0);
  group.add(top);
  // Deux bras en « L ».
  for (const [side, y, h] of [
    [-1, 0.36, 0.16],
    [1, 0.44, 0.12],
  ] as const) {
    group.add(box(0.1, 0.06, 0.06, PALETTE.cactus, side * 0.1, y, 0));
    group.add(post(0.035, 0.035, h, PALETTE.cactus, side * 0.15, y, 0, 6));
  }
  group.add(post(0.04, 0.02, 0.05, PALETTE.pink, 0, 0.71, 0, 5));
  return group;
}

/**
 * Écran géant de métriques : utilisateurs en barres vertes, courbe de revenus,
 * voyant de la prod (rouge, évidemment).
 */
function metricsScreen(): THREE.Group {
  const group = new THREE.Group();
  for (const x of [-0.35, 0.35]) group.add(box(0.06, 0.12, 0.2, PALETTE.dark, x, 0, 0));
  group.add(box(1.5, 0.86, 0.06, PALETTE.dark, 0, 0.1, 0));
  group.add(box(1.42, 0.78, 0.01, PALETTE.screen, 0, 0.14, 0.03));
  const face = 0.04;
  // Histogramme des utilisateurs.
  [0.12, 0.18, 0.15, 0.26, 0.3, 0.42].forEach((h, i) => {
    group.add(light(0.07, h, 0.01, PALETTE.green, -0.6 + i * 0.1, 0.22, face));
  });
  // Courbe en dents de scie (revenus).
  const points = [0.3, 0.42, 0.36, 0.55, 0.5, 0.66];
  for (let i = 0; i < points.length - 1; i++) {
    const x0 = 0.05 + i * 0.11;
    const y0 = points[i] ?? 0;
    const y1 = points[i + 1] ?? 0;
    const segment = new THREE.Mesh(
      new THREE.BoxGeometry(Math.hypot(0.11, y1 - y0), 0.02, 0.01),
      glow(PALETTE.yellow),
    );
    segment.position.set(x0 + 0.055, (y0 + y1) / 2 + 0.2, face);
    segment.rotation.z = Math.atan2(y1 - y0, 0.11);
    group.add(segment);
  }
  // Bandeau de titre et voyant « prod ».
  group.add(light(0.6, 0.05, 0.01, PALETTE.blue, -0.35, 0.8, face));
  group.add(light(0.08, 0.08, 0.01, PALETTE.red, 0.6, 0.77, face));
  return group;
}

/** Pot de ramen instantanées et ses baguettes : le repas officiel du garage. */
function ramen(): THREE.Group {
  const group = new THREE.Group();
  group.add(post(0.09, 0.07, 0.14, PALETTE.white, 0, 0, 0));
  group.add(post(0.092, 0.092, 0.04, PALETTE.red, 0, 0.09, 0));
  group.add(post(0.085, 0.085, 0.01, PALETTE.yellow, 0, 0.135, 0));
  for (const x of [-0.02, 0.02]) {
    const stick = cylinder(0.006, 0.26, PALETTE.wood);
    stick.rotation.z = 0.5;
    stick.position.set(x + 0.05, 0.2, 0);
    group.add(stick);
  }
  return group;
}

/** Hauteur sous plafond : les murs du fond et les fenêtres montent jusque-là. */
export const WALL_HEIGHT = 2.2;
/** Axe des murs du fond, à une demi-case et un peu plus du bord de la première rangée. */
export const WALL_AXIS = -0.6;
export const WALL_THICKNESS = 0.2;
export const WALL_COLOR = 0xece6da;
/** Allège et linteau des baies vitrées pleine hauteur (le cadre, du sol au plafond). */
export const GLASS_SILL = 0.14;
export const GLASS_HEADER = 0.24;

/**
 * Verre des fenêtres, partagé : presque transparent pour qu'on voie la ville derrière, teinté
 * par le ciel au fil de la journée (`OfficeLights.update`).
 */
export const windowGlass = new THREE.MeshBasicMaterial({
  color: 0xbfe3ff,
  transparent: true,
  opacity: 0.2,
  depthWrite: false,
  side: THREE.DoubleSide,
});

export interface WindowShape {
  /** Largeur en cases. */
  readonly cells: number;
  /** Bas et haut de la vitre. */
  readonly bottom: number;
  readonly top: number;
  /** Mur plein gardé de chaque côté de la vitre. */
  readonly inset: number;
  /** Couleur de l'allège et du linteau : le mur, ou le cadre pour une baie pleine hauteur. */
  readonly solid: number;
}

/**
 * Une fenêtre et le pan de mur qui la porte, sur toute sa largeur : le mur du fond est percé
 * là où une fenêtre est posée (voir `buildWalls` dans office.ts). Repère de l'objet : centre
 * de son emprise, le mur est derrière (z = `WALL_AXIS`). Le cadre (couleur `dark`) se repeint.
 */
function wallWindow({ cells, bottom, top, inset, solid }: WindowShape): THREE.Group {
  const group = new THREE.Group();
  const z = WALL_AXIS;
  const inner = cells - 2 * inset;
  const height = top - bottom;
  const rail = 0.05;
  if (bottom > 0) group.add(box(cells, bottom, WALL_THICKNESS, solid, 0, 0, z));
  group.add(box(cells, WALL_HEIGHT - top, WALL_THICKNESS, solid, 0, top, z));
  if (inset > 0) {
    for (const side of [-1, 1])
      group.add(
        box(inset, height, WALL_THICKNESS, WALL_COLOR, (side * (cells - inset)) / 2, bottom, z),
      );
  }
  // Cadre : traverses en haut et en bas, un montant à chaque case.
  group.add(box(inner, rail, WALL_THICKNESS + 0.06, PALETTE.dark, 0, bottom, z));
  group.add(box(inner, rail, WALL_THICKNESS + 0.06, PALETTE.dark, 0, top - rail, z));
  for (let k = 0; k <= cells; k++) {
    const x = -inner / 2 + (k * inner) / cells;
    group.add(box(rail, height, WALL_THICKNESS + 0.04, PALETTE.dark, x, bottom, z));
  }
  // Tablette intérieure sous les fenêtres classiques.
  if (inset > 0) group.add(box(inner + 0.1, 0.04, 0.14, PALETTE.white, 0, bottom - 0.04, z + 0.14));
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(inner, height), windowGlass);
  pane.position.set(0, bottom + height / 2, z);
  group.add(pane);
  return group;
}

/**
 * Hauteurs des fenêtres classiques : bas et haut de la vitre, mur plein gardé de chaque côté.
 * Les revêtements des murs (render/office.ts) recouvrent aussi ces morceaux de mur.
 */
export const WINDOW_SHAPES: Record<string, Omit<WindowShape, 'solid'>> = {
  'window-small': { cells: 1, bottom: 0.95, top: 1.65, inset: 0.12 },
  'window-medium': { cells: 2, bottom: 0.85, top: 1.75, inset: 0.12 },
  'window-large': { cells: 3, bottom: 0.75, top: 1.85, inset: 0.12 },
};

const classicWindow = (kind: string) => () =>
  wallWindow({ ...(WINDOW_SHAPES[kind] as Omit<WindowShape, 'solid'>), solid: WALL_COLOR });
const windowSmall = classicWindow('window-small');
const windowMedium = classicWindow('window-medium');
const windowLarge = classicWindow('window-large');
/** Vitre de building : du sol au plafond, tenue par une allège et un linteau métalliques. */
const glassWall = () =>
  wallWindow({
    cells: 2,
    bottom: GLASS_SILL,
    top: WALL_HEIGHT - GLASS_HEADER,
    inset: 0,
    solid: PALETTE.dark,
  });

const BUILDERS: Record<MissingAssetId, (() => THREE.Group) | null> = {
  babyfoot,
  slide,
  napPod,
  floorSpeaker,
  roundRug,
  pedalBin,
  standingDesk,
  earbudsDock,
  serverRack,
  drawerCabinet,
  doorCabinet,
  sinkUnit,
  tallCabinet,
  hutchCabinet,
  kitchenIsland,
  dripCoffeeMaker,
  espressoMachine,
  microwaveOven,
  electricKettle,
  riceCooker,
  drinksFridge,
  canteenTable,
  cactus,
  metricsScreen,
  ramen,
  mug,
  rubberDuck,
  trophy,
  deskEarbuds,
  deskLamp,
  bookStack,
  teddyBear,
  retroRadio,
  secondScreen,
  miniSpeaker,
  chromeToaster: toaster,
  smoothieBlender: blender,
  miniCactus,
  mousePad,
  qwertyKeyboard,
  plainTower,
  neonTower,
  liquidTower,
  titanTower,
  proLaptop,
  litterOpen,
  litterCovered,
  litterRobot,
  catBowl,
  catFeeder,
  catTreeSmall,
  catTreeMedium,
  catTreeLarge,
  windowSmall,
  windowMedium,
  windowLarge,
  glassWall,
  thinWall: () => partitionPiece('solid'),
  glassPartition: () => partitionPiece('glass'),
  sofa: detailedSofa,
  bookcase: detailedBookcase,
  officeDesk,
  trestleDesk,
  officeChair,
  ergonomicChair,
  mediaConsole,
  snakePlant,
  pothos,
  bonsai,
  fiddleLeafFig,
  kentiaPalm,
  oliveTree,
  planterBox,
  giantMonstera,
  videoProjector,
  ceilingProjector,
  projectionScreenSmall,
  projectionScreenMedium,
  projectionScreenLarge,
  serverCloset,
  serverRoom,
  rackServer,
  bladeServer,
  gpuServer,
  networkSwitch,
  fibreRouter,
  precisionCooling,
  upsUnit,
  backupNas,
  firewallUnit,
  fireSuppression,
  unicornStatue,
  ipoBell,
  ...ANNEX_DECOR_PRIMITIVES,
  receptionDesk,
  badgeGates: null,
  officeCharacters: null,
  officeCats: null,
  cleaningCrew: null,
  officeLitter: null,
  seasonalDecor: null,
  meetingRoomProps: null,
  deskMonitors: null,
  citySkyline: null,
  uiPack: null,
  soundPacks: null,
};

export function buildPrimitive(id: MissingAssetId): THREE.Group {
  const build = BUILDERS[id];
  return build ? build() : new THREE.Group();
}

/** Boîte de secours quand un modèle Kenney ne se charge pas. */
export function fallbackBox(
  width: number,
  depth: number,
  height: number,
  color: number = PALETTE.metal,
): THREE.Group {
  const group = new THREE.Group();
  group.add(box(width * 0.9, Math.max(0.05, height), depth * 0.9, color));
  return group;
}

/**
 * Personnage de secours, façon « blocky », avec des parties nommées pour les animations
 * procédurales (bob, rotation, petits sauts) quand le GLB n'est pas disponible.
 */
export function fallbackCharacter(shirtColor: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'fallback-character';
  const body = box(0.42, 0.45, 0.26, shirtColor, 0, 0.45, 0);
  body.name = 'body';
  const head = box(0.36, 0.34, 0.34, PALETTE.skin, 0, 0.92, 0);
  head.name = 'head';
  const legs = box(0.38, 0.45, 0.22, PALETTE.dark, 0, 0, 0);
  legs.name = 'legs';
  group.add(legs, body, head);
  return group;
}

/** Couleur de t-shirt par profil, utilisée par le personnage de secours. */
export const ROLE_COLORS = [
  PALETTE.blue,
  PALETTE.red,
  PALETTE.green,
  PALETTE.yellow,
  PALETTE.purple,
  PALETTE.wood,
];
