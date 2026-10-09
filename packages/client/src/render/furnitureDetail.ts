/**
 * Canapé et bibliothèque détaillés, construits en formes Three.js.
 *
 * Les modèles Kenney du canapé et de la bibliothèque sont d'un seul bloc : ici, chaque coussin,
 * chaque pied et chaque livre est une pièce à part, pour un rendu plus proche d'un vrai meuble
 * tout en gardant le style low-poly du jeu (facettes visibles, couleurs franches).
 *
 * Toutes les pièces d'une même matière sont fusionnées en un seul maillage à la fin : le meuble
 * reste dessiné en quelques appels (InstancedMesh par matériau), même avec une centaine de livres.
 * Les tirages (largeur, couleur des livres…) viennent d'un petit générateur à graine fixe, propre
 * à ce fichier : le meuble est identique à chaque partie et le RNG du jeu n'est jamais touché.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { material, PALETTE } from './primitives';

/** Couverture des livres : tons sourds de vraie bibliothèque (non repeints). */
const BOOK_COLORS = [
  0x8e2f2f, 0x2f4a7a, 0x3d6b4a, 0xd1a23d, 0xe8dcc2, 0x2a7f7a, 0x6b4430, 0x5b5f6b, 0x242830,
  0xb5543a, 0x7a4f8c, 0xc9c2b0,
] as const;
/** Bandeaux de titre sur le dos des livres. */
const SPINE_COLORS = [0xe8c66a, 0xf2efe8, 0x242830] as const;

/** Générateur pseudo-aléatoire à graine fixe (mulberry32) : même meuble à chaque partie. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Matériau des livres : une couleur par sommet, pour tous les dessiner d'un seul tenant. */
const bookMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.85,
  metalness: 0.02,
  flatShading: true,
});
bookMaterial.name = 'books';

/** Pièces d'un meuble, regroupées par matériau puis fusionnées. */
export class Pieces {
  private readonly byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();

  /** Ajoute une géométrie déjà placée (position, rotation) dans le repère du meuble. */
  add(geometry: THREE.BufferGeometry, mat: THREE.Material): void {
    const plain = geometry.index ? geometry.toNonIndexed() : geometry;
    if (plain !== geometry) geometry.dispose();
    const list = this.byMaterial.get(mat) ?? [];
    list.push(plain);
    this.byMaterial.set(mat, list);
  }

  /** Boîte posée sur `y` (sa base), centrée en (x, z), tournée de `turn` autour de y puis z. */
  box(
    w: number,
    h: number,
    d: number,
    color: number | THREE.Material,
    at: readonly [number, number, number],
    tilt: { readonly x?: number; readonly y?: number; readonly z?: number } = {},
  ): void {
    this.place(new THREE.BoxGeometry(w, h, d), color, h, at, tilt);
  }

  /** Boîte aux arêtes arrondies (coussins, accoudoirs) : facettes douces, toujours low-poly. */
  soft(
    w: number,
    h: number,
    d: number,
    radius: number,
    color: number,
    at: readonly [number, number, number],
    tilt: { readonly x?: number; readonly y?: number; readonly z?: number } = {},
  ): void {
    this.place(new RoundedBoxGeometry(w, h, d, 2, radius), color, h, at, tilt);
  }

  /** Cylindre (ou tronc de cône) vertical posé sur `y`. */
  post(
    top: number,
    bottom: number,
    h: number,
    color: number,
    at: readonly [number, number, number],
    segments = 8,
  ): void {
    this.place(new THREE.CylinderGeometry(top, bottom, h, segments), color, h, at);
  }

  /** Livre (ou objet multicolore) : boîte teintée par sommet, dessinée avec tous les livres. */
  book(
    w: number,
    h: number,
    d: number,
    color: number,
    at: readonly [number, number, number],
    tilt: { readonly y?: number; readonly z?: number; readonly x?: number } = {},
  ): void {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const tint = new THREE.Color(color);
    const count = geometry.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) tint.toArray(colors, i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.place(geometry, bookMaterial, h, at, tilt);
  }

  /** Un maillage par matériau. */
  build(name: string): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    for (const [mat, geometries] of this.byMaterial) {
      const merged = mergeGeometries(geometries) ?? new THREE.BufferGeometry();
      for (const geometry of geometries) geometry.dispose();
      merged.computeBoundingSphere();
      group.add(new THREE.Mesh(merged, mat));
    }
    return group;
  }

  private place(
    geometry: THREE.BufferGeometry,
    color: number | THREE.Material,
    h: number,
    [x, y, z]: readonly [number, number, number],
    tilt: { readonly x?: number; readonly y?: number; readonly z?: number } = {},
  ): void {
    // La base de la pièce est à `y` : on la remonte de la moitié de sa hauteur avant de tourner,
    // pour qu'un livre penché pivote sur son coin et non sur son centre.
    geometry.translate(0, h / 2, 0);
    if (tilt.x) geometry.rotateX(tilt.x);
    if (tilt.z) geometry.rotateZ(tilt.z);
    if (tilt.y) geometry.rotateY(tilt.y);
    geometry.translate(x, y, z);
    this.add(geometry, typeof color === 'number' ? material(color) : color);
  }
}

// ---------------------------------------------------------------------------------------------
// Canapé : 2 x 1 cases, tourné vers +z, assise à 0,44 (un chat s'y couche à 0,42).
// ---------------------------------------------------------------------------------------------

/** Hauteur du dessus des coussins d'assise. */
const SOFA_SEAT_TOP = 0.44;

export function detailedSofa(): THREE.Group {
  const p = new Pieces();
  // Tissu : `fabric` (coussins) et `fabricDark` (structure), repeints au choix du joueur.
  const { fabric, fabricDark } = PALETTE;
  // Pieds fuselés en bois foncé, légèrement en retrait des angles.
  for (const x of [-0.84, 0.84])
    for (const z of [-0.3, 0.3]) p.post(0.032, 0.022, 0.1, PALETTE.woodDark, [x, 0, z], 6);
  // Socle sous les coussins et dossier, en tissu plus foncé.
  p.soft(1.84, 0.22, 0.82, 0.04, fabricDark, [0, 0.1, 0]);
  p.soft(1.84, 0.5, 0.2, 0.06, fabricDark, [0, 0.28, -0.31]);
  // Accoudoirs : un bloc et un rouleau sur le dessus.
  for (const side of [-1, 1]) {
    p.soft(0.17, 0.4, 0.82, 0.05, fabricDark, [side * 0.835, 0.1, 0]);
    p.soft(0.21, 0.1, 0.84, 0.05, fabricDark, [side * 0.835, 0.48, 0.005]);
  }
  // Deux coussins d'assise et deux coussins de dossier, séparés par une fine couture.
  for (const x of [-0.37, 0.37]) {
    p.soft(0.72, 0.13, 0.62, 0.05, fabric, [x, 0.31, 0.07]);
    p.soft(0.72, 0.4, 0.16, 0.06, fabric, [x, SOFA_SEAT_TOP - 0.02, -0.17], { x: -0.14 });
  }
  // Passepoil sous le bord avant des coussins.
  p.box(1.46, 0.015, 0.02, fabricDark, [0, 0.31, 0.385]);
  // Coussins décoratifs : moutarde et terre cuite, posés de biais contre le dossier.
  p.soft(0.36, 0.34, 0.12, 0.05, PALETTE.yellow, [-0.52, SOFA_SEAT_TOP - 0.02, -0.08], {
    x: -0.3,
    y: 0.3,
  });
  p.soft(0.34, 0.32, 0.12, 0.05, PALETTE.terracotta, [0.46, SOFA_SEAT_TOP - 0.02, -0.08], {
    x: -0.3,
    y: -0.3,
  });
  // Plaid à carreaux plié sur l'accoudoir droit : dessus, côté extérieur et un pan sur l'assise.
  const plaid = 0xe9dcc4;
  const stripe = 0xb5543a;
  p.box(0.25, 0.025, 0.42, plaid, [0.835, 0.53, 0.12]);
  p.box(0.025, 0.28, 0.42, plaid, [0.955, 0.26, 0.12]);
  p.box(0.12, 0.022, 0.42, plaid, [0.66, SOFA_SEAT_TOP, 0.12]);
  for (const z of [-0.02, 0.12, 0.26]) {
    p.box(0.255, 0.028, 0.03, stripe, [0.835, 0.53, z]);
    p.box(0.028, 0.285, 0.03, stripe, [0.955, 0.258, z]);
  }
  // Franges du plaid qui dépassent sous le pan extérieur.
  for (let i = 0; i < 6; i += 1) p.box(0.012, 0.04, 0.012, plaid, [0.958, 0.22, -0.06 + i * 0.07]);
  return p.build('sofa');
}

// ---------------------------------------------------------------------------------------------
// Bibliothèque : 2 x 1 cases, deux colonnes de quatre niveaux, dessus à 1,58 (accessoires).
// ---------------------------------------------------------------------------------------------

/** Hauteur du dessus de la bibliothèque, où se posent les accessoires. */
const BOOKCASE_TOP_Y = 1.58;
const CASE_WIDTH = 1.8;
const CASE_DEPTH = 0.42;
const BOARD = 0.04;
/** Bas de chaque tablette ; le niveau du dessous va de la tablette à la suivante. */
const SHELVES = [0.08, 0.44, 0.8, 1.16] as const;
const SHELF_TOP = (level: number) => (SHELVES[level] ?? 0) + BOARD;
const LEVEL_HEIGHT = (level: number) =>
  (SHELVES[level + 1] ?? BOOKCASE_TOP_Y - 0.05) - SHELF_TOP(level);
/** Les livres s'alignent sur le bord avant des tablettes, comme dans une vraie bibliothèque. */
const FRONT = CASE_DEPTH / 2 - 0.03;
/** Colonnes : bord gauche et bord droit de l'espace libre. */
const BAYS = [
  [-CASE_WIDTH / 2 + BOARD, -BOARD / 2],
  [BOARD / 2, CASE_WIDTH / 2 - BOARD],
] as const;

/** Une rangée de livres debout de `from` à `to` ; renvoie l'abscisse du dernier livre. */
function shelfOfBooks(p: Pieces, random: () => number, level: number, from: number, to: number) {
  const base = SHELF_TOP(level);
  const room = LEVEL_HEIGHT(level) - 0.03;
  let x = from;
  let lastHeight = 0;
  for (;;) {
    const w = 0.032 + random() * 0.03;
    if (x + w > to) break;
    const h = Math.min(room, 0.19 + random() * 0.11);
    const d = 0.2 + random() * 0.07;
    const color = BOOK_COLORS[Math.floor(random() * BOOK_COLORS.length)] ?? BOOK_COLORS[0];
    p.book(w, h, d, color, [x + w / 2, base, FRONT - d / 2]);
    // Bandeau de titre sur le dos, pour un livre sur deux environ.
    if (random() < 0.55) {
      const band = SPINE_COLORS[Math.floor(random() * SPINE_COLORS.length)] ?? SPINE_COLORS[0];
      p.book(w * 0.8, 0.018, 0.006, band, [x + w / 2, base + h * (0.62 + random() * 0.2), FRONT]);
    }
    x += w + (random() < 0.15 ? 0.006 : 0.001);
    lastHeight = h;
  }
  return { x, lastHeight };
}

/** Livre penché contre la rangée, appuyé sur le dernier livre (vers la droite si `dir` = 1). */
function leaningBook(p: Pieces, level: number, x: number, dir: 1 | -1, color: number): void {
  const h = Math.min(LEVEL_HEIGHT(level) - 0.06, 0.24);
  const angle = 0.32;
  // Pied écarté de la rangée, haut appuyé contre le dernier livre.
  const foot = x + dir * (0.025 + h * Math.sin(angle) * 0.8);
  p.book(0.04, h, 0.22, color, [foot, SHELF_TOP(level), FRONT - 0.11], { z: dir * angle });
}

/** Pile de livres couchés. */
function bookStack(p: Pieces, level: number, x: number, colors: readonly number[]): void {
  let y = SHELF_TOP(level);
  colors.forEach((color, index) => {
    const t = 0.035 + (index % 2) * 0.01;
    p.book(0.24 - index * 0.025, t, 0.18 - index * 0.012, color, [x, y, FRONT - 0.1], {
      y: (index % 2 === 0 ? 1 : -1) * 0.08,
    });
    y += t;
  });
}

/** Serre-livres en métal en équerre. */
function bookend(p: Pieces, level: number, x: number): void {
  p.box(0.012, 0.13, 0.1, PALETTE.dark, [x, SHELF_TOP(level), FRONT - 0.07]);
  p.box(0.08, 0.008, 0.1, PALETTE.dark, [x + 0.04, SHELF_TOP(level), FRONT - 0.07]);
}

/** Petite plante en pot : terre cuite et feuilles en éventail. */
function pottedPlant(p: Pieces, level: number, x: number): void {
  const base = SHELF_TOP(level);
  const z = FRONT - 0.1;
  p.post(0.07, 0.05, 0.12, PALETTE.terracotta, [x, base, z], 7);
  p.post(0.065, 0.065, 0.01, PALETTE.coffee, [x, base + 0.112, z], 7);
  // Feuilles retombantes, comme un pothos qui a survécu au télétravail.
  for (let i = 0; i < 7; i += 1) {
    const turn = (i / 7) * Math.PI * 2;
    const lean = 0.5 + (i % 2) * 0.35;
    p.box(0.045, 0.16, 0.014, i % 2 ? PALETTE.green : PALETTE.cactus, [x, base + 0.11, z], {
      z: lean * Math.cos(turn),
      x: lean * Math.sin(turn),
      y: turn,
    });
  }
}

/** Cadre photo incliné vers l'arrière. */
function pictureFrame(p: Pieces, level: number, x: number): void {
  const base = SHELF_TOP(level);
  p.box(0.17, 0.22, 0.02, PALETTE.dark, [x, base, FRONT - 0.12], { x: -0.12 });
  p.box(0.13, 0.17, 0.006, 0x9cc7e0, [x, base + 0.025, FRONT - 0.104], { x: -0.12 });
  p.box(0.13, 0.06, 0.007, PALETTE.green, [x, base + 0.025, FRONT - 0.1], { x: -0.12 });
}

/** Petite coupe dorée (un prix de hackathon, forcément). */
function trophyCup(p: Pieces, level: number, x: number): void {
  const base = SHELF_TOP(level);
  p.box(0.08, 0.03, 0.08, PALETTE.woodDark, [x, base, FRONT - 0.1]);
  p.post(0.012, 0.02, 0.06, PALETTE.gold, [x, base + 0.03, FRONT - 0.1], 6);
  p.post(0.05, 0.025, 0.07, PALETTE.gold, [x, base + 0.09, FRONT - 0.1], 8);
}

/** Paniers de rangement tressés. */
function basket(p: Pieces, level: number, x: number, w: number): void {
  const base = SHELF_TOP(level);
  const h = LEVEL_HEIGHT(level) - 0.07;
  p.box(w, h, 0.3, PALETTE.sisal, [x, base, FRONT - 0.15]);
  p.box(w + 0.01, 0.03, 0.31, 0xa88a5a, [x, base + h - 0.03, FRONT - 0.15]);
  p.box(0.08, 0.025, 0.01, 0xa88a5a, [x, base + h - 0.09, FRONT + 0.006]);
}

export function detailedBookcase(): THREE.Group {
  const p = new Pieces();
  const random = seeded(0xb00c);
  const half = CASE_WIDTH / 2;
  // Bâti : côtés, montant central, dessus mouluré, socle en retrait et fond plus foncé.
  for (const x of [-half + BOARD / 2, half - BOARD / 2])
    p.box(BOARD, BOOKCASE_TOP_Y - 0.05, CASE_DEPTH, PALETTE.wood, [x, 0, 0]);
  p.box(BOARD, BOOKCASE_TOP_Y - 0.05 - SHELVES[0], CASE_DEPTH - 0.01, PALETTE.wood, [
    0,
    SHELVES[0],
    0.005,
  ]);
  p.box(CASE_WIDTH + 0.06, 0.05, CASE_DEPTH + 0.04, PALETTE.wood, [0, BOOKCASE_TOP_Y - 0.05, 0.01]);
  p.box(CASE_WIDTH + 0.02, 0.015, CASE_DEPTH + 0.02, PALETTE.woodDark, [
    0,
    BOOKCASE_TOP_Y - 0.065,
    0.005,
  ]);
  p.box(CASE_WIDTH - 2 * BOARD, SHELVES[0], CASE_DEPTH - 0.05, PALETTE.woodDark, [0, 0, -0.01]);
  p.box(CASE_WIDTH - 2 * BOARD, BOOKCASE_TOP_Y - 0.1, 0.02, PALETTE.woodDark, [
    0,
    0.04,
    -CASE_DEPTH / 2 + 0.01,
  ]);
  for (const y of SHELVES)
    p.box(CASE_WIDTH - 2 * BOARD, BOARD, CASE_DEPTH - 0.02, PALETTE.wood, [0, y, 0]);

  // Niveau du bas : placard à deux portes à gauche, paniers à droite.
  const [left, right] = BAYS;
  const doorW = (left[1] - left[0]) / 2 - 0.006;
  const doorH = LEVEL_HEIGHT(0) - 0.01;
  for (const side of [0, 1]) {
    const x = left[0] + doorW / 2 + 0.004 + side * (doorW + 0.004);
    p.box(doorW, doorH, 0.02, PALETTE.wood, [x, SHELF_TOP(0) + 0.005, CASE_DEPTH / 2 - 0.01]);
    // Panneau en creux et bouton de porte.
    p.box(doorW - 0.08, doorH - 0.08, 0.006, PALETTE.woodDark, [
      x,
      SHELF_TOP(0) + 0.045,
      CASE_DEPTH / 2 + 0.002,
    ]);
    p.post(0.012, 0.012, 0.025, PALETTE.chrome, [
      x + (side === 0 ? doorW / 2 - 0.05 : -doorW / 2 + 0.05),
      SHELF_TOP(0) + doorH / 2,
      CASE_DEPTH / 2 + 0.012,
    ]);
  }
  const basketW = (right[1] - right[0]) / 2 - 0.04;
  basket(p, 0, right[0] + 0.02 + basketW / 2, basketW);
  basket(p, 0, right[1] - 0.02 - basketW / 2, basketW);

  // Niveau 1 : une rangée pleine à gauche ; à droite des livres et une pile couchée.
  shelfOfBooks(p, random, 1, left[0] + 0.01, left[1] - 0.01);
  const r1 = shelfOfBooks(p, random, 1, right[0] + 0.01, right[0] + 0.5);
  bookStack(p, 1, r1.x + 0.16, [0x2f4a7a, 0xe8dcc2, 0x8e2f2f]);

  // Niveau 2 : cadre photo et livre penché à gauche ; plante, serre-livre et rangée à droite.
  pictureFrame(p, 2, left[0] + 0.12);
  const l2 = shelfOfBooks(p, random, 2, left[0] + 0.25, left[0] + 0.62);
  leaningBook(p, 2, l2.x, 1, 0x3d6b4a);
  pottedPlant(p, 2, right[0] + 0.1);
  bookend(p, 2, right[0] + 0.2);
  shelfOfBooks(p, random, 2, right[0] + 0.215, right[1] - 0.01);

  // Niveau 3 : livres et trophée à gauche ; pile couchée et rangée courte à droite.
  const l3 = shelfOfBooks(p, random, 3, left[0] + 0.01, left[0] + 0.5);
  leaningBook(p, 3, l3.x, 1, 0xd1a23d);
  trophyCup(p, 3, left[1] - 0.1);
  bookStack(p, 3, right[0] + 0.16, [0x5b5f6b, 0xb5543a]);
  const r3 = shelfOfBooks(p, random, 3, right[0] + 0.32, right[1] - 0.16);
  leaningBook(p, 3, r3.x, 1, 0x2a7f7a);
  return p.build('bookcase');
}
