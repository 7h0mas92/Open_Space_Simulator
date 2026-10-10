/**
 * Équipement des chats détaillé, en formes Three.js : trois litières, deux gamelles et trois
 * arbres à chat.
 *
 * Les chats se servent de ces objets : ils s'assoient dans les litières, mangent devant les
 * bols (`feeding`), dorment sur les plateaux (`perches`) et jouent sous les pompons (`toys`).
 * Ces versions gardent donc exactement la place des bols, la hauteur des plateaux et celle des
 * pompons des anciennes, et ajoutent les détails : corde de sisal enroulée, moquette sur
 * planche, coussins, tapis de litière, pelle, croquettes, fontaine, jouets au sol…
 * Chaque objet est fusionné par matériau (voir `pieces.ts`) et regarde vers +z.
 */
import * as THREE from 'three';
import { Pieces } from './pieces';
import { glass, PALETTE } from './primitives';

const COAL = 0x1a1e2b;
const BOARD = 0xd9c4a0;
const ROPE_DARK = 0xb8995f;
const MAT = 0x7a8196;

/** Tapis de litière ou de gamelle en silicone, avec une empreinte de patte. */
function mat(p: Pieces, w: number, d: number, x: number, z: number): void {
  p.soft(w, 0.012, d, 0.005, MAT, [x, 0, z]);
  p.post(0.03, 0.03, 0.003, 0x9aa1b4, [x + w / 2 - 0.08, 0.012, z], 8);
  for (let i = 0; i < 4; i += 1)
    p.post(0.011, 0.011, 0.003, 0x9aa1b4, [x + w / 2 - 0.12 + i * 0.026, 0.012, z - 0.04], 6);
}

/** Litière ouverte : bac à rebord, sable et grumeaux, pelle, tapis devant. */
export function litterOpen(): THREE.Group {
  const p = new Pieces([PALETTE.mint]);
  p.soft(0.62, 0.04, 0.46, 0.015, PALETTE.mint, [0, 0, 0]);
  for (const [w, d, x, z] of [
    [0.62, 0.04, 0, -0.21],
    [0.62, 0.04, 0, 0.21],
    [0.04, 0.46, -0.29, 0],
    [0.04, 0.46, 0.29, 0],
  ] as const)
    p.box(w, 0.13, d, PALETTE.mint, [x, 0.03, z]);
  // Rebord qui dépasse vers l'extérieur, comme sur un vrai bac.
  for (const [w, d, x, z] of [
    [0.66, 0.05, 0, -0.225],
    [0.66, 0.05, 0, 0.225],
    [0.05, 0.4, -0.305, 0],
    [0.05, 0.4, 0.305, 0],
  ] as const)
    p.box(w, 0.02, d, PALETTE.mint, [x, 0.155, z]);
  p.box(0.54, 0.07, 0.38, PALETTE.sand, [0, 0.03, 0]);
  for (const [x, z, s] of [
    [-0.12, 0.05, 1],
    [0.1, -0.08, 0.8],
    [0.16, 0.1, 0.6],
  ] as const)
    p.shape(new THREE.IcosahedronGeometry(0.025 * s, 0), PALETTE.sisal, [x, 0.1, z]);
  // Pelle ajourée et tapis devant le bac.
  p.box(0.09, 0.012, 0.11, COAL, [0.39, 0.012, 0.02], { y: 0.4 });
  p.box(0.025, 0.012, 0.12, COAL, [0.43, 0.012, 0.13], { y: 0.4 });
  for (let i = 0; i < 3; i += 1)
    p.box(0.06, 0.003, 0.012, PALETTE.slate, [0.39 + i * 0.008, 0.024, -0.01 + i * 0.025], {
      y: 0.4,
    });
  mat(p, 0.6, 0.14, 0, 0.36);
  return p.build('litterOpen');
}

/** Litière fermée : bac, capot arrondi, porte battante, filtre, poignée et tapis. */
export function litterCovered(): THREE.Group {
  const p = new Pieces([PALETTE.white, PALETTE.mint]);
  p.soft(0.66, 0.16, 0.5, 0.02, PALETTE.mint, [0, 0, 0]);
  p.box(0.68, 0.02, 0.52, PALETTE.mint, [0, 0.15, 0]);
  for (const x of [-0.31, 0.31]) p.box(0.03, 0.04, 0.1, COAL, [x, 0.13, 0]);
  p.box(0.64, 0.3, 0.48, PALETTE.white, [0, 0.16, 0]);
  const roof = new THREE.CylinderGeometry(0.24, 0.24, 0.64, 14, 1, false, 0, Math.PI);
  roof.rotateZ(Math.PI / 2).scale(1, 0.55, 1);
  p.shape(roof, PALETTE.white, [0, 0.46, 0]);
  // Porte battante teintée dans son cadre, aération et filtre sur le dessus.
  p.box(0.3, 0.28, 0.02, PALETTE.mint, [0, 0.1, 0.245]);
  p.box(0.25, 0.23, 0.02, 0x3a4560, [0, 0.12, 0.252]);
  p.box(0.12, 0.012, 0.012, PALETTE.white, [0, 0.33, 0.262]);
  for (let i = 0; i < 4; i += 1)
    p.box(0.012, 0.01, 0.14, PALETTE.mint, [-0.08 + i * 0.05, 0.585, -0.02]);
  p.soft(0.2, 0.04, 0.05, 0.015, PALETTE.mint, [0, 0.56, 0]);
  mat(p, 0.6, 0.14, 0, 0.36);
  return p.build('litterCovered');
}

/** Litière robot : socle, dôme, entrée cerclée, écran, voyants, marche d'accès et tiroir. */
export function litterRobot(): THREE.Group {
  const p = new Pieces([PALETTE.white]);
  p.post(0.36, 0.38, 0.16, PALETTE.dark, [0, 0, 0], 20);
  p.light(0.3, 0.015, 0.02, PALETTE.blue, [0, 0.1, 0.372]);
  p.box(0.22, 0.012, 0.02, 0x2a2f3c, [0, 0.04, 0.37]);
  const dome = new THREE.SphereGeometry(0.36, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(
    1,
    1.35,
    1,
  );
  p.shape(dome, PALETTE.white, [0, 0.16, 0]);
  // Entrée ronde tournée vers l'avant, avec son cerclage.
  p.shape(new THREE.CircleGeometry(0.17, 16), PALETTE.dark, [0, 0.36, 0.336], { x: -0.25 });
  p.shape(new THREE.TorusGeometry(0.175, 0.018, 6, 18), 0xd5dbe3, [0, 0.36, 0.334], { x: -0.25 });
  p.box(0.3, 0.03, 0.14, PALETTE.dark, [0, 0.16, 0.37]);
  p.box(0.16, 0.05, 0.02, PALETTE.screen, [0, 0.6, 0.27], { x: -0.6 });
  p.light(0.04, 0.04, 0.02, PALETTE.green, [0.12, 0.61, 0.265]);
  p.light(0.1, 0.012, 0.004, 0x7cc8f4, [0, 0.615, 0.285]);
  mat(p, 0.6, 0.12, 0, 0.42);
  return p.build('litterRobot');
}

/** Bol en inox posé sur `y`, rempli d'eau ou de croquettes. */
function bowl(p: Pieces, x: number, y: number, z: number, filling: 'water' | 'kibble'): void {
  p.post(0.11, 0.08, 0.07, PALETTE.metal, [x, y, z], 14);
  p.shape(new THREE.TorusGeometry(0.105, 0.01, 4, 16).rotateX(Math.PI / 2), PALETTE.chrome, [
    x,
    y + 0.07,
    z,
  ]);
  if (filling === 'water') {
    p.post(0.095, 0.095, 0.01, PALETTE.water, [x, y + 0.052, z], 14);
    p.post(0.03, 0.03, 0.002, 0x9fd0f0, [x - 0.03, y + 0.062, z + 0.02], 8);
    return;
  }
  p.post(0.095, 0.095, 0.02, PALETTE.coffee, [x, y + 0.04, z], 14);
  for (let i = 0; i < 9; i += 1) {
    const angle = i * 2.4;
    const r = 0.02 + (i % 3) * 0.022;
    p.shape(new THREE.IcosahedronGeometry(0.014, 0), i % 2 ? PALETTE.woodDark : 0xa0673c, [
      x + Math.cos(angle) * r,
      y + 0.065,
      z + Math.sin(angle) * r,
    ]);
  }
}

/** Gamelle double : support en bois sur pieds, deux bols inox, tapis en silicone. */
export function catBowl(): THREE.Group {
  const p = new Pieces([PALETTE.wood]);
  mat(p, 0.66, 0.38, 0, 0);
  for (const x of [-0.25, 0.25])
    for (const z of [-0.1, 0.1]) p.post(0.018, 0.014, 0.03, PALETTE.woodDark, [x, 0.012, z], 6);
  p.soft(0.56, 0.04, 0.28, 0.012, PALETTE.wood, [0, 0.04, 0]);
  // Empreinte de patte gravée sur la façade.
  p.post(0.016, 0.016, 0.004, PALETTE.woodDark, [0, 0.06, 0.141], 8);
  bowl(p, -0.13, 0.08, 0, 'water');
  bowl(p, 0.13, 0.08, 0, 'kibble');
  return p.build('catBowl');
}

/** Distributeur de croquettes connecté et fontaine à eau sur un même socle. */
export function catFeeder(): THREE.Group {
  const p = new Pieces([PALETTE.white]);
  p.soft(0.72, 0.05, 0.4, 0.015, PALETTE.white, [0, 0, 0]);
  // Distributeur : pied, réservoir transparent plein de croquettes, couvercle, plateau.
  p.soft(0.26, 0.1, 0.3, 0.02, PALETTE.white, [-0.18, 0.05, -0.02]);
  p.box(0.18, 0.18, 0.18, PALETTE.coffee, [-0.18, 0.15, -0.05]);
  p.box(0.2, 0.3, 0.2, glass, [-0.18, 0.15, -0.05]);
  p.soft(0.22, 0.045, 0.22, 0.015, PALETTE.white, [-0.18, 0.45, -0.05]);
  p.post(0.02, 0.02, 0.012, PALETTE.blue, [-0.18, 0.495, -0.05], 10);
  p.box(0.2, 0.03, 0.12, PALETTE.white, [-0.18, 0.05, 0.12]);
  p.box(0.16, 0.02, 0.09, PALETTE.coffee, [-0.18, 0.07, 0.12]);
  p.light(0.04, 0.04, 0.01, PALETTE.green, [-0.1, 0.4, 0.06]);
  p.light(0.07, 0.03, 0.004, 0x7cc8f4, [-0.2, 0.1, 0.132]);
  // Fontaine : bassin, eau, fleur en inox, dôme et filet d'eau.
  p.post(0.15, 0.13, 0.1, PALETTE.white, [0.18, 0.05, 0], 16);
  p.post(0.13, 0.13, 0.01, PALETTE.water, [0.18, 0.145, 0], 16);
  p.post(0.025, 0.03, 0.08, PALETTE.chrome, [0.18, 0.15, 0], 8);
  p.post(0.05, 0.02, 0.015, PALETTE.chrome, [0.18, 0.23, 0], 10);
  p.shape(
    new THREE.SphereGeometry(0.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    glass,
    [0.18, 0.24, 0],
  );
  p.bar([0.22, 0.24, 0.02], [0.25, 0.15, 0.06], 0.006, 0x9fd0f0, 4);
  p.light(0.03, 0.01, 0.004, 0x7cc8f4, [0.18, 0.08, 0.152]);
  return p.build('catFeeder');
}

/** Poteau griffoir en corde de sisal enroulée, avec un spire plus sombre tous les 5 cm. */
function sisalPost(p: Pieces, x: number, y: number, z: number, h: number): void {
  p.post(0.075, 0.075, h, PALETTE.sisal, [x, y, z], 10);
  for (let k = 0.04; k < h - 0.02; k += 0.05)
    p.post(0.077, 0.077, 0.01, ROPE_DARK, [x, y + k, z], 10);
}

/** Plateau : planche claire, moquette par-dessus aux bords arrondis (rond si `round`). */
function platform(
  p: Pieces,
  w: number,
  d: number,
  fabric: number,
  at: readonly [number, number, number],
  round = false,
): void {
  const [x, y, z] = at;
  if (round) {
    p.post(w / 2 - 0.01, w / 2 - 0.01, 0.02, BOARD, [x, y, z], 16);
    p.post(w / 2, w / 2, 0.045, fabric, [x, y + 0.015, z], 16);
    return;
  }
  p.box(w - 0.02, 0.02, d - 0.02, BOARD, [x, y, z]);
  p.soft(w, 0.045, d, 0.015, fabric, [x, y + 0.015, z]);
}

/** Panier rond rembourré au sommet d'un arbre, son coussin un peu plus clair. */
function basket(p: Pieces, fabric: number, x: number, y: number, z: number): void {
  p.post(0.24, 0.22, 0.05, fabric, [x, y, z], 16);
  p.shape(new THREE.TorusGeometry(0.21, 0.05, 6, 18).rotateX(Math.PI / 2), fabric, [
    x,
    y + 0.07,
    z,
  ]);
  p.soft(0.28, 0.03, 0.28, 0.014, PALETTE.plush, [x, y + 0.04, z]);
}

/** Niche cubique : entrée ronde cerclée, coussin visible au fond. */
function cubby(p: Pieces, fabric: number, x: number, y: number, z: number, size = 0.5): void {
  p.soft(size, size, size, 0.03, fabric, [x, y, z]);
  p.shape(new THREE.CircleGeometry(size * 0.3, 14), PALETTE.dark, [
    x,
    y + size * 0.45,
    z + size / 2 + 0.002,
  ]);
  p.shape(new THREE.TorusGeometry(size * 0.3, 0.018, 5, 16), ROPE_DARK, [
    x,
    y + size * 0.45,
    z + size / 2 + 0.004,
  ]);
}

/** Pompon : ficelle, boule rouge et plume, suspendu sous un plateau. */
function pompom(p: Pieces, x: number, y: number, z: number): void {
  p.box(0.008, 0.2, 0.008, PALETTE.white, [x, y - 0.2, z]);
  p.shape(new THREE.IcosahedronGeometry(0.045, 1), PALETTE.red, [x, y - 0.23, z]);
  p.box(0.012, 0.07, 0.004, PALETTE.yellow, [x + 0.02, y - 0.3, z], { z: 0.5 });
}

/** Souris en peluche oubliée au pied de l'arbre. */
function toyMouse(p: Pieces, x: number, z: number, turn: number): void {
  p.shape(new THREE.SphereGeometry(0.035, 8, 6).scale(1, 0.8, 1.6), PALETTE.slate, [x, 0.09, z], {
    y: turn,
  });
  for (const side of [-1, 1])
    p.post(
      0.014,
      0.014,
      0.006,
      PALETTE.pink,
      [x + side * 0.02 * Math.cos(turn), 0.115, z + 0.03],
      6,
    );
  p.bar([x, 0.08, z - 0.05], [x + 0.03, 0.066, z - 0.11], 0.004, PALETTE.pink, 4);
}

/** Arbre à chat compact (1 case, moquette beige) : griffoir, panier en haut, pompon. */
export function catTreeSmall(): THREE.Group {
  const fabric = PALETTE.plush;
  const p = new Pieces([fabric]);
  platform(p, 0.78, 0.78, fabric, [0, 0, 0]);
  sisalPost(p, 0, 0.06, 0, 0.72);
  platform(p, 0.56, 0.56, fabric, [0, 0.78, 0], true);
  basket(p, fabric, 0, 0.84, 0);
  pompom(p, 0.24, 0.78, 0.18);
  toyMouse(p, -0.22, 0.24, 0.6);
  return p.build('catTreeSmall');
}

/** Arbre à chat double (2 cases, moquette grise) : deux tours, niche, panier, plateau haut. */
export function catTreeMedium(): THREE.Group {
  const fabric = PALETTE.slate;
  const p = new Pieces([fabric]);
  platform(p, 1.8, 0.8, fabric, [0, 0, 0]);
  // Tour de gauche, la plus haute, avec un panier au sommet.
  sisalPost(p, -0.5, 0.06, 0, 1.1);
  platform(p, 0.6, 0.6, fabric, [-0.5, 0.55, 0]);
  platform(p, 0.6, 0.6, fabric, [-0.5, 1.16, 0], true);
  basket(p, fabric, -0.5, 1.22, 0);
  // Tour de droite : niche, deux poteaux et un plateau.
  cubby(p, fabric, 0.5, 0.06, 0, 0.5);
  sisalPost(p, 0.3, 0.56, -0.15, 0.24);
  sisalPost(p, 0.7, 0.56, -0.15, 0.24);
  platform(p, 0.62, 0.6, fabric, [0.5, 0.8, 0]);
  pompom(p, 0.15, 0.55, 0.2);
  toyMouse(p, 0.05, 0.3, -0.4);
  return p.build('catTreeMedium');
}

/** Arbre à chat géant (3 cases, moquette mauve) : trois tours, passerelle à barreaux. */
export function catTreeLarge(): THREE.Group {
  const fabric = PALETTE.mauve;
  const p = new Pieces([fabric]);
  platform(p, 2.8, 0.8, fabric, [0, 0, 0]);
  // Gauche : niche, puis un plateau bas.
  cubby(p, fabric, -1, 0.06, 0, 0.55);
  sisalPost(p, -1, 0.61, 0, 0.12);
  platform(p, 0.66, 0.62, fabric, [-1, 0.73, 0]);
  // Centre : la tour la plus haute, deux étages et un panier.
  sisalPost(p, 0, 0.06, 0, 1.5);
  platform(p, 0.6, 0.6, fabric, [0, 0.7, 0], true);
  platform(p, 0.62, 0.62, fabric, [0, 1.56, 0], true);
  basket(p, fabric, 0, 1.62, 0);
  pompom(p, 0.25, 0.7, 0.2);
  // Droite : tour moyenne et une passerelle à barreaux vers le centre.
  sisalPost(p, 1, 0.06, 0, 1.06);
  platform(p, 0.62, 0.62, fabric, [1, 1.12, 0]);
  p.shape(new THREE.BoxGeometry(0.7, 0.04, 0.22), fabric, [0.5, 1.3, 0], { z: 0.5 });
  for (let i = 0; i < 5; i += 1) {
    const t = -0.26 + i * 0.13;
    p.shape(
      new THREE.BoxGeometry(0.02, 0.015, 0.22),
      ROPE_DARK,
      [0.5 + t * Math.cos(0.5), 1.325 + t * Math.sin(0.5), 0],
      { z: 0.5 },
    );
  }
  pompom(p, 1.2, 1.12, 0.22);
  toyMouse(p, -0.5, 0.28, 0.9);
  return p.build('catTreeLarge');
}
