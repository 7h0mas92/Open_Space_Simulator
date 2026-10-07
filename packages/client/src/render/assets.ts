/**
 * Chargement des modèles Kenney (GLTFLoader) avec cache, normalisation et formes de secours.
 *
 * Chaque modèle n'est téléchargé qu'une fois ; les instances sont ensuite dessinées par
 * InstancedMesh (meubles) ou clonées avec leur squelette (personnages animés).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { catalogItem, type ItemModel } from '../view/catalog';
import { characterUrl, CHARACTER_IDS, furnitureUrl, type FurnitureModel } from './assetManifest';
import { buildPrimitive, fallbackBox } from './primitives';

/**
 * Échelle commune du Furniture Kit : ses modèles partagent la même unité, on les agrandit tous
 * du même facteur pour qu'un bureau couvre deux cases.
 */
export const FURNITURE_SCALE = 2;
/** Hauteur visée des personnages, en cases. */
export const CHARACTER_HEIGHT = 1.15;

export interface CharacterAsset {
  readonly scene: THREE.Object3D;
  readonly animations: readonly THREE.AnimationClip[];
}

/** Modèles qui n'ont pas pu être chargés (affichés dans les crédits / la console). */
export const failedAssets = new Set<string>();

export class AssetLibrary {
  private readonly loader = new GLTFLoader();
  private readonly furniture = new Map<string, Promise<THREE.Object3D | null>>();
  private readonly characters = new Map<string, Promise<CharacterAsset | null>>();

  /** Modèle Kenney normalisé (posé au sol, centré), ou `null` s'il est introuvable. */
  loadFurniture(model: FurnitureModel): Promise<THREE.Object3D | null> {
    let promise = this.furniture.get(model);
    if (!promise) {
      promise = this.loader
        .loadAsync(furnitureUrl(model))
        .then((gltf) => normalizeFurniture(gltf.scene))
        .catch(() => {
          failedAssets.add(model);
          return null;
        });
      this.furniture.set(model, promise);
    }
    return promise;
  }

  /**
   * Gabarit d'un objet du catalogue : modèle Kenney ou forme Three.js, complété de ses pièces
   * (appareils posés dessus, écran, bancs…). Boîte de secours si le modèle principal manque.
   */
  async itemTemplate(kind: string): Promise<THREE.Object3D> {
    const def = catalogItem(kind);
    if (!def) return fallbackBox(1, 1, 0.5);
    const body = await this.model(def.model);
    if (!body) return fallbackBox(def.size[0], def.size[1], def.height);
    // Le modèle est centré et posé au sol : l'agrandir autour de l'origine le garde en place.
    if (def.scale) body.scale.set(...def.scale);
    const root = new THREE.Group();
    root.add(body);
    if (def.onTop) await this.placeOnTop(root, def.onTop);
    const parts = await Promise.all((def.parts ?? []).map((part) => this.model(part.model)));
    (def.parts ?? []).forEach((part, index) => {
      const object = parts[index];
      if (!object) return;
      object.position.set(...part.at);
      object.rotation.y = ((part.turn ?? 0) * Math.PI) / 2;
      if (part.scale) object.scale.set(...part.scale);
      root.add(object);
    });
    return withShadows(root);
  }

  /** Une copie du modèle Kenney ou de la forme Three.js, `null` si le GLB est introuvable. */
  private async model(model: ItemModel): Promise<THREE.Object3D | null> {
    if (model.source === 'primitive') return buildPrimitive(model.model);
    return (await this.loadFurniture(model.model))?.clone() ?? null;
  }

  /** Pose de petits appareils côte à côte, centrés sur le dessus du meuble. */
  private async placeOnTop(base: THREE.Object3D, models: readonly ItemModel[]) {
    const top = new THREE.Box3().setFromObject(base).max.y;
    const loaded = await Promise.all(models.map((model) => this.model(model)));
    const parts = loaded.flatMap((part) => (part ? [part] : []));
    const widths = parts.map(
      (part) => new THREE.Box3().setFromObject(part).getSize(new THREE.Vector3()).x,
    );
    let x = -widths.reduce((sum, width) => sum + width, 0) / 2;
    parts.forEach((part, index) => {
      const width = widths[index] ?? 0;
      part.position.set(x + width / 2, top, 0);
      x += width;
      base.add(part);
    });
  }

  /** Personnage animé (une copie indépendante avec son propre squelette). */
  async character(look: number): Promise<CharacterAsset | null> {
    const id =
      CHARACTER_IDS[
        ((look % CHARACTER_IDS.length) + CHARACTER_IDS.length) % CHARACTER_IDS.length
      ] ?? 'a';
    let promise = this.characters.get(id);
    if (!promise) {
      promise = this.loader
        .loadAsync(characterUrl(id))
        .then((gltf) => ({ scene: normalizeCharacter(gltf.scene), animations: gltf.animations }))
        .catch(() => {
          failedAssets.add(`character-${id}`);
          return null;
        });
      this.characters.set(id, promise);
    }
    const asset = await promise;
    if (!asset) return null;
    return { scene: SkeletonUtils.clone(asset.scene), animations: asset.animations };
  }
}

function withShadows<T extends THREE.Object3D>(root: T): T {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return root;
}

/** Met le modèle à l'échelle commune, pose sa base au sol et le centre sur l'origine. */
function normalizeFurniture(scene: THREE.Object3D): THREE.Object3D {
  const wrapper = new THREE.Group();
  scene.scale.setScalar(FURNITURE_SCALE);
  wrapper.add(scene);
  const box = new THREE.Box3().setFromObject(wrapper);
  const center = box.getCenter(new THREE.Vector3());
  scene.position.set(-center.x, -box.min.y, -center.z);
  withShadows(wrapper);
  return wrapper;
}

function normalizeCharacter(scene: THREE.Object3D): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(scene);
  const height = Math.max(0.01, box.max.y - box.min.y);
  scene.scale.setScalar(CHARACTER_HEIGHT / height);
  scene.position.y = -box.min.y * (CHARACTER_HEIGHT / height);
  withShadows(scene);
  const wrapper = new THREE.Group();
  wrapper.add(scene);
  return wrapper;
}
