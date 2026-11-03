/**
 * Décorations de saison et table d'anniversaire, en formes Three.js low-poly.
 *
 * Aucun pack Kenney ne contient de décorations de fête : tout est assemblé ici avec des boîtes,
 * cylindres, cônes et sphères, dans le même esprit que `primitives.ts`. Repère : une case mesure
 * 1 x 1, l'objet est posé au sol (y = 0), centré, et regarde vers +z (vers la caméra).
 *
 * Par thème :
 * - `desk` : un petit objet posé sur chaque bureau ;
 * - `wall` : une guirlande (fil et ampoules, ou cordelette et fanions) tendue en festons sous le
 *   plafond, et un ornement accroché entre deux appliques, jamais devant une fenêtre ni un grand
 *   meuble (les emplacements viennent de `decorWalls`, dans `decorations.ts`).
 * Les pièces d'un thème sont fusionnées par matériau (`Pieces`) : un mur entier se dessine en
 * quatre appels au plus, et les ampoules scintillent en trois phases décalées.
 */
import * as THREE from 'three';
import type { DecorTheme } from '@oss/shared';
import { Pieces, tint } from './pieces';
import { material, PALETTE } from './primitives';

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

// --- Assemblage fusionné ---------------------------------------------------------------------

type At = readonly [number, number, number];

/**
 * Ampoules, néons et flammes des thèmes : trois matériaux non éclairés (lisibles même la nuit),
 * peints par sommet. Trois phases décalées font scintiller les guirlandes sans que toutes les
 * ampoules battent ensemble ; tout un mur tient ainsi en quatre maillages au plus.
 */
function bulbMaterial(phase: number): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
  mat.name = `decor-bulbs-${phase}`;
  return mat;
}
const BULBS = [bulbMaterial(0), bulbMaterial(1), bulbMaterial(2)] as const;

/** Les matériaux des ampoules (animés par `DecorationsView`). */
export function decorBulbMaterials(): readonly THREE.MeshBasicMaterial[] {
  return BULBS;
}

/**
 * Un décor en cours d'assemblage : des pièces placées dans son repère, fusionnées à la fin par
 * matériau (`Pieces`). Les ornements d'un mur sont construits chacun dans son repère, puis
 * « tamponnés » à leur place sur le mur.
 */
class Kit {
  private readonly p = new Pieces();

  box(w: number, h: number, d: number, color: number, at: At, tilt: Tilt = {}): void {
    this.p.box(w, h, d, color, at, tilt);
  }

  soft(w: number, h: number, d: number, r: number, color: number, at: At, tilt: Tilt = {}): void {
    this.p.soft(w, h, d, r, color, at, tilt);
  }

  /** Cylindre vertical posé sur `y`. */
  post(top: number, bottom: number, h: number, color: number, at: At, segments = 10): void {
    this.p.post(top, bottom, h, color, at, segments);
  }

  /** Cône posé sur `y`, pointe en haut. */
  cone(r: number, h: number, color: number, at: At, segments = 8): void {
    this.p.post(0.0005, r, h, color, at, segments);
  }

  /** Cône centré en `at`, pointe tournée de `turn` dans le plan du mur (pointe de flèche). */
  coneAt(r: number, h: number, color: number, at: At, turn: number): void {
    this.p.shape(new THREE.ConeGeometry(r, h, 8), color, at, { z: turn });
  }

  /** Géométrie déjà placée dans le repère du décor (fanion), peinte d'une couleur. */
  piece(geometry: THREE.BufferGeometry, color: number): void {
    this.p.shape(geometry, color, [0, 0, 0]);
  }

  /** Sphère facettée centrée en `at`, étirée par `scale`. */
  ball(r: number, color: number, at: At, scale: At = [1, 1, 1], detail = 1): void {
    const geometry = new THREE.IcosahedronGeometry(r, detail).scale(...scale);
    this.p.shape(geometry, color, at);
  }

  /** Disque face à +z (horloge, disque vinyle, écusson), centré en `at`. */
  disc(r: number, depth: number, color: number, at: At, segments = 18): void {
    this.p.shape(new THREE.CylinderGeometry(r, r, depth, segments), color, at, { x: Math.PI / 2 });
  }

  /** Anneau face à +z (couronne, bouée), centré en `at`. */
  ring(r: number, tube: number, color: number, at: At, arc = Math.PI * 2, turn = 0): void {
    this.p.shape(new THREE.TorusGeometry(r, tube, 5, 18, arc), color, at, { z: turn });
  }

  /** Forme plate extrudée face à +z, centrée en `at`, tournée de `turn` dans son plan. */
  flat(shape: THREE.Shape, depth: number, color: number, at: At, turn = 0): void {
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geometry.translate(0, 0, -depth / 2);
    this.p.shape(geometry, color, at, { z: turn });
  }

  /** Barre tendue entre deux points (pattes, hampes, aiguilles). */
  bar(from: At, to: At, radius: number, color: number, segments = 5): void {
    this.p.bar(from, to, radius, color, segments);
  }

  /** Pièce lumineuse : ampoule, néon, flamme ou visage de citrouille. */
  glow(geometry: THREE.BufferGeometry, color: number, at: At, phase = 0, tilt: Tilt = {}): void {
    tint(geometry, color);
    if (tilt.x) geometry.rotateX(tilt.x);
    if (tilt.z) geometry.rotateZ(tilt.z);
    if (tilt.y) geometry.rotateY(tilt.y);
    geometry.translate(...at);
    this.p.add(geometry, BULBS[phase % BULBS.length] ?? BULBS[0]);
  }

  glowBall(r: number, color: number, at: At, phase = 0, scaleY = 1): void {
    this.glow(new THREE.IcosahedronGeometry(r, 1).scale(1, scaleY, 1), color, at, phase);
  }

  glowBox(w: number, h: number, d: number, color: number, at: At, phase = 0, turn = 0): void {
    this.glow(new THREE.BoxGeometry(w, h, d), color, at, phase, { z: turn });
  }

  glowFlat(shape: THREE.Shape, depth: number, color: number, at: At, phase = 0): void {
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geometry.translate(0, 0, -depth / 2);
    this.glow(geometry, color, at, phase);
  }

  /** Tube le long d'une courbe (fil de guirlande, cordelette). */
  tube(points: readonly THREE.Vector3[], radius: number, color: number): void {
    const curve = new THREE.CatmullRomCurve3([...points]);
    this.p.shape(
      new THREE.TubeGeometry(curve, points.length * 2, radius, 4, false),
      color,
      [0, 0, 0],
    );
  }

  /** Recopie un autre décor (un ornement) à la place donnée par `matrix`. */
  stamp(other: Kit, matrix: THREE.Matrix4): void {
    for (const child of other.build('stamp').children) {
      if (!(child instanceof THREE.Mesh)) continue;
      const geometry = (child.geometry as THREE.BufferGeometry).applyMatrix4(matrix);
      this.p.add(geometry, child.material as THREE.Material);
    }
  }

  build(name: string): THREE.Group {
    return this.p.build(name);
  }
}

type Tilt = { readonly x?: number; readonly y?: number; readonly z?: number };

// --- Les murs ----------------------------------------------------------------------------------

/**
 * Un mur du fond tel que le voit le décor : 0, le mur du fond (le long de x, en z = -0.5) ;
 * 1, le mur de gauche (le long de z, en x = -0.5).
 */
export interface DecorWall {
  readonly side: 0 | 1;
  /** Morceaux de mur plein où tendre les guirlandes, de `from` à `to` (coordonnée le long du mur). */
  readonly spans: readonly (readonly [number, number])[];
  /** Cases où accrocher un ornement : entre les appliques, hors fenêtres, cloisons et grands meubles. */
  readonly spots: readonly number[];
}

/** Hauteur des clous des guirlandes, juste sous le plafond. */
const NAIL_Y = 2.06;
/** Centre des ornements : à hauteur des appliques (1,5 m), sous les guirlandes. */
export const ORNAMENT_Y = 1.4;
/** Les ornements sont dessinés petits, puis agrandis d'un coup à leur place sur le mur. */
const ORNAMENT_SCALE = 1.3;
/** Face intérieure des murs du fond (voir `WALL_AXIS` et `WALL_THICKNESS`). */
const WALL_FACE = -0.5;

/** Point du mur : `along` le long du mur, à la hauteur `y`, décollé de la paroi de `off`. */
function onWall(side: 0 | 1, along: number, y: number, off: number): THREE.Vector3 {
  const out = WALL_FACE + off;
  return side === 0 ? new THREE.Vector3(along, y, out) : new THREE.Vector3(out, y, along);
}

/** Les festons d'un morceau de mur : environ 2,4 m chacun, accrochés à des clous. */
export function festoons(span: readonly [number, number]): [number, number][] {
  const [from, to] = span;
  const count = Math.max(1, Math.round((to - from) / 2.4));
  const step = (to - from) / count;
  return Array.from({ length: count }, (_, i) => [from + i * step, from + (i + 1) * step]);
}

/** Points d'un feston qui pend entre deux clous (parabole), du clou de gauche à celui de droite. */
function sagging(side: 0 | 1, from: number, to: number, off: number, samples = 12) {
  const sag = Math.min(0.12, 0.04 + 0.03 * (to - from));
  return Array.from({ length: samples + 1 }, (_, i) => {
    const u = i / samples;
    return onWall(side, from + (to - from) * u, NAIL_Y - sag * 4 * u * (1 - u), off);
  });
}

/** Guirlande lumineuse : un fil vert sombre, des douilles et des ampoules qui pendent. */
function lightGarland(kit: Kit, walls: readonly DecorWall[], colors: readonly number[]): void {
  const wire = 0x1f3b2a;
  let bulb = 0;
  for (const wall of walls)
    for (const span of wall.spans)
      for (const [from, to] of festoons(span)) {
        const points = sagging(wall.side, from, to, 0.05);
        kit.tube(points, 0.006, wire);
        for (const end of [points[0], points[points.length - 1]])
          if (end) kit.box(0.025, 0.025, 0.04, 0x707479, [end.x, end.y - 0.012, end.z]);
        const count = Math.max(2, Math.round((to - from) / 0.2));
        const curve = new THREE.CatmullRomCurve3(points);
        for (let i = 1; i < count; i++) {
          const point = curve.getPoint(i / count);
          kit.box(0.018, 0.024, 0.018, wire, [point.x, point.y - 0.026, point.z]);
          const color = colors[bulb % colors.length] ?? PALETTE.yellow;
          kit.glowBall(0.024, color, [point.x, point.y - 0.046, point.z], bulb, 1.35);
          bulb++;
        }
      }
}

type FlagShape = 'triangle' | 'heart' | 'pennant';

/** Fanion qui pend sous la cordelette, pointe en bas, face à +z. */
function flagShape(kind: FlagShape): THREE.Shape {
  if (kind === 'heart') {
    const shape = heartShape(0.09);
    return shape;
  }
  const shape = new THREE.Shape();
  if (kind === 'pennant') {
    // Fanion à queue d'aronde.
    shape.moveTo(-0.09, 0);
    shape.lineTo(0.09, 0);
    shape.lineTo(0.09, -0.2);
    shape.lineTo(0, -0.14);
    shape.lineTo(-0.09, -0.2);
  } else {
    shape.moveTo(-0.1, 0);
    shape.lineTo(0.1, 0);
    shape.lineTo(0, -0.2);
  }
  shape.closePath();
  return shape;
}

/** Guirlande de fanions : une cordelette claire et des fanions qui suivent sa courbe. */
function flagGarland(
  kit: Kit,
  walls: readonly DecorWall[],
  colors: readonly number[],
  kind: FlagShape = 'triangle',
): void {
  let flag = 0;
  for (const wall of walls)
    for (const span of wall.spans)
      for (const [from, to] of festoons(span)) {
        const points = sagging(wall.side, from, to, 0.04);
        kit.tube(points, 0.005, 0xf3eee2);
        for (const end of [points[0], points[points.length - 1]])
          if (end) kit.box(0.025, 0.025, 0.04, 0x707479, [end.x, end.y - 0.012, end.z]);
        const curve = new THREE.CatmullRomCurve3(points);
        const count = Math.max(2, Math.round((to - from) / 0.3));
        for (let i = 0; i < count; i++) {
          const u = (i + 0.5) / count;
          const point = curve.getPoint(u);
          const tangent = curve.getTangent(u);
          const slope = Math.atan2(tangent.y, wall.side === 0 ? tangent.x : tangent.z);
          const geometry = new THREE.ExtrudeGeometry(flagShape(kind), {
            depth: 0.008,
            bevelEnabled: false,
          });
          if (kind === 'heart') geometry.translate(0, -0.1, 0);
          geometry.rotateZ(wall.side === 0 ? slope : -slope);
          geometry.rotateY(wall.side === 0 ? 0 : Math.PI / 2);
          geometry.translate(point.x, point.y - 0.004, point.z);
          kit.piece(geometry, colors[flag % colors.length] ?? PALETTE.red);
          flag++;
        }
      }
}

/** Accroche un ornement (construit dans son repère, face à +z) à chaque emplacement des murs. */
function ornaments(kit: Kit, walls: readonly DecorWall[], build: (index: number) => Kit): void {
  let index = 0;
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Matrix4().makeScale(ORNAMENT_SCALE, ORNAMENT_SCALE, ORNAMENT_SCALE);
  for (const wall of walls)
    for (const spot of wall.spots) {
      const at = onWall(wall.side, spot, ORNAMENT_Y, 0.01);
      matrix
        .makeRotationY(wall.side === 0 ? 0 : Math.PI / 2)
        .multiply(scale)
        .setPosition(at);
      kit.stamp(build(index++), matrix);
    }
}

// --- Formes ------------------------------------------------------------------------------------

/** Écu de blason : haut droit, flancs qui s'arrondissent jusqu'à la pointe. */
function shieldShape(w: number, h: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, h / 2);
  shape.lineTo(w / 2, h / 2);
  shape.lineTo(w / 2, 0);
  shape.quadraticCurveTo(w / 2, -h * 0.35, 0, -h / 2);
  shape.quadraticCurveTo(-w / 2, -h * 0.35, -w / 2, 0);
  shape.closePath();
  return shape;
}

/** Aile de chauve-souris festonnée, vers la droite (`side` = 1) ou la gauche (-1). */
function batWing(size: number, side: number): THREE.Shape {
  const s = size;
  const x = side * s;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.02 * s);
  shape.quadraticCurveTo(0.5 * x, 0.35 * s, x, 0.25 * s);
  shape.quadraticCurveTo(0.85 * x, 0.05 * s, 0.78 * x, -0.12 * s);
  shape.quadraticCurveTo(0.62 * x, -0.02 * s, 0.52 * x, -0.16 * s);
  shape.quadraticCurveTo(0.36 * x, -0.04 * s, 0.24 * x, -0.16 * s);
  shape.quadraticCurveTo(0.12 * x, -0.04 * s, 0, -0.08 * s);
  shape.closePath();
  return shape;
}

/** Planche de surf : un fuseau pointu en haut, arrondi en bas. */
function surfboardShape(w: number, h: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, h / 2);
  shape.quadraticCurveTo(w / 2, h * 0.2, w / 2, -h * 0.25);
  shape.quadraticCurveTo(w / 2, -h / 2, 0, -h / 2);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2, -h * 0.25);
  shape.quadraticCurveTo(-w / 2, h * 0.2, 0, h / 2);
  return shape;
}

/** Contour d'un rectangle en néon (quatre tubes). */
function neonFrame(kit: Kit, w: number, h: number, color: number, phase: number, z = 0.03): void {
  const t = 0.018;
  kit.glowBox(w, t, t, color, [0, h / 2, z], phase);
  kit.glowBox(w, t, t, color, [0, -h / 2, z], phase);
  kit.glowBox(t, h, t, color, [w / 2, 0, z], phase);
  kit.glowBox(t, h, t, color, [-w / 2, 0, z], phase);
}

/** Petit anneau d'accroche au-dessus d'un ornement, avec son clou. */
function hanger(kit: Kit, top: number, color = 0x8a8d92): void {
  kit.bar([0, top, 0.012], [0, top + 0.04, 0.006], 0.004, color, 4);
  kit.box(0.02, 0.02, 0.03, 0x707479, [0, top + 0.03, 0]);
}

// --- Les thèmes --------------------------------------------------------------------------------

export interface ThemeModels {
  /** Petit objet posé sur les bureaux (repère : le plateau, au centre de l'objet). */
  readonly desk: () => THREE.Object3D;
  /** Guirlandes et ornements des murs du fond. */
  readonly wall: (walls: readonly DecorWall[]) => THREE.Group;
}

const C = {
  gold: 0xf5c542,
  silver: 0xd5dbe3,
  night: 0x24305a,
  magenta: 0xd94f9a,
  red: 0xc8262e,
  pink: 0xf28fb1,
  rose: 0xe0405a,
  green: 0x2f8f4e,
  pine: 0x2a6b3f,
  pineLight: 0x3a8a52,
  pineDark: 0x1f5232,
  orange: 0xf07f1e,
  purple: 0x6b3fa0,
  black: 0x24242a,
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
  cream: 0xf6f1e4,
  warm: 0xffd27a,
  wood: 0x8a5a36,
  terracotta: 0xc2643f,
} as const;

/** Un décor de mur : la guirlande, puis les ornements. */
function wallOf(
  name: string,
  garland: (kit: Kit, walls: readonly DecorWall[]) => void,
  ornament: (index: number) => Kit,
): (walls: readonly DecorWall[]) => THREE.Group {
  return (walls) => {
    const kit = new Kit();
    garland(kit, walls);
    ornaments(kit, walls, ornament);
    return kit.build(`decor-${name}`);
  };
}

/** Un objet de bureau assemblé. */
function deskOf(name: string, draw: (kit: Kit) => void): () => THREE.Object3D {
  return () => {
    const kit = new Kit();
    draw(kit);
    return kit.build(`decor-desk-${name}`);
  };
}

const NEW_YEAR: ThemeModels = {
  // Bouteille de champagne et sa flûte.
  desk: deskOf('champagne', (k) => {
    k.post(0.028, 0.03, 0.12, 0x1f4a2e, [-0.03, 0, 0], 12);
    k.post(0.012, 0.028, 0.04, 0x1f4a2e, [-0.03, 0.12, 0], 12);
    k.post(0.014, 0.014, 0.035, C.gold, [-0.03, 0.155, 0], 10);
    k.post(0.0305, 0.0305, 0.04, C.cream, [-0.03, 0.04, 0], 12);
    k.post(0.03, 0.03, 0.004, 0xd9d4c4, [0.05, 0, 0.02], 12);
    k.post(0.003, 0.003, 0.05, 0xe8eef2, [0.05, 0.004, 0.02], 5);
    k.post(0.022, 0.008, 0.07, 0xf2e3a6, [0.05, 0.054, 0.02], 10);
  }),
  wall: wallOf(
    'new-year',
    (kit, walls) => lightGarland(kit, walls, [C.warm, C.cream, C.gold]),
    (i) => {
      const k = new Kit();
      if (i % 2 === 0) {
        // Horloge qui va sonner minuit.
        k.disc(0.17, 0.03, C.cream, [0, 0, 0.02], 24);
        k.ring(0.17, 0.018, C.gold, [0, 0, 0.035]);
        for (let h = 0; h < 12; h++) {
          const a = (h / 12) * Math.PI * 2;
          const r = h % 3 === 0 ? 0.13 : 0.135;
          k.box(
            0.012,
            h % 3 === 0 ? 0.03 : 0.018,
            0.006,
            0x2b2f3a,
            [Math.sin(a) * r, Math.cos(a) * r - 0.01, 0.038],
            { z: -a },
          );
        }
        k.box(0.016, 0.085, 0.006, 0x2b2f3a, [0, 0, 0.042]);
        k.box(0.01, 0.12, 0.006, 0x2b2f3a, [0, 0, 0.046], { z: 0.1 });
        k.disc(0.014, 0.012, C.gold, [0, 0, 0.05], 10);
        hanger(k, 0.19);
      } else {
        // Étoile dorée et ses éclats.
        k.glowFlat(starShape(0.13, 0.055), 0.03, C.gold, [0, 0, 0.03], i);
        for (let r = 0; r < 8; r++) {
          const a = (r / 8) * Math.PI * 2 + Math.PI / 8;
          k.glowBox(
            0.008,
            0.06,
            0.006,
            C.cream,
            [Math.sin(a) * 0.19, Math.cos(a) * 0.19, 0.03],
            i,
            -a,
          );
        }
      }
      return k;
    },
  ),
};

const VALENTINE: ThemeModels = {
  // Une rose dans un soliflore.
  desk: deskOf('rose', (k) => {
    k.post(0.022, 0.028, 0.09, 0xcfe6ee, [0, 0, 0], 10);
    k.post(0.014, 0.022, 0.02, 0xcfe6ee, [0, 0.09, 0], 10);
    k.bar([0, 0.1, 0], [0.008, 0.18, 0], 0.004, C.green);
    k.ball(0.022, C.green, [0.018, 0.14, 0], [1.4, 0.4, 0.8], 0);
    k.ball(0.028, C.red, [0.008, 0.195, 0], [1, 0.9, 1]);
    k.ball(0.02, 0x9e1b24, [0.008, 0.215, 0], [1, 0.8, 1], 0);
  }),
  wall: wallOf(
    'valentine',
    (kit, walls) => flagGarland(kit, walls, [C.rose, C.pink, C.cream], 'heart'),
    (i) => {
      const k = new Kit();
      if (i % 2 === 0) {
        // Grand cœur bordé de blanc, traversé d'une flèche.
        k.flat(heartShape(0.17), 0.02, C.cream, [0, 0.02, 0.012]);
        k.flat(heartShape(0.145), 0.035, C.rose, [0, 0.02, 0.03]);
        k.bar([-0.22, -0.1, 0.06], [0.2, 0.12, 0.06], 0.006, C.gold);
        const arrow = Math.atan2(0.22, 0.42);
        k.coneAt(0.022, 0.05, C.gold, [0.205, 0.123, 0.06], arrow - Math.PI / 2);
        k.box(0.04, 0.03, 0.006, C.pink, [-0.21, -0.11, 0.06], { z: arrow });
        hanger(k, 0.17);
      } else {
        // Trois petits cœurs qui pendent d'une tringle.
        k.bar([-0.16, 0.18, 0.02], [0.16, 0.18, 0.02], 0.007, C.gold);
        [-0.1, 0, 0.1].forEach((x, n) => {
          const y = [0.0, -0.08, 0.02][n] ?? 0;
          k.bar([x, 0.18, 0.02], [x, y + 0.08, 0.02], 0.002, C.cream, 3);
          k.flat(heartShape(0.055), 0.025, n === 1 ? C.pink : C.rose, [x, y + 0.03, 0.03]);
        });
        hanger(k, 0.18);
      }
      return k;
    },
  ),
};

const EASTER: ThemeModels = {
  // Panier en osier, herbe et trois œufs.
  desk: deskOf('easter-basket', (k) => {
    k.post(0.065, 0.05, 0.05, C.sand, [0, 0, 0], 12);
    k.post(0.067, 0.067, 0.012, 0xc7a66a, [0, 0.045, 0], 12);
    k.ball(0.05, C.pastelGreen, [0, 0.055, 0], [1.2, 0.3, 1.2], 0);
    const eggs: [number, number, number][] = [
      [-0.025, 0.07, 0.01],
      [0.025, 0.072, -0.012],
      [0.005, 0.07, 0.03],
    ];
    eggs.forEach((at, n) =>
      k.ball(0.022, [C.pastelPink, C.sky, C.pastelYellow][n] ?? C.lilac, at, [1, 1.3, 1]),
    );
    k.ring(0.06, 0.006, 0xc7a66a, [0, 0.06, 0], Math.PI);
  }),
  wall: wallOf(
    'easter',
    (kit, walls) =>
      flagGarland(kit, walls, [C.pastelPink, C.sky, C.pastelYellow, C.pastelGreen, C.lilac]),
    (i) => {
      const k = new Kit();
      if (i % 2 === 0) {
        // Couronne d'œufs pastel et son nœud.
        const colors = [C.pastelPink, C.sky, C.pastelYellow, C.lilac, C.pastelGreen];
        k.ring(0.14, 0.022, 0xc7a66a, [0, 0, 0.025]);
        for (let n = 0; n < 10; n++) {
          const a = (n / 10) * Math.PI * 2;
          k.ball(
            0.04,
            colors[n % colors.length] ?? C.sky,
            [Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0.05],
            [0.8, 1.05, 0.6],
          );
        }
        k.soft(0.09, 0.05, 0.02, 0.01, C.lilac, [-0.045, -0.175, 0.07], { z: 0.4 });
        k.soft(0.09, 0.05, 0.02, 0.01, C.lilac, [0.045, -0.175, 0.07], { z: -0.4 });
        k.ball(0.022, C.lilac, [0, -0.15, 0.075]);
        hanger(k, 0.16);
      } else {
        // Tête de lapin.
        k.ball(0.12, C.cream, [0, -0.04, 0.03], [1, 0.9, 0.4]);
        for (const side of [-1, 1]) {
          k.soft(0.06, 0.2, 0.03, 0.025, C.cream, [side * 0.05, 0.03, 0.03], { z: -side * 0.18 });
          k.soft(0.03, 0.14, 0.01, 0.012, C.pastelPink, [side * 0.052, 0.06, 0.05], {
            z: -side * 0.18,
          });
          k.ball(0.014, 0x2b2f3a, [side * 0.04, -0.02, 0.075], [1, 1, 0.5], 0);
          k.ball(0.025, C.pastelPink, [side * 0.06, -0.08, 0.07], [1, 0.7, 0.3], 0);
        }
        k.ball(0.016, C.pink, [0, -0.06, 0.08], [1.2, 0.8, 0.6], 0);
      }
      return k;
    },
  ),
};

const SPACE: ThemeModels = {
  // Maquette de fusée sur son socle.
  desk: deskOf('rocket', (k) => {
    k.post(0.05, 0.055, 0.015, 0x3a3f4b, [0, 0, 0], 12);
    k.post(0.024, 0.024, 0.13, C.cream, [0, 0.03, 0], 12);
    k.cone(0.024, 0.05, C.red, [0, 0.16, 0], 12);
    k.disc(0.011, 0.006, C.sky, [0, 0.12, 0.024], 10);
    for (let n = 0; n < 3; n++) {
      const a = (n / 3) * Math.PI * 2;
      k.box(0.006, 0.05, 0.035, C.red, [Math.sin(a) * 0.03, 0.025, Math.cos(a) * 0.03], {
        y: a,
      });
    }
    k.bar([0, 0.015, 0], [0, 0.03, 0], 0.006, 0x8a8d92);
  }),
  wall: wallOf(
    'space',
    (kit, walls) => lightGarland(kit, walls, [C.cream, C.sky, 0x7fb2ff]),
    (i) => {
      const k = new Kit();
      if (i % 2 === 0) {
        // Affiche encadrée : planète à anneau dans le ciel étoilé.
        k.soft(0.34, 0.42, 0.025, 0.006, 0x2b2f3a, [0, -0.21, 0]);
        k.box(0.3, 0.38, 0.006, C.night, [0, -0.19, 0.025]);
        k.ball(0.07, C.orange, [0.02, 0.0, 0.04], [1, 1, 0.4]);
        k.ring(0.11, 0.008, C.sand, [0.02, 0.0, 0.045], Math.PI * 2, 0.35);
        const stars: [number, number][] = [
          [-0.11, 0.13],
          [0.1, 0.14],
          [-0.08, -0.1],
          [0.12, -0.12],
          [-0.12, 0.02],
          [0.0, -0.15],
        ];
        stars.forEach(([x, y], n) => k.glowBox(0.012, 0.012, 0.006, C.cream, [x, y, 0.032], n));
        hanger(k, 0.21);
      } else {
        // Saturne en suspension.
        k.bar([0, 0.2, 0.06], [0, 0.07, 0.06], 0.002, C.cream, 3);
        k.ball(0.065, 0xe2b968, [0, 0, 0.06]);
        k.ring(0.1, 0.012, C.sand, [0, 0, 0.06], Math.PI * 2, 0.4);
        k.box(0.022, 0.022, 0.06, 0x707479, [0, 0.2, 0.03]);
      }
      return k;
    },
  ),
};

const MEDIEVAL: ThemeModels = {
  // Calice doré serti d'un rubis.
  desk: deskOf('goblet', (k) => {
    k.post(0.04, 0.045, 0.012, C.gold, [0, 0, 0], 12);
    k.post(0.01, 0.014, 0.06, C.gold, [0, 0.012, 0], 8);
    k.ball(0.014, C.gold, [0, 0.07, 0], [1.2, 0.8, 1.2]);
    k.post(0.045, 0.022, 0.06, C.gold, [0, 0.075, 0], 12);
    k.ball(0.01, 0xb3202c, [0, 0.1, 0.035], [1, 1, 0.6], 0);
  }),
  wall: wallOf(
    'medieval',
    (kit, walls) => flagGarland(kit, walls, [0xa8323a, C.gold, C.blue], 'pennant'),
    (i) => {
      const k = new Kit();
      const color = i % 2 === 0 ? 0xa8323a : C.blue;
      if (i % 2 === 0) {
        // Écu bordé d'or, croix au centre.
        k.flat(shieldShape(0.3, 0.38), 0.025, C.gold, [0, -0.02, 0.013]);
        k.flat(shieldShape(0.26, 0.34), 0.035, color, [0, -0.015, 0.03]);
        k.box(0.04, 0.24, 0.008, C.gold, [0, -0.15, 0.05]);
        k.box(0.18, 0.04, 0.008, C.gold, [0, -0.05, 0.05]);
        hanger(k, 0.17);
      } else {
        // Bannière sur sa hampe, emblème doré.
        k.bar([-0.16, 0.19, 0.04], [0.16, 0.19, 0.04], 0.01, C.wood);
        k.ball(0.018, C.gold, [-0.17, 0.19, 0.04]);
        k.ball(0.018, C.gold, [0.17, 0.19, 0.04]);
        const cloth = new THREE.Shape();
        cloth.moveTo(-0.12, 0);
        cloth.lineTo(0.12, 0);
        cloth.lineTo(0.12, -0.38);
        cloth.lineTo(0, -0.3);
        cloth.lineTo(-0.12, -0.38);
        cloth.closePath();
        k.flat(cloth, 0.012, color, [0, 0.18, 0.03]);
        k.disc(0.05, 0.01, C.gold, [0, 0.02, 0.04], 14);
        k.flat(starShape(0.035, 0.016), 0.012, color, [0, 0.02, 0.046]);
        k.box(0.022, 0.022, 0.03, 0x707479, [0, 0.21, 0.015]);
      }
      return k;
    },
  ),
};

const SUPERHEROES: ThemeModels = {
  // Figurine de super-héros (inventé) à cape rouge.
  desk: deskOf('hero', (k) => {
    k.post(0.035, 0.04, 0.012, 0x2b2f3a, [0, 0, 0], 12);
    for (const side of [-1, 1]) k.box(0.016, 0.05, 0.02, C.blue, [side * 0.012, 0.012, 0]);
    k.soft(0.05, 0.05, 0.028, 0.008, C.blue, [0, 0.06, 0]);
    k.box(0.05, 0.008, 0.03, C.gold, [0, 0.06, 0]);
    k.box(0.052, 0.08, 0.006, C.red, [0, 0.03, -0.02], { x: -0.15 });
    k.flat(boltShape(0.014), 0.004, C.gold, [0, 0.09, 0.016]);
    k.ball(0.019, 0xf0c39a, [0, 0.13, 0]);
    k.box(0.04, 0.012, 0.03, C.blue, [0, 0.13, 0.004]);
  }),
  wall: wallOf(
    'superheroes',
    (kit, walls) => flagGarland(kit, walls, [C.red, C.blue, C.gold]),
    (i) => {
      const k = new Kit();
      if (i % 2 === 0) {
        // Écusson rond cerclé, éclair doré (emblème inventé).
        const color = i % 4 === 0 ? C.red : C.blue;
        k.disc(0.18, 0.025, C.gold, [0, 0, 0.013], 24);
        k.disc(0.155, 0.035, color, [0, 0, 0.025], 24);
        k.flat(boltShape(0.13), 0.02, C.gold, [0, 0, 0.05]);
        hanger(k, 0.18);
      } else {
        // Bulle de BD qui explose : « ! ».
        k.flat(starShape(0.2, 0.13, 12), 0.02, C.gold, [0, 0, 0.012]);
        k.flat(starShape(0.15, 0.1, 12), 0.03, C.red, [0, 0, 0.025]);
        k.box(0.04, 0.12, 0.01, C.cream, [0, -0.03, 0.045]);
        k.box(0.04, 0.035, 0.01, C.cream, [0, -0.085, 0.045]);
      }
      return k;
    },
  ),
};

const RETRO_80S: ThemeModels = {
  // Cube à facettes colorées (casse-tête des années 80).
  desk: deskOf('puzzle-cube', (k) => {
    const s = 0.07;
    k.box(s, s, s, 0x1b1d21, [0, 0, 0]);
    const face = [C.red, C.gold, C.blue, C.green, C.cream, C.orange];
    const cell = s / 3;
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++) {
        const u = (a - 1) * cell;
        const v = (b - 1) * cell;
        const pick = (n: number) => face[(a * 3 + b + n) % face.length] ?? C.red;
        k.box(cell * 0.82, 0.004, cell * 0.82, pick(0), [u, s, v]);
        k.box(cell * 0.82, cell * 0.82, 0.004, pick(2), [u, s / 2 + v - cell * 0.41 + 0.0, s / 2]);
        k.box(0.004, cell * 0.82, cell * 0.82, pick(4), [s / 2, s / 2 + u - cell * 0.41, v]);
      }
  }),
  wall: wallOf(
    'retro-80s',
    (kit, walls) => lightGarland(kit, walls, [C.neonPink, C.cyan, C.violet]),
    (i) => {
      const k = new Kit();
      if (i % 2 === 0) {
        // Disque vinyle : sillons et étiquette.
        k.disc(0.18, 0.012, 0x16171b, [0, 0, 0.015], 28);
        k.ring(0.14, 0.003, 0x34363d, [0, 0, 0.022]);
        k.ring(0.11, 0.003, 0x34363d, [0, 0, 0.022]);
        k.disc(0.06, 0.016, C.neonPink, [0, 0, 0.017], 18);
        k.disc(0.008, 0.02, 0x16171b, [0, 0, 0.018], 8);
        hanger(k, 0.18);
      } else {
        // Cassette audio.
        k.soft(0.32, 0.2, 0.03, 0.012, 0x2b2f3a, [0, -0.1, 0.015]);
        k.box(0.28, 0.08, 0.006, C.cream, [0, 0.0, 0.032]);
        k.box(0.28, 0.02, 0.006, C.neonPink, [0, 0.06, 0.032]);
        k.box(0.16, 0.05, 0.006, 0x16171b, [0, -0.005, 0.036]);
        for (const x of [-0.05, 0.05]) k.disc(0.018, 0.01, C.cream, [x, 0.02, 0.038], 10);
        k.box(0.18, 0.04, 0.008, 0x3a3f4b, [0, -0.09, 0.032]);
      }
      return k;
    },
  ),
};

const SUMMER: ThemeModels = {
  // Cocktail à paille et à ombrelle.
  desk: deskOf('cocktail', (k) => {
    k.post(0.028, 0.03, 0.004, 0xe8eef2, [0, 0, 0], 10);
    k.post(0.004, 0.004, 0.04, 0xe8eef2, [0, 0.004, 0], 5);
    k.post(0.042, 0.006, 0.05, 0xff9e7a, [0, 0.044, 0], 12);
    k.post(0.042, 0.042, 0.006, C.turquoise, [0, 0.088, 0], 12);
    k.disc(0.018, 0.006, C.orange, [0.03, 0.098, 0.0], 10);
    k.bar([-0.01, 0.07, 0], [-0.025, 0.14, 0.01], 0.003, C.cream);
    k.bar([0.012, 0.09, 0], [0.02, 0.14, 0], 0.002, C.wood);
    k.cone(0.04, 0.02, C.pink, [0.02, 0.14, 0], 8);
  }),
  wall: wallOf(
    'summer',
    (kit, walls) => flagGarland(kit, walls, [C.turquoise, C.coral, C.pastelYellow]),
    (i) => {
      const k = new Kit();
      if (i % 2 === 0) {
        // Soleil rayonnant.
        for (let r = 0; r < 12; r++) {
          const a = (r / 12) * Math.PI * 2;
          k.flat(
            triangleShape(0.06, 0.07),
            0.015,
            C.orange,
            [Math.sin(a) * 0.12, Math.cos(a) * 0.12, 0.012],
            -a + Math.PI,
          );
        }
        k.glow(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 20), C.gold, [0, 0, 0.03], i, {
          x: Math.PI / 2,
        });
        hanger(k, 0.19);
      } else {
        // Planche de surf accrochée au mur.
        k.flat(surfboardShape(0.13, 0.44), 0.025, C.coral, [0, -0.02, 0.02]);
        k.box(0.012, 0.42, 0.008, C.cream, [0, -0.23, 0.037]);
        k.box(0.11, 0.025, 0.008, C.turquoise, [0, -0.1, 0.037]);
        k.box(0.05, 0.02, 0.05, 0x8a8d92, [0, 0.0, 0.025]);
      }
      return k;
    },
  ),
};

const PIRATES: ThemeModels = {
  // Coffre au trésor entrouvert.
  desk: deskOf('treasure', (k) => {
    k.box(0.1, 0.05, 0.065, 0x7a4a26, [0, 0, 0]);
    for (const x of [-0.035, 0.035]) k.box(0.012, 0.052, 0.067, C.gold, [x, 0, 0]);
    k.ball(0.03, C.gold, [0, 0.05, 0.0], [1.4, 0.5, 0.9], 0);
    k.box(0.1, 0.012, 0.065, 0x6a3e1f, [0, 0.07, -0.03], { x: -0.9 });
    k.box(0.016, 0.02, 0.006, C.gold, [0, 0.02, 0.034]);
  }),
  wall: wallOf(
    'pirates',
    (kit, walls) => flagGarland(kit, walls, [C.black, C.cream, C.red]),
    (i) => {
      const k = new Kit();
      if (i % 2 === 0) {
        // Pavillon noir sur sa hampe, tête de mort et tibias.
        k.box(0.03, 0.06, 0.03, 0x707479, [-0.18, -0.03, 0.015]);
        k.bar([-0.18, 0, 0.03], [0.04, 0.2, 0.1], 0.008, C.wood);
        k.soft(0.3, 0.2, 0.012, 0.004, C.black, [0.08, -0.05, 0.08], { z: 0.15 });
        const center: At = [0.07, 0.07, 0.09];
        k.ball(0.038, C.cream, center, [1, 1, 0.4]);
        k.box(0.04, 0.02, 0.01, C.cream, [center[0] + 0.002, center[1] - 0.05, 0.09], { z: 0.15 });
        k.bar([0.0, 0.0, 0.09], [0.14, 0.09, 0.09], 0.008, C.cream);
        k.bar([0.0, 0.09, 0.09], [0.14, 0.0, 0.09], 0.008, C.cream);
      } else {
        // Bouée rouge et blanche, cordage.
        for (let q = 0; q < 4; q++)
          k.ring(
            0.13,
            0.04,
            q % 2 === 0 ? C.red : C.cream,
            [0, 0, 0.04],
            Math.PI / 2,
            q * (Math.PI / 2),
          );
        k.ring(0.13, 0.008, C.sand, [0, 0, 0.08]);
        hanger(k, 0.17, C.sand);
      }
      return k;
    },
  ),
};

const HALLOWEEN: ThemeModels = {
  // Citrouille à côtes, visage lumineux.
  desk: deskOf('pumpkin', (k) => {
    const r = 0.055;
    for (let n = 0; n < 6; n++) {
      const a = (n / 6) * Math.PI * 2;
      k.ball(
        r * 0.7,
        C.orange,
        [Math.cos(a) * r * 0.45, r * 0.75, Math.sin(a) * r * 0.45],
        [0.9, 1, 0.9],
      );
    }
    k.ball(r * 0.85, 0xe0701a, [0, r * 0.75, 0], [1, 0.9, 1]);
    k.post(0.006, 0.01, 0.03, 0x4c7a2a, [0, r * 1.35, 0], 5);
    for (const side of [-1, 1])
      k.glow(new THREE.ConeGeometry(0.01, 0.016, 3), C.warm, [side * 0.017, r * 0.92, r * 0.95]);
    k.glowBox(0.035, 0.009, 0.006, C.warm, [0, r * 0.55, r * 0.97]);
  }),
  wall: wallOf(
    'halloween',
    (kit, walls) => lightGarland(kit, walls, [C.orange, C.purple, C.slime]),
    (i) => {
      const k = new Kit();
      if (i % 2 === 0) {
        // Trois chauves-souris en vol.
        const bats: [number, number, number, number][] = [
          [-0.1, 0.06, 1, 0.15],
          [0.1, 0.12, 0.75, -0.2],
          [0.04, -0.1, 0.85, 0.05],
        ];
        for (const [x, y, s, turn] of bats) {
          const bat = new Kit();
          bat.ball(0.03 * s, C.black, [0, 0, 0.02], [1, 1.2, 0.6]);
          bat.ball(0.022 * s, C.black, [0, 0.04 * s, 0.02], [1, 1, 0.7]);
          for (const side of [-1, 1]) {
            bat.cone(0.008 * s, 0.022 * s, C.black, [side * 0.012 * s, 0.05 * s, 0.02], 4);
            bat.glowBox(0.007 * s, 0.007 * s, 0.004, C.warm, [side * 0.008 * s, 0.043 * s, 0.035]);
            bat.flat(batWing(0.16 * s, side), 0.008, C.black, [side * 0.01, 0.01, 0.02]);
          }
          k.stamp(bat, new THREE.Matrix4().makeRotationZ(turn).setPosition(x, y, 0.01));
        }
      } else {
        // Araignée au bout de son fil.
        k.bar([0, 0.24, 0.04], [0, -0.02, 0.04], 0.003, 0xe8e8e8, 3);
        k.ball(0.035, C.black, [0, -0.06, 0.04], [1, 1.15, 0.8]);
        k.ball(0.022, C.black, [0, -0.01, 0.04], [1, 1, 0.8]);
        for (const side of [-1, 1]) {
          k.glowBox(0.006, 0.006, 0.004, 0xff3b30, [side * 0.008, -0.005, 0.06]);
          for (let leg = 0; leg < 4; leg++) {
            const y = -0.03 - leg * 0.018;
            const knee: At = [side * 0.06, y + 0.03, 0.045];
            k.bar([side * 0.015, y, 0.04], knee, 0.003, C.black, 3);
            k.bar(knee, [side * 0.09, y - 0.02 - leg * 0.01, 0.045], 0.0025, C.black, 3);
          }
        }
        k.box(0.022, 0.022, 0.06, 0x707479, [0, 0.23, 0.03]);
      }
      return k;
    },
  ),
};

const CYBERPUNK: ThemeModels = {
  // Émetteur d'hologramme : socle sombre et cube lumineux.
  desk: deskOf('holo', (k) => {
    k.soft(0.08, 0.02, 0.08, 0.006, 0x1b1d21, [0, 0, 0]);
    k.glowBox(0.07, 0.004, 0.004, C.cyan, [0, 0.022, 0.04], 1);
    k.glow(new THREE.OctahedronGeometry(0.03, 0), C.neonPink, [0, 0.07, 0], 2);
    k.glowBox(0.002, 0.03, 0.002, C.cyan, [0, 0.025, 0], 0);
  }),
  wall: wallOf(
    'cyberpunk',
    (kit, walls) => lightGarland(kit, walls, [C.cyan, C.neonPink, C.violet]),
    (i) => {
      const k = new Kit();
      k.soft(0.42, 0.3, 0.02, 0.01, 0x15161c, [0, -0.15, 0.01]);
      if (i % 2 === 0) {
        // Enseigne néon : cadre cyan, signes roses.
        neonFrame(k, 0.36, 0.24, C.cyan, i);
        k.glowBox(0.15, 0.016, 0.016, C.neonPink, [-0.06, 0.05, 0.03], i + 1);
        k.glowBox(0.016, 0.12, 0.016, C.neonPink, [-0.06, -0.01, 0.03], i + 1);
        k.glowBox(0.1, 0.016, 0.016, C.neonPink, [0.08, -0.05, 0.03], i + 1, 0.6);
        k.glow(new THREE.TorusGeometry(0.035, 0.008, 4, 14), C.violet, [0.09, 0.05, 0.03], i + 2);
      } else {
        // Triangle néon violet, barré de cyan.
        neonFrame(k, 0.36, 0.24, C.neonPink, i);
        for (const [a, b] of [
          [
            [-0.1, -0.08],
            [0.1, -0.08],
          ],
          [
            [0.1, -0.08],
            [0, 0.09],
          ],
          [
            [0, 0.09],
            [-0.1, -0.08],
          ],
        ] as const) {
          const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
          k.glowBox(
            length,
            0.016,
            0.016,
            C.violet,
            [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.03],
            i + 1,
            angle,
          );
        }
        k.glowBox(0.26, 0.012, 0.012, C.cyan, [0, 0, 0.035], i + 2);
      }
      return k;
    },
  ),
};

const CHRISTMAS: ThemeModels = {
  // Petit sapin en pot, boules et étoile.
  desk: deskOf('fir', (k) => {
    k.post(0.03, 0.024, 0.035, C.terracotta, [0, 0, 0], 10);
    k.post(0.006, 0.006, 0.02, C.wood, [0, 0.035, 0], 5);
    k.cone(0.06, 0.07, C.pine, [0, 0.05, 0], 10);
    k.cone(0.047, 0.06, C.pineLight, [0, 0.09, 0], 10);
    k.cone(0.032, 0.05, C.pine, [0, 0.125, 0], 10);
    k.glowFlat(starShape(0.02, 0.009), 0.008, C.gold, [0, 0.185, 0]);
    const baubles: [number, number, number, number][] = [
      [0.035, 0.07, 0.03, C.red],
      [-0.03, 0.08, 0.035, C.gold],
      [0.02, 0.115, 0.03, C.gold],
      [-0.015, 0.14, 0.022, C.red],
      [0.045, 0.06, -0.02, C.silver],
    ];
    for (const [x, y, z, color] of baubles) k.ball(0.009, color, [x, y, z], [1, 1, 1], 0);
  }),
  wall: wallOf(
    'christmas',
    (kit, walls) => lightGarland(kit, walls, [C.red, C.warm, C.green, C.sky]),
    (i) => {
      const k = new Kit();
      if (i % 2 === 0) {
        // Couronne de sapin touffue, baies et grand nœud rouge.
        const greens = [C.pine, C.pineLight, C.pineDark];
        for (let n = 0; n < 16; n++) {
          const a = (n / 16) * Math.PI * 2;
          const r = 0.14 + (n % 2) * 0.02;
          k.ball(
            0.05,
            greens[n % 3] ?? C.pine,
            [Math.cos(a) * r, Math.sin(a) * r, 0.035],
            [1.1, 0.9, 0.6],
            0,
          );
        }
        for (const a of [0.4, 1.3, 2.3, 3.1, 4.0, 5.6])
          k.ball(0.016, C.red, [Math.cos(a) * 0.155, Math.sin(a) * 0.155, 0.07]);
        k.soft(0.09, 0.06, 0.025, 0.012, C.red, [-0.05, -0.19, 0.075], { z: 0.35 });
        k.soft(0.09, 0.06, 0.025, 0.012, C.red, [0.05, -0.19, 0.075], { z: -0.35 });
        k.box(0.025, 0.09, 0.012, C.red, [-0.025, -0.26, 0.07], { z: -0.25 });
        k.box(0.025, 0.09, 0.012, C.red, [0.025, -0.26, 0.07], { z: 0.25 });
        k.ball(0.025, 0xa51d24, [0, -0.165, 0.085]);
        hanger(k, 0.17, C.red);
      } else {
        // Chaussette de Noël.
        k.soft(0.12, 0.22, 0.03, 0.03, C.red, [0, -0.2, 0.025]);
        k.soft(0.17, 0.09, 0.03, 0.035, C.red, [0.03, -0.24, 0.025]);
        k.soft(0.15, 0.06, 0.04, 0.02, C.cream, [0, 0.0, 0.025]);
        k.soft(0.05, 0.04, 0.034, 0.015, C.cream, [0.09, -0.24, 0.026]);
        k.ball(0.022, C.pine, [-0.03, 0.035, 0.05], [1.4, 0.6, 0.6], 0);
        k.ball(0.022, C.pineLight, [0.0, 0.04, 0.05], [1.4, 0.6, 0.6], 0);
        k.ball(0.012, C.red, [-0.012, 0.03, 0.065]);
        hanger(k, 0.06, C.cream);
      }
      return k;
    },
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
