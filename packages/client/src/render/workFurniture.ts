/**
 * Mobilier de travail détaillé, en formes Three.js : bureau de dev, bureau du garage sur
 * tréteaux, bureau debout motorisé, chaises de bureau, portant de casques, meuble télé et baie
 * de serveurs.
 *
 * Les modèles Kenney correspondants sont d'un seul bloc ; ces versions gardent leurs dimensions
 * (hauteur des plateaux, emprise) pour que l'écran, le clavier, la souris, les accessoires et les
 * personnages restent à leur place, mais ajoutent ce qui rend un meuble crédible : tiroirs et
 * poignées, piètement métallique, passe-câbles, roulettes, coussins, vérin…
 * Chaque meuble est fusionné par matériau (voir `pieces.ts`) et regarde vers +z.
 */
import type * as THREE from 'three';
import { Pieces } from './pieces';
import { PALETTE } from './primitives';

/** Plateau du bureau de dev (le modèle Kenney `desk`) : 1,47 x 0,78, dessus à 0,77. */
const DESK = { width: 1.46, depth: 0.78, top: 0.769, board: 0.04 } as const;

export function officeDesk(): THREE.Group {
  const p = new Pieces([PALETTE.wood, PALETTE.woodDark]);
  const { width, depth, top, board } = DESK;
  const under = top - board;
  // Plateau aux bords adoucis.
  p.soft(width, board, depth, 0.012, PALETTE.wood, [0, under, 0]);
  // Piètement en acier à gauche : deux pieds carrés reliés par un patin au sol et une traverse.
  const legX = -width / 2 + 0.06;
  for (const z of [-depth / 2 + 0.06, depth / 2 - 0.06])
    p.box(0.045, under, 0.045, PALETTE.dark, [legX, 0, z]);
  p.box(0.05, 0.03, depth - 0.06, PALETTE.dark, [legX, 0, 0]);
  p.box(0.04, 0.04, depth - 0.1, PALETTE.dark, [legX, under - 0.06, 0]);
  // Caisson à trois tiroirs à droite, poignées chromées et socle en retrait.
  const caseW = 0.42;
  const caseX = width / 2 - caseW / 2 - 0.02;
  const caseD = depth - 0.06;
  p.box(caseW - 0.04, 0.05, caseD - 0.04, PALETTE.dark, [caseX, 0, -0.01]);
  p.box(caseW, under - 0.05, caseD, PALETTE.woodDark, [caseX, 0.05, 0]);
  const drawers = [0.2, 0.2, 0.26];
  let y = 0.06;
  for (const h of [...drawers].reverse()) {
    p.box(caseW - 0.03, h - 0.015, 0.02, PALETTE.wood, [caseX, y, caseD / 2]);
    p.box(0.14, 0.018, 0.025, PALETTE.chrome, [caseX, y + h - 0.06, caseD / 2 + 0.02]);
    y += h;
  }
  // Voile de fond entre le piètement et le caisson.
  p.box(width - caseW - 0.16, 0.3, 0.02, PALETTE.woodDark, [
    (legX + caseX - caseW / 2) / 2,
    under - 0.34,
    -depth / 2 + 0.05,
  ]);
  // Passe-câble dans le plateau, goulotte dessous et câbles qui descendent jusqu'à la multiprise.
  p.post(0.035, 0.035, 0.004, PALETTE.dark, [-0.15, top, -depth / 2 + 0.08], 10);
  p.box(0.6, 0.05, 0.1, PALETTE.metal, [-0.2, under - 0.06, -depth / 2 + 0.1]);
  p.bar([-0.42, under - 0.06, -depth / 2 + 0.1], [-0.46, 0.03, -depth / 2 + 0.1], 0.012, 0x1d2130);
  p.bar([-0.38, under - 0.06, -depth / 2 + 0.12], [-0.4, 0.03, -depth / 2 + 0.16], 0.01, 0x1d2130);
  p.box(0.28, 0.035, 0.07, PALETTE.white, [-0.3, 0, -depth / 2 + 0.14]);
  p.light(0.02, 0.012, 0.02, PALETTE.red, [-0.17, 0.035, -depth / 2 + 0.14]);
  return p.build('officeDesk');
}

/** Bureau du garage (modèle Kenney `tableCross`) : 1,7 x 0,89, plateau à 0,69. */
export function trestleDesk(): THREE.Group {
  const p = new Pieces([PALETTE.birch, PALETTE.birchDark]);
  const top = 0.695;
  const board = 0.035;
  p.soft(1.7, board, 0.89, 0.008, PALETTE.birch, [0, top - board, 0]);
  // Chant contreplaqué : une fine bande plus claire sur le pourtour.
  p.box(1.71, 0.008, 0.9, PALETTE.sand, [0, top - board - 0.004, 0]);
  // Deux tréteaux en A : pieds écartés, traverse haute et barre de pied.
  for (const x of [-0.6, 0.6]) {
    for (const side of [-1, 1]) {
      p.bar(
        [x - 0.06, 0.02, side * 0.38],
        [x - 0.02, top - board, side * 0.12],
        0.022,
        PALETTE.birchDark,
        4,
      );
      p.bar(
        [x + 0.06, 0.02, side * 0.38],
        [x + 0.02, top - board, side * 0.12],
        0.022,
        PALETTE.birchDark,
        4,
      );
    }
    p.box(0.14, 0.04, 0.4, PALETTE.birchDark, [x, top - board - 0.04, 0]);
    p.box(0.03, 0.03, 0.62, PALETTE.birchDark, [x, 0.22, 0]);
  }
  // Une barre d'écartement entre les tréteaux, comme sur les modèles en kit.
  p.bar([-0.6, 0.24, 0], [0.6, 0.24, 0], 0.015, PALETTE.metal, 6);
  return p.build('trestleDesk');
}

/** Bureau debout motorisé : plateau à 1,10, colonnes télescopiques, boîtier de commande. */
export function standingDesk(): THREE.Group {
  const p = new Pieces([PALETTE.white]);
  const top = 1.1;
  for (const x of [-0.8, 0.8]) {
    // Pied plat avec patins réglables, deux étages de colonne et support sous le plateau.
    p.box(0.08, 0.035, 0.64, PALETTE.dark, [x, 0.015, 0]);
    for (const z of [-0.3, 0.3]) p.post(0.02, 0.022, 0.015, 0x1d2130, [x, 0, z], 6);
    p.box(0.095, 0.5, 0.075, PALETTE.dark, [x, 0.05, 0]);
    p.box(0.075, 0.47, 0.058, PALETTE.slate, [x, 0.55, 0]);
    p.box(0.08, 0.04, 0.6, PALETTE.dark, [x, top - 0.085, 0]);
  }
  // Traverse et moteur, goulotte à câbles et chenille qui descend au sol.
  p.box(1.52, 0.04, 0.05, PALETTE.dark, [0, top - 0.09, -0.05]);
  p.box(0.12, 0.06, 0.07, 0x1d2130, [-0.62, top - 0.11, -0.05]);
  p.box(0.9, 0.05, 0.12, PALETTE.metal, [0.1, top - 0.11, -0.24]);
  for (let i = 0; i < 9; i += 1) p.box(0.045, 0.1, 0.035, 0x1d2130, [0.5, 0.05 + i * 0.105, -0.28]);
  // Plateau blanc (repeint au choix du joueur).
  p.soft(1.9, 0.045, 0.75, 0.012, PALETTE.white, [0, top - 0.045, 0]);
  // Boîtier de commande sous le bord avant : afficheur de hauteur et deux touches.
  p.box(0.2, 0.035, 0.07, PALETTE.dark, [0.62, top - 0.08, 0.34]);
  p.light(0.05, 0.012, 0.005, 0x7cc8f4, [0.58, top - 0.065, 0.377]);
  for (const x of [0.65, 0.69]) p.box(0.025, 0.012, 0.006, PALETTE.slate, [x, top - 0.066, 0.377]);
  // Écran sur pied (sa face sert de support au contenu animé de `screens.ts`) et son pied.
  p.post(0.09, 0.1, 0.012, PALETTE.dark, [0, top, -0.22], 10);
  p.box(0.05, 0.16, 0.03, PALETTE.dark, [0, top, -0.245]);
  p.box(0.7, 0.42, 0.04, PALETTE.dark, [0, top + 0.05, -0.2]);
  p.box(0.25, 0.18, 0.02, 0x23283a, [0, top + 0.15, -0.23]);
  // Clavier (inchangé) devant l'écran.
  p.box(0.5, 0.02, 0.15, PALETTE.dark, [0, top, 0.12]);
  return p.build('standingDesk');
}

interface ChairShape {
  /** Hauteur du haut du dossier. */
  readonly backTop: number;
  readonly headrest: boolean;
}

/**
 * Chaise de bureau à roulettes : piétement étoile à cinq branches, vérin, assise rembourrée,
 * dossier résille, accoudoirs. Le tissu (`chairFabric`) se repeint, le cadre reste sombre.
 */
function chair({ backTop, headrest }: ChairShape): Pieces {
  const p = new Pieces([PALETTE.chairFabric]);
  const { chairFabric, chairFabricDark } = PALETTE;
  // Étoile à cinq branches et roulettes.
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2 + Math.PI / 10;
    const x = Math.sin(angle) * 0.27;
    const z = Math.cos(angle) * 0.27;
    p.bar([0, 0.09, 0], [x, 0.07, z], 0.022, PALETTE.dark, 5);
    p.post(0.028, 0.028, 0.045, 0x1d2130, [x, 0.012, z], 6);
    p.box(0.015, 0.03, 0.015, PALETTE.dark, [x, 0.05, z]);
  }
  p.post(0.05, 0.06, 0.06, PALETTE.dark, [0, 0.06, 0], 8);
  // Vérin chromé, soufflet et mécanisme sous l'assise.
  p.post(0.025, 0.025, 0.2, PALETTE.chrome, [0, 0.12, 0], 8);
  p.post(0.035, 0.04, 0.14, PALETTE.dark, [0, 0.11, 0], 8);
  p.box(0.22, 0.05, 0.22, PALETTE.dark, [0, 0.36, 0]);
  p.box(0.03, 0.015, 0.12, PALETTE.dark, [0.13, 0.37, 0.08]);
  // Assise rembourrée, plus épaisse à l'avant.
  p.soft(0.5, 0.06, 0.48, 0.02, chairFabricDark, [0, 0.41, 0]);
  p.soft(0.48, 0.07, 0.46, 0.03, chairFabric, [0, 0.45, 0.005]);
  // Montant du dossier et dossier résille dans un cadre.
  p.box(0.06, 0.04, 0.22, PALETTE.dark, [0, 0.4, -0.2]);
  p.bar([0, 0.42, -0.3], [0, 0.62, -0.31], 0.025, PALETTE.dark, 6);
  const backH = backTop - 0.56;
  p.soft(0.46, backH, 0.05, 0.03, chairFabricDark, [0, 0.56, -0.3], { x: -0.1 });
  p.soft(0.38, backH - 0.08, 0.02, 0.01, chairFabric, [0, 0.6, -0.27], { x: -0.1 });
  // Renfort lombaire.
  p.soft(0.34, 0.08, 0.035, 0.015, PALETTE.dark, [0, 0.66, -0.255], { x: -0.1 });
  if (headrest) {
    p.bar([0, backTop - 0.02, -0.34], [0, backTop + 0.09, -0.36], 0.015, PALETTE.dark, 6);
    p.soft(0.3, 0.13, 0.06, 0.03, chairFabricDark, [0, backTop + 0.06, -0.36], { x: -0.1 });
  }
  // Accoudoirs : montant et manchette.
  for (const side of [-1, 1]) {
    p.bar([side * 0.2, 0.4, -0.04], [side * 0.27, 0.48, -0.04], 0.018, PALETTE.dark, 5);
    p.bar([side * 0.27, 0.47, -0.04], [side * 0.27, 0.66, -0.04], 0.02, PALETTE.dark, 5);
    p.soft(0.07, 0.035, 0.28, 0.015, 0x1d2130, [side * 0.27, 0.66, -0.02]);
  }
  return p;
}

/** Chaise de bureau standard, servie avec chaque bureau de dev et du garage. */
export function officeChair(): THREE.Group {
  return chair({ backTop: 1.05, headrest: false }).build('officeChair');
}

/** Chaise ergonomique : dossier haut avec appui-tête. */
export function ergonomicChair(): THREE.Group {
  return chair({ backTop: 1.08, headrest: true }).build('ergonomicChair');
}

/** Casque audio fermé : arceau rembourré, coques et coussinets. */
function headset(p: Pieces, color: number, x: number, y: number, z: number, turn: number): void {
  // Taille réelle x 1,4 : un casque doit se lire de loin sur le portant.
  const k = 1.4;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const at = (dx: number, dy: number): [number, number, number] => [
    x + dx * k * cos,
    y + dy * k,
    z - dx * k * sin,
  ];
  // Arceau : trois segments et un coussin sur le dessus.
  p.bar(at(-0.13, 0), at(-0.1, 0.11), 0.016 * k, PALETTE.dark, 5);
  p.bar(at(-0.1, 0.11), at(0.1, 0.11), 0.016 * k, PALETTE.dark, 5);
  p.bar(at(0.1, 0.11), at(0.13, 0), 0.016 * k, PALETTE.dark, 5);
  p.soft(0.14 * k, 0.025 * k, 0.05 * k, 0.01, 0x1d2130, at(0, 0.1), { y: turn });
  // Coques de couleur et coussinets noirs côté oreille.
  for (const side of [-1, 1]) {
    p.soft(0.04 * k, 0.12 * k, 0.1 * k, 0.02, color, at(side * 0.15, -0.09), { y: turn });
    p.soft(0.03 * k, 0.1 * k, 0.085 * k, 0.02, 0x1d2130, at(side * 0.12, -0.08), { y: turn });
  }
}

/** Portant de casques antibruit : socle lesté, mât, bras et trois casques. */
export function headsetRack(): THREE.Group {
  const p = new Pieces([PALETTE.dark]);
  p.post(0.28, 0.3, 0.04, PALETTE.dark, [0, 0, 0], 12);
  p.post(0.26, 0.26, 0.012, 0x1d2130, [0, 0.04, 0], 12);
  p.post(0.03, 0.035, 1.0, PALETTE.metal, [0, 0.05, 0], 8);
  p.box(0.72, 0.035, 0.04, PALETTE.metal, [0, 0.99, 0]);
  for (const x of [-0.33, 0.33]) p.box(0.035, 0.08, 0.035, PALETTE.metal, [x, 0.95, 0]);
  p.post(0.04, 0.04, 0.03, PALETTE.dark, [0, 1.05, 0], 8);
  headset(p, PALETTE.red, -0.33, 0.8, 0, Math.PI / 2);
  headset(p, PALETTE.blue, 0.33, 0.8, 0, Math.PI / 2);
  headset(p, PALETTE.yellow, 0, 1.12, 0, 0);
  return p.build('headsetRack');
}

/** Meuble télé (modèle Kenney `cabinetTelevision`) : 1,6 x 0,5, dessus à 0,62. */
export function mediaConsole(): THREE.Group {
  const p = new Pieces([PALETTE.wood, PALETTE.woodDark]);
  const top = 0.62;
  const legH = 0.14;
  const depth = 0.48;
  // Pieds fuselés façon années 50.
  for (const x of [-0.7, 0.7])
    for (const z of [-0.17, 0.17]) p.post(0.026, 0.016, legH, PALETTE.woodDark, [x, 0, z], 6);
  // Caisson : fond, dessus, côtés, deux séparations et le dos.
  p.box(1.6, 0.03, depth, PALETTE.wood, [0, legH, 0]);
  p.box(1.62, 0.025, depth + 0.02, PALETTE.wood, [0, top - 0.025, 0]);
  for (const x of [-0.785, 0.785])
    p.box(0.03, top - legH - 0.025, depth, PALETTE.wood, [x, legH, 0]);
  for (const x of [-0.27, 0.27])
    p.box(0.025, top - legH - 0.025, depth - 0.02, PALETTE.wood, [x, legH, 0]);
  p.box(1.56, top - legH - 0.03, 0.015, PALETTE.woodDark, [0, legH + 0.01, -depth / 2 + 0.01]);
  // Portes à lattes verticales de part et d'autre, bouton en laiton.
  for (const side of [-1, 1]) {
    const cx = side * 0.53;
    p.box(0.48, top - legH - 0.05, 0.02, PALETTE.woodDark, [cx, legH + 0.03, depth / 2 - 0.01]);
    for (let i = 0; i < 9; i += 1)
      p.box(0.03, top - legH - 0.07, 0.012, PALETTE.wood, [
        cx - 0.2 + i * 0.05,
        legH + 0.04,
        depth / 2 + 0.005,
      ]);
    p.post(0.014, 0.014, 0.02, PALETTE.gold, [cx - side * 0.2, legH + 0.22, depth / 2 + 0.015], 8);
  }
  // Niche du milieu : étagère, console de jeu et box internet aux voyants allumés.
  p.box(0.5, 0.02, depth - 0.04, PALETTE.wood, [0, legH + 0.22, 0]);
  p.box(0.3, 0.07, 0.24, PALETTE.white, [0, legH + 0.03, 0.02]);
  p.light(0.1, 0.008, 0.005, 0x7cc8f4, [0.08, legH + 0.07, 0.143]);
  p.box(0.24, 0.05, 0.16, 0x23283a, [0, legH + 0.24, 0.02]);
  for (let i = 0; i < 4; i += 1)
    p.light(0.014, 0.01, 0.005, PALETTE.green, [-0.06 + i * 0.035, legH + 0.27, 0.102]);
  // Barre de son devant l'écran.
  p.soft(0.8, 0.06, 0.08, 0.025, 0x23283a, [0, top, 0.17]);
  p.light(0.02, 0.008, 0.005, PALETTE.white, [0.3, top + 0.03, 0.212]);
  return p.build('mediaConsole');
}

/** Baie de serveurs : armoire 42U, rails, serveurs à voyants, panneau de brassage et câbles. */
export function serverRack(): THREE.Group {
  const p = new Pieces();
  const frame = 0x23283a;
  const dark = 0x1a1e2b;
  // Roulettes et socle, armoire, toit ventilé.
  for (const x of [-0.33, 0.33])
    for (const z of [-0.33, 0.33]) p.post(0.035, 0.035, 0.05, dark, [x, 0, z], 6);
  p.box(0.82, 1.75, 0.82, PALETTE.dark, [0, 0.05, 0]);
  p.box(0.86, 0.06, 0.86, frame, [0, 1.8, 0]);
  for (let i = 0; i < 4; i += 1) p.box(0.6, 0.015, 0.05, dark, [0, 1.86, -0.24 + i * 0.16]);
  // Montants avant avec rails perforés.
  for (const x of [-0.385, 0.385]) {
    p.box(0.05, 1.72, 0.04, frame, [x, 0.07, 0.4]);
    for (let i = 0; i < 24; i += 1) p.box(0.012, 0.012, 0.005, dark, [x, 0.12 + i * 0.07, 0.422]);
  }
  // Serveurs : façade, grille d'aération, voyants (une baie en alerte) et poignées.
  const leds = [PALETTE.green, PALETTE.green, PALETTE.blue, PALETTE.yellow, PALETTE.green];
  for (let i = 0; i < 8; i += 1) {
    const y = 0.12 + i * 0.18;
    p.box(0.7, 0.15, 0.03, 0x4a5168, [0, y, 0.41]);
    for (let j = 0; j < 5; j += 1)
      p.box(0.05, 0.1, 0.008, 0x3a4055, [-0.3 + j * 0.065, y + 0.025, 0.428]);
    for (let j = 0; j < 3; j += 1) {
      const color = i === 5 && j === 0 ? PALETTE.red : (leds[(i + j * 2) % leds.length] ?? 0);
      p.light(0.035, 0.03, 0.012, color, [0.24 + j * 0.06, y + 0.06, 0.43]);
    }
    for (const x of [-0.33, 0.33]) p.box(0.02, 0.09, 0.025, PALETTE.chrome, [x, y + 0.03, 0.43]);
  }
  // Panneau de brassage en haut, câbles de couleur qui retombent en boucles vers le côté.
  const patch = 0.12 + 8 * 0.18;
  p.box(0.7, 0.1, 0.03, dark, [0, patch, 0.41]);
  const cables = [
    PALETTE.blue,
    PALETTE.yellow,
    PALETTE.red,
    PALETTE.green,
    PALETTE.blue,
    PALETTE.white,
  ];
  cables.forEach((color, i) => {
    const x = -0.28 + i * 0.1;
    p.box(0.03, 0.03, 0.01, PALETTE.metal, [x, patch + 0.035, 0.428]);
    // Chaque câble sort du port, descend un peu puis file vers le passe-câble de droite.
    const drop = patch - 0.04 - i * 0.012;
    p.bar([x, patch + 0.035, 0.445], [x, drop, 0.445], 0.008, color, 4);
    p.bar([x, drop, 0.445], [0.37, drop, 0.445], 0.008, color, 4);
  });
  for (const [z, color] of [
    [0.25, PALETTE.blue],
    [0.1, PALETTE.yellow],
  ] as const) {
    p.box(0.03, 0.9, 0.03, color, [0.43, 0.6, z]);
  }
  // Étiquette « PROD — NE PAS DÉBRANCHER » sur le côté.
  p.box(0.005, 0.08, 0.2, PALETTE.yellow, [-0.413, 1.4, 0]);
  return p.build('serverRack');
}
