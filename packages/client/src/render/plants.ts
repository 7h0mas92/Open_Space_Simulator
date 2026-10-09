/**
 * Plantes d'intérieur construites en formes Three.js : trois petites (sansevieria, pothos sur
 * sellette, bonsaï), trois grandes (figuier lyre, palmier kentia, olivier) et deux grosses
 * (jardinière de séparation sur 3 cases, monstera géante sur 2 x 2 cases).
 *
 * Le Furniture Kit de Kenney n'a que quatre petites plantes : celles-ci sont dessinées feuille
 * par feuille, en gardant le style low-poly du jeu (facettes visibles, couleurs franches).
 * Une feuille est un polygone plat dont la nervure centrale est légèrement bombée, puis
 * inclinée et tournée autour de sa base. Comme pour le canapé, toutes les pièces d'une même
 * couleur sont fusionnées (`Pieces`) : une plante de 200 feuilles se dessine en quelques appels.
 * Les variations (angle, taille, teinte) viennent d'une graine fixe propre à chaque plante :
 * elle est identique à chaque partie et le RNG du jeu n'est jamais touché.
 */
import * as THREE from 'three';
import { Pieces, seeded } from './furnitureDetail';
import { material, PALETTE } from './primitives';

type Vec3 = readonly [number, number, number];

/**
 * Contour d'une feuille, côté droit, de la base à la pointe : [position le long de la feuille
 * (0 à 1), demi-largeur (0 à 1)]. Le côté gauche est son reflet.
 */
type Outline = readonly (readonly [number, number])[];

/** Lame étroite (sansevieria, herbes hautes, folioles du palmier). */
const BLADE: Outline = [
  [0, 0.45],
  [0.35, 1],
  [0.75, 0.7],
  [1, 0],
];
/** Feuille en cœur du pothos. */
const HEART: Outline = [
  [0, 0],
  [0.12, 0.85],
  [0.4, 1],
  [0.75, 0.55],
  [1, 0],
];
/** Feuille en violon du figuier lyre : étroite à la base, large près de la pointe. */
const FIDDLE: Outline = [
  [0, 0],
  [0.12, 0.45],
  [0.35, 0.6],
  [0.6, 0.85],
  [0.85, 0.8],
  [0.96, 0.4],
  [1, 0],
];
/** Feuille de monstera, avec ses découpes profondes. */
const MONSTERA: Outline = [
  [0, 0],
  [0.04, 0.6],
  [0.16, 0.92],
  [0.25, 0.5],
  [0.31, 0.97],
  [0.44, 0.55],
  [0.5, 0.95],
  [0.64, 0.5],
  [0.7, 0.82],
  [0.86, 0.5],
  [1, 0],
];

interface LeafOptions {
  readonly length: number;
  readonly width: number;
  /** Cap : direction de la feuille vue de dessus (0 regarde vers +z). */
  readonly yaw: number;
  /** Inclinaison : 0 à plat, π/2 à la verticale, négatif vers le bas. */
  readonly pitch: number;
  /** Torsion autour de la nervure. */
  readonly roll?: number;
  /** Affaissement de la pointe, en unités de grille. */
  readonly droop?: number;
  /** Épaisseur au milieu de la nervure. */
  readonly thickness?: number;
}

/**
 * Feuille plate et facettée : deux éventails de triangles (dessus et dessous) qui partent d'un
 * point de la nervure, sa base en `at`.
 */
function leaf(p: Pieces, color: number, outline: Outline, at: Vec3, options: LeafOptions): void {
  const { length, width, yaw, pitch, roll = 0, droop = 0, thickness = 0.016 } = options;
  const loop: [number, number][] = [];
  for (const [f, w] of outline) loop.push([(w * width) / 2, f * length]);
  for (let i = outline.length - 1; i >= 0; i -= 1) {
    const [f, w] = outline[i] as readonly [number, number];
    if (w > 0) loop.push([(-w * width) / 2, f * length]);
  }
  const center = 0.45 * length;
  const sag = (z: number) => -droop * (z / length) ** 2;
  const positions: number[] = [];
  for (let i = 0; i < loop.length; i += 1) {
    const [ax, az] = loop[i] as [number, number];
    const [bx, bz] = loop[(i + 1) % loop.length] as [number, number];
    // Le contour tourne de la droite (+x) vers la pointe (+z) : dessus (C, B, A), dessous (C, A, B).
    positions.push(0, sag(center) + thickness / 2, center, bx, sag(bz), bz, ax, sag(az), az);
    positions.push(0, sag(center) - thickness / 2, center, ax, sag(az), az, bx, sag(bz), bz);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (roll) geometry.rotateZ(roll);
  geometry.rotateX(-pitch);
  geometry.rotateY(yaw);
  geometry.translate(...at);
  geometry.computeVertexNormals();
  p.add(geometry, material(color));
}

/** Tige, tronc ou branche : un cylindre à 5 pans tendu de `from` à `to`. */
function stem(p: Pieces, color: number, from: Vec3, to: Vec3, radius: number, tip = radius): void {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const direction = b.clone().sub(a);
  const geometry = new THREE.CylinderGeometry(tip, radius, direction.length(), 5);
  geometry.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
  );
  const middle = a.add(b).multiplyScalar(0.5);
  geometry.translate(middle.x, middle.y, middle.z);
  p.add(geometry, material(color));
}

/** Touffe de feuillage arrondie (bonsaï, olivier, buissons) : un icosaèdre aplati. */
function tuft(p: Pieces, color: number, at: Vec3, radius: number, flatten = 0.7): void {
  const geometry = new THREE.IcosahedronGeometry(radius, 0);
  geometry.scale(1, flatten, 1);
  geometry.translate(...at);
  p.add(geometry, material(color));
}

/** Pot rond avec un rebord et sa terre ; renvoie la hauteur de la terre. */
function roundPot(p: Pieces, color: number, top: number, bottom: number, h: number): number {
  p.post(top, bottom, h, color, [0, 0, 0], 10);
  p.post(top + 0.015, top + 0.015, 0.045, color, [0, h - 0.045, 0], 10);
  p.post(top - 0.01, top - 0.01, 0.01, SOIL, [0, h - 0.03, 0], 10);
  return h - 0.02;
}

const SOIL = 0x4a3324;
const BARK = 0x6b4a32;
const BARK_DARK = 0x54392a;

/** Point au cap `yaw` et à la distance `r` de l'axe, à la hauteur `y`. */
const around = (yaw: number, r: number, y: number): Vec3 => [
  Math.sin(yaw) * r,
  y,
  Math.cos(yaw) * r,
];

/** Angle d'or : des feuilles bien réparties sans motif visible. */
const GOLDEN = 2.399963;

// ---------------------------------------------------------------------------------------------
// Petites plantes (1 case)
// ---------------------------------------------------------------------------------------------

/** Sansevieria : des lames dressées, vert sombre bordé de jaune, dans un pot en céramique. */
export function snakePlant(): THREE.Group {
  const p = new Pieces();
  const random = seeded(0x5a45);
  const soil = roundPot(p, PALETTE.ceramic, 0.15, 0.12, 0.3);
  const colors = [0x2f5f3a, 0x3f7444, 0x4c8248] as const;
  for (let i = 0; i < 11; i += 1) {
    const yaw = i * GOLDEN;
    const r = i === 0 ? 0 : 0.03 + random() * 0.06;
    const length = 0.34 + random() * 0.26 - r;
    const pitch = Math.PI / 2 - 0.08 - random() * 0.22;
    const options = { length, width: 0.075 + random() * 0.02, yaw, pitch, roll: random() - 0.5 };
    leaf(p, colors[i % 3] as number, BLADE, around(yaw, r, soil), options);
    // Liseré jaune : une lame un peu plus large, juste derrière.
    leaf(p, 0xc5bf55, BLADE, around(yaw, r - 0.004, soil - 0.005), {
      ...options,
      width: options.width + 0.016,
      length: length - 0.01,
      thickness: 0.008,
    });
  }
  return p.build('snakePlant');
}

/** Pothos sur sellette : un pot sur un guéridon en bois, et des lianes qui tombent jusqu'au sol. */
export function pothos(): THREE.Group {
  const p = new Pieces();
  const random = seeded(0x9070);
  const wood = PALETTE.woodDark;
  // Sellette : plateau rond, quatre pieds écartés, entretoise.
  for (let i = 0; i < 4; i += 1) {
    const yaw = Math.PI / 4 + (i * Math.PI) / 2;
    stem(p, wood, around(yaw, 0.17, 0), around(yaw, 0.12, 0.46), 0.016, 0.014);
  }
  p.post(0.13, 0.13, 0.02, wood, [0, 0.16, 0], 10);
  p.post(0.18, 0.18, 0.03, PALETTE.wood, [0, 0.46, 0], 10);
  const base = 0.49;
  p.post(0.14, 0.11, 0.17, PALETTE.terracotta, [0, base, 0], 10);
  p.post(0.15, 0.15, 0.035, PALETTE.terracotta, [0, base + 0.135, 0], 10);
  p.post(0.13, 0.13, 0.01, SOIL, [0, base + 0.15, 0], 10);
  const soil = base + 0.16;
  const greens = [0x4f9a3c, 0x67ad46, 0xa3c95a] as const;
  // Touffe : des cœurs serrés au-dessus du pot.
  for (let i = 0; i < 18; i += 1) {
    const yaw = i * GOLDEN;
    const r = 0.02 + random() * 0.09;
    leaf(p, greens[i % 3] as number, HEART, around(yaw, r, soil + random() * 0.06), {
      length: 0.11 + random() * 0.04,
      width: 0.1 + random() * 0.03,
      yaw,
      pitch: 0.2 + random() * 0.6,
      droop: 0.02,
    });
  }
  // Lianes : elles passent par-dessus le bord du pot puis descendent en ondulant.
  for (let v = 0; v < 6; v += 1) {
    const yaw = v * 1.05 + random() * 0.4;
    const bottom = 0.05 + random() * 0.3;
    let previous = around(yaw, 0.12, soil);
    let y = soil;
    for (let k = 0; y > bottom; k += 1) {
      y = soil + 0.02 - k * 0.075;
      const r = 0.17 + Math.min(k, 2) * 0.03 + Math.sin(k * 1.3 + v) * 0.015;
      const point = around(yaw + Math.sin(k * 0.9 + v) * 0.12, r, Math.max(y, bottom));
      stem(p, 0x5f8f3a, previous, point, 0.006);
      const side = k % 2 === 0 ? 1 : -1;
      leaf(p, greens[(k + v) % 3] as number, HEART, point, {
        length: 0.075 + random() * 0.03,
        width: 0.07 + random() * 0.02,
        yaw: yaw + side * 0.9,
        pitch: -0.5 - random() * 0.4,
      });
      previous = point;
    }
  }
  return p.build('pothos');
}

/** Bonsaï : un pin tordu dans une coupe plate, sur une petite sellette en bois. */
export function bonsai(): THREE.Group {
  const p = new Pieces();
  // Sellette basse.
  for (const x of [-0.19, 0.19])
    for (const z of [-0.19, 0.19]) p.box(0.04, 0.3, 0.04, PALETTE.woodDark, [x, 0, z]);
  p.box(0.36, 0.03, 0.03, PALETTE.woodDark, [0, 0.08, -0.19]);
  p.box(0.36, 0.03, 0.03, PALETTE.woodDark, [0, 0.08, 0.19]);
  p.box(0.48, 0.035, 0.48, PALETTE.wood, [0, 0.3, 0]);
  // Coupe rectangulaire émaillée, sur quatre petits pieds, et mousse.
  for (const x of [-0.15, 0.15])
    for (const z of [-0.09, 0.09]) p.box(0.04, 0.02, 0.04, PALETTE.slate, [x, 0.335, z]);
  p.box(0.42, 0.075, 0.28, PALETTE.slate, [0, 0.355, 0]);
  p.box(0.38, 0.01, 0.24, 0x6a8f3a, [0, 0.43, 0]);
  p.box(0.05, 0.025, 0.04, 0x9a9a92, [0.12, 0.435, 0.06]);
  p.box(0.035, 0.02, 0.03, 0x9a9a92, [0.15, 0.435, 0.03]);
  // Tronc en « S » et branches.
  const trunk: Vec3[] = [
    [0.05, 0.43, 0],
    [-0.05, 0.53, 0.02],
    [0.04, 0.63, -0.01],
    [-0.01, 0.73, 0.01],
  ];
  for (let i = 0; i < trunk.length - 1; i += 1)
    stem(p, BARK, trunk[i] as Vec3, trunk[i + 1] as Vec3, 0.035 - i * 0.007, 0.03 - i * 0.007);
  stem(p, BARK, [-0.04, 0.55, 0.02], [-0.17, 0.62, 0.05], 0.014, 0.008);
  stem(p, BARK, [0.03, 0.62, -0.01], [0.16, 0.69, -0.03], 0.013, 0.008);
  stem(p, BARK, [0, 0.7, 0.01], [-0.08, 0.76, -0.07], 0.01, 0.007);
  // Plateaux de feuillage taillés.
  tuft(p, 0x2f6b35, [-0.18, 0.64, 0.05], 0.1, 0.5);
  tuft(p, 0x3e7d3c, [0.17, 0.71, -0.03], 0.11, 0.5);
  tuft(p, 0x3e7d3c, [-0.09, 0.78, -0.08], 0.08, 0.55);
  tuft(p, 0x2f6b35, [0, 0.82, 0.01], 0.12, 0.55);
  return p.build('bonsai');
}

// ---------------------------------------------------------------------------------------------
// Grandes plantes (1 case, jusqu'à 2 m)
// ---------------------------------------------------------------------------------------------

/** Figuier lyre : un tronc fin et de grandes feuilles en violon, dans un pot en béton. */
export function fiddleLeafFig(): THREE.Group {
  const p = new Pieces();
  const random = seeded(0xf16);
  const soil = roundPot(p, PALETTE.concrete, 0.21, 0.17, 0.38);
  const trunk: Vec3[] = [
    [0, soil, 0],
    [0.02, 0.9, 0.01],
    [-0.015, 1.4, 0],
    [0.01, 1.82, -0.01],
  ];
  for (let i = 0; i < trunk.length - 1; i += 1)
    stem(p, BARK, trunk[i] as Vec3, trunk[i + 1] as Vec3, 0.028 - i * 0.006, 0.022 - i * 0.006);
  const greens = [0x2c6e36, 0x3a8443, 0x4a9650] as const;
  const count = 26;
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const y = 0.82 + t * 1.02;
    const yaw = i * GOLDEN;
    // Les feuilles du haut se redressent, celles du bas s'étalent.
    leaf(p, greens[i % 3] as number, FIDDLE, around(yaw, 0.02, y), {
      length: 0.3 - t * 0.08 + random() * 0.04,
      width: 0.22 - t * 0.05 + random() * 0.03,
      yaw,
      pitch: 0.25 + t * 0.75 + random() * 0.2,
      roll: (random() - 0.5) * 0.6,
      droop: 0.04,
    });
  }
  return p.build('fiddleLeafFig');
}

/** Palmier kentia : des palmes arquées couvertes de folioles, dans un grand cache-pot blanc. */
export function kentiaPalm(): THREE.Group {
  const p = new Pieces();
  const random = seeded(0xc3a);
  const soil = roundPot(p, PALETTE.ceramic, 0.2, 0.16, 0.42);
  const greens = [0x3b7d3a, 0x4f9444, 0x2f6a32] as const;
  const fronds = 9;
  for (let f = 0; f < fronds; f += 1) {
    const yaw = f * GOLDEN;
    const inner = f < 3;
    // Les palmes du cœur montent presque droit, celles du tour s'ouvrent davantage.
    const rise = inner ? 1.5 : 1.35 - random() * 0.15;
    const fall = inner ? 0.9 : 0.3 - random() * 0.2;
    const length = inner ? 1.6 + random() * 0.15 : 0.95 + random() * 0.15;
    const steps = 11;
    let point: Vec3 = around(yaw, 0.03, soil);
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps;
      const elevation = rise - (rise - fall) * t ** 1.4;
      const step = length / steps;
      const next: Vec3 = [
        point[0] + Math.sin(yaw) * Math.cos(elevation) * step,
        point[1] + Math.sin(elevation) * step,
        point[2] + Math.cos(yaw) * Math.cos(elevation) * step,
      ];
      stem(p, 0x5c7a3a, point, next, 0.012 - t * 0.006);
      if (s > 3) {
        // Folioles des deux côtés, plus longues au milieu de la palme, qui retombent.
        const size = Math.sin(((s - 3) / (steps - 2)) * Math.PI) * 0.22 + 0.07;
        for (const side of [-1, 1])
          leaf(p, greens[(s + f) % 3] as number, BLADE, next, {
            length: size,
            width: 0.04,
            yaw: yaw + side * 1.25,
            pitch: -0.35 - t * 0.3,
            droop: 0.03,
            thickness: 0.008,
          });
      }
      point = next;
    }
  }
  return p.build('kentiaPalm');
}

/** Olivier centenaire : un tronc noueux, un feuillage argenté et quelques olives. */
export function oliveTree(): THREE.Group {
  const p = new Pieces();
  const random = seeded(0x011e);
  const soil = roundPot(p, PALETTE.terracotta, 0.24, 0.19, 0.42);
  // Deux troncs tordus qui s'enlacent.
  const trunkA: Vec3[] = [
    [0.04, soil, 0.02],
    [-0.03, 0.62, 0.04],
    [0.05, 0.82, -0.02],
    [0, 1.02, 0],
  ];
  const trunkB: Vec3[] = [
    [-0.05, soil, -0.03],
    [0.03, 0.6, -0.05],
    [-0.04, 0.8, 0.03],
    [0, 1.0, 0],
  ];
  for (const trunk of [trunkA, trunkB])
    for (let i = 0; i < trunk.length - 1; i += 1)
      stem(
        p,
        i % 2 ? BARK_DARK : BARK,
        trunk[i] as Vec3,
        trunk[i + 1] as Vec3,
        0.05 - i * 0.008,
        0.042 - i * 0.008,
      );
  // Branches et boules de feuillage argenté au bout de chacune.
  const silver = [0x8ea36d, 0x7b9460, 0xa3b383] as const;
  const crowns: Vec3[] = [
    [-0.28, 1.3, 0.08],
    [0.27, 1.38, -0.06],
    [0.02, 1.55, 0.02],
    [0.05, 1.3, 0.28],
    [-0.08, 1.33, -0.27],
  ];
  crowns.forEach((crown, index) => {
    stem(p, BARK, [0, 1.0, 0], [crown[0] * 0.7, crown[1] - 0.12, crown[2] * 0.7], 0.026, 0.014);
    for (let k = 0; k < 4; k += 1) {
      const offset = around(k * GOLDEN + index, 0.08 + random() * 0.06, (random() - 0.4) * 0.12);
      tuft(
        p,
        silver[(k + index) % 3] as number,
        [crown[0] + offset[0], crown[1] + offset[1], crown[2] + offset[2]],
        0.11 + random() * 0.05,
        0.72,
      );
    }
  });
  // Olives noires piquées dans le feuillage.
  for (let i = 0; i < 14; i += 1) {
    const crown = crowns[i % crowns.length] as Vec3;
    const o = around(i * GOLDEN, 0.15 + random() * 0.03, (random() - 0.5) * 0.1);
    tuft(p, 0x4a3a52, [crown[0] + o[0], crown[1] + o[1], crown[2] + o[2]], 0.014, 1.2);
  }
  return p.build('oliveTree');
}

// ---------------------------------------------------------------------------------------------
// Grosses plantes
// ---------------------------------------------------------------------------------------------

/** Jardinière de séparation (3 x 1 cases) : un bac en lattes de bois, herbes hautes et buissons. */
export function planterBox(): THREE.Group {
  const p = new Pieces();
  const random = seeded(0x9a4d);
  const W = 2.8;
  const D = 0.6;
  const H = 0.52;
  // Socle sombre en retrait, bac en bois, lattes verticales et rebord.
  p.box(W - 0.1, 0.05, D - 0.1, PALETTE.dark, [0, 0, 0]);
  p.box(W, H - 0.05, D, PALETTE.wood, [0, 0.05, 0]);
  for (let x = -W / 2 + 0.1; x < W / 2 - 0.05; x += 0.2)
    for (const z of [-D / 2 - 0.004, D / 2 + 0.004])
      p.box(0.012, H - 0.12, 0.01, PALETTE.woodDark, [x, 0.09, z]);
  p.box(W + 0.05, 0.04, D + 0.05, PALETTE.woodDark, [0, H, 0]);
  p.box(W - 0.06, 0.01, D - 0.06, SOIL, [0, H - 0.01, 0]);
  const top = H;
  // Buissons ronds.
  for (const [x, r] of [
    [-1.05, 0.2],
    [0.15, 0.22],
    [1.1, 0.18],
  ] as const) {
    tuft(p, 0x3a7a3c, [x, top + r * 0.5, 0.04], r, 0.8);
    tuft(p, 0x4d8f45, [x + 0.12, top + r * 0.45, -0.08], r * 0.75, 0.8);
  }
  // Herbes hautes en touffes, et des graminées à plumeau.
  const grass = [0x7aa04a, 0x5f8f3e, 0xa8b85a] as const;
  for (let c = 0; c < 16; c += 1) {
    const x = -W / 2 + 0.15 + (c / 15) * (W - 0.3) + (random() - 0.5) * 0.08;
    const z = (random() - 0.5) * 0.3;
    for (let b = 0; b < 7; b += 1) {
      const yaw = b * GOLDEN + c;
      leaf(p, grass[(b + c) % 3] as number, BLADE, [x, top, z], {
        length: 0.35 + random() * 0.3,
        width: 0.035,
        yaw,
        pitch: 1.05 + random() * 0.4,
        droop: 0.08,
        thickness: 0.008,
      });
    }
    if (c % 3 === 1) {
      const height = 0.55 + random() * 0.2;
      stem(p, 0x9c9a5a, [x, top, z], [x + 0.03, top + height, z], 0.006);
      leaf(p, PALETTE.sand, BLADE, [x + 0.03, top + height - 0.02, z], {
        length: 0.2,
        width: 0.06,
        yaw: 0,
        pitch: Math.PI / 2 - 0.15,
        thickness: 0.05,
      });
    }
  }
  // Quelques fleurs blanches et jaunes au ras des buissons.
  for (let i = 0; i < 10; i += 1) {
    const x = -W / 2 + 0.2 + random() * (W - 0.4);
    const z = (random() - 0.5) * 0.4;
    tuft(p, i % 2 ? 0xf2efe8 : 0xf5c84a, [x, top + 0.18 + random() * 0.15, z], 0.03, 1);
  }
  return p.build('planterBox');
}

/** Monstera géante (2 x 2 cases) : de grandes feuilles découpées sur de longues tiges. */
export function giantMonstera(): THREE.Group {
  const p = new Pieces();
  const random = seeded(0x3057);
  // Grand panier tressé, rayé de bandes plus foncées.
  p.post(0.4, 0.33, 0.44, PALETTE.wicker, [0, 0, 0], 12);
  for (const y of [0.08, 0.2, 0.32])
    p.post(0.385 - y * 0.15 + 0.035, 0.38 - y * 0.15 + 0.03, 0.03, PALETTE.sisal, [0, y, 0], 12);
  p.post(0.42, 0.42, 0.05, PALETTE.wicker, [0, 0.41, 0], 12);
  p.post(0.39, 0.39, 0.01, SOIL, [0, 0.43, 0], 12);
  const soil = 0.44;
  const greens = [0x2a6a36, 0x37803f, 0x24592e] as const;
  const leaves = 14;
  for (let i = 0; i < leaves; i += 1) {
    const yaw = i * GOLDEN;
    const inner = i % 3 === 0;
    const reach = inner ? 0.25 + random() * 0.15 : 0.45 + random() * 0.25;
    const height = soil + (inner ? 0.75 : 0.35) + random() * 0.35;
    // Tige courbée en deux segments, de la terre jusqu'au pied de la feuille.
    const start = around(yaw, 0.05, soil);
    const elbow = around(yaw, reach * 0.4, height * 0.85 + 0.05);
    const end = around(yaw, reach, height);
    stem(p, 0x4a7f3a, start, elbow, 0.014, 0.012);
    stem(p, 0x4a7f3a, elbow, end, 0.012, 0.01);
    const length = 0.48 + random() * 0.16;
    leaf(p, greens[i % 3] as number, MONSTERA, end, {
      length,
      width: length * 0.95,
      yaw,
      pitch: inner ? 0.55 : 0.12 + random() * 0.25,
      roll: (random() - 0.5) * 0.4,
      droop: 0.08,
      thickness: 0.02,
    });
  }
  return p.build('giantMonstera');
}
