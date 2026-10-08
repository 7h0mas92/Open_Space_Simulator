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
import type { DevRole } from '../view/types';
import { characterUrl, furnitureUrl, type CharacterId, type FurnitureModel } from './assetManifest';
import {
  addAccessories,
  BLOCKY_HEIGHT,
  buildCharacter,
  KENNEY_COLORS,
  lookFor,
  lookKey,
  type CharacterLook,
} from './officeCharacters';
import { buildPrimitive, fallbackBox } from './primitives';

/**
 * Échelle commune du Furniture Kit : ses modèles partagent la même unité, on les agrandit tous
 * du même facteur pour qu'un bureau couvre deux cases.
 */
export const FURNITURE_SCALE = 2;
/** Hauteur visée des personnages, en cases. */
export const CHARACTER_HEIGHT = 1.15;

/** Personnage Kenney dont on emprunte les clips pour animer les personnages construits. */
const CLIP_DONOR: CharacterId = 'i';
const DEFAULT_COLORS = { hair: 0x2b2420, shirt: 0x4f7fd9 };

export interface CharacterAsset {
  readonly scene: THREE.Object3D;
  readonly animations: readonly THREE.AnimationClip[];
}

/** Modèles qui n'ont pas pu être chargés (affichés dans les crédits / la console). */
export const failedAssets = new Set<string>();

export class AssetLibrary {
  private readonly loader = new GLTFLoader();
  private readonly furniture = new Map<string, Promise<THREE.Object3D | null>>();
  /** Personnages prêts à cloner, par look. */
  private readonly characters = new Map<string, Promise<CharacterAsset | null>>();
  private readonly kenney = new Map<CharacterId, Promise<CharacterAsset | null>>();

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

  /**
   * Personnage animé d'un dev (une copie indépendante) : le look dépend de son profil, voir
   * `officeCharacters.ts`. Les personnages construits en Three.js empruntent les clips Kenney.
   */
  async character(role: DevRole, look: number): Promise<CharacterAsset | null> {
    const chosen = lookFor(role, look);
    const key = lookKey(chosen);
    let promise = this.characters.get(key);
    if (!promise) {
      promise = this.buildCharacter(chosen);
      this.characters.set(key, promise);
    }
    const asset = await promise;
    if (!asset) return null;
    return { scene: SkeletonUtils.clone(asset.scene), animations: asset.animations };
  }

  private async buildCharacter(look: CharacterLook): Promise<CharacterAsset | null> {
    if (look.kind === 'built') {
      const donor = await this.kenneyCharacter(CLIP_DONOR);
      const scene = buildCharacter(look.outfit, look.accessories);
      return { scene: normalizeCharacter(scene), animations: donor?.animations ?? [] };
    }
    const base = await this.kenneyCharacter(look.id);
    if (!base) return null;
    const scene = SkeletonUtils.clone(base.scene);
    addAccessories(scene, look.accessories, KENNEY_COLORS[look.id] ?? DEFAULT_COLORS);
    return { scene: normalizeCharacter(scene), animations: base.animations };
  }

  /** GLB Kenney brut (chargé une seule fois). */
  private kenneyCharacter(id: CharacterId): Promise<CharacterAsset | null> {
    let promise = this.kenney.get(id);
    if (!promise) {
      promise = this.loader
        .loadAsync(characterUrl(id))
        .then((gltf) => ({ scene: gltf.scene, animations: gltf.animations }))
        .catch(() => {
          failedAssets.add(`character-${id}`);
          return null;
        });
      this.kenney.set(id, promise);
    }
    return promise;
  }
}

function withShadows<T extends THREE.Object3D>(root: T): T {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Les corps translucides (Dev Fantôme) ne projettent pas d'ombre.
      child.castShadow = !(child.material as THREE.Material).transparent;
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

/**
 * Met le personnage à la hauteur commune et le pose au sol. L'échelle vient de la hauteur du
 * corps Blocky (et non de la boîte englobante) pour que béret ou antenne ne rapetissent pas le dev.
 */
function normalizeCharacter(scene: THREE.Object3D): THREE.Object3D {
  scene.scale.setScalar(CHARACTER_HEIGHT / BLOCKY_HEIGHT);
  scene.position.y = 0;
  withShadows(scene);
  const wrapper = new THREE.Group();
  wrapper.add(scene);
  return wrapper;
}
