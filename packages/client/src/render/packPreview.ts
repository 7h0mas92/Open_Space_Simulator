/**
 * Aperçu d'un pack de personnages pour le back-office : les 8 profils costumés, rendus hors
 * écran en une image PNG. Chargé à la demande (Three.js ne pèse rien tant qu'on ne l'ouvre pas).
 */
import type { CharacterPackId } from '@oss/shared';
import * as THREE from 'three';
import { DEV_ROLES } from '../view/types';
import { AssetLibrary } from './assets';

const SPACING = 1.25;
let library: AssetLibrary | null = null;

/** Image (data URL) de toute l'équipe déguisée, ou `null` si WebGL est indisponible. */
export async function packPreview(
  pack: CharacterPackId,
  width = 640,
  height = 150,
): Promise<string | null> {
  library ??= new AssetLibrary();
  const assets = library;
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(3, 6, 5);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8f80, 2), sun);
  const characters = await Promise.all(DEV_ROLES.map((role) => assets.character(role, 0, [pack])));
  characters.forEach((character, index) => {
    if (!character) return;
    character.scene.position.x = (index - (DEV_ROLES.length - 1) / 2) * SPACING;
    character.scene.rotation.y = 0.45;
    scene.add(character.scene);
  });

  const halfWidth = (DEV_ROLES.length * SPACING) / 2;
  const halfHeight = (halfWidth * height) / width;
  const camera = new THREE.OrthographicCamera(
    -halfWidth,
    halfWidth,
    halfHeight,
    -halfHeight,
    0.1,
    50,
  );
  camera.position.set(0, 0.75, 10);
  camera.lookAt(0, 0.75, 0);

  let renderer: THREE.WebGLRenderer | null = null;
  try {
    const canvas = document.createElement('canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    renderer?.dispose();
  }
}
