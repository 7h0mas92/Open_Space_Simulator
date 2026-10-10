/**
 * Ordinateurs des postes de travail, en formes Three.js (le kit Kenney n'a qu'un écran, un
 * clavier lisse et un portable générique) : la tour sobre d'origine, trois tours gaming et le
 * portable pro en aluminium qui remplace le clavier (voir `shared/sim/computers.ts`).
 *
 * Chaque tour est posée au sol, sa façade vers +z, origine au centre de sa base. Le portable
 * est posé sur le plateau, ouvert, l'écran vers +z (face au dev assis). Aucun logo de marque :
 * le capot du portable reste nu.
 *
 * Les pièces sont fusionnées par matériau (`pieces.ts`) : boîtier et détails peints par sommet,
 * vitres dans un matériau transparent, ventilateurs RGB et voyants dans le matériau lumineux.
 */
import * as THREE from 'three';
import type { ComputerId } from '@oss/shared';
import type { MissingAssetId } from './assetManifest';
import { qwertyKeyboard } from './keyboard';
import { Pieces } from './pieces';

/** Emprise de chaque tour [largeur, hauteur, profondeur], pour la placer sous un bureau. */
export const TOWER_SIZES: Readonly<
  Record<Exclude<ComputerId, 'pro-laptop'>, readonly [number, number, number]>
> = {
  tower: [0.19, 0.42, 0.4],
  'gaming-neon': [0.22, 0.47, 0.44],
  'gaming-liquid': [0.26, 0.46, 0.44],
  'gaming-titan': [0.28, 0.62, 0.5],
};

/** Vitre teintée des tours gaming : on voit l'intérieur éclairé au travers. */
const glass = new THREE.MeshStandardMaterial({
  color: 0x9fb4d8,
  transparent: true,
  opacity: 0.28,
  roughness: 0.1,
  metalness: 0.2,
  depthWrite: false,
});
glass.name = 'glass';

/** Anneau de ventilateur, à plat dans le plan de la façade (z) ou du flanc (x). */
function fanRing(radius: number): THREE.BufferGeometry {
  return new THREE.TorusGeometry(radius, radius * 0.14, 4, 16);
}

/** Pieds en caoutchouc aux quatre coins. */
function feet(p: Pieces, w: number, d: number): void {
  for (const x of [-w / 2 + 0.03, w / 2 - 0.03])
    for (const z of [-d / 2 + 0.04, d / 2 - 0.04])
      p.post(0.016, 0.018, 0.015, 0x15171e, [x, 0, z], 6);
}

/** Tour sobre : boîtier gris clair, façade brossée, bouton à LED bleue, deux ports USB. */
export function plainTower(): THREE.Group {
  const p = new Pieces();
  const [w, h, d] = TOWER_SIZES.tower;
  feet(p, w, d);
  p.soft(w, h - 0.015, d, 0.01, 0xc3c8d0, [0, 0.015, 0]);
  // Façade un ton plus sombre, baies de lecteur en haut, grille d'aération en bas.
  p.box(w - 0.012, h - 0.04, 0.008, 0xa9afba, [0, 0.03, d / 2]);
  for (const y of [h - 0.09, h - 0.06])
    p.box(w - 0.04, 0.004, 0.004, 0x8b919d, [0, y, d / 2 + 0.005]);
  for (let i = 0; i < 6; i += 1)
    p.box(w - 0.06, 0.006, 0.004, 0x6f7581, [0, 0.05 + i * 0.016, d / 2 + 0.005]);
  // Bouton d'alimentation et sa LED, ports USB.
  p.post(0.016, 0.016, 0.006, 0x8b919d, [0, h - 0.13, d / 2 + 0.004], 10);
  p.light(0.008, 0.008, 0.004, 0x5fb4ff, [0, h - 0.128, d / 2 + 0.012]);
  for (const x of [-0.025, 0.025])
    p.box(0.022, 0.008, 0.004, 0x23262f, [x, h - 0.17, d / 2 + 0.005]);
  // Grille latérale et bandeau d'aération sur le dessus.
  for (let i = 0; i < 5; i += 1)
    p.box(0.004, 0.006, 0.12, 0x8b919d, [w / 2, 0.24 + i * 0.016, -0.06]);
  p.box(w - 0.06, 0.004, 0.16, 0x8b919d, [0, h, -0.08]);
  return p.build('plainTower');
}

/** Intérieur vu à travers la vitre : carte mère, carte graphique, barrettes de RAM lumineuses. */
function insides(
  p: Pieces,
  side: number,
  w: number,
  h: number,
  d: number,
  accent: number,
  ram: readonly number[],
): void {
  const x = side * (w / 2 - 0.02);
  // Carte mère contre la paroi opposée à la vitre.
  p.box(0.01, h - 0.12, d - 0.1, 0x1f2a24, [-side * (w / 2 - 0.03), 0.07, -0.01]);
  // Ventirad du processeur et barrettes de RAM.
  p.box(0.05, 0.08, 0.08, 0x2b2f3a, [-side * (w / 2 - 0.07), h - 0.2, -0.02]);
  ram.forEach((color, i) =>
    p.light(0.03, 0.07, 0.008, color, [-side * (w / 2 - 0.06), h - 0.2, 0.06 + i * 0.016]),
  );
  // Carte graphique allongée, son bandeau lumineux tourné vers la vitre.
  p.box(w - 0.08, 0.05, d - 0.14, 0x262a35, [0, 0.16, -0.01]);
  p.light(0.006, 0.01, d - 0.18, accent, [x - side * 0.035, 0.19, -0.01]);
  // Alimentation sous son capot.
  p.box(w - 0.03, 0.08, d - 0.04, 0x15171e, [0, 0.02, 0]);
}

/** Tour gaming « Néon » : boîtier noir, vitre latérale, trois ventilateurs RGB en façade. */
export function neonTower(): THREE.Group {
  const p = new Pieces();
  const [w, h, d] = TOWER_SIZES['gaming-neon'];
  const black = 0x1b1d26;
  feet(p, w, d);
  // Cadre noir : fond, dessus, dessous, flanc plein ; le flanc droit est vitré.
  p.box(w, 0.02, d, black, [0, 0.015, 0]);
  p.box(w, 0.02, d, black, [0, h - 0.005, 0]);
  p.box(0.012, h - 0.03, d, black, [-w / 2 + 0.006, 0.025, 0]);
  p.box(w, h - 0.03, 0.012, black, [0, 0.025, -d / 2 + 0.006]);
  insides(p, 1, w, h, d, 0x3ef0ff, [0xff4fd8, 0x7c5cff]);
  p.box(0.006, h - 0.04, d - 0.03, glass, [w / 2 - 0.003, 0.03, 0]);
  // Façade grillagée et ses trois ventilateurs : cyan, magenta, violet.
  p.box(w, h - 0.03, 0.012, 0x23262f, [0, 0.025, d / 2 - 0.006]);
  [0x3ef0ff, 0xff4fd8, 0x9a6bff].forEach((color, i) => {
    const y = 0.1 + i * 0.12;
    p.glow(fanRing(0.05), color, [0, y, d / 2 + 0.002]);
    p.post(0.014, 0.014, 0.006, 0x15171e, [0, y - 0.003, d / 2 + 0.001], 8);
  });
  // Bandeau lumineux sur le dessus et bouton à LED.
  p.light(w - 0.04, 0.004, 0.01, 0xff4fd8, [0, h + 0.015, d / 2 - 0.02]);
  p.light(0.012, 0.012, 0.006, 0x3ef0ff, [w / 2 - 0.03, h + 0.015, d / 2 - 0.05]);
  return p.build('neonTower');
}

/**
 * Tour gaming à watercooling : boîtier blanc « aquarium », vitré en façade et sur le flanc,
 * bloc processeur, réservoir et tubes de liquide fluo, ventilateurs roses dessous et derrière.
 */
export function liquidTower(): THREE.Group {
  const p = new Pieces();
  const [w, h, d] = TOWER_SIZES['gaming-liquid'];
  const white = 0xe9ecf2;
  const coolant = 0x3ef0ff;
  feet(p, w, d);
  // Montants blancs : la façade et le flanc droit sont deux vitres qui se rejoignent.
  p.box(w, 0.03, d, white, [0, 0.015, 0]);
  p.box(w, 0.025, d, white, [0, h - 0.01, 0]);
  p.box(0.014, h - 0.04, d, white, [-w / 2 + 0.007, 0.045, 0]);
  p.box(w, h - 0.04, 0.014, white, [0, 0.045, -d / 2 + 0.007]);
  p.box(0.014, h - 0.04, 0.014, white, [w / 2 - 0.007, 0.045, d / 2 - 0.007]);
  // Carte mère blanche, carte graphique et barrettes arc-en-ciel.
  p.box(0.01, h - 0.12, d - 0.1, 0xd7dbe3, [-w / 2 + 0.03, 0.08, -0.01]);
  p.box(w - 0.09, 0.05, d - 0.14, 0xf4f6fa, [-0.01, 0.17, -0.02]);
  p.light(0.006, 0.01, d - 0.18, coolant, [w / 2 - 0.06, 0.2, -0.02]);
  [0xff5a5a, 0xffd23f, 0x5aff8c, 0x5ab8ff].forEach((color, i) =>
    p.light(0.03, 0.07, 0.008, color, [-w / 2 + 0.06, h - 0.2, 0.05 + i * 0.016]),
  );
  // Bloc processeur à anneau lumineux, réservoir cylindrique, tubes fluo qui les relient.
  const cpu: [number, number, number] = [-w / 2 + 0.05, h - 0.17, -0.06];
  p.box(0.03, 0.07, 0.07, 0xc9ced8, [cpu[0], cpu[1] - 0.035, cpu[2]]);
  p.glow(fanRing(0.028), coolant, [cpu[0] + 0.016, cpu[1], cpu[2]], { y: Math.PI / 2 });
  const tank: [number, number, number] = [0.04, 0.08, d / 2 - 0.07];
  p.post(0.032, 0.032, 0.2, glass, tank, 12);
  p.glow(new THREE.CylinderGeometry(0.024, 0.024, 0.17, 10), coolant, [
    tank[0],
    tank[1] + 0.1,
    tank[2],
  ]);
  p.bar([cpu[0] + 0.01, cpu[1], cpu[2] + 0.035], [tank[0], cpu[1], tank[2]], 0.009, 0xc8fbff);
  p.bar([tank[0], cpu[1], tank[2]], [tank[0], tank[1] + 0.2, tank[2]], 0.009, 0xc8fbff);
  p.bar([cpu[0] + 0.01, cpu[1] - 0.03, cpu[2] - 0.035], [0.04, h - 0.03, -0.12], 0.009, 0xc8fbff);
  // Radiateur sous le toit et ventilateurs roses : trois dessous, un à l'arrière.
  p.box(w - 0.05, 0.03, d - 0.08, 0x9aa3b5, [0, h - 0.06, 0]);
  for (const z of [-0.12, 0, 0.12])
    p.glow(fanRing(0.045), 0xff6fb5, [0, 0.055, z], { x: Math.PI / 2 });
  p.glow(fanRing(0.05), 0xff6fb5, [0, h - 0.16, -d / 2 + 0.016]);
  // Vitres, posées en dernier pour couvrir l'intérieur.
  p.box(w - 0.02, h - 0.04, 0.005, glass, [0, 0.045, d / 2 - 0.004]);
  p.box(0.005, h - 0.04, d - 0.02, glass, [w / 2 - 0.004, 0.045, 0]);
  p.light(0.012, 0.012, 0.006, coolant, [-w / 2 + 0.03, h + 0.015, d / 2 - 0.04]);
  return p.build('liquidTower');
}

/**
 * Tour gaming XXL « Titan » : grand boîtier noir et anguleux, façade en V à bandes rouges, deux
 * gros ventilateurs, afficheur de température, poignée de transport et vitre latérale.
 */
export function titanTower(): THREE.Group {
  const p = new Pieces();
  const [w, h, d] = TOWER_SIZES['gaming-titan'];
  const black = 0x14161d;
  const red = 0xff3b3b;
  // Socle surélevé à patins.
  for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) p.box(0.04, 0.03, d - 0.02, 0x2a2d38, [x, 0, 0]);
  p.box(w, 0.025, d, black, [0, 0.03, 0]);
  p.box(w, 0.03, d, black, [0, h - 0.03, 0]);
  p.box(0.014, h - 0.06, d, black, [-w / 2 + 0.007, 0.055, 0]);
  p.box(w, h - 0.06, 0.014, black, [0, 0.055, -d / 2 + 0.007]);
  insides(p, 1, w, h, d, red, [red, 0xff8a3b, red, 0xff8a3b]);
  p.box(0.006, h - 0.07, d - 0.04, glass, [w / 2 - 0.003, 0.06, 0]);
  // Façade : plaque centrale, deux joues biseautées, bandes rouges en V.
  p.box(w - 0.06, h - 0.06, 0.02, 0x1d2029, [0, 0.055, d / 2 - 0.01]);
  for (const side of [-1, 1]) {
    p.box(0.03, h - 0.06, 0.03, 0x2a2d38, [side * (w / 2 - 0.015), 0.055, d / 2 - 0.02], {
      y: side * 0.35,
    });
    p.glow(new THREE.BoxGeometry(0.006, 0.22, 0.006), red, [side * 0.06, h - 0.2, d / 2 + 0.004], {
      z: -side * 0.45,
    });
  }
  // Deux gros ventilateurs rouges et un afficheur de température.
  for (const y of [0.15, 0.3]) {
    p.glow(fanRing(0.07), red, [0, y, d / 2 + 0.003]);
    p.post(0.02, 0.02, 0.006, 0x0e1015, [0, y - 0.003, d / 2 + 0.002], 8);
  }
  p.box(0.09, 0.04, 0.006, 0x0e1015, [0, h - 0.11, d / 2 + 0.002]);
  p.light(0.07, 0.024, 0.004, 0xff8a3b, [0, h - 0.102, d / 2 + 0.006]);
  // Poignée de transport sur le dessus et bouton rouge.
  for (const z of [-0.12, 0.12]) p.box(0.03, 0.05, 0.02, 0x2a2d38, [0, h, z]);
  p.box(0.03, 0.02, 0.26, 0x2a2d38, [0, h + 0.05, 0]);
  p.light(0.016, 0.01, 0.016, red, [w / 2 - 0.05, h, d / 2 - 0.05]);
  return p.build('titanTower');
}

/**
 * Portable pro en aluminium gris sidéral, ouvert : clavier noir, grand pavé tactile, haut-parleurs
 * de part et d'autre, écran à bordure fine incliné vers l'arrière. Capot nu, sans logo.
 */
export function proLaptop(): THREE.Group {
  const p = new Pieces();
  const alu = 0x8e939b;
  const w = 0.36;
  const d = 0.25;
  // Châssis en deux épaisseurs (dessous un peu plus étroit) et petits pieds.
  p.soft(w - 0.01, 0.006, d - 0.01, 0.003, 0x7c8189, [0, 0.002, 0]);
  p.soft(w, 0.012, d, 0.006, alu, [0, 0.006, 0]);
  // Clavier noir en creux : 6 rangées de touches sombres.
  const keyTop = 0.018;
  p.box(w - 0.08, 0.002, 0.11, 0x2a2d35, [0, keyTop - 0.002, -0.04]);
  for (let row = 0; row < 6; row += 1)
    for (let col = 0; col < 14; col += 1)
      p.box(0.017, 0.002, 0.014, 0x181a20, [-0.137 + col * 0.0211, keyTop, -0.085 + row * 0.018]);
  // Haut-parleurs de part et d'autre, pavé tactile.
  for (const side of [-1, 1])
    p.box(0.022, 0.001, 0.11, 0x6f747c, [side * 0.165, keyTop - 0.001, -0.04]);
  p.box(0.15, 0.001, 0.09, 0x9ca1a9, [0, keyTop - 0.001, 0.07]);
  // Charnière, puis l'écran incliné de 105° : coque alu, dalle noire et contenu allumé.
  const hinge: [number, number, number] = [0, 0.012, -d / 2 + 0.008];
  p.bar([-w / 2 + 0.03, hinge[1], hinge[2]], [w / 2 - 0.03, hinge[1], hinge[2]], 0.006, 0x5d6168);
  // Chaque pièce de l'écran est construite debout au-dessus de la charnière, puis basculée.
  const tilt = { x: -0.26 };
  const lidH = 0.235;
  const lidPiece = (pw: number, ph: number, pd: number, y: number, z: number) => {
    const geometry = new THREE.BoxGeometry(pw, ph, pd);
    geometry.translate(0, y + ph / 2, z);
    return geometry;
  };
  p.shape(lidPiece(w, lidH, 0.006, 0, -0.003), alu, hinge, tilt);
  p.shape(lidPiece(w - 0.012, lidH - 0.012, 0.002, 0.006, 0.001), 0x0c0d10, hinge, tilt);
  p.glow(lidPiece(w - 0.03, lidH - 0.045, 0.002, 0.022, 0.0025), 0x1d2a44, hinge, tilt);
  // Quelques lignes de code claires sur la dalle.
  for (let i = 0; i < 6; i += 1)
    p.glow(
      lidPiece(0.06 + ((i * 37) % 5) * 0.025, 0.006, 0.001, 0.17 - i * 0.022, 0.0042),
      i % 3 === 0 ? 0x7cc8f4 : 0xc6d2e6,
      [-0.07 + ((i * 13) % 3) * 0.02, hinge[1], hinge[2]],
      tilt,
    );
  return p.build('proLaptop');
}

const TOWERS: Readonly<Record<Exclude<ComputerId, 'pro-laptop'>, () => THREE.Group>> = {
  tower: plainTower,
  'gaming-neon': neonTower,
  'gaming-liquid': liquidTower,
  'gaming-titan': titanTower,
};

/** Formes des assets manquants que `workstation` pose sur les postes de travail. */
export const WORKSTATION_ASSETS: readonly MissingAssetId[] = [
  'qwertyKeyboard',
  'plainTower',
  'neonTower',
  'liquidTower',
  'titanTower',
  'proLaptop',
];

/** Où poser l'ordinateur d'un bureau (voir `workstation` dans `view/catalog.ts`). */
export interface WorkstationSpot {
  readonly keyboard: readonly [number, number, number];
  readonly tower: readonly [number, number];
}

/**
 * L'ordinateur d'un bureau, dans le repère du bureau : la tour au sol et le clavier QWERTY sur
 * le plateau, ou le portable seul, ouvert à la place du clavier.
 */
export function workstation(spot: WorkstationSpot, computer: ComputerId): THREE.Group {
  const group = new THREE.Group();
  group.name = `workstation-${computer}`;
  if (computer === 'pro-laptop') {
    const laptop = proLaptop();
    laptop.position.set(spot.keyboard[0], spot.keyboard[1], spot.keyboard[2] - 0.01);
    group.add(laptop);
    return group;
  }
  const keyboard = qwertyKeyboard();
  keyboard.position.set(...spot.keyboard);
  const tower = TOWERS[computer]();
  const depth = TOWER_SIZES[computer][2];
  tower.position.set(spot.tower[0], 0, spot.tower[1] - depth / 2);
  group.add(keyboard, tower);
  return group;
}
