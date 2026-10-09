/**
 * Formes Three.js qui remplacent les modèles absents des packs Kenney (babyfoot, toboggan,
 * sieste-pod, bureau debout, casques, baie de serveurs, machines à café, frigo à boissons,
 * cactus, écran de métriques, ramen, casque et mini-cactus de bureau, tapis de souris, clavier
 * QWERTY (voir `keyboard.ts`), litières, gamelles, arbres à chat, canapé et bibliothèque
 * détaillés, plantes d'intérieur (voir `plants.ts`)) et servent de secours si un GLB ne se charge pas.
 * Chaque forme assemble des primitives (boîtes, cylindres) dans la palette low-poly du
 * Furniture Kit, en unités de grille : une case mesure 1 x 1, l'objet est posé au sol (y = 0)
 * et regarde vers +z, comme les modèles Kenney.
 */
import * as THREE from 'three';
import type { MissingAssetId } from './assetManifest';
import { detailedBookcase, detailedSofa } from './furnitureDetail';
import { qwertyKeyboard } from './keyboard';
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
  ceramic: 0xebe6dc,
  concrete: 0xaba69d,
  wicker: 0xa88a5a,
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
const glass = new THREE.MeshStandardMaterial({
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

function babyfoot(): THREE.Group {
  const group = new THREE.Group();
  for (const [x, z] of [
    [-0.75, -0.3],
    [0.75, -0.3],
    [-0.75, 0.3],
    [0.75, 0.3],
  ] as const) {
    group.add(box(0.08, 0.6, 0.08, PALETTE.woodDark, x, 0, z));
  }
  group.add(box(1.7, 0.25, 0.8, PALETTE.wood, 0, 0.6, 0));
  group.add(box(1.55, 0.02, 0.65, PALETTE.green, 0, 0.84, 0));
  // Barres et joueurs.
  for (let i = 0; i < 6; i++) {
    const x = -0.6 + i * 0.24;
    const rod = cylinder(0.015, 1.1, PALETTE.metal);
    rod.rotation.x = Math.PI / 2;
    rod.position.set(x, 0.92, 0);
    group.add(rod);
    const color = i % 2 === 0 ? PALETTE.red : PALETTE.blue;
    for (const z of [-0.15, 0.15]) group.add(box(0.06, 0.14, 0.05, color, x, 0.82, z));
  }
  return group;
}

function slide(): THREE.Group {
  const group = new THREE.Group();
  // Échelle à l'arrière, plan incliné vers l'avant.
  for (const x of [-0.35, 0.35]) group.add(box(0.06, 2, 0.06, PALETTE.metal, x, 0, -1.3));
  for (let i = 0; i < 6; i++)
    group.add(box(0.7, 0.04, 0.06, PALETTE.metal, 0, 0.3 + i * 0.3, -1.3));
  group.add(box(0.8, 0.08, 0.5, PALETTE.yellow, 0, 1.9, -1.1));
  const ramp = box(0.7, 0.06, 2.6, PALETTE.red, 0, 0, 0);
  ramp.geometry.translate(0, -0.03, 0);
  ramp.rotation.x = Math.atan2(1.9, 2.4);
  ramp.position.set(0, 1, 0.05);
  group.add(ramp);
  for (const x of [-0.37, 0.37]) {
    const rail = box(0.04, 0.12, 2.6, PALETTE.yellow, 0, 0, 0);
    rail.rotation.x = ramp.rotation.x;
    rail.position.set(x, 1.05, 0.05);
    group.add(rail);
  }
  return group;
}

function napPod(): THREE.Group {
  const group = new THREE.Group();
  group.add(box(1.8, 0.35, 0.8, PALETTE.white, 0, 0, 0));
  group.add(box(1.6, 0.12, 0.65, PALETTE.blue, 0, 0.35, 0));
  // Coque en demi-cylindre au-dessus du matelas.
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 1.8, 12, 1, true, 0, Math.PI),
    material(PALETTE.white),
  );
  shell.material = material(PALETTE.white).clone();
  (shell.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  shell.rotation.z = Math.PI / 2;
  shell.rotation.y = Math.PI / 2;
  shell.position.set(0, 0.47, -0.05);
  group.add(shell);
  group.add(box(0.2, 0.1, 0.4, PALETTE.white, -0.65, 0.47, 0));
  return group;
}

function standingDesk(): THREE.Group {
  const group = new THREE.Group();
  for (const x of [-0.8, 0.8]) {
    group.add(box(0.08, 1.05, 0.08, PALETTE.dark, x, 0, 0));
    group.add(box(0.1, 0.04, 0.6, PALETTE.dark, x, 0, 0));
  }
  group.add(box(1.9, 0.05, 0.75, PALETTE.white, 0, 1.05, 0));
  group.add(box(0.7, 0.42, 0.04, PALETTE.dark, 0, 1.15, -0.2));
  group.add(box(0.5, 0.02, 0.15, PALETTE.dark, 0, 1.1, 0.12));
  return group;
}

/** Un casque audio : arceau et deux oreillettes, centré sur l'arceau. */
function headset(color: number): THREE.Group {
  const group = new THREE.Group();
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.022, 6, 12, Math.PI),
    material(PALETTE.dark),
  );
  group.add(band);
  for (const x of [-0.13, 0.13]) {
    const cup = cylinder(0.065, 0.06, color);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(x, -0.03, 0);
    group.add(cup);
  }
  return group;
}

/** Casques antibruit : un portant de bureau avec trois casques de couleurs différentes. */
function headphones(): THREE.Group {
  const group = new THREE.Group();
  group.add(post(0.28, 0.3, 0.05, PALETTE.dark));
  group.add(post(0.03, 0.03, 1.05, PALETTE.metal, 0, 0.05, 0));
  // Bras en croix au sommet, un casque suspendu à chaque bout et un posé sur le dessus.
  group.add(box(0.7, 0.04, 0.04, PALETTE.metal, 0, 1.0, 0));
  const colors = [PALETTE.red, PALETTE.blue, PALETTE.yellow];
  colors.forEach((color, index) => {
    const one = headset(color);
    one.scale.setScalar(1.4);
    if (index < 2) {
      one.position.set(index === 0 ? -0.3 : 0.3, 0.86, 0);
      one.rotation.y = Math.PI / 2;
    } else {
      one.position.set(0, 1.1, 0);
    }
    group.add(one);
  });
  return group;
}

/** Casque antibruit de bureau : un casque posé sur son petit support, à portée de main. */
function deskHeadset(): THREE.Group {
  const group = new THREE.Group();
  group.add(post(0.07, 0.08, 0.02, PALETTE.dark));
  group.add(post(0.012, 0.012, 0.25, PALETTE.metal, 0, 0.02, 0));
  group.add(box(0.06, 0.015, 0.03, PALETTE.metal, 0, 0.255, 0));
  // L'arceau repose sur le haut du support, les oreillettes pendent de chaque côté.
  // Oreillettes vers l'avant et l'arrière : le casque tient au bout d'un bureau.
  const one = headset(PALETTE.blue);
  one.position.set(0, 0.15, 0);
  one.rotation.y = Math.PI / 2;
  group.add(one);
  return group;
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
  group.add(box(0.26, 0.008, 0.24, PALETTE.blue, 0, 0, 0));
  group.add(box(0.24, 0.012, 0.22, PALETTE.dark, 0, 0, 0));
  return group;
}

/** Baie de serveurs : armoire noire, serveurs empilés et voyants qui clignotent. */
function serverRack(): THREE.Group {
  const group = new THREE.Group();
  group.add(box(0.82, 1.8, 0.82, PALETTE.dark, 0, 0, 0));
  group.add(box(0.86, 0.06, 0.86, 0x23283a, 0, 1.8, 0));
  // Grille de ventilation sur le dessus.
  for (let i = 0; i < 4; i++) group.add(box(0.6, 0.015, 0.05, 0x1a1e2b, 0, 1.86, -0.24 + i * 0.16));
  const leds = [PALETTE.green, PALETTE.green, PALETTE.blue, PALETTE.yellow, PALETTE.green];
  for (let i = 0; i < 9; i++) {
    const y = 0.12 + i * 0.18;
    group.add(box(0.7, 0.14, 0.03, 0x4a5168, 0, y, 0.41));
    // Voyants : un motif différent par serveur, et une baie en alerte (rouge).
    for (let j = 0; j < 3; j++) {
      const color = i === 5 && j === 0 ? PALETTE.red : (leds[(i + j * 2) % leds.length] ?? 0);
      group.add(light(0.04, 0.03, 0.02, color, 0.24 + j * 0.07, y + 0.055, 0.43));
    }
    group.add(box(0.36, 0.02, 0.01, 0x2c3245, -0.12, y + 0.06, 0.43));
  }
  // Câbles qui dépassent sur le côté, comme dans toutes les vraies baies.
  for (const [z, color] of [
    [0.25, PALETTE.blue],
    [0.1, PALETTE.yellow],
  ] as const) {
    group.add(box(0.03, 0.9, 0.03, color, 0.43, 0.6, z));
  }
  return group;
}

/** Cafetière à filtre, petite et bon marché : socle noir, verseuse en verre à moitié pleine. */
function dripCoffeeMaker(): THREE.Group {
  const group = new THREE.Group();
  group.add(box(0.34, 0.04, 0.32, PALETTE.dark, 0, 0, 0));
  group.add(box(0.34, 0.46, 0.12, PALETTE.dark, 0, 0, -0.1));
  group.add(box(0.34, 0.1, 0.3, PALETTE.dark, 0, 0.4, -0.01));
  group.add(post(0.1, 0.11, 0.02, 0x1a1e2b, 0, 0.04, 0.05));
  group.add(post(0.1, 0.1, 0.2, glass, 0, 0.06, 0.05));
  group.add(post(0.09, 0.09, 0.09, PALETTE.coffee, 0, 0.065, 0.05));
  group.add(box(0.03, 0.12, 0.03, PALETTE.dark, 0, 0.1, 0.17));
  group.add(light(0.03, 0.03, 0.01, PALETTE.red, 0.12, 0.42, 0.145));
  return group;
}

/** Machine à expresso de barista : chrome, deux groupes, manomètre, tasses et moulin. */
function espressoMachine(): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.add(box(0.56, 0.36, 0.4, PALETTE.chrome, 0, 0, -0.02));
  for (const x of [-0.285, 0.285]) body.add(box(0.02, 0.32, 0.36, PALETTE.red, x, 0.02, -0.02));
  body.add(box(0.5, 0.03, 0.12, PALETTE.metal, 0, 0, 0.22));
  body.add(box(0.58, 0.04, 0.42, PALETTE.metal, 0, 0.36, -0.02));
  // Manomètre sur la façade.
  const gauge = post(0.055, 0.055, 0.02, PALETTE.white);
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(0, 0.27, 0.19);
  body.add(gauge);
  body.add(box(0.005, 0.04, 0.005, PALETTE.red, 0.01, 0.26, 0.2));
  // Deux groupes et leurs porte-filtres noirs, une tasse sous chacun.
  for (const x of [-0.15, 0.15]) {
    body.add(post(0.045, 0.05, 0.06, PALETTE.metal, x, 0.12, 0.2));
    body.add(box(0.03, 0.03, 0.14, PALETTE.dark, x, 0.11, 0.3));
    body.add(post(0.03, 0.025, 0.05, PALETTE.white, x, 0.03, 0.22));
  }
  // Buse vapeur.
  const wand = cylinder(0.008, 0.16, PALETTE.metal);
  wand.rotation.z = 0.3;
  wand.position.set(0.25, 0.16, 0.2);
  body.add(wand);
  // Tasses qui chauffent sur le dessus.
  for (const [x, z] of [
    [-0.17, -0.1],
    [-0.08, -0.1],
    [0.01, -0.1],
    [-0.12, 0.02],
  ] as const) {
    body.add(post(0.03, 0.025, 0.05, PALETTE.white, x, 0.4, z));
  }
  body.position.x = -0.1;
  group.add(body);
  // Moulin à café : corps noir, trémie en verre pleine de grains.
  group.add(box(0.14, 0.24, 0.16, PALETTE.dark, 0.3, 0, -0.06));
  group.add(post(0.09, 0.05, 0.14, glass, 0.3, 0.24, -0.06));
  group.add(post(0.07, 0.045, 0.08, PALETTE.coffee, 0.3, 0.25, -0.06));
  return group;
}

/** Frigo à boissons vitré : canettes de toutes les couleurs, bandeau lumineux. */
function drinksFridge(): THREE.Group {
  const group = new THREE.Group();
  // Caisson ouvert à l'avant : fond, côtés, socle et chapeau.
  group.add(box(0.84, 1.82, 0.06, PALETTE.red, 0, 0, -0.36));
  for (const x of [-0.39, 0.39]) group.add(box(0.06, 1.82, 0.7, PALETTE.red, x, 0, -0.04));
  group.add(box(0.84, 0.14, 0.7, 0x9f2f25, 0, 0, -0.04));
  group.add(box(0.84, 0.32, 0.7, PALETTE.red, 0, 1.5, -0.04));
  group.add(box(0.72, 1.36, 0.02, PALETTE.white, 0, 0.14, -0.32));
  group.add(light(0.7, 0.14, 0.02, PALETTE.white, 0, 1.6, 0.32));
  // Étagères et canettes, derrière la porte vitrée.
  const cans = [PALETTE.red, PALETTE.green, PALETTE.yellow, PALETTE.blue, PALETTE.white];
  for (let row = 0; row < 4; row++) {
    const y = 0.16 + row * 0.35;
    group.add(box(0.7, 0.02, 0.5, PALETTE.white, 0, y, 0));
    for (let i = 0; i < 6; i++) {
      const color = cans[(row * 2 + i) % cans.length] ?? PALETTE.red;
      group.add(post(0.045, 0.045, 0.15, color, -0.28 + i * 0.112, y + 0.02, 0.12, 6));
    }
  }
  group.add(box(0.72, 1.36, 0.02, glass, 0, 0.14, 0.31));
  group.add(box(0.04, 0.5, 0.05, PALETTE.metal, 0.33, 0.7, 0.34));
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

/** Mug de dev : corps, anse et un fond de café froid. */
function mug(): THREE.Group {
  const group = new THREE.Group();
  group.add(post(0.07, 0.065, 0.14, PALETTE.white, 0, 0, 0));
  group.add(post(0.06, 0.06, 0.005, PALETTE.coffee, 0, 0.125, 0));
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.04, 0.012, 6, 10),
    material(PALETTE.white),
  );
  handle.position.set(0.075, 0.07, 0);
  group.add(handle);
  // Le logo du mug, une bande colorée.
  group.add(post(0.071, 0.067, 0.03, PALETTE.blue, 0, 0.05, 0));
  return group;
}

/** Canard en plastique jaune, le meilleur outil de débogage. */
function rubberDuck(): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), material(PALETTE.yellow));
  body.scale.set(1.25, 0.8, 1);
  body.position.set(0, 0.07, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), material(PALETTE.yellow));
  head.position.set(0.06, 0.17, 0);
  const beak = box(0.05, 0.025, 0.04, PALETTE.orange, 0.12, 0.155, 0);
  group.add(body, head, beak);
  for (const z of [-0.03, 0.03]) group.add(box(0.012, 0.012, 0.012, PALETTE.dark, 0.1, 0.185, z));
  // Tourné vers le dev assis devant le bureau (l'avant des objets est +z).
  group.rotation.y = -Math.PI / 2;
  return group;
}

/** Coupe de hackathon dorée sur un socle en bois. */
function trophy(): THREE.Group {
  const group = new THREE.Group();
  group.add(box(0.16, 0.06, 0.16, PALETTE.woodDark, 0, 0, 0));
  group.add(post(0.02, 0.03, 0.1, PALETTE.gold, 0, 0.06, 0));
  group.add(post(0.08, 0.035, 0.14, PALETTE.gold, 0, 0.16, 0));
  for (const x of [-0.085, 0.085]) {
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.03, 0.008, 5, 8),
      material(PALETTE.gold),
    );
    handle.position.set(x, 0.25, 0);
    group.add(handle);
  }
  return group;
}

// --- Animaux : équipement des chats (litières, gamelles, arbres à chat). ---

/** Litière ouverte : un bac en plastique, du sable et la pelle posée à côté. */
function litterOpen(): THREE.Group {
  const group = new THREE.Group();
  group.add(box(0.62, 0.03, 0.46, PALETTE.mint, 0, 0, 0));
  for (const [w, d, x, z] of [
    [0.62, 0.04, 0, -0.21],
    [0.62, 0.04, 0, 0.21],
    [0.04, 0.46, -0.29, 0],
    [0.04, 0.46, 0.29, 0],
  ] as const)
    group.add(box(w, 0.14, d, PALETTE.mint, x, 0.03, z));
  group.add(box(0.54, 0.06, 0.38, PALETTE.sand, 0, 0.03, 0));
  // Quelques grumeaux, et la pelle.
  for (const [x, z] of [
    [-0.12, 0.05],
    [0.1, -0.08],
  ] as const)
    group.add(box(0.05, 0.03, 0.04, PALETTE.sisal, x, 0.09, z));
  const scoop = box(0.08, 0.015, 0.2, PALETTE.dark, 0.38, 0, 0.05);
  scoop.rotation.y = 0.4;
  group.add(scoop);
  return group;
}

/** Litière fermée : un bac surmonté d'un capot avec une porte battante et une poignée. */
function litterCovered(): THREE.Group {
  const group = new THREE.Group();
  group.add(box(0.66, 0.16, 0.5, PALETTE.mint, 0, 0, 0));
  group.add(box(0.64, 0.3, 0.48, PALETTE.white, 0, 0.16, 0));
  // Toit arrondi : un demi-cylindre couché.
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.64, 10, 1, false, 0, Math.PI),
    material(PALETTE.white),
  );
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.set(0, 0.46, 0);
  roof.scale.set(1, 1, 0.55);
  group.add(roof);
  // Porte battante teintée, sur la face avant.
  group.add(box(0.26, 0.24, 0.02, PALETTE.dark, 0, 0.12, 0.245));
  group.add(box(0.2, 0.04, 0.05, PALETTE.mint, 0, 0.56, 0));
  return group;
}

/** Litière robot : dôme sur socle, ouverture sombre, écran et voyant lumineux. */
function litterRobot(): THREE.Group {
  const group = new THREE.Group();
  group.add(post(0.36, 0.38, 0.16, PALETTE.dark, 0, 0, 0, 12));
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    material(PALETTE.white),
  );
  dome.position.set(0, 0.16, 0);
  dome.scale.set(1, 1.35, 1);
  group.add(dome);
  // Entrée ronde, tournée vers l'avant.
  const entrance = new THREE.Mesh(new THREE.CircleGeometry(0.17, 12), material(PALETTE.dark));
  entrance.position.set(0, 0.36, 0.335);
  entrance.rotation.x = -0.25;
  group.add(entrance);
  group.add(box(0.16, 0.05, 0.02, PALETTE.screen, 0, 0.6, 0.27));
  group.add(light(0.04, 0.04, 0.02, PALETTE.green, 0.12, 0.61, 0.265));
  group.add(light(0.3, 0.015, 0.02, PALETTE.blue, 0, 0.1, 0.375));
  return group;
}

/** Bol posé sur `y`, rempli d'eau ou de croquettes. */
function bowl(x: number, y: number, z: number, filling: 'water' | 'kibble'): THREE.Group {
  const group = new THREE.Group();
  group.add(post(0.11, 0.08, 0.07, PALETTE.metal, 0, 0, 0, 12));
  if (filling === 'water') group.add(post(0.095, 0.095, 0.01, PALETTE.water, 0, 0.055, 0, 12));
  else {
    group.add(post(0.095, 0.095, 0.02, PALETTE.coffee, 0, 0.045, 0, 12));
    for (const [kx, kz] of [
      [-0.03, 0.02],
      [0.03, -0.03],
      [0.02, 0.04],
    ] as const)
      group.add(box(0.03, 0.02, 0.03, PALETTE.woodDark, kx, 0.06, kz));
  }
  group.position.set(x, y, z);
  return group;
}

/** Gamelle double : l'eau et les croquettes côte à côte sur un support en bois. */
function catBowl(): THREE.Group {
  const group = new THREE.Group();
  group.add(box(0.56, 0.08, 0.28, PALETTE.wood, 0, 0, 0));
  group.add(bowl(-0.13, 0.08, 0, 'water'));
  group.add(bowl(0.13, 0.08, 0, 'kibble'));
  return group;
}

/** Fontaine à eau et distributeur de croquettes sur un même socle. */
function catFeeder(): THREE.Group {
  const group = new THREE.Group();
  group.add(box(0.72, 0.05, 0.4, PALETTE.white, 0, 0, 0));
  // Distributeur : réservoir transparent plein de croquettes, plateau en dessous.
  group.add(box(0.26, 0.1, 0.3, PALETTE.white, -0.18, 0.05, -0.02));
  group.add(box(0.2, 0.3, 0.2, glass, -0.18, 0.15, -0.05));
  group.add(box(0.18, 0.18, 0.18, PALETTE.coffee, -0.18, 0.15, -0.05));
  group.add(box(0.22, 0.04, 0.22, PALETTE.white, -0.18, 0.45, -0.05));
  group.add(box(0.2, 0.03, 0.12, PALETTE.coffee, -0.18, 0.06, 0.12));
  group.add(light(0.04, 0.04, 0.01, PALETTE.green, -0.1, 0.4, 0.06));
  // Fontaine : bassin rond et jet d'eau.
  group.add(post(0.15, 0.13, 0.1, PALETTE.white, 0.18, 0.05, 0, 12));
  group.add(post(0.13, 0.13, 0.01, PALETTE.water, 0.18, 0.145, 0, 12));
  group.add(post(0.025, 0.025, 0.08, PALETTE.chrome, 0.18, 0.15, 0, 8));
  const spout = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glass);
  spout.position.set(0.18, 0.25, 0);
  group.add(spout);
  return group;
}

/** Poteau en sisal (griffoir) de `h` de haut, posé sur `y`. */
function sisalPost(x: number, y: number, z: number, h: number): THREE.Mesh {
  return post(0.075, 0.075, h, PALETTE.sisal, x, y, z, 8);
}

/** Plateau recouvert de moquette (rond si `round`). */
function platform(
  w: number,
  d: number,
  fabric: number,
  x: number,
  y: number,
  z: number,
  round = false,
): THREE.Mesh {
  return round ? post(w / 2, w / 2, 0.06, fabric, x, y, z, 12) : box(w, 0.06, d, fabric, x, y, z);
}

/** Panier rond posé sur `y`, le coussin du chat au sommet de l'arbre. */
function basket(fabric: number, x: number, y: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.add(post(0.24, 0.22, 0.05, fabric, 0, 0, 0, 12));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.05, 6, 14), material(fabric));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.07;
  group.add(rim);
  group.position.set(x, y, z);
  return group;
}

/** Niche cubique avec une entrée ronde sur la face avant. */
function cubby(fabric: number, x: number, y: number, z: number, size = 0.5): THREE.Group {
  const group = new THREE.Group();
  group.add(box(size, size, size, fabric, 0, 0, 0));
  const hole = new THREE.Mesh(new THREE.CircleGeometry(size * 0.3, 10), material(PALETTE.dark));
  hole.position.set(0, size * 0.45, size / 2 + 0.002);
  group.add(hole);
  group.position.set(x, y, z);
  return group;
}

/** Pompon suspendu à un plateau par une ficelle. */
function pompom(x: number, y: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.add(box(0.01, 0.2, 0.01, PALETTE.white, 0, -0.2, 0));
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), material(PALETTE.red));
  ball.position.y = -0.23;
  group.add(ball);
  group.position.set(x, y, z);
  return group;
}

/** Arbre à chat compact (1 case, moquette beige) : griffoir, panier en haut, pompon. */
function catTreeSmall(): THREE.Group {
  const fabric = PALETTE.plush;
  const group = new THREE.Group();
  group.add(platform(0.78, 0.78, fabric, 0, 0, 0));
  group.add(sisalPost(0, 0.06, 0, 0.72));
  group.add(platform(0.56, 0.56, fabric, 0, 0.78, 0, true));
  group.add(basket(fabric, 0, 0.84, 0));
  group.add(pompom(0.24, 0.78, 0.18));
  return group;
}

/** Arbre à chat double (2 cases, moquette grise) : deux tours, niche, hamac, plateau haut. */
function catTreeMedium(): THREE.Group {
  const fabric = PALETTE.slate;
  const group = new THREE.Group();
  group.add(platform(1.8, 0.8, fabric, 0, 0, 0));
  // Tour de gauche, la plus haute, avec un panier au sommet.
  group.add(sisalPost(-0.5, 0.06, 0, 1.1));
  group.add(platform(0.6, 0.6, fabric, -0.5, 0.55, 0));
  group.add(platform(0.6, 0.6, fabric, -0.5, 1.16, 0, true));
  group.add(basket(fabric, -0.5, 1.22, 0));
  // Tour de droite : une niche, un hamac en toile entre deux poteaux.
  group.add(cubby(fabric, 0.5, 0.06, 0, 0.5));
  group.add(sisalPost(0.3, 0.56, -0.15, 0.24));
  group.add(sisalPost(0.7, 0.56, -0.15, 0.24));
  group.add(platform(0.62, 0.6, fabric, 0.5, 0.8, 0));
  group.add(pompom(0.15, 0.55, 0.2));
  return group;
}

/** Arbre à chat géant (3 cases, moquette mauve) : trois tours de hauteurs différentes. */
function catTreeLarge(): THREE.Group {
  const fabric = PALETTE.mauve;
  const group = new THREE.Group();
  group.add(platform(2.8, 0.8, fabric, 0, 0, 0));
  // Gauche : niche, puis un plateau bas.
  group.add(cubby(fabric, -1, 0.06, 0, 0.55));
  group.add(sisalPost(-1, 0.61, 0, 0.12));
  group.add(platform(0.66, 0.62, fabric, -1, 0.73, 0));
  // Centre : la tour la plus haute, deux étages et un panier.
  group.add(sisalPost(0, 0.06, 0, 1.5));
  group.add(platform(0.6, 0.6, fabric, 0, 0.7, 0, true));
  group.add(platform(0.62, 0.62, fabric, 0, 1.56, 0, true));
  group.add(basket(fabric, 0, 1.62, 0));
  group.add(pompom(0.25, 0.7, 0.2));
  // Droite : tour moyenne et une passerelle vers le centre.
  group.add(sisalPost(1, 0.06, 0, 1.06));
  group.add(platform(0.62, 0.62, fabric, 1, 1.12, 0));
  const ramp = box(0.7, 0.04, 0.22, fabric, 0.5, 1.28, 0);
  ramp.rotation.z = 0.5;
  group.add(ramp);
  group.add(pompom(1.2, 1.12, 0.22));
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

interface WindowShape {
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

const windowSmall = () =>
  wallWindow({ cells: 1, bottom: 0.95, top: 1.65, inset: 0.12, solid: WALL_COLOR });
const windowMedium = () =>
  wallWindow({ cells: 2, bottom: 0.85, top: 1.75, inset: 0.12, solid: WALL_COLOR });
const windowLarge = () =>
  wallWindow({ cells: 3, bottom: 0.75, top: 1.85, inset: 0.12, solid: WALL_COLOR });
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
  standingDesk,
  headphones,
  serverRack,
  dripCoffeeMaker,
  espressoMachine,
  drinksFridge,
  cactus,
  metricsScreen,
  ramen,
  mug,
  rubberDuck,
  trophy,
  deskHeadset,
  miniCactus,
  mousePad,
  qwertyKeyboard,
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
  sofa: detailedSofa,
  bookcase: detailedBookcase,
  snakePlant,
  pothos,
  bonsai,
  fiddleLeafFig,
  kentiaPalm,
  oliveTree,
  planterBox,
  giantMonstera,
  officeCharacters: null,
  officeCats: null,
  seasonalDecor: null,
  meetingRoomProps: null,
  citySkyline: null,
  annexDecor: null,
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
