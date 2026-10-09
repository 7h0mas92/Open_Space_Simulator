/**
 * La vue sur New York : le bureau est au dernier étage d'une tour, au milieu d'une ville
 * low-poly inspirée de Manhattan (grille d'avenues et de rues, tours à gradins, réservoirs
 * d'eau en bois sur les toits, un parc, le fleuve et des taxis jaunes). Aucun bâtiment réel
 * n'est reproduit : la ville est générique, faite de boîtes Three.js.
 *
 * - `planSkyline` est une fonction pure (layout → liste de volumes), testable sans WebGL.
 *   Son hasard vient d'un générateur à graine fixe : la ville est la même à chaque partie et
 *   ne touche jamais au RNG de la simulation.
 * - `SkylineView` fusionne les volumes en quelques maillages (une dizaine d'appels de dessin
 *   pour toute la ville) et suit le cycle jour/nuit : fenêtres allumées, lampadaires et
 *   balises rouges le soir.
 *
 * Contrainte de lisibilité : la caméra isométrique regarde le bureau de haut, depuis l'un des
 * quatre côtés. Un immeuble ne doit jamais cacher la salle : près de la tour, les toits restent
 * sous le plancher ; seules les tours éloignées dépassent (voir `maxTop`).
 */
import * as THREE from 'three';
import type { OfficeLayout } from '../view/layout';
import type { LightingState } from './lighting';
import { PixelCanvas, pseudoRandom, radialGlowTexture } from './pixels';

/** Niveau de la rue, sous le plancher du bureau (y = 0) : on est en haut d'une tour. */
export const STREET_LEVEL = -45;
/** Rayon de la ville autour du bureau, en cases : couvre l'écran au zoom minimal. */
export const CITY_RADIUS = 120;
/** Les avenues (axe z) et les rues (axe x) de la grille de Manhattan. */
const AVENUE_SPACING = 16;
const AVENUE_WIDTH = 3.6;
const STREET_SPACING = 9;
const STREET_WIDTH = 2.2;
/** Largeur d'une fenêtre et hauteur d'un étage sur les façades, en cases. */
const WINDOW_WIDTH = 1;
const FLOOR_HEIGHT = 1.5;
/** Fenêtres par côté de la texture de façade (elle se répète). */
const TILE_WINDOWS = 8;
/** Graine de la ville : fixe, indépendante de la partie. */
const CITY_SEED = 0x6e7963;

/** Un volume de la ville, aligné sur les axes ; `top` et `bottom` en hauteur monde. */
export interface CityBox {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly bottom: number;
  readonly top: number;
  readonly color: number;
}

/** Une voie de circulation (pour les taxis), d'un bout à l'autre de la ville. */
export interface Lane {
  readonly x: number;
  readonly z: number;
  /** Axe de la voie : le long de x (rue) ou de z (avenue). */
  readonly axis: 'x' | 'z';
  readonly length: number;
}

export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SkylinePlan {
  /** Volumes à fenêtres : immeubles, gradins des tours et notre propre tour. */
  readonly towers: readonly CityBox[];
  /** Volumes unis : trottoirs, corniche, parc, flèches. */
  readonly solids: readonly CityBox[];
  /** Réservoirs d'eau en bois sur les toits (centre de la base). */
  readonly tanks: readonly Point3[];
  readonly trees: readonly Point3[];
  /** Feux rouges d'obstacle au sommet des plus hautes tours. */
  readonly beacons: readonly Point3[];
  readonly streetLamps: readonly Point3[];
  readonly lanes: readonly Lane[];
  /** Le fleuve : rectangle d'eau au niveau de la rue. */
  readonly river: { readonly x0: number; readonly x1: number };
  /** Emprise de notre tour (sous le bureau). */
  readonly footprint: { x0: number; z0: number; x1: number; z1: number };
}

const FACADE_COLORS = [0xd8d2c6, 0xc9b9a3, 0xb88a6a, 0xa86f55, 0x9aa6b5, 0x8d97a6, 0xe4ded2];
const GLASS_TOWER_COLORS = [0x7f9ab8, 0x6f8aa8, 0x8fa7bf, 0x9bb0c4];
const ROOF_COLORS = [0x8a8d93, 0x7a7d84, 0x9b968c, 0x6f747c];
const SIDEWALK = 0xa9a59c;
const PARK = 0x5f9e57;
const CORNICE = 0xd9d4c8;

/** Distance d'un point au rectangle de notre tour (0 dedans). */
function distanceToRect(
  x: number,
  z: number,
  rect: { x0: number; z0: number; x1: number; z1: number },
): number {
  const dx = Math.max(rect.x0 - x, 0, x - rect.x1);
  const dz = Math.max(rect.z0 - z, 0, z - rect.z1);
  return Math.hypot(dx, dz);
}

/**
 * Hauteur maximale d'un toit à `distance` cases de la tour : la caméra plonge à 35°, donc un
 * toit sous cette ligne ne masque jamais le bureau, quel que soit le côté d'où on le regarde.
 */
export function maxTop(distance: number): number {
  return Math.min(30, 0.6 * distance - 8);
}

export function planSkyline(layout: OfficeLayout): SkylinePlan {
  const random = pseudoRandom(CITY_SEED);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T;
  const cx = (layout.width - 1) / 2;
  const cz = (layout.depth - 1) / 2;
  // Les murs du bureau vont de -0,7 à largeur - 0,3 : la tour les déborde un peu.
  const footprint = {
    x0: -0.8,
    z0: -0.8,
    x1: layout.width - 0.2,
    z1: layout.depth - 0.2,
  };
  const towers: CityBox[] = [];
  const solids: CityBox[] = [];
  const tanks: Point3[] = [];
  const trees: Point3[] = [];
  const beacons: Point3[] = [];
  const streetLamps: Point3[] = [];
  const lanes: Lane[] = [];

  // Notre tour : une façade de verre jusqu'à la rue, et une corniche sous le plancher.
  const ownWidth = footprint.x1 - footprint.x0;
  const ownDepth = footprint.z1 - footprint.z0;
  const ownX = (footprint.x0 + footprint.x1) / 2;
  const ownZ = (footprint.z0 + footprint.z1) / 2;
  towers.push({
    x: ownX,
    z: ownZ,
    width: ownWidth,
    depth: ownDepth,
    bottom: STREET_LEVEL,
    top: -0.5,
    color: 0x8fa7c4,
  });
  solids.push({
    x: ownX,
    z: ownZ,
    width: ownWidth + 0.5,
    depth: ownDepth + 0.5,
    bottom: -0.5,
    top: -0.1,
    color: CORNICE,
  });

  // Le fleuve longe un côté de la ville (à gauche de la vue de départ).
  const river = { x0: cx - CITY_RADIUS - 40, x1: cx - CITY_RADIUS * 0.62 };
  // Un parc de 2 x 4 pâtés de maisons, derrière la tour (visible à travers les baies).
  const park = { i0: -3, i1: -2, j0: -6, j1: -3 };
  const plaza = 6; // dégagement autour de notre tour

  const half = Math.ceil(CITY_RADIUS / AVENUE_SPACING);
  const halfStreets = Math.ceil(CITY_RADIUS / STREET_SPACING);
  for (let i = -half; i <= half; i++) {
    for (let j = -halfStreets; j <= halfStreets; j++) {
      const blockX0 = cx + i * AVENUE_SPACING + AVENUE_WIDTH / 2;
      const blockX1 = cx + (i + 1) * AVENUE_SPACING - AVENUE_WIDTH / 2;
      const blockZ0 = cz + j * STREET_SPACING + STREET_WIDTH / 2;
      const blockZ1 = cz + (j + 1) * STREET_SPACING - STREET_WIDTH / 2;
      const blockCx = (blockX0 + blockX1) / 2;
      const blockCz = (blockZ0 + blockZ1) / 2;
      // Le hasard est tiré même pour les pâtés ignorés : la ville ne dépend pas de la phase.
      const lots = 1 + Math.floor(random() * 3);
      const rolls = Array.from({ length: lots }, () => [random(), random(), random(), random()]);
      if (Math.hypot(blockCx - cx, blockCz - cz) > CITY_RADIUS) continue;
      if (blockX1 > river.x0 && blockX0 < river.x1) continue;
      const nearOwn =
        blockX1 > footprint.x0 - plaza &&
        blockX0 < footprint.x1 + plaza &&
        blockZ1 > footprint.z0 - plaza &&
        blockZ0 < footprint.z1 + plaza;
      if (nearOwn) continue;
      const sidewalk: CityBox = {
        x: blockCx,
        z: blockCz,
        width: blockX1 - blockX0,
        depth: blockZ1 - blockZ0,
        bottom: STREET_LEVEL,
        top: STREET_LEVEL + 0.25,
        color: SIDEWALK,
      };
      if (i >= park.i0 && i <= park.i1 && j >= park.j0 && j <= park.j1) {
        solids.push({ ...sidewalk, color: PARK, top: STREET_LEVEL + 0.35 });
        for (let t = 0; t < 6; t++)
          trees.push({
            x: blockX0 + 1 + random() * (blockX1 - blockX0 - 2),
            y: STREET_LEVEL + 0.35,
            z: blockZ0 + 1 + random() * (blockZ1 - blockZ0 - 2),
          });
        continue;
      }
      solids.push(sidewalk);

      const lotWidth = (blockX1 - blockX0) / lots;
      rolls.forEach(([a = 0, b = 0, c = 0, d = 0], lot) => {
        const x0 = blockX0 + lot * lotWidth + 0.35;
        const x1 = blockX0 + (lot + 1) * lotWidth - 0.35;
        const z0 = blockZ0 + 0.35;
        const z1 = blockZ1 - 0.35;
        const distance = distanceToRect((x0 + x1) / 2, (z0 + z1) / 2, footprint);
        const ceiling = Math.min(maxTop(distance - Math.max(x1 - x0, z1 - z0)), -2);
        const tall = distance > 55 && a < 0.16;
        const limit = tall ? maxTop(distance - 6) : ceiling;
        const height = tall ? 35 + b * 45 : 4 + Math.pow(b, 1.8) * 30;
        const top = Math.max(STREET_LEVEL + 4, Math.min(STREET_LEVEL + height, limit));
        const color = tall ? pick(GLASS_TOWER_COLORS) : pick(FACADE_COLORS);
        const base = STREET_LEVEL + 0.25;
        const box = (inset: number, bottom: number, boxTop: number): CityBox => ({
          x: (x0 + x1) / 2,
          z: (z0 + z1) / 2,
          width: Math.max(0.8, x1 - x0 - inset * 2),
          depth: Math.max(0.8, z1 - z0 - inset * 2),
          bottom,
          top: boxTop,
          color,
        });
        if (tall && top - base > 30) {
          // Tour à gradins (« wedding cake ») : trois volumes de plus en plus étroits.
          const step1 = base + (top - base) * 0.55;
          const step2 = base + (top - base) * 0.82;
          towers.push(box(0, base, step1), box(0.7, step1, step2), box(1.4, step2, top));
          if (c < 0.5) {
            solids.push({
              ...box(Math.max(0, (x1 - x0) / 2 - 0.15), top, top + 5),
              color: 0xb9c0c8,
            });
            beacons.push({ x: (x0 + x1) / 2, y: top + 5.2, z: (z0 + z1) / 2 });
          } else {
            beacons.push({ x: (x0 + x1) / 2, y: top + 0.3, z: (z0 + z1) / 2 });
          }
          return;
        }
        towers.push(box(0, base, top));
        // Les vieux immeubles new-yorkais portent un réservoir d'eau en bois sur le toit.
        if (!tall && d < 0.35 && top - base < 30)
          tanks.push({ x: x0 + 1 + c * Math.max(0, x1 - x0 - 2), y: top, z: (z0 + z1) / 2 });
      });
    }
  }

  // Taxis et lampadaires sur les avenues et les rues proches.
  for (let i = -half; i <= half; i++) {
    const x = cx + i * AVENUE_SPACING;
    if (x > river.x0 && x < river.x1) continue;
    lanes.push(
      { x: x - 0.8, z: cz, axis: 'z', length: CITY_RADIUS * 2 },
      { x: x + 0.8, z: cz, axis: 'z', length: CITY_RADIUS * 2 },
    );
    for (let z = cz - CITY_RADIUS; z <= cz + CITY_RADIUS; z += 6)
      if (Math.hypot(x - cx, z - cz) < CITY_RADIUS)
        streetLamps.push({ x: x - AVENUE_WIDTH / 2 + 0.2, y: STREET_LEVEL + 1.2, z });
  }
  for (let j = -halfStreets; j <= halfStreets; j += 3) {
    const z = cz + j * STREET_SPACING;
    lanes.push({ x: cx, z, axis: 'x', length: CITY_RADIUS * 2 });
  }

  return { towers, solids, tanks, trees, beacons, streetLamps, lanes, river, footprint };
}

// --- Géométrie -------------------------------------------------------------------------------

/**
 * Ombrage « cuit » dans les couleurs : les toits sont les plus clairs, chaque côté a sa teinte.
 * La ville se passe ainsi des lumières de la scène (dont les lampes du bureau), ce qui la rend
 * très peu coûteuse à dessiner, même plein écran sur un mobile.
 */
function faceShade(normal: readonly number[]): number {
  const [x = 0, y = 0, z = 0] = normal;
  if (y > 0.5) return 1;
  if (z > 0.5) return 0.82;
  if (x > 0.5) return 0.68;
  if (z < -0.5) return 0.6;
  return x < -0.5 ? 0.74 : 0.8;
}

/** Réglages des façades, modifiés à chaque image selon l'heure. */
interface FacadeUniforms {
  readonly map: { value: THREE.Texture };
  readonly lit: { value: THREE.Texture };
  /** Lumière du jour sur la ville. */
  readonly tint: { value: THREE.Color };
  /** Intensité des fenêtres allumées. */
  readonly glow: { value: number };
}

/** Façades : texture de fenêtres x couleur de l'immeuble x lumière du jour, + fenêtres allumées. */
function facadeMaterial(facade: FacadeUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'skyline-facade',
    fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...facade },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute vec3 color;
      varying vec3 vColor;
      varying vec2 vUv;
      void main() {
        vColor = color;
        vUv = uv / ${TILE_WINDOWS.toFixed(1)};
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform sampler2D map;
      uniform sampler2D lit;
      uniform vec3 tint;
      uniform float glow;
      varying vec3 vColor;
      varying vec2 vUv;
      void main() {
        vec3 base = texture2D(map, vUv).rgb * vColor * tint;
        gl_FragColor = vec4(base + texture2D(lit, vUv).rgb * glow, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

/** Accumule des faces de boîtes dans un seul tampon (une géométrie pour toute la ville). */
class BoxBatch {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly uvs: number[] = [];
  private readonly colors: number[] = [];
  private readonly color = new THREE.Color();

  /**
   * Ajoute les faces d'une boîte (sans le dessous, jamais visible). Les UV des côtés sont en
   * unités de façade (une fenêtre, un étage) décalées de `offset` : la texture se répète.
   */
  add(box: CityBox, sides: boolean, top: boolean, offset = 0): void {
    this.color.setHex(box.color);
    const x0 = box.x - box.width / 2;
    const x1 = box.x + box.width / 2;
    const z0 = box.z - box.depth / 2;
    const z1 = box.z + box.depth / 2;
    const y0 = box.bottom;
    const y1 = box.top;
    const v0 = 0;
    const v1 = (y1 - y0) / FLOOR_HEIGHT;
    const u = (length: number) => length / WINDOW_WIDTH;
    if (sides) {
      // Chaque face : 4 coins (bas-gauche, bas-droite, haut-droite, haut-gauche) vus de dehors.
      this.quad(
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
        [0, 0, 1],
        u(box.width),
        v1,
        offset,
      );
      this.quad(
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
        [0, 0, -1],
        u(box.width),
        v1,
        offset + 3,
      );
      this.quad(
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [1, 0, 0],
        u(box.depth),
        v1,
        offset + 5,
      );
      this.quad(
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
        [-1, 0, 0],
        u(box.depth),
        v1,
        offset + 2,
      );
    }
    if (top)
      this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], 1, 1, 0, v0);
  }

  private quad(
    a: readonly number[],
    b: readonly number[],
    c: readonly number[],
    d: readonly number[],
    normal: readonly number[],
    uMax: number,
    vMax: number,
    offset: number,
    vMin = 0,
  ): void {
    const corners = [a, b, c, a, c, d];
    const uv = [
      [offset, vMin],
      [offset + uMax, vMin],
      [offset + uMax, vMax],
      [offset, vMin],
      [offset + uMax, vMax],
      [offset, vMax],
    ];
    corners.forEach((corner, index) => {
      this.positions.push(...corner);
      this.normals.push(...normal);
      this.uvs.push(...(uv[index] ?? [0, 0]));
      const shade = faceShade(normal);
      this.colors.push(this.color.r * shade, this.color.g * shade, this.color.b * shade);
    });
  }

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }
}

/**
 * Textures de façade, en 8 x 8 fenêtres répétées : `map` (mur clair, vitres sombres) et
 * `lit` (fenêtres allumées le soir, environ une sur trois, en blanc chaud ou froid).
 */
export function facadeTextures(): { map: PixelCanvas; lit: PixelCanvas } {
  const cell = 8;
  const size = TILE_WINDOWS * cell;
  const random = pseudoRandom(CITY_SEED + 1);
  const map = new PixelCanvas(size, size).fill(0xffffff);
  const lit = new PixelCanvas(size, size).fill(0x000000);
  for (let row = 0; row < TILE_WINDOWS; row++) {
    for (let col = 0; col < TILE_WINDOWS; col++) {
      const x = col * cell + 1;
      const y = row * cell + 2;
      map.rect(x, y, cell - 2, cell - 3, 0x4a5a72);
      map.rect(x, y, cell - 2, 1, 0x6d7f99); // reflet du ciel en haut de la vitre
      const roll = random();
      if (roll < 0.34) lit.rect(x, y, cell - 2, cell - 3, roll < 0.08 ? 0xbfd9ff : 0xffd79a);
    }
  }
  return { map, lit };
}

function repeating(canvas: PixelCanvas, colorSpace: THREE.ColorSpace): THREE.DataTexture {
  const texture = canvas.texture();
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function instancedAt(
  geometry: THREE.BufferGeometry,
  mat: THREE.Material,
  points: readonly Point3[],
  name: string,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, mat, Math.max(1, points.length));
  const matrix = new THREE.Matrix4();
  points.forEach((point, index) => {
    mesh.setMatrixAt(index, matrix.makeTranslation(point.x, point.y, point.z));
  });
  mesh.count = points.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.name = name;
  return mesh;
}

function glowPoints(points: readonly Point3[], mat: THREE.PointsMaterial, name: string) {
  const object = new THREE.Points(
    new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p.x, p.y, p.z))),
    mat,
  );
  object.name = name;
  object.frustumCulled = false;
  return object;
}

const TAXI_COUNT = 48;
const TAXI_SPEED = 9;

export class SkylineView {
  readonly root = new THREE.Group();
  private readonly facadeMap: THREE.DataTexture;
  private readonly facadeLit: THREE.DataTexture;
  private readonly glow = radialGlowTexture(32, 1.6);
  private readonly facade: FacadeUniforms;
  private readonly facadeMaterial: THREE.ShaderMaterial;
  private readonly plainMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  private readonly groundMaterial = new THREE.MeshBasicMaterial({ color: 0x3d424c });
  private readonly waterMaterial = new THREE.MeshBasicMaterial({ color: 0x3f6e8f });
  /** Lumière du jour sur la ville (couleur et intensité), recalculée à chaque image. */
  private readonly tint = new THREE.Color(1, 1, 1);
  private readonly sunTint = new THREE.Color();
  private readonly tankMaterial = new THREE.MeshLambertMaterial({
    color: 0x8a5a36,
    flatShading: true,
  });
  private readonly treeMaterial = new THREE.MeshLambertMaterial({
    color: 0x3f8a4a,
    flatShading: true,
  });
  private readonly taxiMaterial = new THREE.MeshLambertMaterial({
    color: 0xf2c230,
    emissive: new THREE.Color(0xffd257),
    emissiveIntensity: 0,
  });
  private readonly lampMaterial: THREE.PointsMaterial;
  private readonly beaconMaterial: THREE.PointsMaterial;
  private taxis: THREE.InstancedMesh | null = null;
  private lanes: readonly Lane[] = [];
  private clock = 0;
  private key = '';

  constructor() {
    const { map, lit } = facadeTextures();
    this.facadeMap = repeating(map, THREE.SRGBColorSpace);
    this.facadeLit = repeating(lit, THREE.SRGBColorSpace);
    this.facade = {
      map: { value: this.facadeMap },
      lit: { value: this.facadeLit },
      tint: { value: new THREE.Color(1, 1, 1) },
      glow: { value: 0 },
    };
    this.facadeMaterial = facadeMaterial(this.facade);
    const points = (color: number) =>
      new THREE.PointsMaterial({
        map: this.glow,
        color,
        size: 12,
        sizeAttenuation: false,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
    this.lampMaterial = points(0xffc978);
    this.beaconMaterial = points(0xff3b30);
    this.root.name = 'skyline';
  }

  /** Reconstruit la ville quand le bureau change de taille (la tour suit son emprise). */
  setLayout(layout: OfficeLayout): void {
    const key = `${layout.width}x${layout.depth}`;
    if (key === this.key) return;
    this.key = key;
    this.clear();
    const plan = planSkyline(layout);

    const facades = new BoxBatch();
    const plain = new BoxBatch();
    // Du plus proche au plus loin : les immeubles proches masquent les lointains, que la carte
    // graphique n'a alors pas à colorier (test de profondeur précoce).
    const cx = (layout.width - 1) / 2;
    const cz = (layout.depth - 1) / 2;
    const near = (box: CityBox) => Math.hypot(box.x - cx, box.z - cz);
    [...plan.towers]
      .sort((a, b) => near(a) - near(b))
      .forEach((box, index) => {
        facades.add(box, true, false, (index * 7) % TILE_WINDOWS);
        plain.add(
          { ...box, color: ROOF_COLORS[index % ROOF_COLORS.length] ?? 0x8a8d93 },
          false,
          true,
        );
      });
    for (const box of plan.solids) plain.add(box, true, true);
    const facadeMesh = new THREE.Mesh(facades.build(), this.facadeMaterial);
    facadeMesh.name = 'skyline-facades';
    const plainMesh = new THREE.Mesh(plain.build(), this.plainMaterial);
    plainMesh.name = 'skyline-roofs';

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY_RADIUS * 4, CITY_RADIUS * 4).rotateX(-Math.PI / 2),
      this.groundMaterial,
    );
    ground.position.set((layout.width - 1) / 2, STREET_LEVEL, (layout.depth - 1) / 2);
    ground.name = 'skyline-street';
    const riverWidth = plan.river.x1 - plan.river.x0;
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(riverWidth, CITY_RADIUS * 4).rotateX(-Math.PI / 2),
      this.waterMaterial,
    );
    water.position.set(
      (plan.river.x0 + plan.river.x1) / 2,
      STREET_LEVEL + 0.05,
      (layout.depth - 1) / 2,
    );
    water.name = 'skyline-river';

    // Réservoir d'eau : une cuve en bois sur quatre pieds, coiffée d'un toit conique.
    const tank = new THREE.CylinderGeometry(0.55, 0.55, 1, 8).translate(0, 1.2, 0);
    const legs = new THREE.BoxGeometry(0.9, 0.7, 0.9).translate(0, 0.35, 0);
    const roof = new THREE.ConeGeometry(0.62, 0.45, 8).translate(0, 1.92, 0);
    const tree = new THREE.ConeGeometry(0.7, 1.8, 6).translate(0, 0.9, 0);
    this.lanes = plan.lanes;
    this.taxis = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.9, 0.45, 0.45).translate(0, 0.5, 0),
      this.taxiMaterial,
      TAXI_COUNT,
    );
    this.taxis.name = 'skyline-taxis';
    this.taxis.frustumCulled = false;
    this.placeTaxis();

    this.root.add(
      ground,
      water,
      facadeMesh,
      plainMesh,
      instancedAt(tank, this.tankMaterial, plan.tanks, 'skyline-tanks'),
      instancedAt(legs, this.tankMaterial, plan.tanks, 'skyline-tank-legs'),
      instancedAt(roof, this.tankMaterial, plan.tanks, 'skyline-tank-roofs'),
      instancedAt(tree, this.treeMaterial, plan.trees, 'skyline-trees'),
      this.taxis,
      glowPoints(plan.streetLamps, this.lampMaterial, 'skyline-lamps'),
      glowPoints(plan.beacons, this.beaconMaterial, 'skyline-beacons'),
    );
    // La ville se dessine après le bureau, et la rue en dernier : tout ce qui est caché derrière
    // la salle ou sous les immeubles est éliminé avant d'être colorié.
    for (const child of this.root.children) child.renderOrder = 1;
    ground.renderOrder = 2;
    water.renderOrder = 2;
  }

  /**
   * Suit l'heure : les fenêtres et lampadaires s'allument à la tombée du jour, les balises
   * clignotent, les taxis roulent (immobiles si l'option « réduire les animations » est active).
   */
  update(light: LightingState, delta: number, pixelsPerUnit: number, animate: boolean): void {
    const night = 1 - light.daylight;
    this.facade.glow.value = 0.05 + 1.2 * night;
    // Lumière du ciel et du soleil, comme celle que reçoit le bureau (sans ses lampes).
    this.tint
      .setHex(light.skyColor)
      .multiplyScalar(0.55 * light.ambient)
      .add(this.sunTint.setHex(light.sunColor).multiplyScalar(0.28 * light.sun));
    this.facade.tint.value.copy(this.tint);
    this.plainMaterial.color.copy(this.tint);
    this.groundMaterial.color.setHex(0x3d424c).multiply(this.tint);
    this.waterMaterial.color.setHex(0x3f6e8f).multiply(this.tint);
    this.taxiMaterial.emissiveIntensity = 0.5 * night;
    this.lampMaterial.opacity = Math.max(0, night - 0.15);
    this.lampMaterial.size = 0.9 * pixelsPerUnit;
    if (animate) this.clock += delta;
    const blink = animate ? (Math.sin(this.clock * 3) > 0.2 ? 1 : 0.15) : 1;
    this.beaconMaterial.opacity = (0.25 + 0.75 * night) * blink;
    this.beaconMaterial.size = 1.4 * pixelsPerUnit;
    if (animate) this.placeTaxis();
  }

  dispose(): void {
    this.clear();
    for (const texture of [this.facadeMap, this.facadeLit, this.glow]) texture.dispose();
    for (const mat of [
      this.facadeMaterial,
      this.plainMaterial,
      this.groundMaterial,
      this.waterMaterial,
      this.tankMaterial,
      this.treeMaterial,
      this.taxiMaterial,
      this.lampMaterial,
      this.beaconMaterial,
    ])
      mat.dispose();
  }

  /** Chaque taxi suit une voie, à sa vitesse ; il réapparaît à l'autre bout. */
  private placeTaxis(): void {
    const taxis = this.taxis;
    if (!taxis || this.lanes.length === 0) return;
    const matrix = new THREE.Matrix4();
    const turn = new THREE.Matrix4().makeRotationY(Math.PI / 2);
    for (let index = 0; index < TAXI_COUNT; index++) {
      const lane = this.lanes[(index * 5) % this.lanes.length];
      if (!lane) continue;
      const direction = index % 2 === 0 ? 1 : -1;
      const speed = TAXI_SPEED * (0.7 + ((index * 37) % 10) / 20);
      const travelled = ((index * 53.7 + this.clock * speed) % lane.length) - lane.length / 2;
      const along = travelled * direction;
      matrix.makeTranslation(
        lane.axis === 'x' ? lane.x + along : lane.x,
        STREET_LEVEL,
        lane.axis === 'z' ? lane.z + along : lane.z + (direction > 0 ? 0.6 : -0.6),
      );
      if (lane.axis === 'z') matrix.multiply(turn);
      taxis.setMatrixAt(index, matrix);
    }
    taxis.instanceMatrix.needsUpdate = true;
  }

  private clear(): void {
    for (const child of [...this.root.children]) {
      this.root.remove(child);
      if (child instanceof THREE.InstancedMesh) child.dispose();
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) child.geometry.dispose();
    }
    this.taxis = null;
  }
}
