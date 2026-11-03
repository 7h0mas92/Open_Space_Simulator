/**
 * Les décorations de saison et la table d'anniversaire dans la scène.
 *
 * Le plan (où poser quoi) vient de `view/decor.ts` ; ce module ne fait que le dessiner. Les
 * objets répétés (une citrouille sur chaque bureau, plusieurs sapins) sont des InstancedMesh,
 * comme le mobilier : un seul appel de dessin par pièce, quel que soit le nombre de bureaux.
 */
import * as THREE from 'three';
import type { DecorTheme } from '@oss/shared';
import { itemCells } from '../ai/grid';
import { catalogItem } from '../view/catalog';
import type { DecorPlan } from '../view/decor';
import type { OfficeLayout } from '../view/layout';
import type { PlacedItemView } from '../view/types';
import { wallLength, wallOpenings, type WallSide } from '../view/windows';
import type { AssetLibrary } from './assets';
import {
  decorBulbMaterials,
  decorGlowMaterials,
  festoons,
  partyProps,
  THEME_MODELS,
  type DecorWall,
} from './decorModels';
import { itemMatrix } from './office';
import { wallSlots } from './officeLights';
import { fallbackBox } from './primitives';

/**
 * Où poser un petit objet sur chaque type de bureau : hauteur du plateau et coin libre, à
 * l'écart de l'écran, du clavier, de la souris et des trois places d'accessoires.
 */
const DESK_SPOTS: Readonly<Record<string, readonly [number, number, number]>> = {
  desk: [0.31, 0.77, 0.24],
  'ikea-desk': [0.4, 0.695, 0.3],
  'standing-desk': [-0.52, 1.1, 0.18],
};

/** Un meuble collé au mur qui monte au-delà passe devant les ornements (étagère, frigo…). */
const TALL_ITEM = 1.3;
/** Au-delà, il atteint même les guirlandes. */
const VERY_TALL_ITEM = 1.9;

/**
 * Où décorer les deux murs du fond. Les guirlandes suivent le mur plein, coupées par les
 * fenêtres, les cloisons qui viennent s'y raccorder et les meubles qui montent jusqu'au
 * plafond ; les ornements se placent entre deux appliques (une case sur quatre, voir
 * `wallSlots`), jamais devant une fenêtre, une cloison ou un grand meuble. Fonction pure.
 */
export function decorWalls(layout: OfficeLayout, items: readonly PlacedItemView[]): DecorWall[] {
  const openings = wallOpenings(items);
  const sconces = wallSlots(layout);
  return ([0, 1] as const).map((side: WallSide) => {
    const length = wallLength(layout, side);
    /** Coupures de la guirlande [début, fin[ le long du mur, et cases interdites aux ornements. */
    const cuts: [number, number][] = [];
    const blocked = new Set<number>();
    for (const opening of openings) {
      if (opening.wall !== side) continue;
      cuts.push([opening.start - 0.5, opening.start + opening.length - 0.5]);
      for (let k = opening.start; k < opening.start + opening.length; k++) blocked.add(k);
    }
    for (const cell of layout.partitions) {
      const along = side === 0 ? cell.x : cell.z;
      if ((side === 0 ? cell.z : cell.x) !== 0) continue;
      cuts.push([along - 0.12, along + 0.12]);
      blocked.add(along);
    }
    for (const item of items) {
      const def = catalogItem(item.kind);
      if (!def || def.wall || def.ceiling || def.height < TALL_ITEM) continue;
      for (const cell of itemCells(item)) {
        if ((side === 0 ? cell.z : cell.x) !== 0) continue;
        const along = side === 0 ? cell.x : cell.z;
        blocked.add(along);
        if (def.height >= VERY_TALL_ITEM) cuts.push([along - 0.5, along + 0.5]);
      }
    }
    // Morceaux de mur plein, d'un coin à l'autre, sans les coupures.
    const spans: [number, number][] = [];
    let from = -0.44;
    const end = length - 0.56;
    for (const [a, b] of [...cuts].sort((x, y) => x[0] - y[0])) {
      if (a > from) spans.push([from, Math.min(a, end)]);
      from = Math.max(from, b);
    }
    if (end > from) spans.push([from, end]);
    // Ornements : à mi-chemin entre deux appliques, ni dans un coin ni contre le bout du mur.
    const lamps = sconces
      .filter((slot) => slot.turn === side)
      .map((slot) => (side === 0 ? slot.x : slot.z));
    const first = lamps[0] ?? 2;
    const spots: number[] = [];
    for (let k = 1; k <= length - 2; k++) {
      if ((((k - first) % 4) + 4) % 4 !== 2 || blocked.has(k)) continue;
      spots.push(k);
    }
    return { side, spans: spans.filter(([a, b]) => b - a >= 0.6), spots };
  });
}

/** Parties d'un modèle à plat (géométrie, matériau, matrice relative), pour l'instanciation. */
function flatten(template: THREE.Object3D) {
  template.updateMatrixWorld(true);
  const parts: {
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    matrix: THREE.Matrix4;
  }[] = [];
  template.traverse((child) => {
    if (child instanceof THREE.Mesh && !Array.isArray(child.material))
      parts.push({
        geometry: child.geometry,
        material: child.material,
        matrix: child.matrixWorld.clone(),
      });
  });
  return parts;
}

/** Un modèle répété aux positions données, en InstancedMesh. */
function instanced(template: THREE.Object3D, matrices: readonly THREE.Matrix4[]): THREE.Group {
  const result = new THREE.Group();
  if (matrices.length === 0) return result;
  for (const part of flatten(template)) {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, matrices.length);
    matrices.forEach((matrix, index) =>
      mesh.setMatrixAt(index, matrix.clone().multiply(part.matrix)),
    );
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    result.add(mesh);
  }
  return result;
}

function withShadows(object: THREE.Object3D): THREE.Object3D {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return object;
}

/**
 * Libère les géométries d'un groupe (les matériaux sont partagés et gardés en cache). Les objets
 * marqués `userData.shared` (la table Kenney, gardée en cache) ne sont pas libérés.
 */
function disposeGroup(node: THREE.Object3D): void {
  if (node.userData.shared) return;
  if (node instanceof THREE.InstancedMesh) node.dispose();
  if (node instanceof THREE.Mesh) node.geometry.dispose();
  for (const child of node.children) disposeGroup(child);
}

/** La part des murs du thème `index` sur `count` : un feston et un ornement sur `count`. */
export function shareWalls(walls: readonly DecorWall[], index: number, count: number): DecorWall[] {
  if (count <= 1) return [...walls];
  let festoon = 0;
  let spot = 0;
  return walls.map((wall) => ({
    side: wall.side,
    spans: wall.spans.flatMap((span) => festoons(span)).filter(() => festoon++ % count === index),
    spots: wall.spots.filter(() => spot++ % count === index),
  }));
}

export class DecorationsView {
  readonly root = new THREE.Group();
  private key = '';
  private buildId = 0;
  private table: Promise<THREE.Object3D> | null = null;

  constructor(private readonly assets: AssetLibrary) {
    this.root.name = 'decorations';
  }

  /** Reconstruit le décor si le plan a changé (nouveaux thèmes, mobilier déplacé, fête). */
  async update(
    key: string,
    plan: DecorPlan,
    layout: OfficeLayout,
    items: readonly PlacedItemView[],
  ): Promise<void> {
    if (key === this.key) return;
    this.key = key;
    const buildId = ++this.buildId;
    const table = plan.party ? await this.partyTable() : null;
    if (buildId !== this.buildId) return; // un plan plus récent est arrivé entre-temps

    this.clear();
    this.root.add(...this.walls(plan.themes, decorWalls(layout, items)));
    this.root.add(...this.desks(plan.themes, items));
    if (plan.party && table) {
      const party = new THREE.Group();
      const copy = table.clone();
      copy.userData.shared = true;
      party.add(copy, withShadows(partyProps(table.userData.top as number)));
      party.position.set(plan.party.center.x, 0, plan.party.center.z);
      party.name = 'birthday-table';
      this.root.add(party);
    }
  }

  /** Les guirlandes et ampoules scintillent doucement (sauf avec « réduire les animations »). */
  animate(seconds: number, reducedMotion: boolean): void {
    decorGlowMaterials().forEach((material, index) => {
      material.emissiveIntensity = reducedMotion
        ? 0.9
        : 0.75 + 0.35 * Math.sin(seconds * 2.4 + index * 1.7);
    });
    decorBulbMaterials().forEach((material, index) => {
      material.color.setScalar(
        reducedMotion ? 1 : 0.82 + 0.22 * Math.sin(seconds * 2.4 + index * 2.1),
      );
    });
  }

  dispose(): void {
    this.clear();
  }

  private clear(): void {
    for (const child of [...this.root.children]) {
      this.root.remove(child);
      disposeGroup(child);
    }
  }

  /**
   * Un décor mural par thème. Avec plusieurs thèmes à la fois, ils se partagent les murs au
   * lieu de s'empiler : festons et ornements alternent d'un thème à l'autre.
   */
  private walls(themes: readonly DecorTheme[], walls: readonly DecorWall[]): THREE.Object3D[] {
    return themes.map((theme, index) =>
      withShadows(THEME_MODELS[theme].wall(shareWalls(walls, index, themes.length))),
    );
  }

  /** Un petit objet par bureau ; avec plusieurs thèmes, les bureaux se les partagent. */
  private desks(themes: readonly DecorTheme[], items: readonly PlacedItemView[]): THREE.Object3D[] {
    if (themes.length === 0) return [];
    const byTheme = new Map<DecorTheme, THREE.Matrix4[]>();
    const desks = items.filter((item) => catalogItem(item.kind)?.use === 'desk');
    desks.forEach((desk, index) => {
      const spot = DESK_SPOTS[desk.kind];
      const theme = themes[index % themes.length];
      if (!spot || !theme) return;
      const matrix = itemMatrix(desk).multiply(new THREE.Matrix4().makeTranslation(...spot));
      byTheme.set(theme, [...(byTheme.get(theme) ?? []), matrix]);
    });
    return [...byTheme].map(([theme, matrices]) => instanced(THEME_MODELS[theme].desk(), matrices));
  }

  /**
   * Table de fête : la table à nappe du kit Kenney, étirée sur deux cases. Sa hauteur, lue sur
   * le modèle, est gardée dans `userData.top` pour y poser le gâteau.
   */
  private partyTable(): Promise<THREE.Object3D> {
    this.table ??= this.assets.loadFurniture('tableCloth').then((model) => {
      const table = model?.clone() ?? fallbackBox(2, 1, 0.75, 0xf2efe8);
      const size = new THREE.Box3().setFromObject(table).getSize(new THREE.Vector3());
      table.scale.set(1.9 / Math.max(0.1, size.x), 1, 0.95 / Math.max(0.1, size.z));
      table.userData.top = size.y;
      return withShadows(table);
    });
    return this.table;
  }
}
