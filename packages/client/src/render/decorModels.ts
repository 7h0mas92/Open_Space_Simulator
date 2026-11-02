/**
 * Décorations de saison et table d'anniversaire, en formes Three.js low-poly.
 *
 * Aucun pack Kenney ne contient de décorations de fête : tout est assemblé ici avec des boîtes,
 * cylindres, cônes et sphères, dans le même esprit que `primitives.ts`. Repère : une case mesure
 * 1 x 1, l'objet est posé au sol (y = 0), centré, et regarde vers +z (vers la caméra).
 *
 * Par thème :
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
