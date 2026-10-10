/**
 * Détente et décor détaillés, en formes Three.js : babyfoot, toboggan, capsule de sieste,
 * enceinte colonne, tapis rond et poubelle à pédale.
 *
 * Comme le canapé et la bibliothèque, chaque objet garde l'emprise et la hauteur de l'ancien
 * (babyfoot à 0,9, toboggan à 1,9, matelas de la capsule à 0,46 où les chats se couchent, tapis
 * de 2 cm qu'on traverse) mais gagne ce qui le rend crédible : joueurs sur leurs barres,
 * échelle et garde-corps, coque arrondie avec liseuse, haut-parleurs, motifs, pédale…
 * Chaque objet est fusionné par matériau (voir `pieces.ts`) et regarde vers +z.
 */
import * as THREE from 'three';
import { Pieces } from './pieces';
import { PALETTE } from './primitives';

const COAL = 0x1a1e2b;
const BLACK = 0x23283a;

/** Barres du babyfoot, d'un but à l'autre : équipe et nombre de joueurs (1, 2, 5, 3…). */
const RODS: readonly { readonly red: boolean; readonly players: number }[] = [
  { red: true, players: 1 },
  { red: true, players: 2 },
  { red: false, players: 3 },
  { red: true, players: 5 },
  { red: false, players: 5 },
  { red: true, players: 3 },
  { red: false, players: 2 },
  { red: false, players: 1 },
];

/** Babyfoot : pieds carrés, caisse en bois, terrain tracé, 8 barres de joueurs, compteurs. */
export function babyfoot(): THREE.Group {
  const p = new Pieces([PALETTE.wood, PALETTE.woodDark]);
  const field = 0.68;
  // Pieds avec patins réglables, traverse au ras du sol.
  for (const x of [-0.72, 0.72])
    for (const z of [-0.29, 0.29]) {
      p.post(0.035, 0.035, 0.03, COAL, [x, 0, z], 8);
      p.box(0.09, 0.6, 0.09, PALETTE.woodDark, [x, 0.03, z]);
    }
  p.box(1.44, 0.06, 0.05, PALETTE.woodDark, [0, 0.15, 0]);
  // Caisse ouverte : fond, côtés hauts, bouts percés des buts.
  p.box(1.56, 0.08, 0.66, PALETTE.wood, [0, field - 0.08, 0]);
  for (const side of [-1, 1]) {
    p.box(1.66, 0.26, 0.05, PALETTE.wood, [0, field - 0.1, side * 0.355]);
    p.box(0.05, 0.26, 0.76, PALETTE.wood, [side * 0.805, field - 0.1, 0]);
    p.box(0.012, 0.06, 0.2, COAL, [side * 0.776, field, 0]);
  }
  // Terrain : pelouse, ligne médiane, rond central et surfaces de réparation.
  p.box(1.56, 0.012, 0.66, PALETTE.green, [0, field - 0.012, 0]);
  p.box(0.01, 0.003, 0.66, PALETTE.white, [0, field, 0]);
  p.shape(new THREE.RingGeometry(0.085, 0.095, 16).rotateX(-Math.PI / 2), PALETTE.white, [
    0,
    field + 0.002,
    0,
  ]);
  for (const side of [-1, 1]) {
    p.box(0.01, 0.003, 0.3, PALETTE.white, [side * 0.66, field, 0]);
    for (const z of [-0.15, 0.15]) p.box(0.12, 0.003, 0.01, PALETTE.white, [side * 0.72, field, z]);
  }
  // Barres chromées, poignées noires du côté de chaque équipe, joueurs en bois peint.
  const rodY = 0.82;
  RODS.forEach(({ red, players }, i) => {
    const x = -0.63 + i * 0.18;
    p.bar([x, rodY, -0.56], [x, rodY, 0.56], 0.011, PALETTE.chrome);
    const handleZ = red ? 0.5 : -0.5;
    p.bar([x, rodY, handleZ], [x, rodY, handleZ + (red ? 0.12 : -0.12)], 0.024, COAL, 8);
    const color = red ? PALETTE.red : PALETTE.blue;
    const spread = players === 1 ? 0 : players === 2 ? 0.24 : 0.12;
    for (let n = 0; n < players; n += 1) {
      const z = (n - (players - 1) / 2) * spread;
      p.box(0.04, 0.025, 0.035, COAL, [x, field + 0.004, z]);
      p.box(0.035, 0.1, 0.045, color, [x, field + 0.03, z]);
      p.post(0.02, 0.02, 0.035, PALETTE.skin, [x, field + 0.13, z], 8);
    }
  });
  // Balle, et compteurs de buts à boules sur un côté.
  p.post(0.018, 0.018, 0.034, PALETTE.white, [0.08, field, 0.1], 8);
  for (const side of [-1, 1]) {
    p.bar([side * 0.12, 0.89, -0.355], [side * 0.5, 0.89, -0.355], 0.006, PALETTE.chrome);
    for (let n = 0; n < 5; n += 1) {
      const color = side < 0 ? PALETTE.red : PALETTE.blue;
      p.post(0.016, 0.016, 0.025, color, [side * (0.15 + n * 0.035), 0.877, -0.355], 6);
    }
  }
  return p.build('babyfoot');
}

/** Toboggan : tour à échelle, plateforme à garde-corps, piste inclinée à rebords et sortie. */
export function slide(): THREE.Group {
  const p = new Pieces([PALETTE.red]);
  const deck = 1.9;
  const metal = PALETTE.metal;
  // Tour : quatre montants, plateforme jaune, garde-corps sur trois côtés.
  for (const x of [-0.4, 0.4])
    for (const z of [-1.45, -0.85]) {
      p.box(0.07, deck + 0.42, 0.07, metal, [x, 0, z]);
      p.post(0.06, 0.06, 0.03, COAL, [x, 0, z], 8);
    }
  p.box(0.88, 0.06, 0.68, PALETTE.yellow, [0, deck, -1.15]);
  for (const y of [deck + 0.2, deck + 0.38]) {
    for (const x of [-0.4, 0.4]) p.box(0.035, 0.035, 0.6, PALETTE.yellow, [x, y, -1.15]);
  }
  for (let i = 0; i < 5; i += 1)
    for (const x of [-0.4, 0.4])
      p.box(0.02, 0.32, 0.02, metal, [x, deck + 0.06, -1.38 + i * 0.115]);
  p.bar([-0.4, deck + 0.42, -0.85], [-0.33, deck + 0.42, -0.78], 0.02, PALETTE.yellow);
  p.bar([0.4, deck + 0.42, -0.85], [0.33, deck + 0.42, -0.78], 0.02, PALETTE.yellow);
  // Échelle à l'arrière : barreaux antidérapants.
  for (let i = 0; i < 6; i += 1) p.box(0.74, 0.035, 0.06, PALETTE.dark, [0, 0.3 + i * 0.3, -1.49]);
  // Piste : de la plateforme jusqu'au sol, rebords jaunes, puis sortie à plat.
  const from = { y: deck + 0.03, z: -0.82 };
  const to = { y: 0.14, z: 1.28 };
  const run = to.z - from.z;
  const drop = from.y - to.y;
  const angle = Math.atan2(drop, run);
  const length = Math.hypot(run, drop);
  const mid = { y: (from.y + to.y) / 2, z: (from.z + to.z) / 2 };
  p.shape(new THREE.BoxGeometry(0.7, 0.05, length), PALETTE.red, [0, mid.y, mid.z], { x: angle });
  for (const x of [-0.37, 0.37])
    p.shape(new THREE.BoxGeometry(0.04, 0.16, length), PALETTE.yellow, [x, mid.y + 0.07, mid.z], {
      x: angle,
    });
  p.box(0.7, 0.05, 0.24, PALETTE.red, [0, 0.09, to.z + 0.11]);
  for (const x of [-0.37, 0.37]) p.box(0.04, 0.14, 0.24, PALETTE.yellow, [x, 0.07, to.z + 0.11]);
  // Pieds sous la piste, là où elle passe à 0,8 du sol.
  for (const x of [-0.3, 0.3]) {
    p.box(0.05, 0.78, 0.05, metal, [x, 0, 0.42]);
    p.box(0.05, 0.3, 0.05, metal, [x, 0, 1.05]);
  }
  p.box(0.65, 0.04, 0.04, metal, [0, 0.6, 0.42]);
  return p.build('slide');
}

/**
 * Coque des capsules de sieste : visible des deux côtés, puisqu'on voit dedans. Créée au premier
 * usage, car la palette n'est pas encore chargée quand ce module l'est.
 */
let shellMaterial: THREE.MeshStandardMaterial | undefined;
function shell(): THREE.MeshStandardMaterial {
  shellMaterial ??= new THREE.MeshStandardMaterial({
    color: PALETTE.white,
    roughness: 0.5,
    metalness: 0.05,
    flatShading: true,
    side: THREE.DoubleSide,
    // Seules les faces intérieures vont dans la carte d'ombres : pas de rayures sur la coque.
    shadowSide: THREE.BackSide,
    name: 'shell',
  });
  return shellMaterial;
}

/** Capsule de sieste allongée sur 2 cases : socle, matelas, oreiller, couette, coque et liseuse. */
export function napPod(): THREE.Group {
  const p = new Pieces([PALETTE.blue]);
  const length = 1.84;
  const base = 0.36;
  // Socle en retrait, caisson blanc aux angles adoucis.
  p.box(0.78, 0.06, length - 0.1, COAL, [0, 0, 0]);
  p.soft(0.9, base - 0.05, length, 0.04, PALETTE.white, [0, 0.05, 0]);
  // Matelas repeignable, oreiller, couette pliée au pied.
  p.soft(0.78, 0.1, length - 0.12, 0.04, PALETTE.blue, [0, base, 0]);
  p.soft(0.5, 0.08, 0.26, 0.035, 0xf4f1ea, [0, base + 0.09, -0.66]);
  p.soft(0.8, 0.05, 0.6, 0.02, 0x2f4a7a, [0, base + 0.09, 0.38]);
  p.soft(0.8, 0.04, 0.16, 0.015, 0xf4f1ea, [0, base + 0.135, 0.12]);
  // Coque en demi-cylindre couchée le long de la capsule, ouverte au pied.
  const shellLength = 1.46;
  const radius = 0.46;
  const shellZ = -length / 2 + shellLength / 2;
  const shellGeometry = new THREE.CylinderGeometry(
    radius,
    radius,
    shellLength,
    16,
    1,
    true,
    Math.PI / 2,
    Math.PI,
  );
  shellGeometry.rotateX(Math.PI / 2);
  p.shape(shellGeometry, shell(), [0, base, shellZ]);
  p.shape(new THREE.CircleGeometry(radius, 16, 0, Math.PI), shell(), [0, base, -length / 2 + 0.01]);
  // Liseré sombre à l'entrée, liseuse allumée et petit panneau de commande à l'intérieur.
  p.shape(new THREE.TorusGeometry(radius, 0.025, 6, 16, Math.PI), BLACK, [
    0,
    base,
    shellZ + shellLength / 2,
  ]);
  p.light(0.12, 0.02, 0.06, 0xffe2a8, [0.12, base + radius - 0.04, -0.6]);
  p.light(0.05, 0.03, 0.005, 0x7cc8f4, [-0.43, base + 0.22, -0.3]);
  return p.build('napPod');
}

/** Haut-parleur rond, tourné vers +z, centré en (x, y, z). */
function driver(p: Pieces, x: number, y: number, z: number, radius: number): void {
  const facing = { x: Math.PI / 2 };
  p.shape(new THREE.CylinderGeometry(radius, radius, 0.012, 16), PALETTE.metal, [x, y, z], facing);
  p.shape(
    new THREE.CylinderGeometry(radius * 0.86, radius * 0.4, 0.02, 16),
    BLACK,
    [x, y, z + 0.01],
    facing,
  );
  p.shape(
    new THREE.SphereGeometry(radius * 0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
    COAL,
    [x, y, z + 0.005],
    facing,
  );
}

/** Enceinte colonne : pointes de découplage, caisson en noyer, deux boomers, tweeter, évent. */
export function floorSpeaker(): THREE.Group {
  const p = new Pieces();
  const width = 0.3;
  const depth = 0.32;
  // Socle et pointes, caisson, façade noire.
  p.box(width + 0.06, 0.03, depth + 0.06, COAL, [0, 0.03, 0]);
  for (const x of [-0.15, 0.15])
    for (const z of [-0.15, 0.15]) p.post(0.016, 0.004, 0.03, PALETTE.chrome, [x, 0, z], 6);
  p.soft(width, 1.14, depth, 0.02, PALETTE.woodDark, [0, 0.06, 0]);
  p.box(width - 0.03, 1.1, 0.01, COAL, [0, 0.08, depth / 2]);
  const front = depth / 2 + 0.01;
  driver(p, 0, 1.06, front, 0.045);
  driver(p, 0, 0.82, front, 0.1);
  driver(p, 0, 0.56, front, 0.1);
  // Évent de basses et voyant de mise en marche.
  p.shape(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 12), 0x05070c, [0, 0.3, front], {
    x: Math.PI / 2,
  });
  p.light(0.012, 0.012, 0.004, 0x7cc8f4, [0.1, 0.14, front + 0.002]);
  // Câble qui part derrière.
  p.bar([0.05, 0.12, -depth / 2], [0.12, 0.004, -depth / 2 - 0.12], 0.008, COAL);
  return p.build('floorSpeaker');
}

/** Tapis rond de 1,84 m : bordure, anneau clair, médaillon central et motifs en couronne. */
export function roundRug(): THREE.Group {
  const p = new Pieces([PALETTE.rug]);
  const disc = (radius: number, height: number, color: number, y: number) =>
    p.post(radius, radius, height, color, [0, y, 0], 36);
  disc(0.92, 0.012, PALETTE.rug, 0);
  disc(0.84, 0.014, 0xeadfc8, 0);
  disc(0.78, 0.016, PALETTE.rug, 0);
  disc(0.36, 0.018, 0xe8b93c, 0);
  disc(0.27, 0.019, PALETTE.rug, 0);
  disc(0.1, 0.02, 0xeadfc8, 0);
  // Douze losanges entre le médaillon et la bordure, et un pointillé clair.
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    p.box(0.09, 0.018, 0.09, 0xeadfc8, [Math.cos(angle) * 0.57, 0, Math.sin(angle) * 0.57], {
      y: angle + Math.PI / 4,
    });
    const dot = angle + Math.PI / 12;
    p.box(0.04, 0.017, 0.04, 0xe8b93c, [Math.cos(dot) * 0.7, 0, Math.sin(dot) * 0.7]);
  }
  return p.build('roundRug');
}

/** Poubelle à pédale en inox : couvercle bombé, sac qui dépasse, pédale et papier raté à côté. */
export function pedalBin(): THREE.Group {
  const p = new Pieces([PALETTE.metal]);
  p.post(0.15, 0.15, 0.04, COAL, [0, 0, 0], 16);
  p.post(0.175, 0.155, 0.62, PALETTE.metal, [0, 0.03, 0], 16);
  p.post(0.178, 0.178, 0.02, 0x2a2f3c, [0, 0.64, 0], 16);
  p.post(0.182, 0.182, 0.03, PALETTE.metal, [0, 0.655, 0], 16);
  p.shape(
    new THREE.SphereGeometry(0.182, 16, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1),
    PALETTE.metal,
    [0, 0.685, 0],
  );
  // Charnière à l'arrière, pédale à l'avant, étiquette de tri verte.
  p.box(0.12, 0.03, 0.03, COAL, [0, 0.65, -0.18]);
  p.box(0.12, 0.025, 0.1, COAL, [0, 0.01, 0.19]);
  p.box(0.08, 0.06, 0.004, PALETTE.green, [0, 0.42, 0.172], { x: -0.03 });
  // La boule de papier qui a raté la poubelle.
  p.shape(new THREE.IcosahedronGeometry(0.045, 0), PALETTE.white, [0.26, 0.04, 0.2], {
    y: 0.6,
    x: 0.4,
  });
  return p.build('pedalBin');
}
