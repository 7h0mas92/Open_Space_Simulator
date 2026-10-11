/**
 * Sols posés par le joueur : une fine dalle texturée par pièce, juste au-dessus du sol
 * d'origine. Elle couvre la pièce et la moitié des cloisons qui l'entourent, pour que deux
 * pièces voisines se rejoignent sous le mur fin. Les pièces sans nouveau sol gardent le sol
 * d'origine (damier ou lames tirés de la graine).
 *
 * Une pièce est un seul maillage (un appel de dessin) ; textures et matériaux sont partagés
 * entre toutes les pièces du même sol.
 */
import * as THREE from 'three';
import type { FloorFinish, FloorZone } from '@oss/shared';
import {
  drawFloorTile,
  FLOOR_ROUGHNESS,
  FLOOR_TINT_COLORS,
  floorKey,
  floorRect,
  floorZoneRooms,
} from '../view/floors';
import type { OfficeLayout } from '../view/layout';

/** Hauteur de la dalle : un poil au-dessus du sol d'origine, sous le paillasson et les tapis. */
const FLOOR_SKIN = 0.003;

const materials = new Map<string, THREE.MeshStandardMaterial>();

/** Matériau d'un sol : le motif de la matière dans sa teinte, répété à chaque case. */
export function floorFinishMaterial(finish: FloorFinish): THREE.MeshStandardMaterial {
  const key = floorKey(finish);
  let found = materials.get(key);
  if (found) return found;
  const canvas = drawFloorTile(finish);
  let map: THREE.CanvasTexture | null = null;
  if (canvas) {
    map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 8;
  }
  found = new THREE.MeshStandardMaterial({
    color: map ? 0xffffff : new THREE.Color(FLOOR_TINT_COLORS[finish.tint]),
    map,
    roughness: FLOOR_ROUGHNESS[finish.material],
    metalness: 0,
  });
  materials.set(key, found);
  return found;
}

/** Dalles des pièces au sol refait. */
export function buildFloorFinishes(
  layout: OfficeLayout,
  finishes: Readonly<Partial<Record<FloorZone, FloorFinish>>>,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'floor-finishes';
  for (const { zone, room } of floorZoneRooms(layout)) {
    const finish = finishes[zone];
    if (!finish) continue;
    const { x0, x1, z0, z1 } = floorRect(room, layout);
    const width = x1 - x0;
    const depth = z1 - z0;
    const geometry = new THREE.PlaneGeometry(width, depth);
    // UV en cases : le motif d'une case se répète sur toute la pièce, aligné sur la grille.
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, x0 + 0.5 + uv.getX(i) * width, z0 + 0.5 + (1 - uv.getY(i)) * depth);
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, floorFinishMaterial(finish));
    mesh.position.set((x0 + x1) / 2, FLOOR_SKIN, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    mesh.name = `floor-${zone}`;
    group.add(mesh);
  }
  return group;
}
