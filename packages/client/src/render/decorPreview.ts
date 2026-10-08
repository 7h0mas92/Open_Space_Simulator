/**
 * Aperçu d'un thème de décoration pour le back-office : un coin de bureau décoré (mur, guirlande,
 * objets au sol et sur un bureau), rendu hors écran en une image PNG. Chargé à la demande.
 */
import type { DecorTheme } from '@oss/shared';
import * as THREE from 'three';
import { THEME_MODELS } from './decorModels';
import { material, PALETTE } from './primitives';

const WIDTH = 5;

/** Image (data URL) du coin décoré, ou `null` si WebGL est indisponible. */
export async function decorPreview(
  theme: DecorTheme,
  width = 640,
  height = 220,
): Promise<string | null> {
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(3, 6, 5);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8f80, 1.8), sun);

  // Sol, mur du fond et un bureau.
  const floor = new THREE.Mesh(new THREE.BoxGeometry(WIDTH, 0.1, 1.6), material(0xd9cbb4));
  floor.position.set((WIDTH - 1) / 2, -0.05, 0.3);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(WIDTH, 2.2, 0.2), material(0xece6da));
  wall.position.set((WIDTH - 1) / 2, 1.1, -0.6);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.5), material(PALETTE.wood));
  desk.position.set(2, 0.72, 0.15);
  scene.add(floor, wall, desk);

  const models = THEME_MODELS[theme];
  const decor = models.wall(WIDTH, 0.2);
  // Seul le mur du fond est montré : on retire ce qui a été accroché au mur de gauche.
  decor.traverse((child) => {
    if (child.rotation.y !== 0 && child.parent !== decor) child.visible = child.position.x > -0.3;
  });
  scene.add(decor);
  models.floor.forEach((build, index) => {
    const object = build();
    object.position.set([0, 3.1, 4][index] ?? index, 0, 0.05);
    scene.add(object);
  });
  const small = models.desk();
  small.position.set(2.2, 0.745, 0.15);
  scene.add(small);

  const aspect = width / height;
  const halfHeight = 1.08;
  const camera = new THREE.OrthographicCamera(
    -halfHeight * aspect,
    halfHeight * aspect,
    halfHeight,
    -halfHeight,
    0.1,
    50,
  );
  camera.position.set((WIDTH - 1) / 2 + 2, 3, 8);
  camera.lookAt((WIDTH - 1) / 2, 0.92, 0);

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
