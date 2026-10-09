/**
 * Chats du bureau en formes Three.js (aucun chat dans les packs Kenney fournis) : un corps,
 * une tête avec oreilles, quatre pattes et une queue en deux segments, aux couleurs de la robe
 * choisie (roux, noir, blanc, tigré, siamois, écaille de tortue). Les postures sont animées
 * par le code : marche, assis, sieste roulé en boule, repas, toilette.
 *
 * Le rendu lit les instantanés de `ai/cats.ts` et ne modifie jamais l'état du jeu.
 */
import * as THREE from 'three';
import type { CatPose, CatSnapshot } from '../ai/cats';
import { COAT_COLORS, type PetCoat } from '../view/petCoats';
import type { PetView } from '../view/types';
import { lerp, lerpAngle } from './interpolation';
import { material } from './primitives';

/** Taille du chat dans la scène (une case = 1). */
const CAT_SCALE = 1.5;

const glowMaterials = new Map<number, THREE.MeshStandardMaterial>();
/** Yeux lumineux : on les voit même la nuit. */
function eyeMaterial(color: number): THREE.MeshStandardMaterial {
  let found = glowMaterials.get(color);
  if (!found) {
    found = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 });
    glowMaterials.set(color, found);
  }
  return found;
}

function block(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

/** Les pièces animées d'un chat. */
interface CatRig {
  readonly root: THREE.Group;
  /** Corps (tourne pour s'asseoir) : tête, pattes avant et queue y sont attachées. */
  readonly body: THREE.Group;
  readonly head: THREE.Group;
  readonly legs: readonly THREE.Group[];
  readonly tail: THREE.Group;
  readonly tailTip: THREE.Group;
}

/** Construit un chat de la robe donnée, tourné vers +z et posé au sol. */
export function buildCat(coat: PetCoat): CatRig {
  const c = COAT_COLORS[coat];
  const points = c.pattern === 'points';
  const root = new THREE.Group();
  root.name = `cat-${coat}`;
  const body = new THREE.Group();
  body.position.set(0, 0.13, 0);
  root.add(body);

  // Corps, ventre et motifs.
  body.add(block(0.17, 0.14, 0.34, c.base, 0, 0.03, 0));
  body.add(block(0.13, 0.03, 0.28, c.belly, 0, -0.04, 0.01));
  if (c.pattern === 'stripes')
    for (const z of [-0.11, -0.04, 0.03, 0.1])
      body.add(block(0.175, 0.03, 0.03, c.accent, 0, 0.09, z));
  if (c.pattern === 'patches') {
    body.add(block(0.12, 0.02, 0.12, c.accent, 0.03, 0.1, -0.07));
    body.add(block(0.1, 0.02, 0.09, c.accent2 ?? c.accent, -0.035, 0.1, 0.08));
  }

  // Tête : museau, oreilles, yeux, nez.
  const head = new THREE.Group();
  head.position.set(0, 0.12, 0.17);
  body.add(head);
  head.add(block(0.16, 0.13, 0.13, c.base, 0, 0, 0));
  head.add(block(0.08, 0.05, 0.03, points ? c.accent : c.belly, 0, -0.03, 0.07));
  if (c.pattern === 'patches') head.add(block(0.08, 0.06, 0.131, c.accent, 0.045, 0.03, 0));
  if (points) head.add(block(0.12, 0.08, 0.02, c.accent, 0, -0.01, 0.06));
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(
      new THREE.ConeGeometry(0.035, 0.07, 4),
      material(points || c.pattern === 'stripes' ? c.accent : c.base),
    );
    ear.position.set(side * 0.05, 0.095, -0.01);
    ear.rotation.y = Math.PI / 4;
    ear.castShadow = true;
    head.add(ear);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.01), eyeMaterial(c.eyes));
    eye.position.set(side * 0.038, 0.02, 0.066);
    head.add(eye);
  }
  head.add(block(0.022, 0.015, 0.01, 0xf28fb1, 0, -0.005, 0.087));

  // Pattes : pivot en haut, pour les faire balancer en marchant.
  const legs: THREE.Group[] = [];
  for (const [x, z] of [
    [-0.055, 0.12],
    [0.055, 0.12],
    [-0.055, -0.12],
    [0.055, -0.12],
  ] as const) {
    const leg = new THREE.Group();
    leg.position.set(x, -0.03, z);
    leg.add(block(0.045, 0.1, 0.045, points ? c.accent : c.base, 0, -0.05, 0));
    leg.add(block(0.047, 0.02, 0.05, points ? c.accent : c.belly, 0, -0.095, 0.005));
    body.add(leg);
    legs.push(leg);
  }

  // Queue en deux segments, qui se dresse en marchant et s'enroule pendant la sieste.
  const tail = new THREE.Group();
  tail.position.set(0, 0.07, -0.17);
  body.add(tail);
  const tailColor = points || c.pattern === 'stripes' ? c.accent : c.base;
  tail.add(block(0.04, 0.04, 0.14, c.base, 0, 0, -0.07));
  const tailTip = new THREE.Group();
  tailTip.position.set(0, 0, -0.14);
  tail.add(tailTip);
  tailTip.add(block(0.038, 0.038, 0.12, tailColor, 0, 0, -0.06));

  root.scale.setScalar(CAT_SCALE);
  return { root, body, head, legs, tail, tailTip };
}

/** Pose un chat dans sa posture, `time` en secondes (respiration, balancement de la queue). */
export function poseCat(rig: CatRig, pose: CatPose, time: number, animate: boolean): void {
  const wave = animate ? Math.sin(time * 3) : 0;
  const stride = animate ? Math.sin(time * 14) : 0;
  const { body, head, legs, tail, tailTip } = rig;
  body.rotation.set(0, 0, 0);
  body.position.y = 0.13;
  body.scale.set(1, 1, 1);
  head.rotation.set(0, 0, 0);
  head.position.set(0, 0.12, 0.17);
  tail.rotation.set(0, 0, 0);
  tailTip.rotation.set(0, 0, 0);
  for (const leg of legs) {
    leg.rotation.set(0, 0, 0);
    leg.visible = true;
  }
  switch (pose) {
    case 'walk':
      legs.forEach((leg, i) => (leg.rotation.x = (i === 0 || i === 3 ? 1 : -1) * stride * 0.6));
      body.position.y = 0.13 + Math.abs(stride) * 0.01;
      tail.rotation.x = 0.9;
      tailTip.rotation.x = -0.6 + wave * 0.2;
      break;
    case 'sit':
      // Arrière-train au sol, pattes avant tendues, queue posée sur le côté.
      body.rotation.x = -0.55;
      body.position.y = 0.16;
      head.rotation.x = 0.5;
      legs.forEach((leg, i) => (leg.rotation.x = i < 2 ? 0.55 : -1.1));
      tail.rotation.set(0.5, 0.9, 0);
      tailTip.rotation.y = 0.8 + wave * 0.15;
      break;
    case 'sleep': {
      // Roulé en boule : corps aplati, tête posée, pattes repliées, queue enroulée.
      const breath = animate ? Math.sin(time * 1.6) * 0.03 : 0;
      body.position.y = 0.085;
      body.scale.set(1.1, 0.78 + breath, 0.88);
      head.position.set(0.04, 0.06, 0.15);
      head.rotation.set(0.35, -0.5, 0.2);
      for (const leg of legs) leg.visible = false;
      tail.rotation.set(0, 1.4, 0);
      tailTip.rotation.y = 1.3;
      break;
    }
    case 'eat':
      head.rotation.x = 0.75;
      head.position.y = 0.07;
      tail.rotation.x = 0.4;
      tailTip.rotation.y = wave * 0.5;
      break;
    case 'groom':
      body.rotation.x = -0.55;
      body.position.y = 0.16;
      legs.forEach(
        (leg, i) => (leg.rotation.x = i === 0 ? -0.9 + wave * 0.3 : i < 2 ? 0.55 : -1.1),
      );
      head.rotation.set(0.6 + wave * 0.15, 0.3, 0);
      tail.rotation.set(0.5, -0.9, 0);
      break;
  }
}

/** Les chats de la scène. */
export class PetsView {
  readonly root = new THREE.Group();
  private readonly rigs = new Map<string, CatRig>();
  private time = 0;

  constructor() {
    this.root.name = 'pets';
  }

  /** Ajoute les chats adoptés et retire ceux qui sont partis. */
  sync(pets: readonly PetView[]): void {
    const alive = new Set(pets.map((pet) => pet.id));
    for (const [id, rig] of this.rigs) {
      if (alive.has(id)) continue;
      this.root.remove(rig.root);
      this.rigs.delete(id);
    }
    for (const pet of pets) {
      if (this.rigs.has(pet.id)) continue;
      const rig = buildCat(pet.coat);
      rig.root.visible = false;
      this.rigs.set(pet.id, rig);
      this.root.add(rig.root);
    }
  }

  /** Place chaque chat entre ses deux derniers instantanés (`alpha` de 0 à 1). */
  update(
    previous: ReadonlyMap<string, CatSnapshot>,
    current: readonly CatSnapshot[],
    alpha: number,
    delta: number,
    reducedMotion: boolean,
  ): void {
    this.time += delta;
    const t = Math.min(1, Math.max(0, alpha));
    for (const cat of current) {
      const rig = this.rigs.get(cat.id);
      if (!rig) continue;
      const before = previous.get(cat.id);
      // Un saut sur un meuble (ou la sortie d'une litière) n'est pas une glissade.
      const jump = !before || before.visible !== cat.visible || Math.abs(before.y - cat.y) > 0.01;
      const shown = jump
        ? cat
        : {
            ...cat,
            x: lerp(before.x, cat.x, t),
            z: lerp(before.z, cat.z, t),
            facing: lerpAngle(before.facing, cat.facing, t),
          };
      rig.root.visible = shown.visible;
      rig.root.position.set(shown.x, shown.y, shown.z);
      rig.root.rotation.y = shown.facing;
      poseCat(rig, shown.pose, this.time + hashPhase(cat.id), !reducedMotion);
    }
  }

  dispose(): void {
    this.root.traverse((node) => {
      if (node instanceof THREE.Mesh) node.geometry.dispose();
    });
    this.root.clear();
    this.rigs.clear();
  }
}

/** Décalage de phase propre à chaque chat, pour qu'ils ne respirent pas en chœur. */
function hashPhase(id: string): number {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i) * (i + 1);
  return (sum % 100) / 10;
}
