/**
 * Peintures et papiers peints : une fine peau posée sur la face intérieure des murs du fond,
 * zone par zone. Les fenêtres achetées percent la peau comme elles percent le mur ; l'allège,
 * le linteau et les bords des fenêtres classiques sont recouverts eux aussi, pour que le mur
 * garde une seule couleur. Les baies vitrées gardent leur cadre métallique.
 *
 * Chaque zone est un seul maillage (un appel de dessin) ; textures et matériaux sont partagés
 * entre toutes les zones du même revêtement.
 */
import * as THREE from 'three';
import type { WallFinishId, WallZone } from '@oss/shared';
import type { OfficeLayout } from '../view/layout';
import { drawWallTile, finishHex, hasPattern, wallZoneSpans } from '../view/walls';
import type { WallOpening, WallSide } from '../view/windows';
import { WALL_AXIS, WALL_HEIGHT, WALL_THICKNESS, WINDOW_SHAPES } from './primitives';

/** Face intérieure des murs du fond, un poil devant pour éviter le scintillement. */
const SKIN = WALL_AXIS + WALL_THICKNESS / 2 + 0.004;

/** Un rectangle de peau : de `a` à `b` le long du mur, de `y0` à `y1` en hauteur. */
export interface SkinRect {
  readonly a: number;
  readonly b: number;
  readonly y0: number;
  readonly y1: number;
}

/**
 * Rectangles à couvrir sur une zone de mur [from, to] (coordonnées le long du mur) : tout le
 * mur, sauf les fenêtres ; autour des fenêtres classiques, l'allège, le linteau et les bords.
 */
export function skinRects(
  from: number,
  to: number,
  openings: readonly WallOpening[],
  wall: WallSide,
): SkinRect[] {
  const holes = openings
    .filter((o) => o.wall === wall)
    .map((o) => ({ opening: o, a: o.start - 0.5, b: o.start + o.length - 0.5 }))
    .filter((hole) => hole.b > from && hole.a < to)
    .sort((p, q) => p.a - q.a);
  const rects: SkinRect[] = [];
  const full = (a: number, b: number) => {
    if (b - a > 1e-6) rects.push({ a, b, y0: 0, y1: WALL_HEIGHT });
  };
  let cursor = from;
  for (const { opening, a, b } of holes) {
    full(cursor, Math.max(cursor, a));
    cursor = Math.max(cursor, b);
    const shape = WINDOW_SHAPES[opening.kind];
    if (opening.full || !shape) continue;
    const clip = (p: number, q: number) => [Math.max(p, from), Math.min(q, to)] as const;
    const [ca, cb] = clip(a, b);
    if (cb <= ca) continue;
    rects.push({ a: ca, b: cb, y0: 0, y1: shape.bottom });
    rects.push({ a: ca, b: cb, y0: shape.top, y1: WALL_HEIGHT });
    for (const [p, q] of [clip(a, a + shape.inset), clip(b - shape.inset, b)])
      if (q > p) rects.push({ a: p, b: q, y0: shape.bottom, y1: shape.top });
  }
  full(cursor, to);
  return rects;
}

/** Géométrie d'une zone : ses rectangles en un seul maillage, UV en cases (motif répété). */
function skinGeometry(rects: readonly SkinRect[], wall: WallSide): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const point = (along: number, y: number) => (wall === 0 ? [along, y, SKIN] : [SKIN, y, along]);
  for (const { a, b, y0, y1 } of rects) {
    // Mur du fond : face vers +z ; mur de gauche : face vers +x (sens inverse le long de z).
    const corners =
      wall === 0
        ? [
            [a, y0],
            [b, y0],
            [b, y1],
            [a, y0],
            [b, y1],
            [a, y1],
          ]
        : [
            [b, y0],
            [a, y0],
            [a, y1],
            [b, y0],
            [a, y1],
            [b, y1],
          ];
    for (const [along = 0, y = 0] of corners) {
      positions.push(...point(along, y));
      // Mur de gauche : le motif se lit dans le même sens, vu depuis la pièce.
      uvs.push(wall === 0 ? along : -along, y / WALL_HEIGHT);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

const materials = new Map<WallFinishId, THREE.MeshStandardMaterial>();

/** Matériau d'un revêtement : une teinte (peinture) ou un motif sur canvas (papier peint). */
export function wallFinishMaterial(finish: WallFinishId): THREE.MeshStandardMaterial {
  let found = materials.get(finish);
  if (found) return found;
  const canvas = hasPattern(finish) ? drawWallTile(finish) : null;
  let map: THREE.CanvasTexture | null = null;
  if (canvas) {
    map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
    map.anisotropy = 4;
  }
  found = new THREE.MeshStandardMaterial({
    color: map ? 0xffffff : finishHex(finish),
    map,
    roughness: finish === 'artdeco' ? 0.6 : 0.88,
    metalness: 0,
  });
  materials.set(finish, found);
  return found;
}

/** Peaux des zones couvertes. Les zones sans revêtement gardent le mur crème d'origine. */
export function buildWallSkins(
  layout: OfficeLayout,
  openings: readonly WallOpening[],
  finishes: Readonly<Partial<Record<WallZone, WallFinishId>>>,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'wall-finishes';
  for (const span of wallZoneSpans(layout)) {
    const finish = finishes[span.zone];
    if (!finish) continue;
    const length = span.wall === 0 ? layout.width : layout.depth;
    // La dernière zone va jusqu'au bout du mur (au-delà de la dernière case).
    const tail = span.wall === 0 ? 0.2 : 0.1;
    const to = span.end >= length ? length - 0.5 + tail : span.end - 0.5;
    const rects = skinRects(span.start - 0.5, to, openings, span.wall);
    if (rects.length === 0) continue;
    const mesh = new THREE.Mesh(skinGeometry(rects, span.wall), wallFinishMaterial(finish));
    mesh.receiveShadow = true;
    mesh.name = `wall-${span.zone}`;
    group.add(mesh);
  }
  return group;
}
