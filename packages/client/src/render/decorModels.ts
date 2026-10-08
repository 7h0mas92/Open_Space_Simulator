/**
 * Décorations de saison et table d'anniversaire, en formes Three.js low-poly.
 *
 * Aucun pack Kenney ne contient de décorations de fête : tout est assemblé ici avec des boîtes,
 * cylindres, cônes et sphères, dans le même esprit que `primitives.ts`. Repère : une case mesure
 * 1 x 1, l'objet est posé au sol (y = 0), centré, et regarde vers +z (vers la caméra).
 *
 * Par thème :
 * - `floor` : modèles posés au sol le long des murs (sapin, citrouilles, fusée…) ;
 * - `desk` : un petit objet posé sur chaque bureau ;
 * - `wall` : guirlandes et ornements accrochés aux deux murs du fond.
 */
import * as THREE from 'three';
import type { DecorTheme } from '@oss/shared';
import { material, PALETTE } from './primitives';

/** Hauteur des murs du fond (voir `office.ts`). */
const WALL_HEIGHT = 2.2;

// --- Matériaux et formes de base -------------------------------------------------------------

const glowMaterials = new Map<number, THREE.MeshStandardMaterial>();

/**
 * Matériau lumineux des décorations (guirlandes, néons, bougies). Ils sont à part de ceux du
 * mobilier pour pouvoir scintiller sans faire clignoter les écrans.
 */
export function decorGlow(color: number): THREE.MeshStandardMaterial {
  let found = glowMaterials.get(color);
  if (!found) {
    found = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1 });
    glowMaterials.set(color, found);
  }
  return found;
}

/** Tous les matériaux lumineux des décorations (animés par `DecorationsView`). */
export function decorGlowMaterials(): readonly THREE.MeshStandardMaterial[] {
  return [...glowMaterials.values()];
}

type Paint = number | THREE.Material;
const paint = (color: Paint) => (typeof color === 'number' ? material(color) : color);

function box(w: number, h: number, d: number, color: Paint, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paint(color));
  mesh.position.set(x, y + h / 2, z);
  return mesh;
}

/** Cylindre ou tronc de cône vertical posé sur `y`. */
function post(
  top: number,
  bottom: number,
  h: number,
  color: Paint,
  x = 0,
  y = 0,
  z = 0,
  segments = 8,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, h, segments), paint(color));
  mesh.position.set(x, y + h / 2, z);
  return mesh;
}

/** Sphère centrée en (x, y, z), écrasée ou étirée par `scaleY`. */
function ball(r: number, color: Paint, x = 0, y = 0, z = 0, scaleY = 1): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), paint(color));
  mesh.position.set(x, y, z);
  mesh.scale.y = scaleY;
  return mesh;
}

/** Cône posé sur `y`. */
function cone(r: number, h: number, color: Paint, x = 0, y = 0, z = 0, segments = 8): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, segments), paint(color));
  mesh.position.set(x, y + h / 2, z);
  return mesh;
}

/** Forme plate extrudée (cœur, étoile, éclair…), dressée face à +z. */
function flat(shape: THREE.Shape, depth: number, color: Paint, x = 0, y = 0, z = 0): THREE.Mesh {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geometry, paint(color));
  mesh.position.set(x, y, z);
  return mesh;
}

function heartShape(size: number): THREE.Shape {
  const s = size;
  const shape = new THREE.Shape();
  shape.moveTo(0, -s);
  shape.bezierCurveTo(s * 0.2, -s * 0.6, s, -s * 0.2, s, s * 0.3);
  shape.bezierCurveTo(s, s * 0.8, s * 0.4, s, 0, s * 0.55);
  shape.bezierCurveTo(-s * 0.4, s, -s, s * 0.8, -s, s * 0.3);
  shape.bezierCurveTo(-s, -s * 0.2, -s * 0.2, -s * 0.6, 0, -s);
  return shape;
}

function starShape(outer: number, inner: number, points = 5): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return shape;
}

function boltShape(size: number): THREE.Shape {
  const s = size;
  const shape = new THREE.Shape();
  shape.moveTo(0.1 * s, s);
  shape.lineTo(-0.45 * s, -0.05 * s);
  shape.lineTo(-0.05 * s, -0.05 * s);
  shape.lineTo(-0.2 * s, -s);
  shape.lineTo(0.45 * s, 0.15 * s);
  shape.lineTo(0.05 * s, 0.15 * s);
  shape.lineTo(0.25 * s, s);
  shape.closePath();
  return shape;
}

function triangleShape(w: number, h: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, -h);
  shape.closePath();
  return shape;
}

function group(...children: THREE.Object3D[]): THREE.Group {
  const result = new THREE.Group();
  result.add(...children);
  return result;
}

// --- Pièces réutilisées par plusieurs thèmes -------------------------------------------------

/** Cadeau emballé, avec ruban et nœud. */
export function gift(w: number, h: number, color: number, ribbon: number, x = 0, y = 0, z = 0) {
  const result = group(
    box(w, h, w, color),
    box(w + 0.01, h + 0.01, 0.04, ribbon),
    box(0.04, h + 0.01, w + 0.01, ribbon),
  );
  for (const turn of [0.6, -0.6]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 4, 8), material(ribbon));
    loop.position.set(turn * 0.06, h + 0.035, 0);
    loop.rotation.y = turn;
    result.add(loop);
  }
  result.position.set(x, y, z);
  return result;
}

/** Ballon gonflé à l'hélium et sa ficelle. */
function balloon(color: number, x: number, z: number, height: number): THREE.Group {
  return group(
    ball(0.12, color, x, height, z, 1.2),
    cone(0.025, 0.04, color, x, height - 0.18, z),
    post(0.004, 0.004, height - 0.14, PALETTE.white, x, 0, z, 4),
  );
}

/** Citrouille, éventuellement sculptée (yeux et bouche lumineux). */
function pumpkin(r: number, carved: boolean, x = 0, z = 0): THREE.Group {
  const result = group(ball(r, 0xf07f1e, x, r * 0.8, z, 0.8));
  result.add(post(r * 0.12, r * 0.15, r * 0.35, 0x4c7a2a, x, r * 1.5, z, 5));
  if (carved) {
    for (const dx of [-0.35, 0.35])
      result.add(
        cone(r * 0.16, r * 0.25, decorGlow(0xffc94d), x + dx * r, r * 0.9, z + r * 0.88, 3),
      );
    result.add(box(r * 0.8, r * 0.14, 0.02, decorGlow(0xffc94d), x, r * 0.5, z + r * 0.9));
  }
  return result;
}

/** Œuf de Pâques peint de deux bandes. */
function egg(r: number, base: number, stripe: number, x = 0, y = 0, z = 0): THREE.Group {
  return group(
    ball(r, base, x, y + r * 1.3, z, 1.3),
    post(r * 1.01, r * 1.01, r * 0.25, stripe, x, y + r * 1.15, z, 10),
  );
}

/** Ampoules colorées le long d'un segment (guirlande lumineuse). */
function lightString(
  from: THREE.Vector3,
  to: THREE.Vector3,
  colors: readonly number[],
  sag = 0.15,
  spacing = 0.35,
): THREE.Group {
  const result = new THREE.Group();
  const length = from.distanceTo(to);
  const count = Math.max(2, Math.round(length / spacing));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const point = from.clone().lerp(to, t);
    point.y -= Math.sin(t * Math.PI) * sag;
    const color = colors[i % colors.length] ?? PALETTE.yellow;
    result.add(ball(0.05, decorGlow(color), point.x, point.y, point.z, 1.3));
  }
  return result;
}

/** Fanions triangulaires le long d'un segment, face à la caméra. */
function bunting(
  from: THREE.Vector3,
  to: THREE.Vector3,
  colors: readonly number[],
  facing: number,
  sag = 0.18,
): THREE.Group {
  const result = new THREE.Group();
  const length = from.distanceTo(to);
  const count = Math.max(2, Math.round(length / 0.32));
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const point = from.clone().lerp(to, t);
    point.y -= Math.sin(t * Math.PI) * sag;
    const flag = flat(triangleShape(0.22, 0.28), 0.01, colors[i % colors.length] ?? PALETTE.red);
    flag.position.copy(point);
    flag.rotation.y = facing;
    result.add(flag);
  }
  return result;
}

/** Les deux murs du fond : un segment par mur, légèrement décollé de la paroi. */
interface WallSpan {
  readonly from: THREE.Vector3;
  readonly to: THREE.Vector3;
  /** Rotation qui fait regarder un objet plat vers l'intérieur de la pièce. */
  readonly facing: number;
  /** Position le long du mur (0 à 1) → point sur la paroi à la hauteur `y`. */
  readonly at: (t: number, y: number) => THREE.Vector3;
  readonly length: number;
}

function wallSpans(width: number, depth: number, y: number): WallSpan[] {
  const back = -0.48;
  const make = (from: THREE.Vector3, to: THREE.Vector3, facing: number): WallSpan => ({
    from,
    to,
    facing,
    length: from.distanceTo(to),
    at: (t, height) => {
      const point = from.clone().lerp(to, t);
      point.y = height;
      return point;
    },
  });
  return [
    make(new THREE.Vector3(-0.45, y, back), new THREE.Vector3(width - 0.55, y, back), 0),
    make(new THREE.Vector3(back, y, -0.45), new THREE.Vector3(back, y, depth - 0.55), Math.PI / 2),
  ];
}

/** Répète un ornement mural le long des deux murs, tous les `spacing` mètres. */
function alongWalls(
  width: number,
  depth: number,
  y: number,
  spacing: number,
  build: (index: number) => THREE.Object3D,
): THREE.Group {
  const result = new THREE.Group();
  let index = 0;
  for (const span of wallSpans(width, depth, y)) {
    const count = Math.max(1, Math.floor(span.length / spacing));
    for (let i = 0; i < count; i++) {
      const object = build(index++);
      object.position.copy(span.at((i + 0.5) / count, y));
      object.rotation.y = span.facing;
      result.add(object);
    }
  }
  return result;
}

/** Une guirlande (fanions ou ampoules) en haut des deux murs. */
function topGarland(
  width: number,
  depth: number,
  kind: 'bunting' | 'lights',
  colors: readonly number[],
): THREE.Group {
  const result = new THREE.Group();
  for (const span of wallSpans(width, depth, WALL_HEIGHT - 0.12)) {
    // Plusieurs festons de 3 m environ plutôt qu'une seule guirlande qui pend jusqu'au sol.
    const loops = Math.max(1, Math.round(span.length / 3));
    for (let i = 0; i < loops; i++) {
      const a = span.at(i / loops, span.from.y);
      const b = span.at((i + 1) / loops, span.from.y);
      result.add(
        kind === 'lights' ? lightString(a, b, colors) : bunting(a, b, colors, span.facing),
      );
    }
  }
  return result;
}

// --- Les thèmes --------------------------------------------------------------------------------

export interface ThemeModels {
  /** Modèles au sol, utilisés à tour de rôle. */
  readonly floor: readonly (() => THREE.Object3D)[];
  /** Petit objet posé sur les bureaux. */
  readonly desk: () => THREE.Object3D;
  /** Décor des murs du fond pour un bureau de `width` x `depth` cases. */
  readonly wall: (width: number, depth: number) => THREE.Group;
}

const C = {
  gold: 0xf5c542,
  silver: 0xd5dbe3,
  night: 0x2b3a67,
  magenta: 0xd94f9a,
  red: 0xd93a3a,
  pink: 0xf28fb1,
  rose: 0xe0405a,
  green: 0x2f8f4e,
  pine: 0x2a6b3f,
  orange: 0xf07f1e,
  purple: 0x6b3fa0,
  black: 0x2a2a30,
  slime: 0x7cf05a,
  cyan: 0x2de2e6,
  neonPink: 0xff4fb3,
  violet: 0x8f4fff,
  blue: 0x3a6fd9,
  turquoise: 0x3cc8c8,
  coral: 0xff7f6a,
  sand: 0xe8d29b,
  steel: 0xa0a8b5,
  pastelYellow: 0xf7e48a,
  pastelGreen: 0xa8e0b0,
  lilac: 0xc9b3f0,
  pastelPink: 0xf7b8cf,
  sky: 0xa9d8f5,
} as const;

const NEW_YEAR: ThemeModels = {
  floor: [
    // Seau à champagne sur pied.
    () =>
      group(
        post(0.03, 0.12, 0.7, PALETTE.dark),
        post(0.16, 0.12, 0.25, C.silver, 0, 0.7),
        post(0.04, 0.05, 0.3, C.pine, 0.03, 0.8, 0),
        post(0.02, 0.02, 0.08, C.gold, 0.03, 1.1, 0),
        post(0.04, 0.05, 0.28, C.pine, -0.06, 0.8, 0.04),
      ),
    // Bouquet de ballons or et argent.
    () =>
      group(
        post(0.08, 0.1, 0.08, PALETTE.dark),
        balloon(C.gold, -0.12, 0, 1.3),
        balloon(C.silver, 0.1, 0.05, 1.45),
        balloon(C.magenta, 0, -0.08, 1.6),
      ),
    // Boule à facettes sur un pied.
    () =>
      group(
        post(0.02, 0.15, 1.1, PALETTE.dark),
        new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), decorGlow(C.silver)).translateY(
          1.35,
        ),
      ),
  ],
  desk: () =>
    group(
      cone(0.06, 0.2, C.magenta, 0, 0, 0, 6),
      ball(0.025, C.gold, 0, 0.21, 0),
      post(0.01, 0.01, 0.12, C.gold, 0.1, 0, 0.05, 4),
    ),
  wall: (w, d) =>
    group(
      topGarland(w, d, 'lights', [C.gold, C.silver, C.magenta]),
      alongWalls(w, d, 1.45, 3, (i) =>
        // Horloge qui va sonner minuit.
        i % 2 === 0
          ? group(
              post(0.25, 0.25, 0.04, C.gold, 0, -0.02).rotateX(Math.PI / 2),
              box(0.02, 0.18, 0.02, PALETTE.dark, 0, -0.01, 0.04),
              box(0.02, 0.13, 0.02, PALETTE.dark, 0, -0.01, 0.04),
            )
          : flat(starShape(0.2, 0.09), 0.03, decorGlow(C.gold)),
      ),
    ),
};

const VALENTINE: ThemeModels = {
  floor: [
    // Grand cœur sur un pied.
    () => group(post(0.03, 0.12, 0.8, PALETTE.white), flat(heartShape(0.3), 0.08, C.rose, 0, 1.05)),
    // Vase de roses.
    () => {
      const result = group(post(0.12, 0.09, 0.35, PALETTE.white));
      for (const [x, z, h] of [
        [0, 0, 0.75],
        [0.07, 0.05, 0.7],
        [-0.07, 0.03, 0.68],
        [0.02, -0.07, 0.72],
      ] as const) {
        result.add(post(0.008, 0.008, h - 0.35, C.green, x, 0.35, z, 4));
        result.add(ball(0.045, C.rose, x, h, z));
      }
      return result;
    },
    // Peluche ourson géante (rose).
    () =>
      group(
        ball(0.26, C.pink, 0, 0.3, 0, 1.1),
        ball(0.19, C.pink, 0, 0.72, 0),
        ball(0.06, C.pink, -0.15, 0.88, 0),
        ball(0.06, C.pink, 0.15, 0.88, 0),
        ball(0.06, PALETTE.white, 0, 0.68, 0.17),
        flat(heartShape(0.08), 0.02, C.rose, 0, 0.35, 0.28),
      ),
  ],
  desk: () => flat(heartShape(0.08), 0.04, C.rose, 0, 0.09),
  wall: (w, d) =>
    group(
      topGarland(w, d, 'bunting', [C.rose, C.pink, PALETTE.white]),
      alongWalls(w, d, 1.4, 1.6, (i) =>
        flat(heartShape(i % 2 === 0 ? 0.16 : 0.1), 0.03, i % 3 === 0 ? C.pink : C.rose),
      ),
    ),
};

const EASTER: ThemeModels = {
  floor: [
    // Œuf géant peint.
    () => group(egg(0.28, C.sky, C.pastelYellow), post(0.2, 0.22, 0.06, C.pastelGreen)),
    // Lapin assis.
    () => {
      const bunny = group(
        ball(0.22, PALETTE.white, 0, 0.24, 0, 1.1),
        ball(0.15, PALETTE.white, 0, 0.58, 0.04),
        ball(0.035, C.pastelPink, 0, 0.56, 0.18),
        ball(0.06, PALETTE.white, 0, 0.12, -0.22),
      );
      for (const x of [-0.06, 0.06]) {
        const ear = ball(0.045, PALETTE.white, x, 0.82, 0.02, 3);
        bunny.add(ear, ball(0.025, C.pastelPink, x, 0.82, 0.05, 3));
      }
      return bunny;
    },
    // Panier d'œufs.
    () => {
      const basket = group(post(0.25, 0.2, 0.22, PALETTE.wood, 0, 0, 0, 10));
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.02, 4, 12, Math.PI),
        material(PALETTE.woodDark),
      );
      handle.position.y = 0.22;
      basket.add(handle);
      const colors = [C.pastelPink, C.sky, C.pastelYellow, C.lilac, C.pastelGreen];
      colors.forEach((color, i) => {
        const a = (i / colors.length) * Math.PI * 2;
        basket.add(egg(0.06, color, PALETTE.white, Math.cos(a) * 0.12, 0.16, Math.sin(a) * 0.12));
      });
      return basket;
    },
  ],
  desk: () => egg(0.05, C.lilac, C.pastelYellow),
  wall: (w, d) =>
    group(
      topGarland(w, d, 'bunting', [C.pastelPink, C.sky, C.pastelYellow, C.pastelGreen, C.lilac]),
      alongWalls(w, d, 1.35, 1.8, (i) => {
        const colors = [C.pastelPink, C.sky, C.pastelYellow, C.lilac];
        return egg(0.09, colors[i % colors.length] ?? C.sky, PALETTE.white, 0, -0.12);
      }),
    ),
};

const SPACE: ThemeModels = {
  floor: [
    // Maquette de fusée.
    () => {
      const rocket = group(
        post(0.16, 0.16, 0.9, PALETTE.white, 0, 0.2, 0, 10),
        cone(0.16, 0.35, C.red, 0, 1.1, 0, 10),
        ball(0.07, C.sky, 0, 0.85, 0.15),
        cone(0.12, 0.2, decorGlow(C.orange), 0, 0, 0, 8),
      );
      for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
        const fin = box(0.04, 0.3, 0.16, C.red, Math.sin(a) * 0.17, 0.15, Math.cos(a) * 0.17);
        fin.rotation.y = a;
        rocket.add(fin);
      }
      return rocket;
    },
    // Planète à anneau sur un socle.
    () => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 4, 20), material(C.sand));
      ring.rotation.x = Math.PI / 2.4;
      ring.position.y = 1.05;
      return group(post(0.03, 0.13, 0.8, PALETTE.dark), ball(0.22, C.orange, 0, 1.05, 0), ring);
    },
    // Casque d'astronaute sur un piédestal.
    () =>
      group(
        box(0.4, 0.7, 0.4, PALETTE.white),
        ball(0.2, PALETTE.white, 0, 0.92, 0),
        ball(0.15, decorGlow(0x3a78c9), 0, 0.93, 0.08, 0.8),
      ),
  ],
  desk: () =>
    group(
      post(0.03, 0.03, 0.14, PALETTE.white, 0, 0.02),
      cone(0.03, 0.06, C.red, 0, 0.16),
      cone(0.04, 0.03, C.red),
    ),
  wall: (w, d) =>
    group(
      topGarland(w, d, 'lights', [PALETTE.white, C.sky]),
      alongWalls(w, d, 1.4, 1.5, (i) =>
        i % 3 === 0
          ? ball(0.14, i % 2 === 0 ? C.orange : C.blue)
          : flat(starShape(0.1, 0.045), 0.02, decorGlow(i % 2 === 0 ? C.gold : PALETTE.white)),
      ),
    ),
};

const MEDIEVAL: ThemeModels = {
  floor: [
    // Armure de chevalier.
    () =>
      group(
        box(0.3, 0.1, 0.25, PALETTE.woodDark),
        box(0.08, 0.6, 0.1, C.steel, -0.08, 0.1),
        box(0.08, 0.6, 0.1, C.steel, 0.08, 0.1),
        box(0.36, 0.5, 0.22, C.steel, 0, 0.7),
        box(0.08, 0.45, 0.08, C.steel, -0.23, 0.72),
        box(0.08, 0.45, 0.08, C.steel, 0.23, 0.72),
        post(0.12, 0.13, 0.26, C.steel, 0, 1.2, 0, 8),
        box(0.18, 0.03, 0.02, PALETTE.dark, 0, 1.33, 0.12),
        cone(0.03, 0.15, 0xa8323a, 0, 1.46, 0, 6),
      ),
    // Épée dans le rocher.
    () =>
      group(
        ball(0.3, 0x8a8f99, 0, 0.12, 0, 0.6),
        box(0.05, 0.55, 0.015, C.silver, 0, 0.25),
        box(0.24, 0.04, 0.05, C.gold, 0, 0.78),
        box(0.04, 0.16, 0.04, PALETTE.woodDark, 0, 0.82),
        ball(0.035, C.gold, 0, 1, 0),
      ),
    // Torchère.
    () =>
      group(
        post(0.04, 0.1, 1.1, PALETTE.dark),
        post(0.1, 0.06, 0.12, PALETTE.dark, 0, 1.1),
        cone(0.08, 0.22, decorGlow(C.orange), 0, 1.2, 0, 6),
        cone(0.045, 0.14, decorGlow(C.gold), 0, 1.22, 0, 6),
      ),
  ],
  desk: () =>
    group(
      post(0.04, 0.05, 0.06, C.gold),
      post(0.035, 0.03, 0.08, C.gold, 0, 0.06),
      cone(0.015, 0.04, C.red, 0, 0.14),
    ),
  wall: (w, d) =>
    group(
      topGarland(w, d, 'bunting', [0xa8323a, C.gold, C.blue]),
      alongWalls(w, d, 1.3, 2, (i) => {
        const color = i % 2 === 0 ? 0xa8323a : C.blue;
        // Bouclier ou bannière.
        return i % 2 === 0
          ? group(
              box(0.36, 0.42, 0.04, color, 0, -0.25),
              cone(0.255, 0.18, color, 0, -0.42, 0, 4).rotateX(Math.PI).translateY(0.08),
              box(0.06, 0.4, 0.05, C.gold, 0, -0.25),
              box(0.3, 0.06, 0.05, C.gold, 0, -0.06),
            )
          : group(
              box(0.5, 0.03, 0.03, PALETTE.woodDark, 0, 0.25),
              box(0.4, 0.8, 0.02, color, 0, -0.55),
              flat(triangleShape(0.4, 0.15), 0.02, color, 0, -0.55),
              ball(0.07, C.gold, 0, -0.1, 0.02),
            );
      }),
    ),
};

const SUPERHEROES: ThemeModels = {
  floor: [
    // Mannequin portant une cape.
    () => {
      const cape = box(0.42, 0.85, 0.03, C.red, 0, 0.45, -0.14);
      cape.rotation.x = 0.12;
      return group(
        post(0.12, 0.15, 0.06, PALETTE.dark),
        post(0.025, 0.025, 0.45, PALETTE.dark),
        box(0.36, 0.55, 0.22, C.blue, 0, 0.45),
        ball(0.12, PALETTE.skin, 0, 1.13),
        box(0.25, 0.06, 0.03, PALETTE.dark, 0, 1.13, 0.1),
        flat(boltShape(0.13), 0.02, C.gold, 0, 0.75, 0.12),
        cape,
      );
    },
    // Silhouette de ville en carton.
    () => {
      const city = new THREE.Group();
      [0.9, 1.3, 0.7, 1.1].forEach((h, i) => {
        city.add(box(0.22, h, 0.08, i % 2 === 0 ? C.night : C.blue, -0.36 + i * 0.24, 0, 0));
        for (let y = 0.2; y < h - 0.1; y += 0.25)
          city.add(box(0.06, 0.07, 0.01, decorGlow(C.gold), -0.36 + i * 0.24, y, 0.045));
      });
      return city;
    },
    // Podium du héros du sprint.
    () =>
      group(
        box(0.7, 0.25, 0.5, C.red),
        box(0.5, 0.2, 0.45, C.blue, 0, 0.25),
        flat(starShape(0.18, 0.08), 0.03, C.gold, 0, 0.65, 0),
      ),
  ],
  desk: () =>
    group(box(0.08, 0.1, 0.04, C.blue), flat(boltShape(0.05), 0.01, C.gold, 0, 0.05, 0.025)),
  wall: (w, d) =>
    group(
      topGarland(w, d, 'bunting', [C.red, C.blue, C.gold]),
      alongWalls(w, d, 1.35, 2, (i) => {
        // Écusson rond avec un éclair (emblème inventé).
        const disc = post(0.22, 0.22, 0.04, i % 2 === 0 ? C.red : C.blue, 0, -0.02, 0, 12);
        disc.rotation.x = Math.PI / 2;
        return group(disc, flat(boltShape(0.16), 0.04, C.gold, 0, 0, 0.04));
      }),
    ),
};

const RETRO_80S: ThemeModels = {
  floor: [
    // Borne d'arcade.
    () =>
      group(
        box(0.55, 1.5, 0.5, C.violet),
        box(0.45, 0.35, 0.02, decorGlow(C.cyan), 0, 0.95, 0.24),
        box(0.5, 0.06, 0.3, PALETTE.dark, 0, 0.75, 0.25),
        post(0.015, 0.015, 0.08, PALETTE.dark, -0.1, 0.81, 0.28, 4),
        ball(0.03, C.red, -0.1, 0.9, 0.28),
        ball(0.025, C.gold, 0.08, 0.83, 0.3),
        ball(0.025, C.neonPink, 0.15, 0.83, 0.3),
        box(0.55, 0.14, 0.04, decorGlow(C.neonPink), 0, 1.38, 0.24),
      ),
    // Gros radiocassette.
    () =>
      group(
        box(0.12, 0.45, 0.12, PALETTE.dark),
        box(0.7, 0.32, 0.2, PALETTE.dark, 0, 0.45),
        post(0.1, 0.1, 0.02, C.silver, -0.22, 0.61, 0.1).rotateX(Math.PI / 2),
        post(0.1, 0.1, 0.02, C.silver, 0.22, 0.61, 0.1).rotateX(Math.PI / 2),
        box(0.18, 0.08, 0.02, decorGlow(C.cyan), 0, 0.6, 0.1),
        box(0.5, 0.04, 0.04, C.silver, 0, 0.8),
      ),
    // Lampe à lave.
    () =>
      group(
        cone(0.13, 0.18, PALETTE.dark, 0, 0, 0, 8),
        post(0.05, 0.11, 0.55, decorGlow(C.neonPink), 0, 0.18, 0, 8),
        cone(0.05, 0.08, PALETTE.dark, 0, 0.73, 0, 8),
        ball(0.05, decorGlow(C.gold), 0, 0.42, 0),
      ),
  ],
  desk: () =>
    group(
      box(0.16, 0.1, 0.02, PALETTE.dark),
      post(0.025, 0.025, 0.01, C.silver, -0.04, 0.05, 0.01).rotateX(Math.PI / 2),
      post(0.025, 0.025, 0.01, C.silver, 0.04, 0.05, 0.01).rotateX(Math.PI / 2),
    ),
  wall: (w, d) =>
    group(
      topGarland(w, d, 'lights', [C.neonPink, C.cyan, C.violet]),
      alongWalls(w, d, 1.35, 1.8, (i) =>
        i % 2 === 0
          ? // Disque vinyle.
            group(
              post(0.18, 0.18, 0.015, PALETTE.dark, 0, 0, 0, 16).rotateX(Math.PI / 2),
              post(0.06, 0.06, 0.02, C.neonPink, 0, 0, 0, 12).rotateX(Math.PI / 2),
            )
          : // Néon en zigzag.
            flat(boltShape(0.18), 0.03, decorGlow(C.cyan)),
      ),
    ),
};

const SUMMER: ThemeModels = {
  floor: [
    // Parasol et transat.
    () => {
      const umbrella = group(
        post(0.02, 0.02, 1.5, PALETTE.white),
        cone(0.5, 0.25, C.coral, 0, 1.4, 0, 8),
      );
      const chair = box(0.35, 0.05, 0.7, C.turquoise, 0.15, 0.2, 0.05);
      chair.rotation.x = -0.25;
      umbrella.add(chair, box(0.04, 0.2, 0.04, PALETTE.white, 0.15, 0, 0.3));
      return umbrella;
    },
    // Palmier en pot.
    () => {
      const palm = group(post(0.18, 0.14, 0.3, PALETTE.terracotta));
      for (let i = 0; i < 4; i++)
        palm.add(post(0.05, 0.06, 0.28, PALETTE.woodDark, 0.02 * i, 0.3 + i * 0.27, 0, 6));
      for (let i = 0; i < 6; i++) {
        const leaf = box(0.12, 0.02, 0.55, C.green, 0, 0, 0.25);
        const holder = new THREE.Group();
        holder.add(leaf);
        holder.position.set(0.06, 1.42, 0);
        holder.rotation.y = (i / 6) * Math.PI * 2;
        leaf.rotation.x = 0.45;
        palm.add(holder);
      }
      return palm;
    },
    // Bouée flamant rose et ballon de plage.
    () => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.09, 6, 14), material(C.pink));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.09;
      const neck = post(0.04, 0.05, 0.45, C.pink, 0, 0.1, -0.25, 6);
      return group(
        ring,
        neck,
        ball(0.08, C.pink, 0, 0.6, -0.22),
        cone(0.03, 0.08, PALETTE.dark, 0, 0.57, -0.13, 4).rotateX(Math.PI / 2),
        ball(0.12, PALETTE.white, 0.32, 0.12, 0.25),
        ball(0.121, C.turquoise, 0.32, 0.12, 0.25, 0.3),
      );
    },
  ],
  desk: () =>
    group(
      post(0.04, 0.03, 0.12, decorGlow(C.coral)),
      post(0.005, 0.005, 0.12, PALETTE.white, 0.015, 0.08, 0, 4),
      cone(0.05, 0.03, C.turquoise, 0, 0.12, 0, 6),
    ),
  wall: (w, d) =>
    group(
      topGarland(w, d, 'bunting', [C.turquoise, C.coral, C.pastelYellow]),
      alongWalls(w, d, 1.35, 2.2, (i) =>
        i % 2 === 0
          ? // Soleil.
            group(
              ball(0.15, decorGlow(C.gold), 0, 0, 0, 1),
              flat(starShape(0.24, 0.16, 10), 0.02, C.gold, 0, 0, -0.02),
            )
          : // Planche de surf.
            ball(0.12, C.coral, 0, -0.2, 0.02, 4.5),
      ),
    ),
};

const PIRATES: ThemeModels = {
  floor: [
    // Coffre au trésor ouvert.
    () => {
      const lid = box(0.55, 0.06, 0.38, PALETTE.woodDark, 0, 0, -0.19);
      const hinge = new THREE.Group();
      hinge.add(lid);
      hinge.position.set(0, 0.36, -0.18);
      hinge.rotation.x = -1.1;
      lid.position.z = -0.0;
      return group(
        box(0.55, 0.35, 0.38, PALETTE.wood),
        box(0.57, 0.05, 0.4, C.gold, 0, 0.1),
        box(0.08, 0.1, 0.02, C.gold, 0, 0.2, 0.2),
        ball(0.2, decorGlow(C.gold), 0, 0.33, 0, 0.4),
        hinge,
      );
    },
    // Tonneau.
    () =>
      group(
        post(0.22, 0.22, 0.6, PALETTE.wood, 0, 0, 0, 10),
        post(0.235, 0.235, 0.05, PALETTE.dark, 0, 0.1, 0, 10),
        post(0.235, 0.235, 0.05, PALETTE.dark, 0, 0.45, 0, 10),
      ),
    // Barre de navire.
    () => {
      const wheel = new THREE.Group();
      wheel.add(
        new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 4, 16), material(PALETTE.woodDark)),
      );
      for (let i = 0; i < 8; i++) {
        const spoke = box(0.03, 0.75, 0.03, PALETTE.wood, 0, -0.375, 0);
        spoke.rotation.z = (i / 8) * Math.PI;
        wheel.add(spoke);
      }
      wheel.position.y = 0.95;
      return group(
        box(0.12, 0.8, 0.12, PALETTE.woodDark),
        box(0.4, 0.06, 0.3, PALETTE.woodDark),
        wheel,
      );
    },
  ],
  desk: () =>
    group(
      post(0.04, 0.035, 0.08, PALETTE.wood),
      post(0.012, 0.012, 0.06, C.pine, 0, 0.08, 0, 6),
      box(0.05, 0.03, 0.02, PALETTE.white, 0, 0.12, 0),
    ),
  wall: (w, d) =>
    group(
      topGarland(w, d, 'bunting', [C.black, PALETTE.white, C.red]),
      alongWalls(w, d, 1.35, 2.5, (i) =>
        i % 2 === 0
          ? // Drapeau noir à tête de mort.
            group(
              box(0.6, 0.4, 0.02, C.black),
              ball(0.07, PALETTE.white, 0, 0.23, 0.02),
              box(0.25, 0.03, 0.02, PALETTE.white, 0, 0.12, 0.02).rotateZ(0.6),
              box(0.25, 0.03, 0.02, PALETTE.white, 0, 0.12, 0.02).rotateZ(-0.6),
            )
          : // Bouée de sauvetage.
            new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 12), material(C.red)),
      ),
    ),
};

const HALLOWEEN: ThemeModels = {
  floor: [
    // Pile de citrouilles sculptées.
    () =>
      group(
        pumpkin(0.24, true, 0, 0.05),
        pumpkin(0.14, false, 0.28, -0.15),
        pumpkin(0.12, true, -0.28, -0.1),
      ),
    // Fantôme.
    () =>
      group(
        cone(0.3, 0.7, PALETTE.white, 0, 0, 0, 10),
        ball(0.22, PALETTE.white, 0, 0.75, 0),
        ball(0.04, PALETTE.dark, -0.08, 0.8, 0.19),
        ball(0.04, PALETTE.dark, 0.08, 0.8, 0.19),
        ball(0.05, PALETTE.dark, 0, 0.67, 0.2, 1.4),
      ),
    // Chaudron bouillonnant.
    () =>
      group(
        ball(0.28, C.black, 0, 0.28, 0, 0.85),
        post(0.24, 0.24, 0.03, decorGlow(C.slime), 0, 0.46),
        ball(0.05, decorGlow(C.slime), 0.08, 0.52, 0.02),
        ball(0.035, decorGlow(C.slime), -0.1, 0.53, -0.05),
        new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.02, 4, 12), material(C.black))
          .rotateX(Math.PI / 2)
          .translateZ(-0.48),
      ),
  ],
  desk: () => pumpkin(0.07, true),
  wall: (w, d) =>
    group(
      topGarland(w, d, 'lights', [C.orange, C.purple, C.slime]),
      alongWalls(w, d, 1.55, 1.4, (i) => {
        // Chauve-souris.
        const bat = group(ball(0.05, C.black, 0, 0, 0, 1.2));
        for (const side of [-1, 1]) {
          const wing = flat(triangleShape(0.2, 0.12), 0.01, C.black, side * 0.11, 0.05, 0);
          wing.rotation.z = side * 0.3;
          bat.add(wing);
        }
        bat.rotation.z = (i % 3) * 0.2 - 0.2;
        return bat;
      }),
    ),
};

const CYBERPUNK: ThemeModels = {
  floor: [
    // Colonne de néons.
    () =>
      group(
        box(0.3, 1.6, 0.3, PALETTE.dark),
        box(0.04, 1.5, 0.04, decorGlow(C.cyan), -0.15, 0.05, 0.15),
        box(0.04, 1.5, 0.04, decorGlow(C.neonPink), 0.15, 0.05, 0.15),
        box(0.32, 0.04, 0.32, decorGlow(C.violet), 0, 1.6),
      ),
    // Écran holographique.
    () =>
      group(
        post(0.15, 0.2, 0.1, PALETTE.dark),
        box(0.02, 0.5, 0.02, PALETTE.dark, 0, 0.1),
        box(0.6, 0.4, 0.01, decorGlow(C.cyan), 0, 0.65, 0),
        box(0.4, 0.04, 0.012, decorGlow(C.neonPink), 0, 0.85, 0.005),
        box(0.25, 0.04, 0.012, decorGlow(C.gold), -0.08, 0.75, 0.005),
      ),
    // Robot de service.
    () =>
      group(
        post(0.18, 0.22, 0.5, C.steel, 0, 0, 0, 8),
        ball(0.17, C.steel, 0, 0.65, 0),
        box(0.24, 0.05, 0.02, decorGlow(C.neonPink), 0, 0.66, 0.15),
        post(0.01, 0.01, 0.15, PALETTE.dark, 0, 0.8, 0, 4),
        ball(0.03, decorGlow(C.cyan), 0, 0.97, 0),
      ),
  ],
  desk: () =>
    group(
      box(0.14, 0.02, 0.06, PALETTE.dark),
      box(0.12, 0.012, 0.04, decorGlow(C.neonPink), 0, 0.02),
    ),
  wall: (w, d) =>
    group(
      topGarland(w, d, 'lights', [C.cyan, C.neonPink, C.violet]),
      alongWalls(w, d, 1.2, 1.5, (i) =>
        // Bandes de néon horizontales.
        box(1, 0.04, 0.02, decorGlow(i % 2 === 0 ? C.cyan : C.neonPink), 0, i % 2 === 0 ? 0 : 0.3),
      ),
    ),
};

const CHRISTMAS: ThemeModels = {
  floor: [
    // Sapin décoré.
    () => {
      const tree = group(post(0.06, 0.08, 0.2, PALETTE.woodDark), post(0.2, 0.2, 0.1, C.red));
      [
        [0.45, 0.5, 0.2],
        [0.36, 0.45, 0.55],
        [0.26, 0.4, 0.88],
      ].forEach(([r, h, y]) => tree.add(cone(r ?? 0, h ?? 0, C.pine, 0, y, 0, 8)));
      const colors = [C.red, C.gold, C.sky, C.magenta];
      for (let i = 0; i < 10; i++) {
        const a = i * 2.4;
        const y = 0.35 + (i % 5) * 0.18;
        const r = 0.4 - (i % 5) * 0.07;
        tree.add(
          ball(
            0.04,
            decorGlow(colors[i % colors.length] ?? C.red),
            Math.cos(a) * r,
            y,
            Math.sin(a) * r,
          ),
        );
      }
      tree.add(flat(starShape(0.1, 0.045), 0.03, decorGlow(C.gold), 0, 1.38, 0));
      return tree;
    },
    // Pile de cadeaux.
    () =>
      group(
        gift(0.4, 0.3, C.red, C.gold, -0.12, 0, 0.05),
        gift(0.3, 0.25, C.green, C.red, 0.2, 0, -0.1),
        gift(0.22, 0.18, C.gold, C.red, -0.08, 0.3, 0.05),
      ),
    // Bonhomme de neige.
    () =>
      group(
        ball(0.28, PALETTE.white, 0, 0.27, 0),
        ball(0.2, PALETTE.white, 0, 0.68, 0),
        ball(0.14, PALETTE.white, 0, 0.98, 0),
        cone(0.025, 0.12, C.orange, 0, 0.98, 0.16, 6).rotateX(Math.PI / 2),
        post(0.1, 0.1, 0.03, PALETTE.dark, 0, 1.08),
        post(0.07, 0.07, 0.15, PALETTE.dark, 0, 1.1),
        new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 4, 10), material(C.red))
          .rotateX(Math.PI / 2)
          .translateZ(-0.84),
      ),
  ],
  desk: () => gift(0.09, 0.07, C.red, C.gold),
  wall: (w, d) =>
    group(
      topGarland(w, d, 'lights', [C.red, C.gold, C.green, C.sky]),
      alongWalls(w, d, 1.35, 2.4, () => {
        // Couronne de l'Avent.
        const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 6, 14), material(C.pine));
        return group(
          wreath,
          ball(0.05, C.red, 0, -0.2, 0.06),
          ball(0.04, C.red, 0.06, -0.18, 0.07),
        );
      }),
    ),
};

export const THEME_MODELS: Readonly<Record<DecorTheme, ThemeModels>> = {
  NEW_YEAR,
  VALENTINE,
  EASTER,
  SPACE,
  MEDIEVAL,
  SUPERHEROES,
  RETRO_80S,
  SUMMER,
  PIRATES,
  HALLOWEEN,
  CYBERPUNK,
  CHRISTMAS,
};

// --- Table d'anniversaire ---------------------------------------------------------------------

/** Gâteau à deux étages, bougies allumées (factice, comme tout ce qui est sur la table). */
export function birthdayCake(): THREE.Group {
  const cake = group(
    post(0.24, 0.24, 0.02, PALETTE.white, 0, 0, 0, 16),
    post(0.2, 0.2, 0.14, C.pastelPink, 0, 0.02, 0, 16),
    post(0.205, 0.205, 0.03, PALETTE.white, 0, 0.13, 0, 16),
    post(0.13, 0.13, 0.1, 0x6b3a22, 0, 0.16, 0, 14),
    post(0.135, 0.135, 0.02, PALETTE.white, 0, 0.25, 0, 14),
  );
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const x = Math.cos(a) * 0.08;
    const z = Math.sin(a) * 0.08;
    cake.add(post(0.008, 0.008, 0.08, i % 2 === 0 ? C.sky : C.gold, x, 0.27, z, 5));
    cake.add(cone(0.012, 0.03, decorGlow(0xffc94d), x, 0.35, z, 5));
  }
  return cake;
}

/** Tout ce qui est posé sur la table : gâteau, cadeaux, assiettes, chapeaux, ballons. */
export function partyProps(tableTop: number): THREE.Group {
  const props = new THREE.Group();
  const cake = birthdayCake();
  cake.position.set(-0.25, tableTop, 0);
  props.add(cake);
  props.add(gift(0.2, 0.16, C.blue, C.gold, 0.25, tableTop, -0.1));
  props.add(gift(0.14, 0.12, C.coral, PALETTE.white, 0.5, tableTop, 0.08));
  props.add(gift(0.16, 0.2, C.pastelGreen, C.magenta, 0.05, tableTop, -0.18));
  for (const [x, z] of [
    [-0.7, 0.15],
    [-0.55, -0.15],
    [0.7, -0.15],
  ] as const) {
    props.add(post(0.07, 0.07, 0.01, PALETTE.white, x, tableTop, z, 10));
  }
  // Chapeaux pointus et cotillons.
  props.add(cone(0.05, 0.14, C.magenta, -0.75, tableTop, -0.12, 6));
  props.add(cone(0.05, 0.14, C.turquoise, 0.72, tableTop, 0.15, 6));
  props.add(ball(0.015, C.gold, -0.75, tableTop + 0.15, -0.12));
  props.add(ball(0.015, C.gold, 0.72, tableTop + 0.15, 0.15));
  // Bouquet de ballons attaché au coin de la table.
  props.add(balloon(C.red, 0.85, -0.2, 1.7));
  props.add(balloon(C.gold, 0.95, -0.1, 1.85));
  props.add(balloon(C.sky, 0.8, -0.05, 1.95));
  // Banderole « Joyeux anniversaire » : fanions multicolores entre deux mâts.
  const colors = [C.red, C.gold, C.turquoise, C.magenta, C.pastelGreen];
  props.add(post(0.012, 0.012, 1.55, PALETTE.white, -0.95, 0, -0.3, 4));
  props.add(post(0.012, 0.012, 1.55, PALETTE.white, 0.6, 0, -0.3, 4));
  props.add(
    bunting(
      new THREE.Vector3(-0.95, 1.52, -0.3),
      new THREE.Vector3(0.6, 1.52, -0.3),
      colors,
      0,
      0.1,
    ),
  );
  return props;
}
