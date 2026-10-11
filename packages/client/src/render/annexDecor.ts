/**
 * Formes Three.js du décor des annexes (salle d'arcade, jardin intérieur, auditorium) : bornes
 * d'arcade, flipper, enseigne néon, arbre, fontaine, scène, pupitre et écran d'auditorium (le
 * Furniture Kit de Kenney n'en a pas, voir les crédits). Banc, plante en pot et enceinte sont
 * les objets habituels du catalogue.
 *
 * Ce sont des objets du catalogue comme les autres (`view/catalog.ts`) : offerts à l'ouverture
 * d'une annexe, et en vente dans la boutique. Chacun est posé au sol (y = 0), centré sur son
 * emprise, et regarde vers +z (vers la caméra).
 */
import * as THREE from 'three';
import { material, PALETTE } from './primitives';

const glowing = new Map<number, THREE.MeshStandardMaterial>();

/** Matériau lumineux partagé (écrans, néons) : il accroche le léger bloom de la scène. */
function glow(color: number): THREE.MeshStandardMaterial {
  let mat = glowing.get(color);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.9,
      roughness: 0.4,
      flatShading: true,
    });
    glowing.set(color, mat);
  }
  return mat;
}

function box(
  group: THREE.Group,
  mat: THREE.Material,
  [w, h, d]: readonly [number, number, number],
  [x, y, z]: readonly [number, number, number],
  tiltX = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.x = tiltX;
  group.add(mesh);
  return mesh;
}

function cylinder(
  group: THREE.Group,
  mat: THREE.Material,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  [x, y, z]: readonly [number, number, number],
  segments = 10,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    mat,
  );
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function arcadeCabinet(): THREE.Group {
  const g = new THREE.Group();
  const body = material(0x3b2f6b);
  box(g, body, [0.7, 1.6, 0.6], [0, 0.8, -0.05]);
  box(g, glow(0x55e0ff), [0.5, 0.4, 0.02], [0, 1.18, 0.26]);
  box(g, glow(PALETTE.pink), [0.72, 0.18, 0.12], [0, 1.55, 0.2]);
  box(g, material(PALETTE.dark), [0.62, 0.08, 0.3], [0, 0.92, 0.32], 0.35);
  cylinder(g, glow(PALETTE.red), 0.03, 0.03, 0.1, [-0.12, 1, 0.36], 6);
  cylinder(g, glow(PALETTE.yellow), 0.03, 0.03, 0.1, [0.1, 1, 0.36], 6);
  return g;
}

function pinball(): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z] of [
    [-0.25, -0.4],
    [0.25, -0.4],
    [-0.25, 0.4],
    [0.25, 0.4],
  ] as const)
    box(g, material(PALETTE.metal), [0.06, 0.75, 0.06], [x, 0.38, z]);
  box(g, material(0xd23c5c), [0.62, 0.16, 1], [0, 0.82, 0], -0.12);
  box(g, glow(0x9ef0ff), [0.52, 0.02, 0.86], [0, 0.91, 0], -0.12);
  box(g, glow(PALETTE.orange), [0.62, 0.45, 0.08], [0, 1.15, -0.48]);
  return g;
}

function neonSign(): THREE.Group {
  const g = new THREE.Group();
  cylinder(g, material(PALETTE.dark), 0.05, 0.05, 1.4, [0, 0.7, 0], 6);
  box(g, material(PALETTE.dark), [0.4, 0.06, 0.4], [0, 0.03, 0]);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 6, 20), glow(PALETTE.pink));
  ring.position.set(0, 1.65, 0);
  g.add(ring);
  box(g, glow(0x55e0ff), [0.5, 0.08, 0.04], [0, 1.65, 0.02]);
  return g;
}

function tree(): THREE.Group {
  const g = new THREE.Group();
  cylinder(g, material(PALETTE.terracotta), 0.32, 0.26, 0.4, [0, 0.2, 0]);
  cylinder(g, material(PALETTE.woodDark), 0.07, 0.09, 1, [0, 0.85, 0], 6);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), material(PALETTE.green));
  leaves.position.set(0, 1.55, 0);
  g.add(leaves);
  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), material(PALETTE.cactus));
  top.position.set(0.12, 1.95, 0.05);
  g.add(top);
  return g;
}

function fountain(): THREE.Group {
  const g = new THREE.Group();
  cylinder(g, material(0xbfbab0), 0.46, 0.48, 0.3, [0, 0.15, 0], 12);
  cylinder(g, glow(0x7cc7f2), 0.4, 0.4, 0.04, [0, 0.29, 0], 12);
  cylinder(g, material(0xbfbab0), 0.08, 0.1, 0.6, [0, 0.55, 0], 8);
  cylinder(g, material(0xbfbab0), 0.22, 0.12, 0.08, [0, 0.86, 0], 10);
  cylinder(g, glow(0x9ad9f7), 0.04, 0.12, 0.25, [0, 1, 0], 8);
  return g;
}

function stage(): THREE.Group {
  const g = new THREE.Group();
  box(g, material(PALETTE.wood), [0.98, 0.3, 0.98], [0, 0.15, 0]);
  box(g, material(PALETTE.woodDark), [0.98, 0.04, 0.98], [0, 0.32, 0]);
  // Micro sur pied, au bord de la scène.
  cylinder(g, material(PALETTE.metal), 0.015, 0.015, 0.9, [0.2, 0.79, 0.25], 4);
  cylinder(g, material(PALETTE.dark), 0.04, 0.04, 0.1, [0.2, 1.25, 0.25], 6);
  return g;
}

function lectern(): THREE.Group {
  const g = new THREE.Group();
  box(g, material(PALETTE.wood), [0.45, 1, 0.35], [0, 0.5, 0]);
  box(g, material(PALETTE.woodDark), [0.55, 0.06, 0.45], [0, 1.03, 0.03], 0.25);
  cylinder(g, material(PALETTE.metal), 0.01, 0.01, 0.3, [0, 1.2, 0.12], 4);
  return g;
}

function projectionScreen(): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-0.8, 0.8]) cylinder(g, material(PALETTE.metal), 0.03, 0.03, 2.1, [x, 1.05, 0]);
  box(g, glow(0xe8f0ff), [1.5, 0.85, 0.03], [0, 1.55, 0.02]);
  box(g, material(PALETTE.dark), [1.62, 0.06, 0.08], [0, 2.02, 0]);
  return g;
}

/** Toutes les formes du décor des annexes (tests : chacune doit être distincte). */
export const ANNEX_DECOR_PRIMITIVES = {
  arcadeCabinet,
  pinballMachine: pinball,
  neonSign,
  indoorTree: tree,
  zenFountain: fountain,
  smallStage: stage,
  lectern,
  auditoriumScreen: projectionScreen,
} as const;
