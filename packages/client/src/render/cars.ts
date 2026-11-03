/**
 * Les voitures de la ville, en formes Three.js low-poly (aucun pack Kenney de véhicules n'est
 * déposé dans le projet).
 *
 * Sept modèles : berline, taxi, citadine, SUV, camionnette, pick-up et bus. Chaque modèle est
 * assemblé pièce par pièce (`Pieces`), puis réduit à deux géométries :
 * - `paint` : la carrosserie, en blanc, teintée voiture par voiture (couleur d'instance) ;
 * - `trim` : tout le reste (vitres, pneus, jantes, pare-chocs, phares, enseigne du taxi), peint
 *   par sommet, identique pour toutes les voitures du modèle.
 * La ville dessine donc deux InstancedMesh par modèle, quel que soit le nombre de voitures.
 *
 * Repère : la voiture est posée au sol (y = 0), centrée, son avant vers +x. Une case mesure 1.
 * Le choix du modèle et de la couleur d'une voiture ne dépend que de son numéro (hachage fixe) :
 * aucun tirage, la circulation est la même à chaque partie.
 */
import * as THREE from 'three';
import { Pieces } from './pieces';

export type CarModelId = 'sedan' | 'taxi' | 'hatchback' | 'suv' | 'van' | 'pickup' | 'bus';

export interface CarModel {
  readonly id: CarModelId;
  /** Longueur hors tout (le long de x) : place des phares et des feux arrière. */
  readonly length: number;
  /** Hauteur des phares au-dessus de la rue. */
  readonly lightHeight: number;
  /** Carrosserie, à teinter par instance. */
  readonly paint: THREE.BufferGeometry;
  /** Vitres, pneus, chromes et feux, peints par sommet. */
  readonly trim: THREE.BufferGeometry;
}

/** Couleur de la carrosserie avant teinte : blanc, pour que la couleur d'instance soit exacte. */
const BODY = 0xffffff;

const GLASS = 0x26323f;
const TYRE = 0x1b1d21;
const RIM = 0xb8bec6;
const BUMPER = 0x3a3f47;
const CHROME = 0xd5dbe3;
const HEADLIGHT = 0xfff3cf;
const TAILLIGHT = 0xc0281f;
const PLATE = 0xf1efe6;

/** Part de chaque modèle dans la circulation (en pour cent) et ses couleurs. */
export const CAR_MIX: readonly {
  readonly id: CarModelId;
  readonly share: number;
  readonly colors: readonly number[];
}[] = [
  // Taxis jaunes : près d'une voiture sur trois, comme à Manhattan.
  { id: 'taxi', share: 30, colors: [0xf2c230] },
  {
    id: 'sedan',
    share: 24,
    colors: [0x1f2328, 0xe8e8e4, 0x9aa1a8, 0x23324f, 0x9b2d2a, 0x5f6b62, 0xc9ccd1],
  },
  { id: 'hatchback', share: 13, colors: [0xc8423a, 0x3a6fb0, 0xe8e8e4, 0x3c9a8f, 0xe08a2e] },
  { id: 'suv', share: 14, colors: [0x1f2328, 0xe8e8e4, 0x6c737b, 0x23324f, 0x6e2430] },
  { id: 'van', share: 9, colors: [0xf2f2ee, 0xf2f2ee, 0xc9ccd1, 0x2f5f9e] },
  { id: 'pickup', share: 6, colors: [0xa8352e, 0x40454c, 0xe8e8e4, 0x3f5f3a] },
  // Bus urbain : rare et long, bleu ou blanc.
  { id: 'bus', share: 4, colors: [0x2f62b0, 0xe9ebe6] },
];

/** Hachage entier fixe (pas de tirage : même circulation à chaque partie). */
function hash(n: number): number {
  let h = (n + 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Modèle (indice dans `CAR_MIX`) et couleur de la voiture numéro `index`. */
export function carLook(index: number): { readonly model: number; readonly color: number } {
  const total = CAR_MIX.reduce((sum, entry) => sum + entry.share, 0);
  let pick = hash(index) % total;
  let model = 0;
  for (; model < CAR_MIX.length - 1; model++) {
    const share = CAR_MIX[model]?.share ?? 0;
    if (pick < share) break;
    pick -= share;
  }
  const colors = CAR_MIX[model]?.colors ?? [BODY];
  const color = colors[hash(index * 31 + 7) % colors.length] ?? BODY;
  return { model, color };
}

// --- Pièces communes ---------------------------------------------------------------------

/**
 * Boîte dont le dessus est rentré vers l'avant (`front`) et vers l'arrière (`back`) : habitacle
 * à pare-brise incliné, capot plongeant.
 */
function tapered(
  length: number,
  height: number,
  width: number,
  front: number,
  back: number,
  inset = 0,
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(length, height, width);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    if (position.getY(i) <= 0) continue;
    const x = position.getX(i);
    position.setX(i, x > 0 ? x - front : x + back);
    const z = position.getZ(i);
    position.setZ(i, z > 0 ? z - inset : z + inset);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Quatre roues (pneu et jante) aux abscisses données. */
function wheels(p: Pieces, xs: readonly number[], track: number, radius: number): void {
  for (const x of xs)
    for (const side of [-1, 1]) {
      const tyre = new THREE.CylinderGeometry(radius, radius, 0.07, 10);
      p.shape(tyre, TYRE, [x, radius, side * track], { x: Math.PI / 2 });
      const rim = new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, 0.075, 8);
      p.shape(rim, RIM, [x, radius, side * (track + 0.004)], { x: Math.PI / 2 });
    }
}

/** Phares à l'avant, feux arrière, pare-chocs et plaques. */
function lightsAndBumpers(
  p: Pieces,
  length: number,
  width: number,
  y: number,
  bumperY = y - 0.07,
): void {
  const half = length / 2;
  for (const side of [-1, 1]) {
    p.box(0.02, 0.045, 0.09, HEADLIGHT, [half + 0.002, y, side * (width / 2 - 0.07)]);
    p.box(0.02, 0.04, 0.08, TAILLIGHT, [-half - 0.002, y, side * (width / 2 - 0.07)]);
  }
  p.box(0.045, 0.065, width - 0.02, BUMPER, [half - 0.005, bumperY, 0]);
  p.box(0.045, 0.065, width - 0.02, BUMPER, [-half + 0.005, bumperY, 0]);
  p.box(0.012, 0.035, 0.11, PLATE, [half + 0.02, bumperY + 0.015, 0]);
  p.box(0.012, 0.035, 0.11, PLATE, [-half - 0.02, bumperY + 0.015, 0]);
}

/** Rétroviseurs, couleur carrosserie. */
function mirrors(p: Pieces, x: number, y: number, width: number): void {
  for (const side of [-1, 1]) p.box(0.04, 0.035, 0.04, BODY, [x, y, side * (width / 2 + 0.015)]);
}

/** Habitacle vitré, toit couleur carrosserie et montants (pare-brise, lunette, vitres). */
function cabin(
  p: Pieces,
  x: number,
  y: number,
  length: number,
  height: number,
  width: number,
  front: number,
  back: number,
): void {
  p.shape(tapered(length, height, width - 0.02, front, back, 0.03), GLASS, [x, y + height / 2, 0]);
  // Toit : une plaque fine qui reprend le dessus de l'habitacle.
  const roofLength = length - front - back + 0.02;
  const roofX = x + (back - front) / 2;
  p.soft(roofLength, 0.035, width - 0.07, 0.012, BODY, [roofX, y + height - 0.005, 0]);
  // Montant central entre les portières.
  for (const side of [-1, 1])
    p.box(0.035, height - 0.02, 0.012, BODY, [roofX, y, side * ((width - 0.02) / 2 - 0.02)]);
}

function build(p: Pieces): { paint: THREE.BufferGeometry; trim: THREE.BufferGeometry } {
  const group = p.build('car');
  const meshes = group.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh);
  const geometryOf = (painted: boolean) => {
    const parts = meshes
      .filter((mesh) => ((mesh.material as THREE.Material).name === 'trim') !== painted)
      .map((mesh) => mesh.geometry);
    const [first] = parts;
    return first ?? new THREE.BufferGeometry();
  };
  return { paint: geometryOf(true), trim: geometryOf(false) };
}

// --- Les modèles -------------------------------------------------------------------------

function sedan(taxi: boolean): CarModel {
  const p = new Pieces([BODY]);
  const L = 1;
  const W = 0.46;
  wheels(p, [0.31, -0.31], W / 2 - 0.02, 0.095);
  // Caisse : bas de caisse, puis capot et coffre légèrement plongeants.
  p.shape(tapered(L, 0.17, W, 0.05, 0.04), BODY, [0, 0.165, 0]);
  p.box(L - 0.06, 0.05, W - 0.04, TYRE, [0, 0.055, 0]);
  cabin(p, -0.06, 0.25, 0.56, 0.17, W, 0.13, 0.11);
  mirrors(p, 0.17, 0.27, W);
  lightsAndBumpers(p, L, W, 0.19);
  // Calandre.
  p.box(0.02, 0.05, 0.2, BUMPER, [L / 2 + 0.001, 0.15, 0]);
  if (taxi) {
    // Enseigne lumineuse sur le toit et damier le long des portières.
    p.box(0.08, 0.06, 0.2, 0xfff6d8, [-0.06, 0.455, 0]);
    p.box(0.1, 0.012, 0.22, BUMPER, [-0.06, 0.448, 0]);
    for (const side of [-1, 1])
      for (let i = 0; i < 6; i++)
        p.box(0.05, 0.022, 0.006, i % 2 === 0 ? 0x1b1d21 : 0xf6f3e8, [
          -0.24 + i * 0.05,
          0.2,
          side * (W / 2 + 0.002),
        ]);
  }
  return { id: taxi ? 'taxi' : 'sedan', length: L, lightHeight: 0.21, ...build(p) };
}

function hatchback(): CarModel {
  const p = new Pieces([BODY]);
  const L = 0.8;
  const W = 0.44;
  wheels(p, [0.25, -0.25], W / 2 - 0.02, 0.09);
  p.shape(tapered(L, 0.17, W, 0.06, 0.01), BODY, [0, 0.16, 0]);
  p.box(L - 0.06, 0.05, W - 0.04, TYRE, [0, 0.05, 0]);
  // Habitacle haut qui descend presque droit à l'arrière (hayon).
  cabin(p, -0.06, 0.245, 0.56, 0.19, W, 0.15, 0.04);
  mirrors(p, 0.12, 0.27, W);
  lightsAndBumpers(p, L, W, 0.19);
  return { id: 'hatchback', length: L, lightHeight: 0.21, ...build(p) };
}

function suv(): CarModel {
  const p = new Pieces([BODY]);
  const L = 1.05;
  const W = 0.5;
  wheels(p, [0.33, -0.33], W / 2 - 0.02, 0.12);
  p.shape(tapered(L, 0.22, W, 0.04, 0.02), BODY, [0, 0.21, 0]);
  p.box(L - 0.08, 0.07, W - 0.03, TYRE, [0, 0.07, 0]);
  cabin(p, -0.08, 0.32, 0.72, 0.2, W, 0.14, 0.04);
  // Barres de toit.
  for (const side of [-1, 1]) p.box(0.6, 0.02, 0.02, CHROME, [-0.06, 0.555, side * 0.17]);
  // Élargisseurs d'ailes sombres au-dessus des roues.
  for (const x of [0.33, -0.33])
    for (const side of [-1, 1]) p.box(0.28, 0.04, 0.02, BUMPER, [x, 0.24, side * (W / 2 + 0.005)]);
  mirrors(p, 0.2, 0.35, W);
  lightsAndBumpers(p, L, W, 0.27);
  // Roue de secours à l'arrière.
  p.shape(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 10), TYRE, [-L / 2 - 0.03, 0.32, 0], {
    z: Math.PI / 2,
  });
  return { id: 'suv', length: L, lightHeight: 0.29, ...build(p) };
}

function van(): CarModel {
  const p = new Pieces([BODY]);
  const L = 1.2;
  const W = 0.52;
  wheels(p, [0.38, -0.36], W / 2 - 0.02, 0.105);
  p.box(L - 0.06, 0.06, W - 0.04, TYRE, [0, 0.06, 0]);
  // Caisse haute, nez court et incliné.
  p.shape(tapered(L, 0.58, W, 0.16, 0.0), BODY, [0, 0.4, 0]);
  // Pare-brise couché sur le nez incliné, vitres de la cabine ; la caisse arrière est aveugle.
  const slope = Math.atan2(0.16, 0.58);
  p.shape(new THREE.BoxGeometry(0.012, 0.26, W - 0.07), GLASS, [0.488, 0.54, 0], { z: slope });
  p.box(0.17, 0.17, W + 0.006, GLASS, [0.33, 0.46, 0]);
  // Moulure et poignée de la porte coulissante, rail sur le côté.
  for (const side of [-1, 1]) {
    p.box(0.7, 0.012, 0.006, BUMPER, [-0.15, 0.48, side * (W / 2 + 0.002)]);
    p.box(0.06, 0.018, 0.008, CHROME, [0.06, 0.36, side * (W / 2 + 0.003)]);
  }
  // Portes arrière : un trait vertical et deux petites vitres.
  p.box(0.006, 0.42, 0.006, BUMPER, [-L / 2 - 0.002, 0.18, 0]);
  for (const side of [-1, 1]) p.box(0.006, 0.12, 0.17, GLASS, [-L / 2 - 0.002, 0.46, side * 0.12]);
  mirrors(p, 0.36, 0.48, W);
  lightsAndBumpers(p, L, W, 0.24, 0.15);
  return { id: 'van', length: L, lightHeight: 0.26, ...build(p) };
}

function pickup(): CarModel {
  const p = new Pieces([BODY]);
  const L = 1.12;
  const W = 0.5;
  wheels(p, [0.36, -0.34], W / 2 - 0.02, 0.115);
  p.box(L - 0.08, 0.07, W - 0.03, TYRE, [0, 0.07, 0]);
  // Capot et cabine à l'avant.
  p.shape(tapered(0.5, 0.2, W, 0.05, 0), BODY, [0.31, 0.2, 0]);
  cabin(p, 0.12, 0.3, 0.36, 0.2, W, 0.1, 0.02);
  // Benne ouverte : fond, ridelles et hayon.
  p.box(0.54, 0.05, W, BODY, [-0.29, 0.14, 0]);
  for (const side of [-1, 1]) p.box(0.54, 0.17, 0.03, BODY, [-0.29, 0.19, side * (W / 2 - 0.015)]);
  p.box(0.03, 0.17, W, BODY, [-0.545, 0.19, 0]);
  p.box(0.03, 0.17, W - 0.06, BODY, [-0.02, 0.19, 0]);
  p.box(0.5, 0.012, W - 0.07, BUMPER, [-0.29, 0.191, 0]);
  // Deux caisses dans la benne.
  p.box(0.14, 0.1, 0.16, 0xa8794a, [-0.36, 0.2, 0.08]);
  p.box(0.12, 0.08, 0.13, 0x8a6238, [-0.18, 0.2, -0.1]);
  mirrors(p, 0.2, 0.35, W);
  lightsAndBumpers(p, L, W, 0.27);
  return { id: 'pickup', length: L, lightHeight: 0.29, ...build(p) };
}

function bus(): CarModel {
  const p = new Pieces([BODY]);
  const L = 2.4;
  const W = 0.56;
  wheels(p, [0.78, -0.62], W / 2 - 0.03, 0.12);
  p.box(L - 0.1, 0.06, W - 0.06, TYRE, [0, 0.07, 0]);
  p.soft(L, 0.66, W, 0.04, BODY, [0, 0.11, 0]);
  // Bandeau de vitres continu, coupé de montants, et grand pare-brise.
  for (const side of [-1, 1]) {
    p.box(L - 0.3, 0.2, 0.006, GLASS, [-0.05, 0.47, side * (W / 2 + 0.002)]);
    for (let i = 0; i < 8; i++)
      p.box(0.03, 0.2, 0.01, BODY, [-1.0 + i * 0.27, 0.47, side * (W / 2 + 0.004)]);
    // Bande décorative sous les vitres.
    p.box(L - 0.12, 0.03, 0.006, 0xf2c230, [0, 0.4, side * (W / 2 + 0.002)]);
  }
  p.box(0.006, 0.3, W - 0.08, GLASS, [L / 2 + 0.002, 0.4, 0]);
  p.box(0.006, 0.14, W - 0.12, GLASS, [-L / 2 - 0.002, 0.52, 0]);
  // Girouette lumineuse au-dessus du pare-brise, porte avant.
  p.box(0.008, 0.05, W - 0.16, 0xffb547, [L / 2 + 0.004, 0.71, 0]);
  p.box(0.22, 0.42, 0.006, GLASS, [0.95, 0.17, W / 2 + 0.003]);
  // Climatisation sur le toit.
  p.soft(0.5, 0.07, 0.36, 0.02, 0xd9dcd8, [-0.3, 0.77, 0]);
  p.soft(0.3, 0.06, 0.3, 0.02, 0xd9dcd8, [0.5, 0.77, 0]);
  mirrors(p, L / 2 - 0.08, 0.6, W);
  lightsAndBumpers(p, L, W, 0.22, 0.15);
  return { id: 'bus', length: L, lightHeight: 0.24, ...build(p) };
}

const BUILDERS: Readonly<Record<CarModelId, () => CarModel>> = {
  sedan: () => sedan(false),
  taxi: () => sedan(true),
  hatchback,
  suv,
  van,
  pickup,
  bus,
};

/** Les modèles, dans l'ordre de `CAR_MIX` (l'indice `model` de `carLook`). */
export function buildCarModels(): CarModel[] {
  return CAR_MIX.map((entry) => BUILDERS[entry.id]());
}
