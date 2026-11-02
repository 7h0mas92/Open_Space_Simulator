/**
 * Salle des serveurs en formes Three.js : le local (sol technique, cloisons vitrées, porte à
 * badge, chemin de câbles) et les treize équipements qu'on y installe (baies de serveurs, lames,
 * GPU, switch, box fibre, trois climatisations, supervision, onduleur, sauvegardes, pare-feu,
 * extinction au gaz).
 * Aucun de ces modèles n'existe dans les packs Kenney (voir `assetManifest.ts`).
 *
 * Chaque équipement est une armoire d'environ 0,55 x 0,65 posée sur le sol technique, façade
 * vers +z. Les vitres des cloisons ne sont pas cliquables (`office.ts`) : on sélectionne le
 * matériel à travers elles.
 */
import * as THREE from 'three';
import { partitionGlass } from './partitions';
import { Pieces } from './pieces';
import { PALETTE } from './primitives';

/** Hauteur du sol technique : le matériel se pose dessus (voir `RAISED_FLOOR` du catalogue). */
const FLOOR = 0.06;
/** Hauteur des cloisons vitrées du local. */
const WALL = 2.1;
const FRAME = 0x2b3040;
/** Montants et rails aluminium des cloisons vitrées du local. */
const ALU = 0xb8bfcc;
const RACK = 0x3a4156;
const RACK_DARK = 0x22262f;
const FACE = 0x6b7389;
const TILE = 0xc3c8d1;
const SEAM = 0x8d93a0;
/** Câble optique : toujours jaune, comme dans les vraies baies. */
const FIBRE = 0xf5c400;
/** Largeur et profondeur d'une armoire. */
const W = 0.55;
const D = 0.65;

/** Vitre fumée des portes d'armoire : on devine les voyants derrière. */
const smoked = new THREE.MeshStandardMaterial({
  color: 0x3a4660,
  transparent: true,
  opacity: 0.22,
  roughness: 0.1,
  metalness: 0.3,
  depthWrite: false,
});
smoked.name = 'smoked';

// --- Le local ------------------------------------------------------------------------------

/**
 * Local vitré de `w` x `d` cases : sol technique en dalles, cloisons vitrées sur montants,
 * porte vitrée à droite de la façade avec lecteur de badge et panneau « accès réservé »,
 * chemin de câbles jaune en haut du mur du fond.
 */
function serverRoomShell(w: number, d: number, name: string): THREE.Group {
  const p = new Pieces();
  const hw = w / 2 - 0.03;
  const hd = d / 2 - 0.03;
  // Sol technique : dalles de 50 cm, joints sombres, dalles perforées devant les baies.
  p.box(w - 0.06, FLOOR, d - 0.06, TILE, [0, 0, 0]);
  for (let x = -hw + 0.5; x < hw; x += 0.5) p.box(0.012, 0.003, d - 0.08, SEAM, [x, FLOOR, 0]);
  for (let z = -hd + 0.5; z < hd; z += 0.5) p.box(w - 0.08, 0.003, 0.012, SEAM, [0, FLOOR, z]);
  for (let x = -hw + 0.25; x < hw; x += 1) {
    p.box(0.44, 0.002, 0.44, 0x9aa1ae, [x, FLOOR, hd - 0.3]);
    for (let i = 0; i < 4; i += 1)
      p.box(0.36, 0.004, 0.02, 0x7d8494, [x, FLOOR, hd - 0.45 + i * 0.1]);
  }
  // Cloisons : rail bas, rail haut, montants aux angles et tous les mètres, vitres.
  const sides: readonly {
    readonly length: number;
    readonly at: readonly [number, number];
    readonly alongX: boolean;
  }[] = [
    { length: w, at: [0, -hd], alongX: true },
    { length: w, at: [0, hd], alongX: true },
    { length: d, at: [-hw, 0], alongX: false },
    { length: d, at: [hw, 0], alongX: false },
  ];
  const doorX = hw - 0.55;
  for (const side of sides) {
    const [cx, cz] = side.at;
    const size = (along: number, across: number) =>
      side.alongX ? ([along, across] as const) : ([across, along] as const);
    const [rw, rd] = size(side.length - 0.02, 0.06);
    p.box(rw, 0.1, rd, ALU, [cx, 0, cz]);
    p.box(rw, 0.06, rd, ALU, [cx, WALL - 0.06, cz]);
    const front = side.alongX && cz > 0;
    // La façade laisse la place de la porte (0,8 de large, à droite).
    const panes: readonly (readonly [number, number])[] = front
      ? [
          [-side.length / 2 + 0.03, doorX - 0.42],
          [doorX + 0.42, side.length / 2 - 0.03],
        ]
      : [[-side.length / 2 + 0.03, side.length / 2 - 0.03]];
    for (const [from, to] of panes) {
      if (to - from < 0.02) continue;
      const [gw, gd] = size(to - from, 0.02);
      const mid = (from + to) / 2;
      p.box(gw, WALL - 0.16, gd, partitionGlass, side.alongX ? [mid, 0.1, cz] : [cx, 0.1, mid]);
    }
    // Montants : aux deux bouts et environ tous les mètres.
    const posts = Math.max(1, Math.round(side.length));
    for (let i = 0; i <= posts; i += 1) {
      const t = -side.length / 2 + 0.03 + (i * (side.length - 0.06)) / posts;
      if (front && Math.abs(t - doorX) < 0.45) continue;
      p.box(0.05, WALL, 0.05, ALU, side.alongX ? [t, 0, cz] : [cx, 0, t]);
    }
  }
  // Porte vitrée : dormant, ouvrant, poignée, lecteur de badge et panneau d'avertissement.
  for (const x of [doorX - 0.42, doorX + 0.42]) p.box(0.06, WALL, 0.07, ALU, [x, 0, hd]);
  p.box(0.78, 0.04, 0.05, ALU, [doorX, 0.06, hd]);
  p.box(0.74, 1.86, 0.02, partitionGlass, [doorX, 0.12, hd]);
  p.box(0.78, 0.05, 0.05, ALU, [doorX, 1.98, hd]);
  p.box(0.025, 0.4, 0.03, PALETTE.chrome, [doorX - 0.3, 0.85, hd + 0.04]);
  p.box(0.08, 0.12, 0.025, 0x1c1f29, [doorX - 0.5, 1.05, hd + 0.04]);
  p.light(0.02, 0.02, 0.006, PALETTE.green, [doorX - 0.5, 1.13, hd + 0.055]);
  p.light(0.05, 0.035, 0.006, 0x7cc8f4, [doorX - 0.5, 1.07, hd + 0.055]);
  p.box(0.46, 0.14, 0.012, PALETTE.yellow, [doorX, 2.02, hd + 0.035]);
  for (let i = 0; i < 4; i += 1)
    p.box(0.06, 0.03, 0.004, 0x1c1f29, [doorX - 0.15 + i * 0.1, 2.075, hd + 0.042]);
  // Chemin de câbles jaune en haut du mur du fond, câbles en nappe.
  p.box(w - 0.3, 0.03, 0.2, PALETTE.yellow, [0, WALL - 0.32, -hd + 0.16]);
  for (const z of [-hd + 0.08, -hd + 0.24])
    p.box(w - 0.3, 0.06, 0.012, PALETTE.yellow, [0, WALL - 0.32, z]);
  for (const [z, color] of [
    [-hd + 0.12, PALETTE.blue],
    [-hd + 0.16, FIBRE],
    [-hd + 0.2, PALETTE.red],
  ] as const)
    p.bar([-w / 2 + 0.2, WALL - 0.27, z], [w / 2 - 0.2, WALL - 0.27, z], 0.018, color, 5);
  // Gaine de la fibre qui sort du sol dans l'angle du fond, à gauche.
  p.bar(
    [-hw + 0.12, FLOOR, -hd + 0.12],
    [-hw + 0.12, WALL - 0.3, -hd + 0.12],
    0.03,
    PALETTE.orange,
    6,
  );
  return p.build(name);
}

export function serverCloset(): THREE.Group {
  return serverRoomShell(2, 2, 'serverCloset');
}

export function serverRoom(): THREE.Group {
  return serverRoomShell(4, 3, 'serverRoom');
}

// --- Le matériel ---------------------------------------------------------------------------

/** Armoire de `h` de haut : socle, flancs, dos, toit ventilé et montants avant à rails. */
function cabinet(p: Pieces, h: number, color: number = RACK, w = W, d = D): void {
  p.box(w, 0.05, d, RACK_DARK, [0, 0, 0]);
  for (const x of [-w / 2 + 0.015, w / 2 - 0.015]) p.box(0.03, h - 0.09, d, color, [x, 0.05, 0]);
  p.box(w - 0.04, h - 0.09, 0.02, color, [0, 0.05, -d / 2 + 0.01]);
  p.box(w, 0.04, d, color, [0, h - 0.04, 0]);
  for (let i = 0; i < 3; i += 1) p.box(w - 0.16, 0.01, 0.04, RACK_DARK, [0, h, -0.15 + i * 0.15]);
  for (const x of [-w / 2 + 0.045, w / 2 - 0.045]) {
    p.box(0.03, h - 0.09, 0.025, FRAME, [x, 0.05, d / 2 - 0.03]);
    for (let y = 0.12; y < h - 0.1; y += 0.09)
      p.box(0.01, 0.01, 0.004, RACK_DARK, [x, y, d / 2 - 0.016]);
  }
}

/** Serveur rack de `h` de haut à la hauteur `y` : façade, grille, voyants et poignées. */
function unit(
  p: Pieces,
  y: number,
  h: number,
  leds: readonly number[],
  face: number = FACE,
  w = W,
): void {
  const z = D / 2 - 0.02;
  p.box(w - 0.1, h - 0.008, 0.03, face, [0, y, z - 0.015]);
  for (let i = 0; i < 4; i += 1)
    p.box(0.04, h * 0.55, 0.006, 0x3a4055, [-w / 2 + 0.12 + i * 0.05, y + h * 0.2, z]);
  leds.forEach((color, i) => p.light(0.022, 0.016, 0.008, color, [0.08 + i * 0.04, y + h / 2, z]));
  for (const x of [-w / 2 + 0.07, w / 2 - 0.07])
    p.box(0.012, h * 0.6, 0.02, PALETTE.chrome, [x, y + h * 0.2, z + 0.01]);
}

/** Porte vitrée fumée d'armoire, avec sa poignée. */
function smokedDoor(p: Pieces, h: number, w = W): void {
  p.box(w - 0.02, h - 0.1, 0.012, smoked, [0, 0.06, D / 2 + 0.005]);
  p.box(0.015, 0.22, 0.02, PALETTE.chrome, [w / 2 - 0.06, h * 0.5, D / 2 + 0.02]);
}

/** Baie de serveurs 1U : six serveurs aux voyants verts, de l'espace libre en bas, porte fumée. */
export function rackServer(): THREE.Group {
  const p = new Pieces();
  const h = 1.9;
  cabinet(p, h);
  for (let i = 0; i < 6; i += 1) {
    const leds = [i === 3 ? PALETTE.yellow : PALETTE.green, PALETTE.green, PALETTE.blue];
    unit(p, 0.62 + i * 0.17, 0.15, leds);
  }
  // Panneau de brassage en haut, quelques câbles bleus.
  p.box(W - 0.1, 0.06, 0.03, RACK_DARK, [0, 1.68, D / 2 - 0.035]);
  for (let i = 0; i < 6; i += 1)
    p.box(0.025, 0.025, 0.01, PALETTE.blue, [-0.15 + i * 0.06, 1.7, D / 2 - 0.014]);
  // Obturateurs en bas.
  for (let i = 0; i < 3; i += 1)
    p.box(W - 0.1, 0.14, 0.02, RACK_DARK, [0, 0.12 + i * 0.16, D / 2 - 0.03]);
  smokedDoor(p, h);
  return p.build('rackServer');
}

/** Châssis de serveurs lames : deux châssis de seize lames verticales aux voyants bleus. */
export function bladeServer(): THREE.Group {
  const p = new Pieces();
  const h = 1.9;
  cabinet(p, h);
  for (const base of [0.15, 0.95]) {
    p.box(W - 0.08, 0.72, 0.03, RACK_DARK, [0, base, D / 2 - 0.05]);
    for (let i = 0; i < 8; i += 1) {
      const x = -W / 2 + 0.08 + i * 0.056;
      for (const [y, hh] of [
        [base + 0.03, 0.32],
        [base + 0.37, 0.32],
      ] as const) {
        p.box(0.048, hh, 0.02, FACE, [x, y, D / 2 - 0.03]);
        p.light(0.014, 0.014, 0.006, i % 5 === 2 ? PALETTE.yellow : PALETTE.blue, [
          x,
          y + hh - 0.04,
          D / 2 - 0.016,
        ]);
      }
    }
  }
  // Modules d'alimentation sous chaque châssis.
  p.box(W - 0.1, 0.06, 0.02, 0x5a6178, [0, 0.89, D / 2 - 0.025]);
  for (let i = 0; i < 4; i += 1)
    p.light(0.02, 0.012, 0.006, PALETTE.green, [-0.15 + i * 0.1, 0.91, D / 2 - 0.012]);
  return p.build('bladeServer');
}

/** Serveur GPU : quatre serveurs 4U aux ventilateurs verts lumineux, bandeau vert. */
export function gpuServer(): THREE.Group {
  const p = new Pieces();
  const h = 1.9;
  cabinet(p, h, 0x1d2027);
  for (let i = 0; i < 4; i += 1) {
    const y = 0.14 + i * 0.4;
    const z = D / 2 - 0.02;
    p.box(W - 0.09, 0.36, 0.03, 0x2e3240, [0, y, z - 0.015]);
    for (const x of [-0.13, 0, 0.13]) {
      p.post(0.05, 0.05, 0.01, 0x15171c, [x, y + 0.2, z + 0.004], 12);
      p.glow(new THREE.TorusGeometry(0.048, 0.007, 4, 16), 0x76e04a, [x, y + 0.2, z + 0.012]);
      p.box(0.012, 0.08, 0.004, 0x3a4055, [x, y + 0.16, z + 0.014]);
    }
    p.light(W - 0.12, 0.012, 0.006, 0x76e04a, [0, y + 0.05, z + 0.004]);
  }
  return p.build('gpuServer');
}

/** Switch réseau : armoire ouverte à deux montants, deux switchs 48 ports et leurs câbles. */
export function networkSwitch(): THREE.Group {
  const p = new Pieces();
  const h = 1.6;
  // Armoire ouverte : socle, deux montants perforés, traverse en haut.
  p.box(W, 0.05, D * 0.7, RACK_DARK, [0, 0, 0]);
  for (const x of [-W / 2 + 0.03, W / 2 - 0.03]) {
    p.box(0.05, h - 0.05, 0.08, FRAME, [x, 0.05, 0]);
    for (let y = 0.12; y < h - 0.08; y += 0.08)
      p.box(0.012, 0.012, 0.004, RACK_DARK, [x, y, 0.042]);
  }
  p.box(W, 0.04, 0.08, FRAME, [0, h - 0.04, 0]);
  const cables = [
    PALETTE.blue,
    PALETTE.yellow,
    PALETTE.red,
    PALETTE.green,
    PALETTE.white,
    PALETTE.purple,
  ];
  for (const [y, hasCables] of [
    [1.25, true],
    [1.05, true],
    [0.85, false],
  ] as const) {
    p.box(W - 0.06, 0.06, 0.3, 0x2f3446, [0, y, -0.1]);
    // 24 ports par rangée, sur deux rangées, et leurs voyants.
    for (let row = 0; row < 2; row += 1)
      for (let i = 0; i < 12; i += 1) {
        const x = -0.2 + i * 0.033;
        p.box(0.022, 0.016, 0.006, 0x15171c, [x, y + 0.01 + row * 0.025, 0.052]);
        if ((i + row) % 3 !== 0)
          p.light(0.006, 0.006, 0.004, PALETTE.green, [x + 0.009, y + 0.03 + row * 0.025, 0.056]);
      }
    if (!hasCables) continue;
    // Câbles de couleur en boucles vers le passe-câbles de droite.
    cables.forEach((color, i) => {
      const x = -0.19 + i * 0.07;
      const drop = y - 0.08 - (i % 3) * 0.02;
      p.bar([x, y + 0.02, 0.06], [x, drop, 0.09], 0.007, color, 4);
      p.bar([x, drop, 0.09], [W / 2 - 0.05, drop - 0.02, 0.08], 0.007, color, 4);
    });
  }
  // Passe-câbles vertical et goulotte qui descend dans le faux plancher.
  p.box(0.05, h - 0.2, 0.06, 0x3a4055, [W / 2 - 0.05, 0.1, 0.09]);
  p.box(W - 0.1, 0.04, 0.03, RACK_DARK, [0, 1.4, 0.05]);
  return p.build('networkSwitch');
}

/** Box fibre pro : petit coffret, boîtier optique et routeur aux antennes, fibres jaunes. */
export function fibreRouter(): THREE.Group {
  const p = new Pieces();
  const h = 1.2;
  cabinet(p, h, 0xd8dbe2, W, 0.45);
  const z = 0.45 / 2 - 0.02;
  // Tiroir optique : jarretières jaunes qui sortent en boucle.
  p.box(W - 0.1, 0.1, 0.03, 0xb9bec8, [0, 0.82, z - 0.015]);
  for (let i = 0; i < 6; i += 1) {
    const x = -0.16 + i * 0.065;
    p.box(0.03, 0.02, 0.01, 0x2a6fdb, [x, 0.86, z + 0.004]);
    p.bar([x, 0.87, z + 0.01], [x + 0.02, 0.74, z + 0.05], 0.006, FIBRE, 4);
  }
  // Boîtier de terminaison optique (ONT) : voyants « PON » et « LOS ».
  p.box(0.3, 0.05, 0.2, PALETTE.white, [-0.05, 0.55, 0]);
  p.light(0.02, 0.012, 0.005, PALETTE.green, [-0.15, 0.575, 0.1]);
  p.light(0.02, 0.012, 0.005, PALETTE.green, [-0.11, 0.575, 0.1]);
  p.light(0.02, 0.012, 0.005, 0x7cc8f4, [-0.07, 0.575, 0.1]);
  // Routeur noir avec ses antennes, voyants bleus.
  p.box(0.4, 0.06, 0.26, 0x1c1f29, [0, 0.32, 0]);
  for (let i = 0; i < 6; i += 1)
    p.light(0.016, 0.01, 0.005, 0x4fa3ff, [-0.15 + i * 0.05, 0.36, 0.131]);
  for (const x of [-0.17, -0.06, 0.06, 0.17])
    p.box(0.018, 0.22, 0.012, 0x1c1f29, [x, 0.38, -0.1], { x: -0.15 });
  // La fibre arrive par le toit, gaine orange.
  p.bar([0.18, h, -0.12], [0.18, h + 0.4, -0.12], 0.02, PALETTE.orange, 6);
  return p.build('fibreRouter');
}

/** Climatisation de précision : grande armoire blanche, grilles, écran de contrôle, souffleurs. */
export function precisionCooling(): THREE.Group {
  const p = new Pieces();
  const h = 1.95;
  const w = 0.6;
  p.box(w, 0.06, D, RACK_DARK, [0, 0, 0]);
  p.box(w, h - 0.06, D, 0xeef0f2, [0, 0.06, 0]);
  // Grilles d'aspiration en façade, à lames horizontales.
  for (const [y0, rows] of [
    [0.15, 8],
    [1.2, 4],
  ] as const) {
    p.box(w - 0.12, rows * 0.06 + 0.02, 0.01, 0xc8ccd3, [0, y0, D / 2 + 0.002]);
    for (let i = 0; i < rows; i += 1)
      p.box(w - 0.14, 0.012, 0.012, 0x9aa1ae, [0, y0 + 0.03 + i * 0.06, D / 2 + 0.008]);
  }
  // Écran de contrôle : 21 °C en bleu, voyant vert.
  p.box(0.22, 0.14, 0.012, 0x1c1f29, [0, 0.85, D / 2 + 0.004]);
  p.light(0.14, 0.05, 0.004, 0x7cc8f4, [-0.02, 0.9, D / 2 + 0.012]);
  p.light(0.02, 0.02, 0.004, PALETTE.green, [0.08, 0.93, D / 2 + 0.012]);
  // Souffleurs sur le toit.
  for (const x of [-0.14, 0.14]) {
    p.post(0.1, 0.11, 0.05, 0xc8ccd3, [x, h, 0], 12);
    p.post(0.07, 0.07, 0.012, 0x7d8494, [x, h + 0.05, 0], 12);
  }
  // Bandeau bleu « froid » sur le flanc.
  p.box(0.004, 0.06, D - 0.1, PALETTE.blue, [w / 2 + 0.002, h - 0.2, 0]);
  return p.build('precisionCooling');
}

/** Climatiseur mural : unité intérieure blanche à volet sur un mât, groupe extérieur au sol. */
export function splitAc(): THREE.Group {
  const p = new Pieces();
  // Groupe extérieur au sol : caisson gris, grille ronde du ventilateur.
  p.box(W, 0.42, 0.3, 0xd9dce1, [0, 0, -0.12]);
  p.shape(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 16), 0x7d8494, [-0.08, 0.21, 0.035], {
    x: Math.PI / 2,
  });
  for (let i = 0; i < 4; i += 1)
    p.box(0.28, 0.008, 0.01, 0x5b6170, [-0.08, 0.13 + i * 0.05, 0.045]);
  p.box(0.1, 0.18, 0.012, 0xb8bdc6, [0.17, 0.12, 0.035]);
  // Mât et tuyaux de cuivre isolés qui montent vers l'unité intérieure.
  p.box(0.05, 1.4, 0.05, FRAME, [0.2, 0.42, -0.22]);
  p.bar([0.14, 0.35, -0.22], [0.14, 1.62, -0.22], 0.018, 0xf2f2f2, 6);
  // Unité intérieure : coque blanche, volet sombre, voyant bleu et affichage.
  p.box(W + 0.05, 0.26, 0.2, 0xf4f5f7, [0, 1.62, -0.15]);
  p.box(W - 0.02, 0.03, 0.04, 0x9aa1ae, [0, 1.63, -0.04]);
  p.box(W - 0.06, 0.012, 0.01, 0xd9dce1, [0, 1.72, -0.048]);
  p.light(0.05, 0.014, 0.004, 0x7cc8f4, [0.18, 1.8, -0.048]);
  p.light(0.012, 0.012, 0.004, PALETTE.green, [0.12, 1.8, -0.048]);
  return p.build('splitAc');
}

/** Climatisation en rangée : armoire noire perforée, trois ventilateurs, écran bleu. */
export function inrowCooling(): THREE.Group {
  const p = new Pieces();
  const h = 1.95;
  p.box(W, 0.06, D, RACK_DARK, [0, 0, 0]);
  p.box(W, h - 0.06, D, 0x2a2e38, [0, 0.06, 0]);
  const z = D / 2 + 0.003;
  // Porte perforée : une grille de petits trous plus sombres.
  for (let row = 0; row < 14; row += 1)
    for (let col = 0; col < 6; col += 1)
      p.box(0.035, 0.035, 0.004, 0x15171c, [-0.19 + col * 0.076, 0.2 + row * 0.08, z]);
  // Trois ventilateurs ronds derrière la grille, moyeu bleu.
  for (let i = 0; i < 3; i += 1) {
    const y = 0.45 + i * 0.42;
    p.shape(new THREE.CylinderGeometry(0.15, 0.15, 0.01, 16), 0x3a4156, [0, y, z + 0.002], {
      x: Math.PI / 2,
    });
    p.light(0.04, 0.04, 0.004, 0x7cc8f4, [0, y, z + 0.012]);
  }
  // Écran de contrôle et bandeau bleu « froid ».
  p.box(0.2, 0.09, 0.01, 0x15171c, [0, h - 0.17, z + 0.004]);
  p.light(0.15, 0.04, 0.004, 0x7cc8f4, [0, h - 0.16, z + 0.012]);
  p.light(W - 0.06, 0.02, 0.004, PALETTE.blue, [0, h - 0.06, z + 0.004]);
  return p.build('inrowCooling');
}

/** Supervision : pupitre, écran de courbes de température, sonde sur câble et gyrophare. */
export function serverMonitoring(): THREE.Group {
  const p = new Pieces();
  // Pied et pupitre incliné.
  p.box(0.36, 0.04, 0.3, FRAME, [0, 0, 0]);
  p.box(0.06, 0.95, 0.06, FRAME, [0, 0.04, -0.04]);
  p.box(0.44, 0.03, 0.26, RACK, [0, 0.98, 0.0]);
  // Écran : fond sombre, courbes de température (bleu, orange, rouge) et seuils.
  p.box(0.5, 0.32, 0.03, 0x1c1f29, [0, 1.06, -0.1]);
  p.box(0.46, 0.27, 0.004, 0x0e1016, [0, 1.085, -0.083]);
  p.light(0.42, 0.004, 0.003, PALETTE.red, [0, 1.3, -0.08]);
  p.light(0.42, 0.004, 0.003, PALETTE.orange, [0, 1.24, -0.08]);
  const curves: readonly [number, number][] = [
    [0x7cc8f4, 1.13],
    [PALETTE.green, 1.16],
    [PALETTE.yellow, 1.2],
  ];
  for (const [color, y] of curves)
    for (let i = 0; i < 7; i += 1)
      p.light(0.055, 0.008, 0.003, color, [-0.18 + i * 0.06, y + ((i * 7) % 5) * 0.008, -0.079]);
  // Sonde de température au bout d'un câble, posée sur le pupitre.
  p.bar([0.18, 1.0, 0.0], [0.15, 1.02, 0.1], 0.006, 0x15171c, 4);
  p.box(0.04, 0.02, 0.06, PALETTE.white, [0.15, 1.0, 0.1]);
  // Gyrophare d'alerte sur le haut de l'écran.
  p.post(0.035, 0.035, 0.05, PALETTE.orange, [0.2, 1.38, -0.1], 10);
  return p.build('serverMonitoring');
}

/** Onduleur : armoire noire trapue, écran vert, tiroirs de batteries. */
export function upsUnit(): THREE.Group {
  const p = new Pieces();
  const h = 1.05;
  p.box(W, 0.05, D, RACK_DARK, [0, 0, 0]);
  p.box(W, h - 0.05, D, 0x22252e, [0, 0.05, 0]);
  const z = D / 2;
  // Écran et boutons.
  p.box(0.2, 0.1, 0.01, 0x15171c, [0, h - 0.22, z + 0.002]);
  p.light(0.16, 0.06, 0.004, 0x76e04a, [0, h - 0.2, z + 0.01]);
  for (let i = 0; i < 3; i += 1)
    p.post(0.012, 0.012, 0.01, PALETTE.metal, [-0.05 + i * 0.05, h - 0.27, z + 0.004], 8);
  // Tiroirs de batteries, poignées et voyants de charge.
  for (let i = 0; i < 4; i += 1) {
    const y = 0.1 + i * 0.15;
    p.box(W - 0.08, 0.13, 0.012, 0x2e3240, [0, y, z + 0.002]);
    p.box(0.14, 0.02, 0.02, PALETTE.metal, [0, y + 0.08, z + 0.012]);
    p.light(0.02, 0.01, 0.004, PALETTE.green, [0.2, y + 0.06, z + 0.01]);
  }
  // Gros câble d'alimentation vers le sol.
  p.bar([0.2, 0.3, -D / 2], [0.2, 0.0, -D / 2 - 0.06], 0.02, 0x15171c, 6);
  return p.build('upsUnit');
}

/** Baie de sauvegarde : tiroirs de disques aux voyants clignotants et robot de bandes. */
export function backupNas(): THREE.Group {
  const p = new Pieces();
  const h = 1.4;
  cabinet(p, h);
  const z = D / 2 - 0.02;
  // Trois tiroirs de douze disques.
  for (let drawer = 0; drawer < 3; drawer += 1) {
    const y = 0.62 + drawer * 0.22;
    p.box(W - 0.09, 0.2, 0.03, RACK_DARK, [0, y, z - 0.015]);
    for (let i = 0; i < 6; i += 1)
      for (let row = 0; row < 2; row += 1) {
        const x = -0.19 + i * 0.076;
        p.box(0.07, 0.085, 0.012, 0x6b7287, [x, y + 0.01 + row * 0.095, z + 0.002]);
        const led = (i + row + drawer) % 4 === 0 ? PALETTE.orange : PALETTE.green;
        p.light(0.01, 0.01, 0.004, led, [x + 0.025, y + 0.075 + row * 0.095, z + 0.01]);
      }
  }
  // Robot de bandes en bas : fenêtre, cartouches de couleur.
  p.box(W - 0.09, 0.42, 0.03, 0x5a6178, [0, 0.12, z - 0.015]);
  p.box(0.3, 0.16, 0.006, 0x1c1f29, [-0.05, 0.32, z + 0.002]);
  for (let i = 0; i < 7; i += 1)
    p.box(
      0.03,
      0.1,
      0.004,
      [PALETTE.blue, PALETTE.yellow, PALETTE.red, PALETTE.green][i % 4] ?? PALETTE.blue,
      [-0.17 + i * 0.04, 0.34, z + 0.006],
    );
  p.light(0.03, 0.012, 0.004, 0x7cc8f4, [0.18, 0.45, z + 0.004]);
  return p.build('backupNas');
}

/** Pare-feu : armoire à bandeau rouge, trois boîtiers aux voyants orange, cadenas. */
export function firewallUnit(): THREE.Group {
  const p = new Pieces();
  const h = 1.2;
  cabinet(p, h);
  const z = D / 2 - 0.02;
  for (let i = 0; i < 3; i += 1) {
    const y = 0.5 + i * 0.18;
    p.box(W - 0.09, 0.14, 0.03, 0x8a2f2a, [0, y, z - 0.015]);
    for (let j = 0; j < 8; j += 1)
      p.box(0.022, 0.016, 0.006, 0x15171c, [-0.18 + j * 0.03, y + 0.06, z + 0.002]);
    p.light(0.02, 0.014, 0.006, PALETTE.orange, [0.12, y + 0.07, z + 0.004]);
    p.light(0.02, 0.014, 0.006, i === 1 ? PALETTE.red : PALETTE.green, [0.16, y + 0.07, z + 0.004]);
  }
  // Bandeau rouge en haut et cadenas sur la porte du bas.
  p.light(W - 0.08, 0.025, 0.006, PALETTE.red, [0, h - 0.12, z + 0.004]);
  p.box(W - 0.09, 0.32, 0.02, RACK_DARK, [0, 0.12, z - 0.01]);
  p.box(0.08, 0.07, 0.025, PALETTE.gold, [0, 0.22, z + 0.012]);
  p.shape(new THREE.TorusGeometry(0.03, 0.008, 4, 10, Math.PI), PALETTE.chrome, [
    0,
    0.29,
    z + 0.012,
  ]);
  return p.build('firewallUnit');
}

/** Extinction automatique au gaz : deux bouteilles rouges, manomètres, tuyauterie et panneau. */
export function fireSuppression(): THREE.Group {
  const p = new Pieces();
  // Support métallique et sangles.
  p.box(W, 0.04, 0.4, FRAME, [0, 0, -0.05]);
  p.box(W, 0.06, 0.03, FRAME, [0, 1.0, -0.22]);
  for (const x of [-0.13, 0.13]) {
    p.post(0.11, 0.11, 1.15, 0xc8322b, [x, 0.04, -0.05], 12);
    p.shape(new THREE.SphereGeometry(0.11, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xc8322b, [
      x,
      1.19,
      -0.05,
    ]);
    p.post(0.03, 0.03, 0.08, PALETTE.chrome, [x, 1.28, -0.05], 8);
    // Manomètre : cadran blanc, aiguille dans le vert.
    p.post(0.035, 0.035, 0.015, PALETTE.white, [x + 0.05, 1.33, -0.05], 12);
    p.light(0.025, 0.004, 0.004, PALETTE.green, [x + 0.05, 1.345, -0.035]);
    p.box(0.14, 0.03, 0.005, PALETTE.white, [x, 0.75, 0.065]);
    p.box(0.22, 0.04, 0.22, FRAME, [x, 0.6, -0.05]);
  }
  // Collecteur et tuyau qui monte vers les buses du plafond.
  p.bar([-0.13, 1.36, -0.05], [0.13, 1.36, -0.05], 0.02, PALETTE.chrome, 6);
  p.bar([0, 1.36, -0.05], [0, 1.7, -0.05], 0.02, PALETTE.red, 6);
  // Panneau « extinction automatique » et boîtier de déclenchement.
  p.box(0.3, 0.16, 0.012, PALETTE.red, [0, 0.12, 0.17]);
  p.box(0.22, 0.03, 0.004, PALETTE.white, [0, 0.2, 0.178]);
  p.box(0.1, 0.1, 0.04, PALETTE.yellow, [0.2, 0.75, 0.12]);
  p.light(0.03, 0.02, 0.004, PALETTE.red, [0.2, 0.8, 0.142]);
  return p.build('fireSuppression');
}
