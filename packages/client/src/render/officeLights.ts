/**
 * Éclairage de la salle : appliques murales (modèle Kenney `lampWall`), halos autour des
 * ampoules, flaques de lumière au sol sous les plafonniers, fenêtres qui suivent la couleur du
 * ciel et taches de soleil au sol pendant la journée.
 *
 * Tout est « faux » (textures additives) sauf quelques vraies lampes ponctuelles selon la
 * qualité graphique : en qualité basse (mobile), aucune lumière en plus, l'effet ne coûte que
 * quelques appels de dessin.
 */
import * as THREE from 'three';
import type { OfficeLayout, Room } from '../view/layout';
import type { AssetLibrary } from './assets';
import type { LightingState } from './lighting';
import { flattenTemplate } from './office';
import { radialGlowTexture, softRectTexture } from './pixels';
import { material, PALETTE } from './primitives';

/** Emplacement sur un mur extérieur : position au pied du mur, rotation (le mur regarde +z). */
export interface WallSlot {
  readonly x: number;
  readonly z: number;
  readonly turn: number;
  readonly kind: 'window' | 'lamp';
}

/** Point lumineux au plafond (invisible : on ne voit que la lumière qu'il projette). */
export interface CeilingLight {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

const WALL_FACE = -0.5;
const WINDOW_WIDTH = 1.2;
const WINDOW_HEIGHT = 0.9;
const WINDOW_SILL = 0.95;
const LAMP_HEIGHT = 1.5;
const WARM = 0xffcf8f;

/**
 * Fenêtres et appliques le long des deux murs du fond, en alternance, une case sur deux.
 * Les murs de devant sont bas (la caméra regarde par-dessus) : rien n'y est accroché.
 */
export function wallSlots(layout: OfficeLayout): WallSlot[] {
  const slots: WallSlot[] = [];
  let index = 0;
  for (let x = 1; x <= layout.width - 2; x += 2)
    slots.push({ x, z: WALL_FACE, turn: 0, kind: index++ % 2 === 0 ? 'window' : 'lamp' });
  index = 1;
  for (let z = 1; z <= layout.depth - 2; z += 2)
    slots.push({ x: WALL_FACE, z, turn: 1, kind: index++ % 2 === 0 ? 'window' : 'lamp' });
  return slots;
}

/** Plafonniers d'une salle : une grille régulière, environ un tous les 4 cases. */
function roomLights(room: Room): CeilingLight[] {
  const nx = Math.max(1, Math.round(room.width / 4));
  const nz = Math.max(1, Math.round(room.depth / 4));
  const radius = Math.min(2.6, Math.max(1.6, Math.min(room.width / nx, room.depth / nz) * 0.75));
  const lights: CeilingLight[] = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++)
      lights.push({
        x: room.x - 0.5 + ((i + 0.5) * room.width) / nx,
        z: room.z - 0.5 + ((j + 0.5) * room.depth) / nz,
        radius,
      });
  return lights;
}

export function ceilingLights(layout: OfficeLayout): CeilingLight[] {
  return layout.rooms.flatMap(roomLights);
}

/** Les `count` plafonniers qui reçoivent une vraie lampe : répartis sur toute la liste. */
export function pickRealLights(lights: readonly CeilingLight[], count: number): CeilingLight[] {
  if (count <= 0 || lights.length === 0) return [];
  if (count >= lights.length) return [...lights];
  return Array.from({ length: count }, (_, i) =>
    lights.slice(Math.floor(((i + 0.5) * lights.length) / count)).slice(0, 1),
  ).flat();
}

function slotMatrix(slot: WallSlot, local: THREE.Matrix4): THREE.Matrix4 {
  return new THREE.Matrix4()
    .compose(
      new THREE.Vector3(slot.x, 0, slot.z),
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        (slot.turn * Math.PI) / 2,
      ),
      new THREE.Vector3(1, 1, 1),
    )
    .multiply(local);
}

const at = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rotateX = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotateX, 0, 0)),
    new THREE.Vector3(sx, sy, sz),
  );

function instanced(
  geometry: THREE.BufferGeometry,
  mat: THREE.Material | THREE.Material[],
  matrices: readonly THREE.Matrix4[],
  name: string,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, mat, Math.max(1, matrices.length));
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.count = matrices.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.name = name;
  return mesh;
}

function additive(map: THREE.Texture, color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map,
    color,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

export class OfficeLights {
  readonly root = new THREE.Group();
  private readonly fixtures = new THREE.Group();
  private readonly glow = radialGlowTexture(64, 1.8);
  private readonly soft = radialGlowTexture(64, 1.2);
  private readonly poolMaterial = additive(this.soft, WARM);
  private readonly washMaterial = additive(this.glow, WARM);
  private readonly window = softRectTexture(64, 0.25);
  private readonly sunMaterial = additive(this.window, 0xffe9b8);
  private readonly glassMaterial = new THREE.MeshBasicMaterial({ color: 0xbfe3ff });
  private readonly haloMaterial = new THREE.PointsMaterial({
    map: this.glow,
    color: 0xffe2b0,
    size: 32,
    sizeAttenuation: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  /** Matériau émissif de l'abat-jour des appliques, qui s'illumine le soir. */
  private readonly shadeMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff4dc,
    emissive: new THREE.Color(WARM),
    emissiveIntensity: 0,
    roughness: 0.6,
    flatShading: true,
  });
  private readonly lights: THREE.PointLight[] = [];
  private sunPatches: THREE.InstancedMesh | null = null;
  private sunSlots: WallSlot[] = [];
  private key = '';
  private buildId = 0;

  constructor(private readonly assets: AssetLibrary) {
    this.root.add(this.fixtures);
  }

  /** Nombre de vraies lampes ponctuelles (debug et tests). */
  get realLights(): number {
    return this.lights.length;
  }

  /** Reconstruit les luminaires quand le bureau ou la qualité graphique changent. */
  async setLayout(layout: OfficeLayout, maxRealLights: number): Promise<void> {
    const key = `${layout.phase}:${layout.width}x${layout.depth}:${maxRealLights}`;
    if (key === this.key) return;
    this.key = key;
    const buildId = ++this.buildId;
    const lamp = await this.lampTemplate();
    if (buildId !== this.buildId) return;
    this.clear();

    const slots = wallSlots(layout);
    const windows = slots.filter((slot) => slot.kind === 'window');
    const lamps = slots.filter((slot) => slot.kind === 'lamp');
    const pools = ceilingLights(layout);

    // Fenêtres : cadre, croisillons et vitre qui prend la couleur du ciel.
    const frame = material(PALETTE.white);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const plane = new THREE.PlaneGeometry(1, 1);
    const centerY = WINDOW_SILL + WINDOW_HEIGHT / 2;
    const frames = windows.map((s) =>
      slotMatrix(s, at(0, centerY, 0.02, WINDOW_WIDTH + 0.12, WINDOW_HEIGHT + 0.12, 0.04)),
    );
    const bars = windows.flatMap((s) => [
      slotMatrix(s, at(0, centerY, 0.07, 0.05, WINDOW_HEIGHT, 0.03)),
      slotMatrix(s, at(0, centerY, 0.07, WINDOW_WIDTH, 0.05, 0.03)),
      slotMatrix(s, at(0, WINDOW_SILL - 0.05, 0.08, WINDOW_WIDTH + 0.2, 0.06, 0.14)),
    ]);
    const glass = windows.map((s) =>
      slotMatrix(s, at(0, centerY, 0.045, WINDOW_WIDTH, WINDOW_HEIGHT, 1)),
    );
    this.fixtures.add(
      instanced(box, frame, frames, 'window-frames'),
      instanced(box, frame, bars, 'window-bars'),
      instanced(plane, this.glassMaterial, glass, 'window-glass'),
    );
    // Taches de soleil devant les fenêtres (déplacées selon la course du soleil).
    this.sunSlots = windows;
    this.sunPatches = instanced(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      this.sunMaterial,
      windows.map((s) => slotMatrix(s, at(0, 0.014, 1.1, 1.3, 1, 1.8))),
      'sun-patches',
    );
    this.fixtures.add(this.sunPatches);

    // Appliques murales et leurs halos, avec le reflet de leur lumière sur le mur et le sol.
    for (const part of lamp) {
      this.fixtures.add(
        instanced(
          part.geometry,
          part.material,
          lamps.map((s) => slotMatrix(s, at(0, LAMP_HEIGHT, 0.15)).multiply(part.matrix)),
          'wall-lamps',
        ),
      );
    }
    this.fixtures.add(
      instanced(
        plane,
        this.washMaterial,
        lamps.map((s) => slotMatrix(s, at(0, LAMP_HEIGHT + 0.1, 0.03, 1.8, 1.8, 1))),
        'lamp-wash',
      ),
      instanced(
        new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
        this.poolMaterial,
        [
          ...lamps.map((s) => slotMatrix(s, at(0, 0.012, 0.6, 2.2, 1, 1.6))),
          ...pools.map((p) => at(p.x, 0.012, p.z, p.radius * 2, 1, p.radius * 2)),
        ],
        'light-pools',
      ),
    );
    const bulbs = lamps.map((s) =>
      new THREE.Vector3().setFromMatrixPosition(slotMatrix(s, at(0, LAMP_HEIGHT + 0.12, 0.2))),
    );
    const halos = new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(bulbs),
      this.haloMaterial,
    );
    halos.name = 'lamp-halos';
    halos.frustumCulled = false;
    this.fixtures.add(halos);

    // Quelques vraies lampes pour éclairer meubles et personnages (pas en qualité basse).
    for (const point of pickRealLights(pools, maxRealLights)) {
      const light = new THREE.PointLight(WARM, 0, point.radius * 3, 1.4);
      light.position.set(point.x, 2.4, point.z);
      this.lights.push(light);
      this.root.add(light);
    }
  }

  /**
   * Règle les lumières sur l'heure de la journée. `pixelsPerUnit` convertit la taille des halos
   * (en cases) en pixels, car la caméra orthographique ne les met pas à l'échelle.
   */
  update(light: LightingState, pixelsPerUnit: number): void {
    const lamps = light.lamps;
    this.poolMaterial.opacity = 0.05 + 0.4 * lamps;
    this.washMaterial.opacity = 0.1 + 0.45 * lamps;
    this.haloMaterial.opacity = 0.15 + 0.85 * lamps;
    this.haloMaterial.size = 0.9 * pixelsPerUnit;
    this.shadeMaterial.emissiveIntensity = 0.2 + 1.4 * lamps;
    this.glassMaterial.color.setHex(light.windowColor);
    for (const point of this.lights) point.intensity = 5 * lamps;

    this.sunMaterial.opacity = 0.45 * light.daylight;
    const patches = this.sunPatches;
    if (patches) {
      patches.visible = light.daylight > 0.01;
      // La tache glisse selon la course du soleil (de gauche à droite au fil de la journée).
      const shift = -Math.cos(light.sunAzimuth) * 0.6;
      this.sunSlots.forEach((slot, index) => {
        patches.setMatrixAt(index, slotMatrix(slot, at(shift, 0.014, 1.1, 1.3, 1, 1.8)));
      });
      patches.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    this.clear();
    for (const texture of [this.glow, this.soft, this.window]) texture.dispose();
    for (const mat of [
      this.poolMaterial,
      this.washMaterial,
      this.sunMaterial,
      this.glassMaterial,
      this.haloMaterial,
      this.shadeMaterial,
    ])
      mat.dispose();
  }

  private clear(): void {
    for (const child of [...this.fixtures.children]) {
      this.fixtures.remove(child);
      if (child instanceof THREE.InstancedMesh) child.dispose();
      if (child instanceof THREE.Points) child.geometry.dispose();
    }
    for (const light of this.lights) {
      this.root.remove(light);
      light.dispose();
    }
    this.lights.length = 0;
    this.sunPatches = null;
    this.sunSlots = [];
  }

  /** Applique murale Kenney ; l'abat-jour reçoit un matériau qui s'illumine le soir. */
  private async lampTemplate() {
    const model = await this.assets.loadFurniture('lampWall');
    const object = model?.clone() ?? fallbackLamp();
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const name = (child.material as THREE.Material).name;
        if (name === 'lamp' || child.name === 'shade') child.material = this.shadeMaterial;
      }
    });
    return flattenTemplate(object);
  }
}

/** Applique de secours si le modèle Kenney manque : un abat-jour sur une platine. */
function fallbackLamp(): THREE.Object3D {
  const group = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.04), material(PALETTE.metal));
  plate.position.set(0, 0.1, 0.02);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.16, 8), material(0xfff4dc));
  shade.position.set(0, 0.12, 0.18);
  shade.name = 'shade';
  group.add(plate, shade);
  return group;
}
