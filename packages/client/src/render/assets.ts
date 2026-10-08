/**
 * Chargement des modèles Kenney (GLTFLoader) avec cache, normalisation et formes de secours.
 *
 * Chaque modèle n'est téléchargé qu'une fois ; les instances sont ensuite dessinées par
 * InstancedMesh (meubles) ou clonées avec leur squelette (personnages animés).
 */
import type { CharacterPackId } from '@oss/shared';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { catalogItem, type ItemModel } from '../view/catalog';
import { COLOR_HEX, SECONDARY_SHADE, type FurnitureColor } from '../view/colors';
import type { DevRole } from '../view/types';
import { dressUp, themedLookFor, themedLookKey, type ThemedLook } from './characterPacks';
import { characterUrl, furnitureUrl, type CharacterId, type FurnitureModel } from './assetManifest';
import { addAccessories, BLOCKY_HEIGHT, buildCharacter, KENNEY_COLORS } from './officeCharacters';
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
  async itemTemplate(kind: string, color: FurnitureColor = 'natural'): Promise<THREE.Object3D> {
    const def = catalogItem(kind);
    if (!def) return fallbackBox(1, 1, 0.5);
    const body = await this.model(def.model);
    if (!body) return fallbackBox(def.size[0], def.size[1], def.height);
    // Seul le meuble est repeint : l'écran, les livres ou la cafetière posés dessus non.
    paintObject(body, def.paint, color);
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
   * `officeCharacters.ts`, et il porte le costume d'un pack actif s'il y en a un, voir
   * `characterPacks.ts`. Les personnages construits en Three.js empruntent les clips Kenney.
   */
  async character(
    role: DevRole,
    look: number,
    packs: readonly CharacterPackId[] = [],
  ): Promise<CharacterAsset | null> {
    const themed = themedLookFor(role, look, packs);
    const key = themedLookKey(themed);
    let promise = this.characters.get(key);
    if (!promise) {
      promise = this.buildCharacter(themed);
      this.characters.set(key, promise);
    }
    const asset = await promise;
    if (!asset) return null;
    return { scene: SkeletonUtils.clone(asset.scene), animations: asset.animations };
  }

  private async buildCharacter({ look, costume }: ThemedLook): Promise<CharacterAsset | null> {
    let scene: THREE.Object3D;
    let animations: readonly THREE.AnimationClip[];
    if (look.kind === 'built') {
      const donor = await this.kenneyCharacter(CLIP_DONOR);
      scene = buildCharacter(look.outfit, look.accessories);
      animations = donor?.animations ?? [];
    } else {
      const base = await this.kenneyCharacter(look.id);
      if (!base) return null;
      scene = SkeletonUtils.clone(base.scene);
      addAccessories(scene, look.accessories, KENNEY_COLORS[look.id] ?? DEFAULT_COLORS);
      animations = base.animations;
    }
    if (costume) dressUp(scene, costume);
    return { scene: normalizeCharacter(scene), animations };
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

/**
 * Repeint les matériaux nommés dans `names` (le premier avec la teinte choisie, les autres un
 * peu plus sombres). Les matériaux sont clonés : les modèles en cache restent intacts.
 */
export function paintObject(
  root: THREE.Object3D,
  names: readonly string[],
  color: FurnitureColor,
): void {
  if (color === 'natural' || names.length === 0) return;
  const base = new THREE.Color(COLOR_HEX[color]);
  const repaint = (material: THREE.Material): THREE.Material => {
    const index = names.indexOf(material.name);
    if (index < 0 || !(material instanceof THREE.MeshStandardMaterial)) return material;
    const painted = material.clone();
    painted.color.copy(base).multiplyScalar(index === 0 ? 1 : SECONDARY_SHADE);
    return painted;
  };
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const material = child.material as THREE.Material | THREE.Material[];
    child.material = Array.isArray(material) ? material.map(repaint) : repaint(material);
  });
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
