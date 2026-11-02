/**
 * Les décorations de saison et la table d'anniversaire dans la scène.
 *
 * Le plan (où poser quoi) vient de `view/decor.ts` ; ce module ne fait que le dessiner. Les
 * objets répétés (une citrouille sur chaque bureau, plusieurs sapins) sont des InstancedMesh,
 * comme le mobilier : un seul appel de dessin par pièce, quel que soit le nombre de bureaux.
 */
import * as THREE from 'three';
import type { DecorTheme } from '@oss/shared';
import { catalogItem } from '../view/catalog';
import type { DecorPlan } from '../view/decor';
import type { OfficeLayout } from '../view/layout';
import type { PlacedItemView } from '../view/types';
import type { AssetLibrary } from './assets';
import { decorGlowMaterials, partyProps, THEME_MODELS } from './decorModels';
import { itemMatrix } from './office';
import { fallbackBox } from './primitives';

/** Où poser un petit objet sur chaque type de bureau : hauteur du plateau et coin libre. */
const DESK_SPOTS: Readonly<Record<string, readonly [number, number, number]>> = {
  desk: [0.33, 0.77, -0.12],
  'ikea-desk': [0.08, 0.69, -0.15],
  'standing-desk': [0.6, 1.1, 0.1],
};

/** Les guirlandes de chaque thème actif sont décalées vers le bas pour ne pas se chevaucher. */
const WALL_OFFSET = 0.32;

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
    this.root.add(...this.walls(plan.themes, layout));
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

  private walls(themes: readonly DecorTheme[], layout: OfficeLayout): THREE.Object3D[] {
    return themes.map((theme, index) => {
      const wall = withShadows(THEME_MODELS[theme].wall(layout.width, layout.depth));
      wall.position.y = -index * WALL_OFFSET;
      return wall;
    });
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
