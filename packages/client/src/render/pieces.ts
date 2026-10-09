/**
 * Assemblage des meubles détaillés en formes Three.js (canapé, bibliothèque, bureaux…).
 *
 * Un meuble détaillé compte des dizaines de pièces : chacune est placée dans le repère du meuble,
 * puis elles sont fusionnées. Les couleurs que le joueur peut repeindre (bois, tissu…) gardent
 * chacune leur matériau nommé, comme dans la palette ; toutes les autres (métal, poignées,
 * livres, câbles…) sont peintes par sommet et partagent un seul matériau. Un meuble tient ainsi
 * en deux à quatre maillages, donc deux à quatre InstancedMesh dans `office.ts`.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { material } from './primitives';

/** Générateur pseudo-aléatoire à graine fixe (mulberry32) : même meuble à chaque partie. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Matériau des pièces non repeignables : une couleur par sommet, un seul appel de dessin. */
const trimMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.8,
  metalness: 0.05,
  flatShading: true,
});
trimMaterial.name = 'trim';

/** Voyants et afficheurs : non éclairés, donc lisibles même la nuit, tous en un seul appel. */
const lightMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
lightMaterial.name = 'lights';

/** Teinte une géométrie d'une couleur unie (attribut `color` par sommet). */
function tint(geometry: THREE.BufferGeometry, color: number): void {
  const rgb = new THREE.Color(color);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) rgb.toArray(colors, i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** Pièces d'un meuble, regroupées par matériau puis fusionnées. */
export class Pieces {
  private readonly byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();

  /** @param paintable couleurs de la palette que le joueur peut repeindre (matériau nommé). */
  constructor(private readonly paintable: readonly number[] = []) {}

  /** Ajoute une géométrie déjà placée (position, rotation) dans le repère du meuble. */
  add(geometry: THREE.BufferGeometry, mat: THREE.Material): void {
    const plain = geometry.index ? geometry.toNonIndexed() : geometry;
    if (plain !== geometry) geometry.dispose();
    const list = this.byMaterial.get(mat) ?? [];
    list.push(plain);
    this.byMaterial.set(mat, list);
  }

  /** Boîte posée sur `y` (sa base), centrée en (x, z), tournée de `turn` autour de y puis z. */
  box(
    w: number,
    h: number,
    d: number,
    color: number | THREE.Material,
    at: readonly [number, number, number],
    tilt: { readonly x?: number; readonly y?: number; readonly z?: number } = {},
  ): void {
    this.place(new THREE.BoxGeometry(w, h, d), color, h, at, tilt);
  }

  /** Boîte aux arêtes arrondies (coussins, accoudoirs) : facettes douces, toujours low-poly. */
  soft(
    w: number,
    h: number,
    d: number,
    radius: number,
    color: number | THREE.Material,
    at: readonly [number, number, number],
    tilt: { readonly x?: number; readonly y?: number; readonly z?: number } = {},
  ): void {
    this.place(new RoundedBoxGeometry(w, h, d, 2, radius), color, h, at, tilt);
  }

  /** Cylindre (ou tronc de cône) vertical posé sur `y`. */
  post(
    top: number,
    bottom: number,
    h: number,
    color: number | THREE.Material,
    at: readonly [number, number, number],
    segments = 8,
  ): void {
    this.place(new THREE.CylinderGeometry(top, bottom, h, segments), color, h, at);
  }

  /** Voyant lumineux (LED, afficheur) : petite boîte qui brille dans le noir. */
  light(
    w: number,
    h: number,
    d: number,
    color: number,
    at: readonly [number, number, number],
  ): void {
    const geometry = new THREE.BoxGeometry(w, h, d);
    tint(geometry, color);
    geometry.translate(at[0], at[1] + h / 2, at[2]);
    this.add(geometry, lightMaterial);
  }

  /** Livre : une simple boîte, teintée comme toutes les pièces non repeignables. */
  book(
    w: number,
    h: number,
    d: number,
    color: number,
    at: readonly [number, number, number],
    tilt: { readonly y?: number; readonly z?: number; readonly x?: number } = {},
  ): void {
    this.place(new THREE.BoxGeometry(w, h, d), color, h, at, tilt);
  }

  /** Géométrie quelconque, centrée sur son origine, posée en (x, y, z) puis tournée. */
  shape(
    geometry: THREE.BufferGeometry,
    color: number | THREE.Material,
    at: readonly [number, number, number],
    tilt: { readonly x?: number; readonly y?: number; readonly z?: number } = {},
  ): void {
    this.place(geometry, color, 0, at, tilt);
  }

  /** Barre cylindrique tendue entre deux points (pieds, tubes, montants). */
  bar(
    from: readonly [number, number, number],
    to: readonly [number, number, number],
    radius: number,
    color: number | THREE.Material,
    segments = 6,
  ): void {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), segments);
    geometry.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
    );
    geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    this.paint(geometry, color);
  }

  /** Un maillage par matériau : un par couleur repeignable, un pour le reste. */
  build(name: string): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    for (const [mat, geometries] of this.byMaterial) {
      const merged = mergeGeometries(geometries) ?? new THREE.BufferGeometry();
      for (const geometry of geometries) geometry.dispose();
      merged.computeBoundingSphere();
      group.add(new THREE.Mesh(merged, mat));
    }
    return group;
  }

  private place(
    geometry: THREE.BufferGeometry,
    color: number | THREE.Material,
    h: number,
    [x, y, z]: readonly [number, number, number],
    tilt: { readonly x?: number; readonly y?: number; readonly z?: number } = {},
  ): void {
    // La base de la pièce est à `y` : on la remonte de la moitié de sa hauteur avant de tourner,
    // pour qu'un livre penché pivote sur son coin et non sur son centre.
    geometry.translate(0, h / 2, 0);
    if (tilt.x) geometry.rotateX(tilt.x);
    if (tilt.z) geometry.rotateZ(tilt.z);
    if (tilt.y) geometry.rotateY(tilt.y);
    geometry.translate(x, y, z);
    this.paint(geometry, color);
  }

  /** Range la pièce : matériau nommé si sa couleur se repeint, sinon couleur par sommet. */
  private paint(geometry: THREE.BufferGeometry, color: number | THREE.Material): void {
    if (typeof color !== 'number') this.add(geometry, color);
    else if (this.paintable.includes(color)) this.add(geometry, material(color));
    else {
      tint(geometry, color);
      this.add(geometry, trimMaterial);
    }
  }
}
