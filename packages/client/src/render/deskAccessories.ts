/**
 * Accessoires de bureau détaillés, en formes Three.js : lampe d'architecte, mug, canard,
 * pile de livres, nounours, radio, deuxième écran, mini-enceinte, trophée, écouteurs sans fil,
 * grille-pain et blender.
 *
 * Ils se posent sur les emplacements des meubles (`surface` dans le catalogue) : chacun garde
 * à peu près la taille de l'ancien modèle pour ne pas déborder sur le voisin, et regarde vers
 * +z, c'est-à-dire vers la personne assise devant le meuble. Comme les meubles, chacun est
 * fusionné par matériau (voir `pieces.ts`).
 */
import * as THREE from 'three';
import { Pieces } from './pieces';
import { glass, PALETTE } from './primitives';

const COAL = 0x1a1e2b;
const BLACK = 0x23283a;
const PAPER = 0xf4efe1;

/** Sphère étirée (corps, tête, pattes) centrée en (x, y, z). */
function blob(
  p: Pieces,
  radius: number,
  scale: readonly [number, number, number],
  color: number,
  at: readonly [number, number, number],
  tilt: { readonly x?: number; readonly y?: number; readonly z?: number } = {},
): void {
  p.shape(new THREE.SphereGeometry(radius, 10, 8).scale(...scale), color, at, tilt);
}

/** Lampe d'architecte : socle lesté, bras articulés à ressorts, abat-jour et ampoule. */
export function deskLamp(): THREE.Group {
  const p = new Pieces([PALETTE.mint]);
  p.post(0.085, 0.09, 0.03, PALETTE.mint, [0, 0, -0.03], 16);
  p.post(0.02, 0.02, 0.03, COAL, [0, 0.03, -0.05], 8);
  const elbow: [number, number, number] = [0, 0.36, -0.07];
  const head: [number, number, number] = [0, 0.5, 0.07];
  // Bras doublés et leurs ressorts.
  for (const dx of [-0.012, 0.012]) {
    p.bar([dx, 0.05, -0.05], [dx, elbow[1], elbow[2]], 0.006, PALETTE.chrome);
    p.bar([dx, elbow[1], elbow[2]], [dx, head[1], head[2]], 0.006, PALETTE.chrome);
  }
  p.bar([0.025, 0.08, -0.03], [0.025, 0.3, -0.06], 0.008, PALETTE.metal, 5);
  p.bar([0.025, 0.38, -0.04], [0.025, 0.47, 0.04], 0.008, PALETTE.metal, 5);
  p.post(0.016, 0.016, 0.03, COAL, [0, elbow[1] - 0.015, elbow[2]], 8);
  // Abat-jour conique penché vers l'avant, ampoule allumée dessous.
  p.shape(new THREE.CylinderGeometry(0.025, 0.075, 0.11, 14), PALETTE.mint, head, { x: -0.6 });
  p.shape(new THREE.SphereGeometry(0.03, 8, 6), 0xfff1c4, [0, head[1] - 0.04, head[2] + 0.03]);
  p.light(0.03, 0.01, 0.03, 0xfff1c4, [0, head[1] - 0.06, head[2] + 0.04]);
  return p.build('deskLamp');
}

/** Mug de dev : corps, anse, bande colorée, café froid et cuillère oubliée. */
export function mug(): THREE.Group {
  const p = new Pieces([PALETTE.white]);
  p.post(0.07, 0.064, 0.14, PALETTE.white, [0, 0, 0], 14);
  p.post(0.0705, 0.066, 0.03, PALETTE.blue, [0, 0.05, 0], 14);
  p.post(0.058, 0.058, 0.004, PALETTE.coffee, [0, 0.139, 0], 14);
  p.shape(new THREE.TorusGeometry(0.038, 0.012, 6, 12, Math.PI), PALETTE.white, [0.068, 0.07, 0], {
    z: -Math.PI / 2,
  });
  p.bar([-0.02, 0.06, 0.01], [-0.06, 0.2, 0.03], 0.006, PALETTE.chrome, 5);
  return p.build('mug');
}

/** Canard en plastique jaune, le meilleur outil de débogage, bec vers le dev. */
export function rubberDuck(): THREE.Group {
  const p = new Pieces([PALETTE.yellow]);
  blob(p, 0.09, [1, 0.78, 1.25], PALETTE.yellow, [0, 0.07, 0]);
  blob(p, 0.06, [0.35, 0.6, 1], PALETTE.yellow, [-0.085, 0.085, -0.01]);
  blob(p, 0.06, [0.35, 0.6, 1], PALETTE.yellow, [0.085, 0.085, -0.01]);
  p.shape(new THREE.ConeGeometry(0.04, 0.07, 6), PALETTE.yellow, [0, 0.12, -0.1], { x: -0.9 });
  blob(p, 0.058, [1, 1, 1], PALETTE.yellow, [0, 0.17, 0.05]);
  p.box(0.045, 0.018, 0.05, PALETTE.orange, [0, 0.152, 0.11]);
  p.box(0.035, 0.01, 0.04, 0xd9701f, [0, 0.142, 0.105]);
  for (const x of [-0.028, 0.028]) {
    p.post(0.012, 0.012, 0.006, PALETTE.white, [x, 0.185, 0.098], 8);
    p.post(0.006, 0.006, 0.006, COAL, [x, 0.187, 0.102], 6);
  }
  return p.build('rubberDuck');
}

/** Pile de livres reliés, légèrement de travers, avec le marque-page qui dépasse. */
export function bookStack(): THREE.Group {
  const p = new Pieces([PALETTE.purple]);
  const books = [
    { h: 0.05, w: 0.29, d: 0.19, color: 0x2f4a7a, turn: 0 },
    { h: 0.045, w: 0.26, d: 0.18, color: 0x8a3b32, turn: 0.12 },
    { h: 0.055, w: 0.24, d: 0.17, color: 0x3d6b4f, turn: -0.08 },
    { h: 0.04, w: 0.22, d: 0.15, color: PALETTE.purple, turn: 0.2 },
  ];
  let y = 0;
  for (const { h, w, d, color, turn } of books) {
    // Couverture, tranche de pages crème en retrait, dos un peu plus épais.
    p.box(w, h, d, color, [0, y, 0], { y: turn });
    p.box(w - 0.02, h - 0.012, d + 0.004, PAPER, [0.008 * Math.cos(turn), y + 0.006, 0], {
      y: turn,
    });
    p.box(0.012, h, d + 0.006, color, [-(w / 2) * Math.cos(turn), y, (w / 2) * Math.sin(turn)], {
      y: turn,
    });
    y += h;
  }
  p.box(0.012, 0.003, 0.06, PALETTE.red, [0.04, y - 0.02, 0.09], { y: 0.2, x: 0.6 });
  return p.build('bookStack');
}

/** Nounours assis : pattes en avant, museau, oreilles, nœud papillon rouge. */
export function teddyBear(): THREE.Group {
  const p = new Pieces([PALETTE.teddy]);
  const fur = PALETTE.teddy;
  const light = PALETTE.plush;
  for (const side of [-1, 1]) {
    blob(p, 0.045, [0.9, 0.85, 1.5], fur, [side * 0.065, 0.04, 0.04]);
    blob(p, 0.03, [1, 1, 0.4], light, [side * 0.065, 0.04, 0.105]);
    blob(p, 0.035, [0.8, 1.7, 0.8], fur, [side * 0.11, 0.15, 0.02], { z: side * 0.45 });
  }
  blob(p, 0.1, [1, 1.15, 0.85], fur, [0, 0.13, 0]);
  blob(p, 0.06, [1, 1.1, 0.5], light, [0, 0.12, 0.05]);
  blob(p, 0.085, [1, 0.95, 0.95], fur, [0, 0.27, 0.01]);
  for (const side of [-1, 1]) {
    blob(p, 0.032, [1, 1, 0.6], fur, [side * 0.065, 0.34, 0]);
    blob(p, 0.018, [1, 1, 0.4], light, [side * 0.065, 0.34, 0.012]);
    p.post(0.009, 0.009, 0.006, COAL, [side * 0.03, 0.285, 0.083], 6);
  }
  blob(p, 0.036, [1, 0.8, 0.8], light, [0, 0.25, 0.075]);
  blob(p, 0.012, [1.3, 0.8, 0.8], COAL, [0, 0.262, 0.103]);
  for (const side of [-1, 1])
    p.box(0.04, 0.03, 0.012, PALETTE.red, [side * 0.022, 0.195, 0.08], { z: side * 0.4 });
  p.post(0.01, 0.01, 0.02, PALETTE.red, [0, 0.2, 0.083], 6);
  return p.build('teddyBear');
}

/** Radio rétro en bois : grille en tissu, cadran éclairé, deux boutons, antenne et poignée. */
export function retroRadio(): THREE.Group {
  const p = new Pieces();
  for (const x of [-0.13, 0.13]) p.box(0.04, 0.012, 0.08, COAL, [x, 0, 0]);
  p.soft(0.34, 0.19, 0.11, 0.025, PALETTE.woodDark, [0, 0.012, 0]);
  // Façade : grille à lattes à gauche, cadran et boutons à droite.
  p.box(0.17, 0.13, 0.006, PALETTE.sisal, [-0.07, 0.04, 0.055]);
  for (let i = 0; i < 6; i += 1)
    p.box(0.17, 0.006, 0.006, PALETTE.wood, [-0.07, 0.05 + i * 0.022, 0.06]);
  p.light(0.11, 0.035, 0.004, 0xffe2a8, [0.09, 0.13, 0.056]);
  p.box(0.003, 0.03, 0.006, PALETTE.red, [0.07, 0.132, 0.058]);
  for (const x of [0.06, 0.12]) {
    p.shape(new THREE.CylinderGeometry(0.02, 0.022, 0.02, 12), PALETTE.chrome, [x, 0.07, 0.063], {
      x: Math.PI / 2,
    });
  }
  // Poignée de transport et antenne télescopique.
  p.bar([-0.1, 0.2, 0], [-0.08, 0.235, 0], 0.008, BLACK, 5);
  p.bar([-0.08, 0.235, 0], [0.08, 0.235, 0], 0.008, BLACK, 5);
  p.bar([0.08, 0.235, 0], [0.1, 0.2, 0], 0.008, BLACK, 5);
  p.bar([0.15, 0.2, -0.03], [0.21, 0.36, -0.05], 0.004, PALETTE.chrome, 5);
  return p.build('retroRadio');
}

/** Deuxième écran : pied ovale, colonne, cadre fin et tableau de bord à l'écran. */
export function secondScreen(): THREE.Group {
  const p = new Pieces([PALETTE.dark]);
  p.shape(
    new THREE.CylinderGeometry(0.1, 0.11, 0.012, 16).scale(1.3, 1, 0.7),
    PALETTE.dark,
    [0, 0.006, -0.01],
  );
  p.box(0.05, 0.13, 0.025, PALETTE.dark, [0, 0.012, -0.045]);
  p.soft(0.5, 0.3, 0.025, 0.008, PALETTE.dark, [0, 0.08, -0.025]);
  p.box(0.47, 0.27, 0.004, PALETTE.screen, [0, 0.095, -0.011]);
  // Tableau de bord : courbe verte, barres et pastilles.
  const bars = [0.05, 0.08, 0.06, 0.1, 0.07];
  bars.forEach((h, i) => p.light(0.03, h, 0.003, 0x7cc8f4, [-0.19 + i * 0.045, 0.115, -0.008]));
  for (let i = 0; i < 6; i += 1) {
    const x = 0.04 + i * 0.03;
    const y = 0.2 + Math.sin(i * 1.1) * 0.03;
    p.light(0.032, 0.006, 0.003, PALETTE.green, [x, y, -0.008]);
  }
  p.light(0.43, 0.012, 0.003, 0x3a4560, [0, 0.33, -0.008]);
  p.light(0.008, 0.008, 0.003, PALETTE.white, [0.22, 0.082, -0.011]);
  return p.build('secondScreen');
}

/** Mini-enceinte de bibliothèque : patin en mousse, caisson, boomer, tweeter et évent. */
export function miniSpeaker(): THREE.Group {
  const p = new Pieces();
  p.box(0.15, 0.015, 0.13, 0x3a4050, [0, 0, 0]);
  p.soft(0.16, 0.3, 0.14, 0.012, PALETTE.woodDark, [0, 0.015, 0]);
  p.box(0.145, 0.285, 0.006, COAL, [0, 0.022, 0.07]);
  const facing = { x: Math.PI / 2 };
  for (const [y, r] of [
    [0.12, 0.055],
    [0.24, 0.022],
  ] as const) {
    p.shape(new THREE.CylinderGeometry(r, r, 0.006, 14), PALETTE.metal, [0, y, 0.075], facing);
    p.shape(new THREE.CylinderGeometry(r * 0.8, r * 0.35, 0.012, 14), BLACK, [0, y, 0.078], facing);
  }
  p.shape(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 10), 0x05070c, [0, 0.045, 0.075], facing);
  return p.build('miniSpeaker');
}

/** Coupe de hackathon : socle à deux étages, plaque gravée, coupe à anses et étoile. */
export function trophy(): THREE.Group {
  const p = new Pieces([PALETTE.gold]);
  p.box(0.16, 0.04, 0.16, PALETTE.woodDark, [0, 0, 0]);
  p.box(0.12, 0.035, 0.12, PALETTE.woodDark, [0, 0.04, 0]);
  p.box(0.07, 0.025, 0.004, PALETTE.gold, [0, 0.008, 0.081]);
  p.post(0.02, 0.03, 0.015, PALETTE.gold, [0, 0.075, 0], 12);
  p.post(0.012, 0.016, 0.06, PALETTE.gold, [0, 0.09, 0], 10);
  p.post(0.03, 0.012, 0.02, PALETTE.gold, [0, 0.15, 0], 12);
  p.post(0.08, 0.035, 0.13, PALETTE.gold, [0, 0.17, 0], 14);
  p.post(0.072, 0.072, 0.004, 0x8a6a1c, [0, 0.297, 0], 14);
  for (const side of [-1, 1])
    p.shape(
      new THREE.TorusGeometry(0.032, 0.008, 6, 10, Math.PI),
      PALETTE.gold,
      [side * 0.095, 0.24, 0],
      { z: (-side * Math.PI) / 2 },
    );
  p.shape(new THREE.OctahedronGeometry(0.022, 0).scale(1, 1, 0.3), PALETTE.white, [0, 0.22, 0.072]);
  return p.build('trophy');
}

/** Blanc des écouteurs, distinct de `PALETTE.white` : repeindre l'étui ne les colore pas. */
const EARBUD = 0xfbfbfa;
/** Embouts en silicone et grilles des micros. */
const EARBUD_TIP = 0xdfe2e7;

/**
 * Écouteur intra-auriculaire sans fil : coque arrondie, embout en silicone et tige courte
 * terminée par le micro. `turn` oriente l'embout (0 : vers -x), `lean` couche la tige.
 */
export function earbud(
  p: Pieces,
  at: readonly [number, number, number],
  turn: number,
  lean: number,
  k = 1,
): void {
  const [x, y, z] = at;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  blob(p, 0.016 * k, [1, 1.05, 0.9], EARBUD, [x, y, z], { y: turn });
  blob(p, 0.009 * k, [0.8, 1, 1], EARBUD_TIP, [
    x - 0.015 * k * cos,
    y + 0.002 * k,
    z + 0.015 * k * sin,
  ]);
  const foot: [number, number, number] = [
    x + 0.03 * k * Math.sin(lean) * sin,
    y - 0.03 * k * Math.cos(lean),
    z + 0.03 * k * Math.sin(lean) * cos,
  ];
  p.bar([x, y - 0.008 * k, z], foot, 0.0055 * k, EARBUD, 6);
  p.post(0.0055 * k, 0.0055 * k, 0.003 * k, PALETTE.chrome, foot, 6);
}

/**
 * Étui de recharge ouvert : boîtier arrondi, couvercle relevé sur sa charnière (à l'arrière),
 * berceau gris et deux écouteurs rangés, embouts vers l'intérieur, voyant de charge devant.
 * `k` = 1 : 2,3 fois la taille réelle, pour que l'étui se lise sur un bureau vu de loin.
 */
export function earbudsCase(
  p: Pieces,
  at: readonly [number, number, number],
  k = 1,
  caseColor: number = PALETTE.white,
): void {
  const [x, y, z] = at;
  const w = 0.14 * k;
  const h = 0.05 * k;
  const d = 0.1 * k;
  p.soft(w, h, d, 0.02 * k, caseColor, [x, y, z]);
  // Berceau intérieur et ligne de jonction du couvercle.
  p.soft(w * 0.84, 0.004 * k, d * 0.72, 0.002 * k, EARBUD_TIP, [x, y + h - 0.003 * k, z]);
  // Couvercle ouvert, presque à la verticale, et sa face intérieure plus claire.
  const back = z - d / 2 + 0.008 * k;
  p.soft(w, d, 0.016 * k, 0.008 * k, caseColor, [x, y + h - 0.008 * k, back], { x: -0.32 });
  p.box(w * 0.8, d * 0.75, 0.004 * k, EARBUD_TIP, [x, y + h - 0.002 * k, back + 0.009 * k], {
    x: -0.32,
  });
  // Les deux écouteurs dans leur logement, tiges enfoncées.
  for (const side of [-1, 1])
    earbud(
      p,
      [x + side * 0.03 * k, y + h + 0.012 * k, z + 0.004 * k],
      side > 0 ? 0 : Math.PI,
      0.15,
      k,
    );
  p.light(0.008 * k, 0.005 * k, 0.003 * k, 0x7cf08a, [x, y + h * 0.45, z + d / 2]);
}

/** Écouteurs sans fil à réduction de bruit : étui ouvert, et un écouteur sorti posé à côté. */
export function deskEarbuds(): THREE.Group {
  const p = new Pieces([PALETTE.white]);
  earbudsCase(p, [-0.03, 0, -0.01]);
  earbud(p, [0.1, 0.014, 0.05], 0.6, 1.35);
  return p.build('deskEarbuds');
}

/** Grille-pain chromé : deux fentes, deux tartines qui dépassent, levier et molette. */
export function toaster(): THREE.Group {
  const p = new Pieces([PALETTE.chrome]);
  p.box(0.25, 0.015, 0.14, COAL, [0, 0, 0]);
  p.soft(0.26, 0.16, 0.15, 0.035, PALETTE.chrome, [0, 0.012, 0]);
  for (const z of [-0.03, 0.03]) {
    p.box(0.18, 0.004, 0.025, COAL, [0, 0.171, z]);
    p.soft(0.15, 0.06, 0.016, 0.01, 0xd9a35f, [0, 0.14, z]);
    p.box(0.13, 0.035, 0.018, 0x9a6233, [0, 0.165, z]);
  }
  p.box(0.012, 0.04, 0.03, COAL, [0.135, 0.11, 0]);
  p.shape(new THREE.CylinderGeometry(0.015, 0.015, 0.012, 10), COAL, [0.05, 0.06, 0.08], {
    x: Math.PI / 2,
  });
  p.light(0.01, 0.01, 0.003, PALETTE.orange, [-0.07, 0.05, 0.076]);
  return p.build('toaster');
}

/** Blender : socle à boutons, bol en verre plein d'un smoothie, couvercle et poignée. */
export function blender(): THREE.Group {
  const p = new Pieces([PALETTE.red]);
  p.soft(0.16, 0.1, 0.15, 0.025, PALETTE.red, [0, 0, 0]);
  for (let i = 0; i < 3; i += 1) p.box(0.022, 0.014, 0.006, COAL, [-0.03 + i * 0.03, 0.04, 0.075]);
  p.light(0.008, 0.008, 0.003, PALETTE.green, [0.06, 0.07, 0.076]);
  p.post(0.055, 0.06, 0.02, COAL, [0, 0.1, 0], 12);
  p.post(0.05, 0.052, 0.11, PALETTE.pink, [0, 0.12, 0], 12);
  p.post(0.068, 0.055, 0.2, glass, [0, 0.12, 0], 12);
  p.post(0.07, 0.07, 0.025, COAL, [0, 0.32, 0], 12);
  p.post(0.02, 0.02, 0.012, COAL, [0, 0.345, 0], 8);
  p.box(0.02, 0.15, 0.03, COAL, [0.08, 0.15, 0]);
  return p.build('blender');
}
