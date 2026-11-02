/**
 * Saleté et ménage dans la scène, en formes Three.js (aucun déchet ni agent d'entretien dans les
 * packs Kenney fournis).
 *
 * - Les déchets : boules de papier, emballages, canettes, gobelets, boîtes de pizza, peaux de
 *   banane et taches, posés sur les cases libres du sol. Leur nombre suit la saleté du bureau ;
 *   leurs places sont tirées d'un hachage de la graine (même bureau sale d'une partie à l'autre),
 *   jamais du hasard du jeu. Un InstancedMesh par sorte de déchet.
 * - L'équipe de Nickel Chrome : Fatou (chariot), Jean-Marc (aspirateur) et Lucía (serpillière),
 *   construits comme les devs et animés par les clips Kenney. Pendant un ménage, ils entrent par
 *   la porte et vont d'un déchet à l'autre en A* ; les déchets disparaissent à mesure que la
 *   saleté baisse.
 *
 * Le rendu lit la `GameView` et ne modifie jamais l'état du jeu.
 */
import { CLEANING_CREW, hashString, type CleanerTool } from '@oss/shared';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { findPath } from '../ai/astar';
import { buildNavGrid, type NavGrid } from '../ai/grid';
import type { Cell, OfficeLayout } from '../view/layout';
import type { CleaningView, PlacedItemView } from '../view/types';
import type { AssetLibrary } from './assets';
import type { Outfit } from './officeCharacters';

/** Sortes de déchets, chacune dans son InstancedMesh. */
export const LITTER_KINDS = ['paper', 'wrapper', 'can', 'cup', 'pizza', 'banana', 'stain'] as const;
export type LitterKind = (typeof LITTER_KINDS)[number];

/** Poids de chaque sorte dans le tirage (les taches et les papiers sont les plus courants). */
const LITTER_WEIGHTS: Readonly<Record<LitterKind, number>> = {
  paper: 5,
  wrapper: 4,
  can: 3,
  cup: 3,
  pizza: 1,
  banana: 1,
  stain: 3,
};

/** Part des cases libres couvertes quand le bureau est sale à 100 %. */
const LITTER_DENSITY = 0.35;
/** Plafond du nombre de déchets (grands bureaux). */
export const LITTER_MAX = 120;

/** Les déchets sont un peu agrandis pour se voir en vue d'ensemble. */
const LITTER_SCALE = 1.6;

/** Un déchet posé : case, décalage dans la case, rotation et sorte. */
export interface LitterPiece {
  readonly cell: Cell;
  readonly x: number;
  readonly z: number;
  readonly turn: number;
  readonly kind: LitterKind;
}

/** Valeur stable entre 0 et 1, tirée de la graine et d'une clé (sans le hasard du jeu). */
function unit(seed: string, key: string): number {
  return hashString(`${seed}#litter#${key}`) / 4294967296;
}

function pickKind(value: number): LitterKind {
  const total = LITTER_KINDS.reduce((sum, kind) => sum + LITTER_WEIGHTS[kind], 0);
  let left = value * total;
  for (const kind of LITTER_KINDS) {
    left -= LITTER_WEIGHTS[kind];
    if (left < 0) return kind;
  }
  return 'paper';
}

/**
 * Toutes les places possibles des déchets, de la première salie à la dernière : les cases
 * libres du sol (hors entrée), triées par un hachage de la graine. Les `count` premières sont
 * sales ; le ménage les vide en partant de la fin.
 */
export function litterSpots(seed: string, grid: NavGrid, entrance: Cell): LitterPiece[] {
  const cells: Cell[] = [];
  for (let z = 0; z < grid.depth; z++)
    for (let x = 0; x < grid.width; x++)
      if (grid.walkable(x, z) && (x !== entrance.x || z !== entrance.z)) cells.push({ x, z });
  const order = new Map(cells.map((cell) => [cell, unit(seed, `${cell.x},${cell.z}`)]));
  cells.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  const max = Math.min(LITTER_MAX, Math.round(cells.length * LITTER_DENSITY));
  return cells.slice(0, max).map((cell) => {
    const key = `${cell.x},${cell.z}`;
    return {
      cell,
      x: cell.x + (unit(seed, `${key}#x`) - 0.5) * 0.4,
      z: cell.z + (unit(seed, `${key}#z`) - 0.5) * 0.4,
      turn: unit(seed, `${key}#r`) * Math.PI * 2,
      kind: pickKind(unit(seed, `${key}#k`)),
    };
  });
}

/** Nombre de déchets visibles pour une saleté donnée (0 à 100). */
export function litterCount(spots: number, dirt: number): number {
  return Math.round((spots * Math.min(100, Math.max(0, dirt))) / 100);
}

// --- Formes des déchets -------------------------------------------------------------------------

function tinted(geometry: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const plain = geometry.index ? geometry.toNonIndexed() : geometry;
  if (plain !== geometry) geometry.dispose();
  const rgb = new THREE.Color(color);
  const count = plain.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) rgb.toArray(colors, i * 3);
  plain.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return plain;
}

function boxAt(
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
  turn = 0,
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(w, h, d);
  if (turn) geometry.rotateY(turn);
  geometry.translate(x, y + h / 2, z);
  return tinted(geometry, color);
}

/** Géométrie fusionnée d'une sorte de déchet, centrée sur sa case et posée au sol. */
function litterGeometry(kind: LitterKind): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  switch (kind) {
    case 'paper': {
      // Boule de papier froissé (et une seconde, plus petite, qui a raté la poubelle elle aussi).
      const ball = new THREE.IcosahedronGeometry(0.07, 0);
      ball.translate(0, 0.06, 0);
      parts.push(tinted(ball, 0xf4f1e8));
      const small = new THREE.IcosahedronGeometry(0.045, 0);
      small.translate(0.12, 0.04, 0.05);
      parts.push(tinted(small, 0xe8e2d0));
      break;
    }
    case 'wrapper':
      // Emballage de barre chocolatée : corps plat et deux bouts tortillés.
      parts.push(boxAt(0.16, 0.025, 0.07, 0xd64545, 0, 0.004, 0));
      parts.push(boxAt(0.04, 0.02, 0.09, 0xf0c94a, 0.1, 0.004, 0, 0.4));
      parts.push(boxAt(0.04, 0.02, 0.09, 0xf0c94a, -0.1, 0.004, 0, -0.4));
      parts.push(boxAt(0.07, 0.027, 0.03, 0xffffff, 0, 0.004, 0));
      break;
    case 'can': {
      // Canette couchée, cabossée.
      const can = new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8);
      can.rotateZ(Math.PI / 2);
      can.translate(0, 0.035, 0);
      parts.push(tinted(can, 0x2f7fd1));
      const band = new THREE.CylinderGeometry(0.036, 0.036, 0.03, 8);
      band.rotateZ(Math.PI / 2);
      band.translate(0.02, 0.035, 0);
      parts.push(tinted(band, 0xd9dde3));
      break;
    }
    case 'cup': {
      // Gobelet de café renversé, couvercle à côté, et une flaque.
      const cup = new THREE.CylinderGeometry(0.045, 0.032, 0.12, 8);
      cup.rotateZ(Math.PI / 2);
      cup.translate(0, 0.04, 0);
      parts.push(tinted(cup, 0xf7f3ea));
      const sleeve = new THREE.CylinderGeometry(0.047, 0.04, 0.05, 8);
      sleeve.rotateZ(Math.PI / 2);
      sleeve.translate(0.005, 0.04, 0);
      parts.push(tinted(sleeve, 0x9a6b3f));
      const lid = new THREE.CylinderGeometry(0.048, 0.048, 0.012, 8);
      lid.translate(0.12, 0.006, 0.06);
      parts.push(tinted(lid, 0x2b2b2b));
      const puddle = new THREE.CylinderGeometry(0.1, 0.1, 0.003, 10);
      puddle.translate(-0.11, 0.002, 0.02);
      parts.push(tinted(puddle, 0x5a3a22));
      break;
    }
    case 'pizza':
      // Boîte de pizza entrouverte, une croûte oubliée dessus.
      parts.push(boxAt(0.34, 0.035, 0.34, 0xc79a5b, 0, 0.002, 0));
      parts.push(boxAt(0.3, 0.004, 0.3, 0xe7cfa1, 0, 0.037, 0));
      parts.push(boxAt(0.14, 0.02, 0.04, 0xd9963c, 0.04, 0.041, -0.06, 0.5));
      parts.push(boxAt(0.12, 0.006, 0.08, 0xc23b2b, -0.06, 0.04, 0.06));
      break;
    case 'banana':
      // Peau de banane, trois pans étalés autour de la queue.
      parts.push(boxAt(0.05, 0.03, 0.05, 0xd8b23a, 0, 0.004, 0));
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const flap = new THREE.BoxGeometry(0.14, 0.012, 0.045);
        flap.translate(0.07, 0.006, 0);
        flap.rotateY(angle);
        parts.push(tinted(flap, i === 1 ? 0xc59a2a : 0xf0d04a));
      }
      parts.push(boxAt(0.025, 0.03, 0.025, 0x6b5326, 0, 0.03, 0));
      break;
    case 'stain': {
      // Tache sur le sol (café, soda) : deux disques écrasés.
      const big = new THREE.CylinderGeometry(0.2, 0.2, 0.002, 12);
      big.translate(0, 0.001, 0);
      parts.push(tinted(big, 0x4a3726));
      const drop = new THREE.CylinderGeometry(0.07, 0.07, 0.002, 10);
      drop.translate(0.22, 0.001, 0.08);
      parts.push(tinted(drop, 0x4a3726));
      break;
    }
  }
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged ?? new THREE.BufferGeometry();
}

const litterMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.85,
  flatShading: true,
});
/** Les taches se fondent dans le sol : un peu transparentes, sans écrire la profondeur. */
const stainMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.4,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});

// --- Équipe de ménage ---------------------------------------------------------------------------

/** Tenue de chaque membre de l'équipe : uniforme bleu canard de Nickel Chrome. */
const CREW_OUTFITS: Readonly<Record<CleanerTool, Outfit>> = {
  cart: {
    skin: 0x7a4a2e,
    hair: 0x1e1612,
    hairStyle: 'bun',
    shirt: 0x1f8a8a,
    sleeves: 'short',
    pants: 0x223047,
    shoes: 0xeeeeee,
  },
  vacuum: {
    skin: 0xf3c9a5,
    hair: 0x8a8a8a,
    hairStyle: 'short',
    shirt: 0x1f8a8a,
    sleeves: 'long',
    pants: 0x223047,
    shoes: 0x2b2b2b,
  },
  mop: {
    skin: 0xd9a066,
    hair: 0x3b2416,
    hairStyle: 'ponytail',
    shirt: 0x1f8a8a,
    sleeves: 'short',
    pants: 0x223047,
    shoes: 0xf2c94c,
  },
};

/** Outil tenu ou poussé devant soi (repère du personnage : il regarde vers +z). */
function toolGeometry(tool: CleanerTool): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  switch (tool) {
    case 'cart':
      // Chariot de ménage : plateau, seau jaune, sac-poubelle, poignée.
      parts.push(boxAt(0.36, 0.04, 0.26, 0x3b3f46, 0, 0.12, 0.42));
      parts.push(boxAt(0.36, 0.04, 0.26, 0x3b3f46, 0, 0.42, 0.42));
      for (const [x, z] of [
        [-0.16, 0.3],
        [0.16, 0.3],
        [-0.16, 0.54],
        [0.16, 0.54],
      ] as const) {
        parts.push(boxAt(0.03, 0.42, 0.03, 0x9aa0a8, x, 0.04, z));
        parts.push(boxAt(0.05, 0.05, 0.05, 0x1b1b1b, x, 0, z));
      }
      parts.push(boxAt(0.16, 0.14, 0.16, 0xf2c94c, -0.08, 0.16, 0.42));
      parts.push(boxAt(0.14, 0.24, 0.14, 0x1b1b1b, 0.1, 0.46, 0.44));
      parts.push(boxAt(0.3, 0.03, 0.03, 0x9aa0a8, 0, 0.62, 0.28));
      break;
    case 'vacuum': {
      // Aspirateur traîneau : corps, tuyau, canne et brosse au sol.
      parts.push(boxAt(0.18, 0.14, 0.24, 0xd64545, 0.22, 0, -0.12));
      parts.push(boxAt(0.12, 0.02, 0.18, 0x2b2b2b, 0.22, 0.14, -0.12));
      const hose = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6);
      hose.rotateX(Math.PI / 2.6);
      hose.translate(0.2, 0.3, 0.12);
      parts.push(tinted(hose, 0x3b3f46));
      const wand = new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6);
      wand.rotateX(-Math.PI / 5);
      wand.translate(0.18, 0.28, 0.42);
      parts.push(tinted(wand, 0xb8bec6));
      parts.push(boxAt(0.22, 0.03, 0.07, 0x2b2b2b, 0.18, 0, 0.62));
      break;
    }
    case 'mop': {
      // Balai à franges et seau à essoreuse.
      const stick = new THREE.CylinderGeometry(0.015, 0.015, 1.1, 6);
      stick.rotateX(-Math.PI / 7);
      stick.translate(0.16, 0.55, 0.32);
      parts.push(tinted(stick, 0x5a9bd5));
      parts.push(boxAt(0.24, 0.04, 0.12, 0xe8e2d0, 0.16, 0, 0.54));
      parts.push(boxAt(0.22, 0.2, 0.22, 0x3a7bd5, -0.3, 0, -0.1));
      parts.push(boxAt(0.18, 0.04, 0.12, 0xf2c94c, -0.3, 0.2, -0.13));
      break;
    }
  }
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged ?? new THREE.BufferGeometry();
}

/** Vitesse de marche de l'équipe (cases par seconde de jeu à x1). */
const WALK_SPEED = 6;
/** Temps passé sur chaque déchet (secondes de jeu à x1). */
const SCRUB_SECONDS = 0.35;

type CrewPose = 'walk' | 'scrub' | 'idle';
const CREW_CLIPS: Readonly<Record<CrewPose, string>> = {
  walk: 'walk',
  scrub: 'interact-right',
  idle: 'idle',
};

class Cleaner {
  readonly root = new THREE.Group();
  private body: THREE.Object3D = new THREE.Group();
  private readonly toolMesh: THREE.Mesh;
  private mixer: THREE.AnimationMixer | null = null;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private pose: CrewPose = 'idle';
  private path: Cell[] = [];
  private targets: Cell[] = [];
  private scrub = 0;
  private time = 0;
  x = 0;
  z = 0;

  constructor(tool: CleanerTool, assets: AssetLibrary) {
    this.root.name = `cleaner-${tool}`;
    this.toolMesh = new THREE.Mesh(toolGeometry(tool), litterMaterial);
    this.toolMesh.castShadow = true;
    this.root.add(this.toolMesh);
    this.root.visible = false;
    void assets.outfitCharacter(`cleaner-${tool}`, CREW_OUTFITS[tool]).then((asset) => {
      if (!asset) return;
      this.body = asset.scene;
      this.root.add(this.body);
      if (asset.animations.length === 0) return;
      this.mixer = new THREE.AnimationMixer(asset.scene);
      for (const clip of asset.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
      this.play(this.pose, true);
    });
  }

  /** Entre par la porte avec sa liste de déchets à ramasser. */
  start(entrance: Cell, targets: readonly Cell[]): void {
    this.x = entrance.x;
    this.z = entrance.z;
    this.targets = [...targets];
    this.path = [];
    this.scrub = 0;
    this.root.visible = true;
  }

  stop(): void {
    this.root.visible = false;
    this.targets = [];
    this.path = [];
  }

  update(grid: NavGrid | null, seconds: number, reducedMotion: boolean): void {
    if (!this.root.visible) return;
    let left = seconds;
    let pose: CrewPose = 'idle';
    while (left > 0) {
      if (this.scrub > 0) {
        const used = Math.min(this.scrub, left);
        this.scrub -= used;
        left -= used;
        pose = 'scrub';
        continue;
      }
      const next = this.path[0];
      if (next) {
        const dx = next.x - this.x;
        const dz = next.z - this.z;
        const distance = Math.hypot(dx, dz);
        const step = WALK_SPEED * left;
        if (distance > 0.0001) this.root.rotation.y = Math.atan2(dx, dz);
        if (step >= distance) {
          this.x = next.x;
          this.z = next.z;
          this.path.shift();
          left -= distance / WALK_SPEED;
          if (this.path.length === 0) this.scrub = SCRUB_SECONDS;
        } else {
          this.x += (dx / distance) * step;
          this.z += (dz / distance) * step;
          left = 0;
        }
        pose = 'walk';
        continue;
      }
      const target = this.targets.shift();
      if (!target || !grid) break;
      const from = { x: Math.round(this.x), z: Math.round(this.z) };
      const path = findPath(grid, from, target, { maxIterations: 4000 });
      if (path === null) continue;
      this.path = path;
      if (path.length === 0) this.scrub = SCRUB_SECONDS;
    }
    this.root.position.set(this.x, 0, this.z);
    if (pose !== this.pose) this.play(pose, false);
    this.time += reducedMotion ? 0 : seconds;
    this.mixer?.update(reducedMotion ? 0 : seconds);
    // L'outil s'agite pendant le ménage (serpillière, brosse de l'aspirateur).
    this.toolMesh.rotation.y =
      pose === 'scrub' && !reducedMotion ? Math.sin(this.time * 14) * 0.12 : 0;
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    this.toolMesh.geometry.dispose();
  }

  private play(pose: CrewPose, immediate: boolean): void {
    this.pose = pose;
    const next = this.actions.get(CREW_CLIPS[pose]);
    if (!next || next === this.current) return;
    next.reset().play();
    if (this.current && !immediate) this.current.crossFadeTo(next, 0.2, false);
    else this.current?.stop();
    this.current = next;
  }
}

/** Déchets au sol et équipe de ménage. */
export class CleaningView3D {
  readonly root = new THREE.Group();
  private readonly meshes = new Map<LitterKind, THREE.InstancedMesh>();
  private readonly cleaners: Cleaner[];
  private spots: LitterPiece[] = [];
  private grid: NavGrid | null = null;
  private entrance: Cell = { x: 0, z: 0 };
  private spotsKey = '';
  private shown = -1;
  private visiting = false;

  constructor(assets: AssetLibrary) {
    this.root.name = 'cleaning';
    for (const kind of LITTER_KINDS) {
      const mesh = new THREE.InstancedMesh(
        litterGeometry(kind),
        kind === 'stain' ? stainMaterial : litterMaterial,
        LITTER_MAX,
      );
      mesh.name = `litter-${kind}`;
      mesh.count = 0;
      mesh.castShadow = kind !== 'stain';
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.meshes.set(kind, mesh);
      this.root.add(mesh);
    }
    this.cleaners = CLEANING_CREW.map((member) => new Cleaner(member.tool, assets));
    for (const cleaner of this.cleaners) this.root.add(cleaner.root);
  }

  /** Nombre de déchets dessinés (tests, captures). */
  get litterShown(): number {
    return Math.max(0, this.shown);
  }

  /** L'équipe de ménage est-elle dans le bureau ? */
  get crewVisible(): boolean {
    return this.cleaners.some((cleaner) => cleaner.root.visible);
  }

  sync(
    seed: string,
    layout: OfficeLayout,
    items: readonly PlacedItemView[],
    cleaning: CleaningView,
  ): void {
    const key = `${seed}|${layout.width}x${layout.depth}|${layout.partitions.length}|${items
      .map((item) => `${item.id}:${item.x},${item.z},${item.rotation}`)
      .join(';')}`;
    if (key !== this.spotsKey) {
      this.spotsKey = key;
      this.grid = buildNavGrid(layout, items);
      this.entrance = layout.entrance;
      this.spots = litterSpots(seed, this.grid, layout.entrance);
      this.shown = -1;
    }
    const count = litterCount(this.spots.length, cleaning.dirt);
    if (count !== this.shown) this.place(count);

    const visiting = cleaning.visit !== null;
    if (visiting && !this.visiting) this.dispatchCrew(count);
    if (!visiting && this.visiting) for (const cleaner of this.cleaners) cleaner.stop();
    this.visiting = visiting;
  }

  update(seconds: number, reducedMotion: boolean): void {
    for (const cleaner of this.cleaners) cleaner.update(this.grid, seconds, reducedMotion);
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) mesh.geometry.dispose();
    for (const cleaner of this.cleaners) cleaner.dispose();
  }

  /** Chaque membre prend un déchet sur trois, des derniers salis aux premiers. */
  private dispatchCrew(count: number): void {
    const dirty = this.spots.slice(0, count).reverse();
    this.cleaners.forEach((cleaner, index) => {
      const targets = dirty.filter((_, i) => i % this.cleaners.length === index).map((p) => p.cell);
      // Bureau déjà propre : un petit tour quand même, pour vider les poubelles.
      if (targets.length === 0 && this.spots[index]) targets.push(this.spots[index].cell);
      cleaner.start(this.entrance, targets);
    });
  }

  private place(count: number): void {
    this.shown = count;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const scale = new THREE.Vector3(LITTER_SCALE, LITTER_SCALE, LITTER_SCALE);
    const counts = new Map<LitterKind, number>(LITTER_KINDS.map((kind) => [kind, 0]));
    for (const piece of this.spots.slice(0, count)) {
      const mesh = this.meshes.get(piece.kind);
      const index = counts.get(piece.kind) ?? 0;
      if (!mesh) continue;
      rotation.setFromAxisAngle(up, piece.turn);
      matrix.compose(new THREE.Vector3(piece.x, 0.004, piece.z), rotation, scale);
      mesh.setMatrixAt(index, matrix);
      counts.set(piece.kind, index + 1);
    }
    for (const [kind, mesh] of this.meshes) {
      mesh.count = counts.get(kind) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
