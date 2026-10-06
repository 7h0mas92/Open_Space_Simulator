/**
 * Formes Three.js qui remplacent les modèles absents des packs Kenney
 * (babyfoot, toboggan, sieste-pod, standing desk, casque antibruit) et servent de secours
 * si un GLB ne se charge pas. Palette low-poly cohérente avec le Furniture Kit.
 */
import * as THREE from 'three';
import type { MissingAssetId } from './assetManifest';

export const PALETTE = {
  wood: 0xc8935b,
  woodDark: 0x8a5a36,
  metal: 0x9aa3b5,
  dark: 0x343a4f,
  white: 0xf2efe8,
  green: 0x4caf6e,
  red: 0xe0584a,
  blue: 0x4f7fd9,
  yellow: 0xf5b942,
  purple: 0x8f6ad8,
  skin: 0xf0c39a,
} as const;

const materials = new Map<number, THREE.MeshStandardMaterial>();

/** Matériau partagé par couleur (moins d'appels de dessin, moins de mémoire). */
export function material(color: number): THREE.MeshStandardMaterial {
  let found = materials.get(color);
  if (!found) {
    found = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0.05,
      flatShading: true,
    });
    materials.set(color, found);
  }
  return found;
}

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
  mesh.position.set(x, y + h / 2, z);
  return mesh;
}

function cylinder(radius: number, length: number, color: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 8), material(color));
}

function babyfoot(): THREE.Group {
  const group = new THREE.Group();
  for (const [x, z] of [
    [-0.75, -0.3],
    [0.75, -0.3],
    [-0.75, 0.3],
    [0.75, 0.3],
  ] as const) {
    group.add(box(0.08, 0.6, 0.08, PALETTE.woodDark, x, 0, z));
  }
  group.add(box(1.7, 0.25, 0.8, PALETTE.wood, 0, 0.6, 0));
  group.add(box(1.55, 0.02, 0.65, PALETTE.green, 0, 0.84, 0));
  // Barres et joueurs.
  for (let i = 0; i < 6; i++) {
    const x = -0.6 + i * 0.24;
    const rod = cylinder(0.015, 1.1, PALETTE.metal);
    rod.rotation.x = Math.PI / 2;
    rod.position.set(x, 0.92, 0);
    group.add(rod);
    const color = i % 2 === 0 ? PALETTE.red : PALETTE.blue;
    for (const z of [-0.15, 0.15]) group.add(box(0.06, 0.14, 0.05, color, x, 0.82, z));
  }
  return group;
}

function slide(): THREE.Group {
  const group = new THREE.Group();
  // Échelle à l'arrière, plan incliné vers l'avant.
  for (const x of [-0.35, 0.35]) group.add(box(0.06, 2, 0.06, PALETTE.metal, x, 0, -1.3));
  for (let i = 0; i < 6; i++)
    group.add(box(0.7, 0.04, 0.06, PALETTE.metal, 0, 0.3 + i * 0.3, -1.3));
  group.add(box(0.8, 0.08, 0.5, PALETTE.yellow, 0, 1.9, -1.1));
  const ramp = box(0.7, 0.06, 2.6, PALETTE.red, 0, 0, 0);
  ramp.geometry.translate(0, -0.03, 0);
  ramp.rotation.x = Math.atan2(1.9, 2.4);
  ramp.position.set(0, 1, 0.05);
  group.add(ramp);
  for (const x of [-0.37, 0.37]) {
    const rail = box(0.04, 0.12, 2.6, PALETTE.yellow, 0, 0, 0);
    rail.rotation.x = ramp.rotation.x;
    rail.position.set(x, 1.05, 0.05);
    group.add(rail);
  }
  return group;
}

function napPod(): THREE.Group {
  const group = new THREE.Group();
  group.add(box(1.8, 0.35, 0.8, PALETTE.white, 0, 0, 0));
  group.add(box(1.6, 0.12, 0.65, PALETTE.blue, 0, 0.35, 0));
  // Coque en demi-cylindre au-dessus du matelas.
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 1.8, 12, 1, true, 0, Math.PI),
    material(PALETTE.white),
  );
  shell.material = material(PALETTE.white).clone();
  (shell.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  shell.rotation.z = Math.PI / 2;
  shell.rotation.y = Math.PI / 2;
  shell.position.set(0, 0.47, -0.05);
  group.add(shell);
  group.add(box(0.2, 0.1, 0.4, PALETTE.white, -0.65, 0.47, 0));
  return group;
}

function standingDesk(): THREE.Group {
  const group = new THREE.Group();
  for (const x of [-0.8, 0.8]) {
    group.add(box(0.08, 1.05, 0.08, PALETTE.dark, x, 0, 0));
    group.add(box(0.1, 0.04, 0.6, PALETTE.dark, x, 0, 0));
  }
  group.add(box(1.9, 0.05, 0.75, PALETTE.white, 0, 1.05, 0));
  group.add(box(0.7, 0.42, 0.04, PALETTE.dark, 0, 1.15, -0.2));
  group.add(box(0.5, 0.02, 0.15, PALETTE.dark, 0, 1.1, 0.12));
  return group;
}

function headphones(): THREE.Group {
  const group = new THREE.Group();
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.025, 6, 12, Math.PI),
    material(PALETTE.dark),
  );
  band.position.y = 0.16;
  group.add(band);
  for (const x of [-0.14, 0.14]) {
    const cup = cylinder(0.06, 0.05, PALETTE.red);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(x, 0.12, 0);
    group.add(cup);
  }
  return group;
}

const BUILDERS: Record<MissingAssetId, (() => THREE.Group) | null> = {
  babyfoot,
  slide,
  napPod,
  standingDesk,
  headphones,
  uiPack: null,
  soundPacks: null,
};

export function buildPrimitive(id: MissingAssetId): THREE.Group {
  const build = BUILDERS[id];
  return build ? build() : new THREE.Group();
}

/** Boîte de secours quand un modèle Kenney ne se charge pas. */
export function fallbackBox(
  width: number,
  depth: number,
  height: number,
  color: number = PALETTE.metal,
): THREE.Group {
  const group = new THREE.Group();
  group.add(box(width * 0.9, Math.max(0.05, height), depth * 0.9, color));
  return group;
}

/**
 * Personnage de secours, façon « blocky », avec des parties nommées pour les animations
 * procédurales (bob, rotation, petits sauts) quand le GLB n'est pas disponible.
 */
export function fallbackCharacter(shirtColor: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'fallback-character';
  const body = box(0.42, 0.45, 0.26, shirtColor, 0, 0.45, 0);
  body.name = 'body';
  const head = box(0.36, 0.34, 0.34, PALETTE.skin, 0, 0.92, 0);
  head.name = 'head';
  const legs = box(0.38, 0.45, 0.22, PALETTE.dark, 0, 0, 0);
  legs.name = 'legs';
  group.add(legs, body, head);
  return group;
}

/** Couleur de t-shirt par profil, utilisée par le personnage de secours. */
export const ROLE_COLORS = [
  PALETTE.blue,
  PALETTE.red,
  PALETTE.green,
  PALETTE.yellow,
  PALETTE.purple,
  PALETTE.wood,
];
