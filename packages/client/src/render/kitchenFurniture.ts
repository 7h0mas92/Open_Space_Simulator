/**
 * Cuisine détaillée, en formes Three.js : comptoir à café, comptoir du barista, comptoir du
 * micro-ondes, frigo à boissons et grande tablée de la cantine.
 *
 * Les meubles bas et la table Kenney d'avant étaient d'un seul bloc, avec la machine posée
 * dessus. Ici, le meuble et ce qu'il porte forment un seul objet : caisson, socle en retrait,
 * façades séparées par un jour, poignées, plan de travail en pierre, puis la machine et ses
 * petits accessoires (tasses, sucrier, pot à lait…). Les hauteurs sont celles des modèles Kenney
 * (plan de travail à 0,9, dessus du frigo à 1,82, plateau de la table à 0,69, assise à 0,44).
 * Chaque meuble est fusionné par matériau (voir `pieces.ts`) et regarde vers +z.
 */
import type * as THREE from 'three';
import { Pieces, seeded } from './pieces';
import { glass, PALETTE } from './primitives';

/** Plan de travail des meubles bas, à la hauteur des meubles de cuisine Kenney. */
const COUNTER = { width: 0.86, depth: 0.6, top: 0.9, plinth: 0.08, worktop: 0.04 } as const;
/** Avant des façades (le caisson s'arrête à 0,27, les façades dépassent un peu). */
const FRONT_Z = 0.285;

const STONE = 0x5d6272;
const PLINTH = 0x2f3443;
const STEEL = 0xc3c9d3;
const BLACK = 0x23283a;
const COAL = 0x1a1e2b;

/** Caisson d'un meuble bas : côtés, dos, fond, socle en retrait et plan de travail en pierre. */
function counterBody(p: Pieces): void {
  const { width, depth, top, plinth, worktop } = COUNTER;
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

/** Cafetière à filtre noire : réservoir, tête, plaque chauffante et verseuse en verre. */
function dripCoffeeMaker(p: Pieces, x: number, y: number, z: number): void {
  p.box(0.3, 0.03, 0.3, BLACK, [x, y, z]);
  p.box(0.3, 0.42, 0.11, BLACK, [x, y, z - 0.095]);
  p.soft(0.3, 0.1, 0.27, 0.02, BLACK, [x, y + 0.36, z - 0.015]);
  // Niveau d'eau sur le côté du réservoir.
  p.box(0.004, 0.22, 0.05, 0x7fb6d9, [x - 0.151, y + 0.1, z - 0.095]);
  // Plaque chauffante, verseuse à moitié pleine, couvercle et poignée.
  p.post(0.085, 0.085, 0.012, COAL, [x, y + 0.03, z + 0.04], 10);
  p.post(0.07, 0.085, 0.075, PALETTE.coffee, [x, y + 0.045, z + 0.04], 10);
  p.post(0.08, 0.092, 0.17, glass, [x, y + 0.042, z + 0.04], 10);
  p.post(0.055, 0.08, 0.025, BLACK, [x, y + 0.212, z + 0.04], 10);
  p.box(0.02, 0.13, 0.025, BLACK, [x + 0.105, y + 0.07, z + 0.04]);
  p.box(0.03, 0.02, 0.025, BLACK, [x + 0.09, y + 0.18, z + 0.04]);
  // Bouton et voyant allumé sur la tête.
  p.box(0.04, 0.02, 0.01, COAL, [x - 0.08, y + 0.39, z + 0.122]);
  p.light(0.02, 0.02, 0.006, PALETTE.red, [x + 0.1, y + 0.39, z + 0.122]);
}

/** Comptoir à café : une porte, un tiroir, une niche à mugs ; cafetière et plateau dessus. */
export function coffeeCounter(): THREE.Group {
  const p = new Pieces([PALETTE.cabinet]);
  const { top, plinth } = COUNTER;
  counterBody(p);
  const y0 = plinth + 0.02;
  const h = top - COUNTER.worktop - y0 - 0.008;
  // Porte à gauche, séparation, tiroir et niche ouverte à droite.
  front(p, -0.215, y0, 0.41, h);
  handle(p, -0.04, y0 + h - 0.22, 0.16, true);
  p.box(0.02, h, COUNTER.depth - 0.05, PALETTE.cabinet, [0, y0, -0.02]);
  front(p, 0.215, y0 + h - 0.16, 0.41, 0.16);
  handle(p, 0.215, y0 + h - 0.06, 0.18, false);
  const shelf = y0 + 0.3;
  p.box(0.39, 0.02, COUNTER.depth - 0.06, PALETTE.cabinet, [0.215, shelf, -0.02]);
  // Dans la niche : sachets de café en bas, mugs rangés sur l'étagère.
  p.box(0.12, 0.2, 0.08, PALETTE.coffee, [0.12, y0, 0.06], { y: 0.2 });
  p.box(0.12, 0.18, 0.08, 0xc2643f, [0.29, y0, 0.08], { y: -0.15 });
  p.box(0.04, 0.03, 0.05, PALETTE.gold, [0.29, y0 + 0.18, 0.08], { y: -0.15 });
  const colors = [PALETTE.white, PALETTE.blue, PALETTE.yellow, PALETTE.red];
  colors.forEach((color, i) => mug(p, color, 0.07 + i * 0.095, shelf + 0.02, 0.05, -Math.PI / 2));
  // Sur le plan : cafetière, plateau de mugs, sucrier et boîte de filtres.
  dripCoffeeMaker(p, -0.2, top, -0.06);
  p.box(0.26, 0.012, 0.18, PALETTE.woodDark, [0.24, top, 0.13]);
  [PALETTE.white, PALETTE.green, PALETTE.white].forEach((color, i) =>
    mug(p, color, 0.16 + i * 0.08, top + 0.012, 0.13),
  );
  p.post(0.04, 0.045, 0.08, glass, [0.3, top, -0.12], 10);
  p.box(0.05, 0.03, 0.05, PALETTE.white, [0.3, top + 0.005, -0.12]);
  p.post(0.046, 0.046, 0.015, PALETTE.chrome, [0.3, top + 0.08, -0.12], 10);
  p.box(0.12, 0.1, 0.07, PALETTE.white, [0.14, top, -0.18], { y: 0.3 });
  return p.build('coffeeCounter');
}

/** Machine à expresso chromée à deux groupes, moulin, pot à lait et bac à marc. */
function espressoMachine(p: Pieces, x: number, y: number, z: number): void {
  // Pieds, caisson chromé à flancs rouges, grille d'égouttage et chauffe-tasses.
  for (const dx of [-0.24, 0.24]) p.post(0.02, 0.02, 0.03, COAL, [x + dx, y, z + 0.1], 6);
  for (const dx of [-0.24, 0.24]) p.post(0.02, 0.02, 0.03, COAL, [x + dx, y, z - 0.14], 6);
  p.box(0.56, 0.36, 0.4, PALETTE.chrome, [x, y + 0.03, z - 0.02]);
  for (const side of [-1, 1])
    p.box(0.012, 0.3, 0.36, PALETTE.red, [x + side * 0.286, y + 0.06, z - 0.02]);
  p.box(0.5, 0.03, 0.12, PALETTE.metal, [x, y + 0.03, z + 0.22]);
  for (let i = 0; i < 6; i += 1)
    p.box(0.46, 0.004, 0.008, COAL, [x, y + 0.06, z + 0.17 + i * 0.019]);
  p.box(0.58, 0.03, 0.42, PALETTE.metal, [x, y + 0.39, z - 0.02]);
  for (const dx of [-0.26, 0.26]) p.box(0.012, 0.05, 0.42, STEEL, [x + dx, y + 0.42, z - 0.02]);
  // Manomètre à aiguille et interrupteur lumineux.
  p.post(0.05, 0.05, 0.015, PALETTE.white, [x, y + 0.28, z + 0.185], 12);
  p.box(0.004, 0.035, 0.004, PALETTE.red, [x + 0.01, y + 0.28, z + 0.2], { z: -0.6 });
  p.light(0.03, 0.02, 0.006, PALETTE.orange, [x + 0.2, y + 0.3, z + 0.18]);
  // Deux groupes, porte-filtres à manche noir et une tasse sous chacun.
  for (const dx of [-0.15, 0.15]) {
    p.post(0.045, 0.05, 0.05, PALETTE.metal, [x + dx, y + 0.14, z + 0.2], 10);
    p.post(0.04, 0.035, 0.03, STEEL, [x + dx, y + 0.11, z + 0.21], 10);
    p.box(0.025, 0.025, 0.13, COAL, [x + dx, y + 0.115, z + 0.3], { x: -0.15 });
    cup(p, x + dx, y + 0.06, z + 0.21);
  }
  // Buse vapeur et sa molette.
  p.bar([x + 0.26, y + 0.24, z + 0.2], [x + 0.3, y + 0.08, z + 0.24], 0.008, PALETTE.metal);
  p.post(0.018, 0.018, 0.02, COAL, [x + 0.25, y + 0.25, z + 0.19], 8);
  // Tasses qui chauffent sur le dessus.
  for (const [dx, dz] of [
    [-0.18, -0.12],
    [-0.09, -0.12],
    [0, -0.12],
    [-0.14, -0.02],
    [-0.05, -0.02],
  ] as const)
    cup(p, x + dx, y + 0.42, z + dz);
}

/** Comptoir du barista : trois tiroirs, machine à expresso, moulin, pot à lait, bac à marc. */
export function espressoCounter(): THREE.Group {
  const p = new Pieces([PALETTE.cabinet]);
  const { top, plinth } = COUNTER;
  counterBody(p);
  // Trois tiroirs de plus en plus hauts.
  let y = plinth + 0.02;
  for (const h of [0.32, 0.24, 0.18]) {
    front(p, 0, y, 0.85, h - 0.01);
    handle(p, 0, y + h - 0.07, 0.3, false);
    y += h;
  }
  espressoMachine(p, -0.12, top, -0.05);
  // Moulin : socle noir, corps, trémie en verre pleine de grains et couvercle.
  const gx = 0.31;
  p.box(0.15, 0.04, 0.2, COAL, [gx, top, -0.04]);
  p.box(0.13, 0.22, 0.14, BLACK, [gx, top + 0.04, -0.07]);
  p.box(0.05, 0.03, 0.05, PALETTE.metal, [gx, top + 0.12, 0.02]);
  p.post(0.06, 0.04, 0.05, PALETTE.coffee, [gx, top + 0.26, -0.07], 10);
  p.post(0.075, 0.045, 0.14, glass, [gx, top + 0.26, -0.07], 10);
  p.post(0.077, 0.077, 0.02, BLACK, [gx, top + 0.4, -0.07], 10);
  // Pot à lait en inox et bac à marc devant le moulin.
  p.post(0.035, 0.042, 0.09, STEEL, [0.3, top, 0.2], 10);
  p.box(0.012, 0.05, 0.012, STEEL, [0.345, top + 0.025, 0.2]);
  p.box(0.12, 0.08, 0.1, COAL, [0.17, top, 0.24]);
  p.box(0.13, 0.012, 0.012, PALETTE.metal, [0.17, top + 0.08, 0.24]);
  return p.build('espressoCounter');
}

/** Four à micro-ondes : hublot sombre, poignée, pavé de touches et horloge allumée. */
function microwave(p: Pieces, x: number, y: number, z: number): void {
  for (const dx of [-0.26, 0.26])
    for (const dz of [-0.16, 0.16]) p.post(0.015, 0.015, 0.015, COAL, [x + dx, y, z + dz], 6);
  p.soft(0.58, 0.32, 0.42, 0.015, PALETTE.white, [x, y + 0.015, z]);
  // Porte : cadre noir, hublot teinté avec un reflet, poignée.
  p.box(0.4, 0.28, 0.012, COAL, [x - 0.08, y + 0.035, z + 0.212]);
  p.box(0.32, 0.2, 0.004, 0x3a4560, [x - 0.09, y + 0.075, z + 0.219]);
  p.box(0.08, 0.2, 0.002, 0x6c7a99, [x - 0.17, y + 0.075, z + 0.222], { z: 0.25 });
  p.box(0.02, 0.22, 0.03, STEEL, [x + 0.095, y + 0.065, z + 0.23]);
  // Panneau de commande : horloge, pavé de touches, bouton rond.
  p.box(0.15, 0.28, 0.008, 0x2a2f3c, [x + 0.205, y + 0.035, z + 0.212]);
  p.light(0.11, 0.04, 0.004, 0x7cf0b4, [x + 0.205, y + 0.25, z + 0.217]);
  for (let row = 0; row < 3; row += 1)
    for (let col = 0; col < 3; col += 1)
      p.box(0.028, 0.022, 0.006, PALETTE.slate, [
        x + 0.17 + col * 0.035,
        y + 0.16 - row * 0.032,
        z + 0.218,
      ]);
  p.post(0.025, 0.025, 0.012, STEEL, [x + 0.205, y + 0.06, z + 0.215], 10);
}

/** Meuble bas du micro-ondes : tiroir et deux portes ; micro-ondes et rouleau d'essuie-tout. */
export function microwaveCounter(): THREE.Group {
  const p = new Pieces([PALETTE.cabinet]);
  const { top, plinth } = COUNTER;
  counterBody(p);
  const y0 = plinth + 0.02;
  const doors = top - COUNTER.worktop - y0 - 0.18;
  for (const side of [-1, 1]) {
    front(p, side * 0.2175, y0, 0.415, doors);
    handle(p, side * 0.035, y0 + doors - 0.22, 0.16, true);
  }
  front(p, 0, y0 + doors + 0.01, 0.85, 0.16);
  handle(p, 0, y0 + doors + 0.1, 0.3, false);
  microwave(p, -0.12, top, -0.06);
  // Dérouleur d'essuie-tout : socle, tige et rouleau blanc.
  p.post(0.06, 0.06, 0.012, PALETTE.metal, [0.33, top, 0.05], 10);
  p.post(0.045, 0.045, 0.24, PALETTE.white, [0.33, top + 0.012, 0.05], 10);
  p.post(0.006, 0.006, 0.27, PALETTE.metal, [0.33, top + 0.012, 0.05], 6);
  return p.build('microwaveCounter');
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
