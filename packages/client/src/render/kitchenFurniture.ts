/**
 * Cuisine détaillée, en formes Three.js : six meubles de cuisine (bas à tiroirs, bas à portes,
 * évier, colonne à niche, buffet vaisselier, îlot), l'électroménager qu'on pose dessus
 * (cafetière, machine à expresso, micro-ondes, bouilloire, cuiseur à riz), le frigo à boissons
 * et la grande tablée de la cantine.
 *
 * Meubles et appareils sont des objets séparés : le meuble a un plan de travail vide où les
 * emplacements d'accessoires (`surface` dans `view/catalog.ts`) reçoivent les appareils. Caisson,
 * socle en retrait, façades séparées par un jour, poignées, plan de travail en pierre ; un
 * appareil tient dans la moitié d'un plan de travail (0,42 de large au plus). Les hauteurs sont
 * celles des modèles Kenney (plan de travail à 0,9, dessus du frigo à 1,82, plateau de la table à
 * 0,69, assise à 0,44). Chaque objet est fusionné par matériau (voir `pieces.ts`), posé au sol
 * (y = 0) et regarde vers +z.
 */
import type * as THREE from 'three';
import { Pieces, seeded } from './pieces';
import { glass, PALETTE } from './primitives';

/**
 * Plan de travail des meubles bas, à la hauteur des meubles de cuisine Kenney. `width` est la
 * largeur d'un meuble d'une case ; celle d'un meuble de deux cases est `wide`.
 */
const COUNTER = {
  width: 0.86,
  wide: 1.86,
  depth: 0.6,
  top: 0.9,
  plinth: 0.08,
  worktop: 0.04,
} as const;
/** Avant des façades (le caisson s'arrête à 0,27, les façades dépassent un peu). */
const FRONT_Z = 0.285;
/** Niche de la colonne : hauteur du fond, où l'appareil encastré est posé. */
const NICHE_FLOOR = 1.02;
/** Plan de l'îlot central, un peu plus haut et plus profond que les meubles bas. */
const ISLAND = { width: 1.86, depth: 0.86, top: 0.92 } as const;

const STONE = 0x5d6272;
const PLINTH = 0x2f3443;
const STEEL = 0xc3c9d3;
const BLACK = 0x23283a;
const COAL = 0x1a1e2b;
const TILE = 0xdfe7ea;

/** Caisson d'un meuble bas de `width` : côtés, dos, fond, socle en retrait, plan en pierre. */
function counterBody(p: Pieces, width: number = COUNTER.width): void {
  const { depth, top, plinth, worktop } = COUNTER;
  const h = top - worktop - plinth;
  p.box(width - 0.06, plinth, depth - 0.1, PLINTH, [0, 0, -0.04]);
  for (const side of [-1, 1])
    p.box(0.02, h, depth - 0.03, PALETTE.cabinet, [side * (width / 2 - 0.01), plinth, -0.015]);
  p.box(width, h, 0.02, PALETTE.cabinet, [0, plinth, -depth / 2 + 0.01]);
  p.box(width - 0.04, 0.02, depth - 0.05, PALETTE.cabinet, [0, plinth, -0.02]);
  // Plan de travail qui déborde devant, avec un chant plus clair.
  p.box(width + 0.02, worktop, depth + 0.01, STONE, [0, top - worktop, 0.005]);
  p.box(width + 0.02, 0.006, 0.006, 0x8a90a0, [0, top - 0.006, depth / 2 + 0.008]);
}

/** Façade (porte ou tiroir) de `w` x `h`, coin bas au centre `x`, base à `y`. */
function front(p: Pieces, x: number, y: number, w: number, h: number): void {
  p.box(w, h, 0.018, PALETTE.cabinet, [x, y, FRONT_Z]);
}

/** Poignée en acier brossé, verticale (porte) ou horizontale (tiroir), sur deux plots. */
function handle(p: Pieces, x: number, y: number, length: number, vertical: boolean): void {
  const z = FRONT_Z + 0.018;
  if (vertical) {
    p.box(0.014, length, 0.014, STEEL, [x, y, z + 0.014]);
    for (const dy of [0.02, length - 0.03]) p.box(0.01, 0.01, 0.014, STEEL, [x, y + dy, z]);
  } else {
    p.box(length, 0.014, 0.014, STEEL, [x, y, z + 0.014]);
    for (const dx of [-length / 2 + 0.02, length / 2 - 0.02])
      p.box(0.01, 0.01, 0.014, STEEL, [x + dx, y + 0.002, z]);
  }
}

/** Hauteur disponible pour les façades d'un meuble bas, et leur base. */
const FRONTS = {
  y0: COUNTER.plinth + 0.02,
  height: COUNTER.top - COUNTER.worktop - COUNTER.plinth - 0.02 - 0.008,
} as const;

/** Trois tiroirs de plus en plus hauts sur une largeur `w`, centrés en `x`. */
function drawerStack(p: Pieces, x: number, w: number): void {
  let y = FRONTS.y0;
  for (const share of [0.42, 0.32, 0.26]) {
    const h = FRONTS.height * share;
    front(p, x, y, w - 0.01, h - 0.01);
    handle(p, x, y + h - 0.07, Math.min(0.3, w * 0.4), false);
    y += h;
  }
}

/** Deux portes sur une largeur `w`, centrées en `x`, poignées vers le milieu. */
function doorPair(p: Pieces, x: number, w: number, y: number, h: number): void {
  for (const side of [-1, 1]) {
    front(p, x + (side * w) / 4, y, w / 2 - 0.01, h);
    handle(p, x + side * 0.035, y + h - 0.22, 0.16, true);
  }
}

/** Meuble bas à tiroirs : trois tiroirs, plan de travail libre pour deux appareils. */
export function drawerCabinet(): THREE.Group {
  const p = new Pieces([PALETTE.cabinet]);
  counterBody(p);
  drawerStack(p, 0, COUNTER.width - 0.01);
  return p.build('drawerCabinet');
}

/** Meuble bas à portes : deux portes sous un bandeau, plan de travail libre. */
export function doorCabinet(): THREE.Group {
  const p = new Pieces([PALETTE.cabinet]);
  counterBody(p);
  const { y0, height } = FRONTS;
  doorPair(p, 0, COUNTER.width, y0, height - 0.13);
  // Bandeau fixe en haut, avec une petite poignée creuse.
  front(p, 0, y0 + height - 0.12, COUNTER.width - 0.01, 0.12);
  p.box(0.12, 0.012, 0.01, COAL, [0, y0 + height - 0.04, FRONT_Z + 0.012]);
  return p.build('doorCabinet');
}

/** Bac en inox : rebord, fond plus sombre, bonde, vu comme encastré dans le plan. */
function sinkBasin(p: Pieces, x: number, w: number, d: number): void {
  const y = COUNTER.top;
  p.box(w, 0.004, d, 0x5b6170, [x, y, -0.02]);
  for (const side of [-1, 1]) {
    p.box(0.03, 0.012, d, STEEL, [x + side * (w / 2 - 0.015), y, -0.02]);
    p.box(w, 0.012, 0.03, STEEL, [x, y, -0.02 + side * (d / 2 - 0.015)]);
  }
  p.post(0.02, 0.02, 0.006, STEEL, [x, y + 0.004, -0.02], 10);
}

/** Robinet col de cygne : pied, col, bec qui revient au-dessus du bac, manette. */
function faucet(p: Pieces, x: number, z: number): void {
  const y = COUNTER.top;
  p.post(0.025, 0.03, 0.04, PALETTE.chrome, [x, y, z], 10);
  p.bar([x, y + 0.03, z], [x, y + 0.3, z + 0.02], 0.012, PALETTE.chrome);
  p.bar([x, y + 0.3, z + 0.02], [x, y + 0.31, z + 0.14], 0.012, PALETTE.chrome);
  p.bar([x, y + 0.31, z + 0.14], [x, y + 0.24, z + 0.19], 0.012, PALETTE.chrome);
  p.box(0.012, 0.012, 0.08, PALETTE.chrome, [x + 0.04, y + 0.06, z], { x: 0.4 });
}

/** Meuble évier sur deux cases : bac et robinet à gauche, tiroirs à droite sous les appareils. */
export function sinkUnit(): THREE.Group {
  const p = new Pieces([PALETTE.cabinet]);
  const width = COUNTER.wide;
  counterBody(p, width);
  const { y0, height } = FRONTS;
  // Sous l'évier : deux portes et un faux tiroir ; à droite, une colonne de tiroirs.
  const left = -width / 4;
  doorPair(p, left, width / 2, y0, height - 0.13);
  front(p, left, y0 + height - 0.12, width / 2 - 0.01, 0.12);
  p.box(0.02, height, COUNTER.depth - 0.05, PALETTE.cabinet, [0, y0, -0.02]);
  drawerStack(p, width / 4, width / 2 - 0.01);
  sinkBasin(p, -0.5, 0.58, 0.4);
  faucet(p, -0.5, -0.24);
  // Liquide vaisselle et éponge entre le bac et le premier emplacement.
  p.post(0.025, 0.03, 0.12, PALETTE.green, [-0.12, COUNTER.top, -0.2], 8);
  p.post(0.01, 0.012, 0.03, PALETTE.white, [-0.12, COUNTER.top + 0.12, -0.2], 6);
  p.box(0.08, 0.025, 0.05, PALETTE.yellow, [-0.13, COUNTER.top, -0.08]);
  p.box(0.08, 0.008, 0.05, PALETTE.green, [-0.13, COUNTER.top + 0.025, -0.08]);
  return p.build('sinkUnit');
}

/**
 * Colonne à niche : deux portes en bas, une niche ouverte à hauteur des yeux (éclairée, faite
 * pour encastrer un appareil) et une grande porte en haut. Hauteur 2,1.
 */
export function tallCabinet(): THREE.Group {
  const p = new Pieces([PALETTE.cabinet]);
  const { width, depth, plinth } = COUNTER;
  const height = 2.1;
  const nicheTop = NICHE_FLOOR + 0.5;
  p.box(width - 0.06, plinth, depth - 0.1, PLINTH, [0, 0, -0.04]);
  for (const side of [-1, 1])
    p.box(0.03, height - plinth, depth, PALETTE.cabinet, [side * (width / 2 - 0.015), plinth, 0]);
  p.box(width, height - plinth, 0.02, PALETTE.cabinet, [0, plinth, -depth / 2 + 0.01]);
  p.box(width, 0.03, depth, PALETTE.cabinet, [0, height - 0.03, 0]);
  // Fond de niche en pierre (comme les plans de travail), plafond avec une réglette allumée.
  p.box(width - 0.06, 0.04, depth - 0.02, STONE, [0, NICHE_FLOOR - 0.04, 0.0]);
  p.box(width - 0.06, 0.03, depth - 0.02, PALETTE.cabinet, [0, nicheTop, 0]);
  p.light(width - 0.16, 0.01, 0.02, 0xfff1cf, [0, nicheTop - 0.01, 0.2]);
  p.box(width - 0.06, nicheTop - NICHE_FLOOR, 0.01, 0xd4d9d1, [0, NICHE_FLOOR, -depth / 2 + 0.025]);
  // Portes du bas et porte du haut.
  const lower = NICHE_FLOOR - 0.04 - (plinth + 0.02) - 0.01;
  doorPair(p, 0, width, plinth + 0.02, lower);
  const upperY = nicheTop + 0.04;
  front(p, 0, upperY, width - 0.01, height - 0.04 - upperY);
  handle(p, 0.36, upperY + 0.04, 0.2, true);
  return p.build('tallCabinet');
}

/** Tasse et soucoupe vues à travers une vitrine. */
function displayCup(p: Pieces, color: number, x: number, y: number, z: number): void {
  p.post(0.03, 0.03, 0.005, color, [x, y, z], 8);
  p.post(0.024, 0.018, 0.04, color, [x, y + 0.005, z], 8);
}

/**
 * Buffet vaisselier : meuble bas (tiroir et deux portes), crédence carrelée, vitrine haute à
 * deux portes vitrées avec tasses, assiettes et bocaux.
 */
export function hutchCabinet(): THREE.Group {
  const p = new Pieces([PALETTE.cabinet]);
  const random = seeded(0x4a7c4);
  const { width, depth, top } = COUNTER;
  counterBody(p);
  const { y0, height } = FRONTS;
  doorPair(p, 0, width, y0, height - 0.17);
  front(p, 0, y0 + height - 0.16, width - 0.01, 0.16);
  handle(p, 0, y0 + height - 0.07, 0.3, false);
  // Crédence en carreaux de métro, joints dessinés.
  const backZ = -depth / 2 + 0.02;
  const splash = 0.55;
  p.box(width, splash, 0.015, TILE, [0, top, backZ]);
  for (let row = 1; row < 7; row += 1)
    p.box(width, 0.004, 0.004, 0xb9c4c8, [0, top + (row * splash) / 7, backZ + 0.009]);
  // Vitrine haute, moins profonde que le meuble bas.
  const vy = top + splash;
  const vh = 0.62;
  const vd = 0.32;
  const vz = -depth / 2 + vd / 2;
  for (const side of [-1, 1])
    p.box(0.03, vh, vd, PALETTE.cabinet, [side * (width / 2 - 0.015), vy, vz]);
  p.box(width, 0.03, vd, PALETTE.cabinet, [0, vy, vz]);
  p.box(width + 0.03, 0.04, vd + 0.03, PALETTE.cabinet, [0, vy + vh - 0.04, vz + 0.01]);
  p.box(width, vh, 0.015, 0xd4d9d1, [0, vy, -depth / 2 + 0.01]);
  const shelf = vy + 0.3;
  p.box(width - 0.06, 0.015, vd - 0.04, PALETTE.white, [0, shelf, vz]);
  // Assiettes debout en bas, tasses dépareillées en haut, deux bocaux.
  for (let i = 0; i < 6; i += 1)
    p.post(0.1, 0.1, 0.012, PALETTE.white, [-0.3 + i * 0.024, vy + 0.13, vz - 0.02], 12);
  p.post(0.05, 0.05, 0.16, glass, [0.15, vy + 0.03, vz], 10);
  p.post(0.045, 0.045, 0.1, PALETTE.coffee, [0.15, vy + 0.035, vz], 10);
  p.post(0.04, 0.04, 0.12, glass, [0.3, vy + 0.03, vz], 10);
  p.post(0.035, 0.035, 0.07, PALETTE.sand, [0.3, vy + 0.035, vz], 10);
  const cups = [PALETTE.white, PALETTE.blue, PALETTE.yellow, PALETTE.red, PALETTE.mint];
  for (let i = 0; i < 5; i += 1)
    displayCup(
      p,
      cups[Math.floor(random() * cups.length)] ?? PALETTE.white,
      -0.3 + i * 0.15,
      shelf + 0.015,
      vz,
    );
  // Deux portes vitrées : cadre, verre, petits boutons.
  const fz = vz + vd / 2 + 0.01;
  for (const side of [-1, 1]) {
    const cx = (side * width) / 4;
    p.box(width / 2 - 0.02, vh - 0.08, 0.01, glass, [cx, vy + 0.035, fz]);
    for (const dx of [-1, 1])
      p.box(0.03, vh - 0.07, 0.02, PALETTE.cabinet, [cx + dx * (width / 4 - 0.025), vy + 0.03, fz]);
    for (const y of [vy + 0.03, vy + vh - 0.07])
      p.box(width / 2 - 0.02, 0.03, 0.02, PALETTE.cabinet, [cx, y, fz]);
    p.post(0.012, 0.012, 0.02, STEEL, [side * 0.05, vy + 0.25, fz + 0.015], 6);
  }
  return p.build('hutchCabinet');
}

/**
 * Îlot central sur deux cases : caisson laqué, plan en chêne massif qui déborde, tiroirs côté
 * cuisine et étagères ouvertes de l'autre côté (livres de cuisine, saladiers, paniers).
 */
export function kitchenIsland(): THREE.Group {
  const p = new Pieces([PALETTE.cabinet]);
  const { width, depth, top } = ISLAND;
  const board = 0.06;
  const bodyD = depth - 0.16;
  const h = top - board - COUNTER.plinth;
  p.box(width - 0.12, COUNTER.plinth, bodyD - 0.08, PLINTH, [0, 0, 0]);
  for (const side of [-1, 1])
    p.box(0.03, h, bodyD, PALETTE.cabinet, [side * (width / 2 - 0.09), COUNTER.plinth, 0]);
  p.box(width - 0.18, 0.02, bodyD, PALETTE.cabinet, [0, COUNTER.plinth, 0]);
  p.box(width - 0.18, h, 0.02, PALETTE.cabinet, [0, COUNTER.plinth, 0]);
  // Plan en chêne : lames collées, de teintes un peu différentes.
  const random = seeded(0x15a1d);
  const strips = 9;
  for (let i = 0; i < strips; i += 1) {
    const shade = random() < 0.5 ? PALETTE.wood : 0xbf8a52;
    p.box(width / strips - 0.002, board, depth, shade, [
      -width / 2 + (width / strips) * (i + 0.5),
      top - board,
      0,
    ]);
  }
  // Côté cuisine (+z) : quatre tiroirs.
  const fz = bodyD / 2 + 0.01;
  const inner = width - 0.2;
  for (const col of [-1, 1])
    for (const row of [0, 1]) {
      const fh = (h - 0.04) / 2;
      const y = COUNTER.plinth + 0.02 + row * fh;
      const x = (col * inner) / 4;
      p.box(inner / 2 - 0.01, fh - 0.01, 0.018, PALETTE.cabinet, [x, y, fz]);
      p.box(0.24, 0.014, 0.014, STEEL, [x, y + fh - 0.08, fz + 0.025]);
    }
  // Côté salle (-z) : étagère ouverte au milieu de la hauteur.
  const sz = -bodyD / 4;
  const shelf = COUNTER.plinth + h / 2;
  p.box(width - 0.2, 0.02, bodyD / 2 - 0.02, PALETTE.cabinet, [0, shelf, sz]);
  const books = [PALETTE.red, PALETTE.blue, PALETTE.yellow, PALETTE.green, PALETTE.purple];
  for (let i = 0; i < 7; i += 1)
    p.book(0.035, 0.2 + random() * 0.06, 0.16, books[i % books.length] ?? PALETTE.red, [
      -0.7 + i * 0.04,
      shelf + 0.02,
      sz - 0.04,
    ]);
  p.post(0.12, 0.07, 0.08, PALETTE.white, [0.05, shelf + 0.02, sz - 0.04], 12);
  p.post(0.1, 0.06, 0.07, PALETTE.white, [0.05, shelf + 0.1, sz - 0.04], 12);
  for (const x of [0.4, 0.66])
    p.box(0.22, 0.14, 0.18, PALETTE.wicker, [x, COUNTER.plinth + 0.02, sz - 0.04]);
  return p.build('kitchenIsland');
}

/** Mug avec son anse, posé sur `y`. */
function mug(p: Pieces, color: number, x: number, y: number, z: number, turn = 0): void {
  p.post(0.034, 0.03, 0.07, color, [x, y, z], 8);
  p.post(0.028, 0.028, 0.004, PALETTE.coffee, [x, y + 0.062, z], 8);
  p.box(0.012, 0.04, 0.012, color, [
    x + Math.cos(turn) * 0.04,
    y + 0.015,
    z - Math.sin(turn) * 0.04,
  ]);
}

/** Tasse à expresso sur sa soucoupe. */
function cup(p: Pieces, x: number, y: number, z: number): void {
  p.post(0.032, 0.032, 0.006, PALETTE.white, [x, y, z], 8);
  p.post(0.022, 0.018, 0.035, PALETTE.white, [x, y + 0.006, z], 8);
}

/**
 * Cafetière à filtre : réservoir, tête, plaque chauffante, verseuse en verre et un mug à côté.
 * Coque repeignable (`dark`).
 */
export function dripCoffeeMaker(): THREE.Group {
  const p = new Pieces([PALETTE.dark]);
  const shell = PALETTE.dark;
  p.box(0.3, 0.03, 0.3, shell, [0, 0, 0]);
  p.box(0.3, 0.42, 0.11, shell, [0, 0, -0.095]);
  p.soft(0.3, 0.1, 0.27, 0.02, shell, [0, 0.36, -0.015]);
  // Niveau d'eau sur le côté du réservoir.
  p.box(0.004, 0.22, 0.05, 0x7fb6d9, [-0.151, 0.1, -0.095]);
  // Plaque chauffante, verseuse à moitié pleine, couvercle et poignée.
  p.post(0.085, 0.085, 0.012, COAL, [0, 0.03, 0.04], 10);
  p.post(0.07, 0.085, 0.075, PALETTE.coffee, [0, 0.045, 0.04], 10);
  p.post(0.08, 0.092, 0.17, glass, [0, 0.042, 0.04], 10);
  p.post(0.055, 0.08, 0.025, BLACK, [0, 0.212, 0.04], 10);
  p.box(0.02, 0.13, 0.025, BLACK, [0.105, 0.07, 0.04]);
  p.box(0.03, 0.02, 0.025, BLACK, [0.09, 0.18, 0.04]);
  // Bouton et voyant allumé sur la tête.
  p.box(0.04, 0.02, 0.01, COAL, [-0.08, 0.39, 0.122]);
  p.light(0.02, 0.02, 0.006, PALETTE.red, [0.1, 0.39, 0.122]);
  mug(p, PALETTE.white, -0.17, 0, 0.14);
  return p.build('dripCoffeeMaker');
}

/**
 * Machine à expresso compacte à broyeur intégré : caisson chromé à flancs repeignables (`red`),
 * trémie de grains, un groupe et son porte-filtre, buse vapeur, tasses qui chauffent dessus.
 */
export function espressoMachine(): THREE.Group {
  const p = new Pieces([PALETTE.red]);
  for (const dx of [-0.17, 0.17])
    for (const dz of [-0.13, 0.1]) p.post(0.016, 0.016, 0.025, COAL, [dx, 0, dz], 6);
  p.box(0.4, 0.29, 0.3, PALETTE.chrome, [0, 0.025, -0.03]);
  for (const side of [-1, 1]) p.box(0.01, 0.25, 0.27, PALETTE.red, [side * 0.205, 0.045, -0.03]);
  // Grille d'égouttage.
  p.box(0.36, 0.025, 0.1, PALETTE.metal, [0, 0.025, 0.16]);
  for (let i = 0; i < 4; i += 1) p.box(0.32, 0.004, 0.008, COAL, [0, 0.05, 0.125 + i * 0.022]);
  p.box(0.42, 0.02, 0.32, PALETTE.metal, [0, 0.315, -0.03]);
  // Manomètre, interrupteur lumineux.
  p.post(0.035, 0.035, 0.012, PALETTE.white, [0.11, 0.22, 0.125], 12);
  p.box(0.004, 0.025, 0.004, PALETTE.red, [0.115, 0.22, 0.135], { z: -0.6 });
  p.light(0.025, 0.015, 0.006, PALETTE.orange, [0.15, 0.27, 0.122]);
  // Groupe, porte-filtre à manche noir et tasse dessous.
  p.post(0.04, 0.045, 0.05, PALETTE.metal, [-0.04, 0.14, 0.14], 10);
  p.post(0.035, 0.03, 0.028, STEEL, [-0.04, 0.115, 0.15], 10);
  p.box(0.022, 0.022, 0.11, COAL, [-0.04, 0.12, 0.23], { x: -0.15 });
  cup(p, -0.04, 0.05, 0.15);
  // Buse vapeur.
  p.bar([0.17, 0.2, 0.12], [0.19, 0.07, 0.16], 0.007, PALETTE.metal);
  // Broyeur intégré : trémie en verre pleine de grains, couvercle noir.
  p.post(0.05, 0.035, 0.05, PALETTE.coffee, [-0.11, 0.335, -0.08], 10);
  p.post(0.06, 0.035, 0.12, glass, [-0.11, 0.335, -0.08], 10);
  p.post(0.062, 0.062, 0.018, BLACK, [-0.11, 0.455, -0.08], 10);
  // Deux tasses qui chauffent sur le dessus.
  cup(p, 0.06, 0.335, -0.06);
  cup(p, 0.13, 0.335, -0.1);
  return p.build('espressoMachine');
}

/**
 * Four à micro-ondes compact : coque repeignable (`white`), hublot sombre, poignée, pavé de
 * touches et horloge allumée.
 */
export function microwaveOven(): THREE.Group {
  const p = new Pieces([PALETTE.white]);
  for (const dx of [-0.19, 0.19])
    for (const dz of [-0.12, 0.12]) p.post(0.012, 0.012, 0.012, COAL, [dx, 0, dz], 6);
  p.soft(0.44, 0.25, 0.32, 0.012, PALETTE.white, [0, 0.012, 0]);
  // Porte : cadre noir, hublot teinté avec un reflet, poignée.
  p.box(0.3, 0.21, 0.01, COAL, [-0.06, 0.03, 0.161]);
  p.box(0.24, 0.15, 0.004, 0x3a4560, [-0.065, 0.06, 0.167]);
  p.box(0.06, 0.15, 0.002, 0x6c7a99, [-0.13, 0.06, 0.17], { z: 0.25 });
  p.box(0.016, 0.17, 0.024, STEEL, [0.075, 0.05, 0.176]);
  // Panneau de commande : horloge, pavé de touches, bouton rond.
  p.box(0.11, 0.21, 0.006, 0x2a2f3c, [0.155, 0.03, 0.161]);
  p.light(0.08, 0.03, 0.004, 0x7cf0b4, [0.155, 0.19, 0.165]);
  for (let row = 0; row < 3; row += 1)
    for (let col = 0; col < 3; col += 1)
      p.box(0.02, 0.016, 0.005, PALETTE.slate, [0.13 + col * 0.026, 0.12 - row * 0.024, 0.166]);
  p.post(0.018, 0.018, 0.01, STEEL, [0.155, 0.05, 0.166], 10);
  return p.build('microwaveOven');
}

/** Bouilloire électrique : socle, corps conique repeignable (`mint`), bec, anse, voyant bleu. */
export function electricKettle(): THREE.Group {
  const p = new Pieces([PALETTE.mint]);
  p.post(0.085, 0.09, 0.02, BLACK, [0, 0, 0], 14);
  p.post(0.065, 0.085, 0.18, PALETTE.mint, [0, 0.02, 0], 14);
  p.post(0.05, 0.065, 0.025, PALETTE.mint, [0, 0.2, 0], 14);
  p.post(0.03, 0.03, 0.015, BLACK, [0, 0.225, 0], 10);
  // Bec verseur vers l'avant, anse noire à l'arrière.
  p.box(0.04, 0.035, 0.07, PALETTE.mint, [0, 0.17, 0.09], { x: -0.5 });
  p.box(0.025, 0.16, 0.025, BLACK, [0, 0.05, -0.11]);
  for (const y of [0.05, 0.19]) p.box(0.025, 0.025, 0.05, BLACK, [0, y, -0.085]);
  // Fenêtre de niveau d'eau et voyant allumé.
  p.box(0.025, 0.1, 0.004, 0x7fb6d9, [0.05, 0.05, 0.072], { y: 0.6 });
  p.light(0.02, 0.012, 0.006, 0x5ab4ff, [0, 0.03, 0.086]);
  return p.build('electricKettle');
}

/** Cuiseur à riz : cuve arrondie repeignable (`ceramic`), couvercle bombé, écran et spatule. */
export function riceCooker(): THREE.Group {
  const p = new Pieces([PALETTE.ceramic]);
  p.soft(0.3, 0.17, 0.26, 0.05, PALETTE.ceramic, [0, 0, 0]);
  p.soft(0.28, 0.06, 0.24, 0.05, PALETTE.ceramic, [0, 0.165, -0.005]);
  p.post(0.04, 0.05, 0.03, PALETTE.slate, [0, 0.22, -0.01], 10);
  p.box(0.18, 0.02, 0.03, PALETTE.slate, [0, 0.13, -0.12]);
  // Panneau avant : écran allumé, deux boutons.
  p.box(0.15, 0.08, 0.01, 0x2a2f3c, [0, 0.05, 0.13]);
  p.light(0.06, 0.025, 0.004, 0xffb35a, [-0.025, 0.08, 0.136]);
  for (const x of [0.035, 0.06]) p.post(0.01, 0.01, 0.006, PALETTE.white, [x, 0.07, 0.138], 8);
  // Spatule dans son support, sur le côté.
  p.box(0.03, 0.08, 0.03, PALETTE.white, [0.17, 0.06, 0.02]);
  p.box(0.012, 0.13, 0.03, PALETTE.white, [0.17, 0.1, 0.02], { z: 0.15 });
  return p.build('riceCooker');
}

/** Frigo à boissons vitré : socle à grille, bandeau lumineux, canettes et bouteilles. */
export function drinksFridge(): THREE.Group {
  const p = new Pieces([PALETTE.red]);
  const random = seeded(0xf1d6e);
  const top = 1.82;
  // Pieds, caisson rouge (dos, côtés, chapeau) et doublure blanche.
  for (const x of [-0.36, 0.36])
    for (const z of [-0.33, 0.27]) p.post(0.025, 0.025, 0.04, COAL, [x, 0, z], 6);
  p.box(0.84, top - 0.04, 0.04, PALETTE.red, [0, 0.04, -0.37]);
  for (const side of [-1, 1])
    p.box(0.05, top - 0.04, 0.7, PALETTE.red, [side * 0.395, 0.04, -0.04]);
  p.box(0.84, 0.3, 0.7, PALETTE.red, [0, top - 0.3, -0.04]);
  p.box(0.74, 1.3, 0.01, 0xf4f6f8, [0, 0.18, -0.345]);
  // Socle : grille de ventilation noire.
  p.box(0.74, 0.14, 0.68, PLINTH, [0, 0.04, -0.04]);
  for (let i = 0; i < 5; i += 1) p.box(0.66, 0.012, 0.01, 0x565c6c, [0, 0.06 + i * 0.022, 0.3]);
  // Bandeau lumineux en façade, avec le logo de la marque de soda.
  p.light(0.7, 0.16, 0.01, 0xfff3d6, [0, top - 0.24, 0.312]);
  p.light(0.34, 0.05, 0.012, 0xd94a3d, [0, top - 0.185, 0.316]);
  // Réglettes LED verticales à l'intérieur.
  for (const side of [-1, 1]) p.light(0.015, 1.28, 0.015, 0xe8f6ff, [side * 0.355, 0.19, 0.22]);
  // Grandes bouteilles en bas, puis trois rangées de canettes sur des clayettes chromées.
  const cans = [
    PALETTE.red,
    PALETTE.green,
    PALETTE.yellow,
    PALETTE.blue,
    PALETTE.white,
    PALETTE.orange,
  ];
  const pick = () => cans[Math.floor(random() * cans.length)] ?? PALETTE.red;
  for (let row = 0; row < 4; row += 1) {
    const y = 0.18 + row * 0.33;
    p.box(0.72, 0.015, 0.6, PALETTE.chrome, [0, y, -0.04]);
    p.box(0.72, 0.03, 0.01, PALETTE.white, [0, y, 0.255]);
    for (const z of [-0.2, 0.12]) {
      if (row === 0) {
        for (let i = 0; i < 4; i += 1) {
          const x = -0.24 + i * 0.16;
          const color = pick();
          p.post(0.05, 0.05, 0.17, color, [x, y + 0.015, z], 8);
          p.post(0.022, 0.05, 0.07, color, [x, y + 0.185, z], 8);
          p.post(0.016, 0.016, 0.02, PALETTE.white, [x, y + 0.255, z], 6);
        }
        continue;
      }
      for (let i = 0; i < 6; i += 1) {
        const x = -0.28 + i * 0.112;
        p.post(0.042, 0.042, 0.13, pick(), [x, y + 0.015, z], 8);
        p.post(0.034, 0.042, 0.012, PALETTE.chrome, [x, y + 0.145, z], 8);
      }
    }
  }
  // Porte vitrée : cadre rouge, verre, poignée chromée sur toute la hauteur, charnières.
  for (const side of [-1, 1]) p.box(0.05, 1.42, 0.04, PALETTE.red, [side * 0.375, 0.14, 0.32]);
  for (const y of [0.14, top - 0.35]) p.box(0.8, 0.05, 0.04, PALETTE.red, [0, y, 0.32]);
  p.box(0.7, 1.32, 0.012, glass, [0, 0.19, 0.325]);
  p.box(0.025, 0.9, 0.025, PALETTE.chrome, [0.32, 0.42, 0.37]);
  for (const y of [0.45, 1.29]) p.box(0.02, 0.02, 0.03, PALETTE.chrome, [0.32, y, 0.35]);
  for (const y of [0.18, top - 0.38]) p.box(0.03, 0.06, 0.03, PALETTE.chrome, [-0.4, y, 0.33]);
  return p.build('drinksFridge');
}

/** Plateau de la tablée (hauteur des tables Kenney) et assise des bancs. */
const TABLE = { width: 2.72, depth: 1.1, top: 0.69, board: 0.05 } as const;
const BENCH = { width: 2.52, depth: 0.4, seat: 0.44, z: 0.8 } as const;

/** Banc de cantine : piètement noir, assise en bois et long coussin repeignable. */
function bench(p: Pieces, z: number): void {
  const { width, depth, seat } = BENCH;
  for (const x of [-width / 2 + 0.16, width / 2 - 0.16]) {
    for (const dz of [-depth / 2 + 0.05, depth / 2 - 0.05])
      p.box(0.035, seat - 0.11, 0.035, BLACK, [x, 0, z + dz]);
    p.box(0.035, 0.03, depth - 0.06, BLACK, [x, seat - 0.14, z]);
  }
  p.box(width - 0.36, 0.03, 0.03, BLACK, [0, 0.14, z]);
  p.soft(width, 0.05, depth, 0.01, PALETTE.wood, [0, seat - 0.11, z]);
  p.soft(width - 0.08, 0.06, depth - 0.06, 0.025, PALETTE.cushion, [0, seat - 0.06, z]);
  // Boutons de capiton tous les 30 cm.
  for (let x = -1.05; x <= 1.06; x += 0.3)
    p.post(0.012, 0.012, 0.004, 0xb85d3c, [x, seat - 0.002, z], 6);
}

/** Grande tablée de cantine : plateau en planches, piètement acier, deux bancs, couverts. */
export function canteenTable(): THREE.Group {
  const p = new Pieces([PALETTE.cushion]);
  const random = seeded(0xca7ee);
  const { width, depth, top, board } = TABLE;
  const under = top - board;
  // Plateau en cinq planches légèrement différentes.
  const planks = 5;
  const plankD = depth / planks;
  for (let i = 0; i < planks; i += 1) {
    const shade = random() < 0.5 ? PALETTE.wood : 0xbf8a52;
    p.box(width, board, plankD - 0.006, shade, [0, under, -depth / 2 + plankD * (i + 0.5)]);
  }
  p.box(width - 0.2, 0.06, 0.04, PALETTE.woodDark, [0, under - 0.06, -depth / 2 + 0.12]);
  p.box(width - 0.2, 0.06, 0.04, PALETTE.woodDark, [0, under - 0.06, depth / 2 - 0.12]);
  // Piètement en acier : deux cadres en trapèze reliés par une traverse.
  for (const x of [-width / 2 + 0.25, width / 2 - 0.25]) {
    for (const side of [-1, 1])
      p.bar([x, 0.02, side * 0.46], [x, under, side * 0.36], 0.022, BLACK);
    p.box(0.05, 0.03, 0.98, BLACK, [x, 0, 0]);
    p.box(0.05, 0.04, 0.8, BLACK, [x, under - 0.04, 0]);
  }
  p.box(width - 0.5, 0.04, 0.04, BLACK, [0, 0.3, 0]);
  bench(p, -BENCH.z);
  bench(p, BENCH.z);
  // Au milieu de la table, entre les places des accessoires : carafe, verres, sel et poivre,
  // porte-serviettes.
  p.post(0.05, 0.06, 0.2, glass, [0, top, -0.02], 10);
  p.post(0.048, 0.058, 0.12, 0xd8eef8, [0, top + 0.005, -0.02], 10);
  for (const x of [-0.12, 0.12]) p.post(0.028, 0.024, 0.08, glass, [x, top, -0.06], 8);
  p.post(0.016, 0.016, 0.06, PALETTE.white, [-0.55, top, 0.02], 8);
  p.post(0.016, 0.016, 0.06, COAL, [-0.5, top, 0.02], 8);
  p.box(0.12, 0.012, 0.06, PALETTE.woodDark, [0.55, top, 0.0]);
  p.box(0.1, 0.07, 0.008, PALETTE.white, [0.55, top + 0.012, 0.0], { x: 0.15 });
  p.box(0.1, 0.07, 0.008, PALETTE.white, [0.55, top + 0.012, 0.012], { x: -0.15 });
  return p.build('canteenTable');
}
