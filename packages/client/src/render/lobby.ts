/**
 * Le hall d'entrée du rez-de-chaussée : le comptoir d'accueil (forme du catalogue), les deux
 * portes à badge percées dans la cloison du hall, les secrétaires derrière le comptoir, l'agent
 * de sécurité et sa caméra. Le Furniture Kit de Kenney n'a ni portique ni comptoir : tout est
 * en formes Three.js (voir les crédits, assets manquants `receptionDesk` et `badgeGates`).
 *
 * Rendu seulement : il lit le plan (portes), les objets posés (comptoirs) et la vue (secrétaires,
 * formule de sécurité, heure), sans jamais toucher à l'état. Les portillons s'ouvrent quand un
 * personnage ou un chat approche, et se referment derrière lui.
 */
import * as THREE from 'three';
import { RECEPTION_DESK_ID } from '@oss/shared';
import type { OfficeLayout } from '../view/layout';
import type { LobbyView, PlacedItemView } from '../view/types';
import { itemMatrix } from './office';
import { CHARACTER_HEIGHT } from './assets';
import { BLOCKY_HEIGHT, buildCharacter, type Outfit } from './officeCharacters';
import { Pieces } from './pieces';
import { PALETTE } from './primitives';

const STEEL = 0xc9ced6;
const STEEL_DARK = 0x8d94a1;
const READER = 0x22252d;

/** Un portique à badge (une case), portillons fermés : deux bornes inox, un lecteur chacune. */
interface GateParts {
  readonly root: THREE.Group;
  readonly flaps: readonly THREE.Object3D[];
  readonly leds: readonly THREE.MeshBasicMaterial[];
  /** Ouverture actuelle (0 fermé, 1 ouvert). */
  open: number;
}

const flapMaterial = new THREE.MeshStandardMaterial({
  color: 0xcfe8f2,
  transparent: true,
  opacity: 0.45,
  roughness: 0.1,
  metalness: 0.1,
  depthWrite: false,
});
const steel = new THREE.MeshStandardMaterial({ color: STEEL, roughness: 0.35, metalness: 0.6 });
const steelDark = new THREE.MeshStandardMaterial({
  color: STEEL_DARK,
  roughness: 0.4,
  metalness: 0.5,
});
const readerMaterial = new THREE.MeshStandardMaterial({ color: READER, roughness: 0.5 });
const GREEN = new THREE.Color(0x35d07f);
const RED = new THREE.Color(0xe0584a);

function buildGate(x: number, z: number): GateParts {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.name = 'badge-gate';
  const flaps: THREE.Object3D[] = [];
  const leds: THREE.MeshBasicMaterial[] = [];
  for (const side of [-1, 1] as const) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.78), steel);
    post.position.set(side * 0.41, 0.33, 0);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.8), steelDark);
    top.position.set(side * 0.41, 0.675, 0);
    // Lecteur de badge côté hall (+z) et côté bureau (-z).
    const led = new THREE.MeshBasicMaterial({ color: RED.clone() });
    leds.push(led);
    for (const face of [-1, 1] as const) {
      const reader = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.14), readerMaterial);
      reader.position.set(side * 0.41, 0.7, face * 0.26);
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.02), led);
      light.position.set(side * 0.41, 0.71, face * 0.34);
      root.add(reader, light);
    }
    // Portillon vitré, pivot contre la borne : fermé il barre la moitié du passage.
    const hinge = new THREE.Group();
    hinge.position.set(side * 0.33, 0, 0);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.42, 0.02), flapMaterial);
    flap.position.set(-side * 0.155, 0.45, 0);
    flap.renderOrder = 2;
    hinge.add(flap);
    hinge.userData.side = side;
    flaps.push(hinge);
    post.castShadow = true;
    root.add(post, top, hinge);
  }
  return { root, flaps, leds, open: 0 };
}

/** Tenues : chemisier ou chemise pour l'accueil, costume sombre et badge pour l'agent. */
const RECEPTIONIST_OUTFITS: readonly Outfit[] = [
  {
    skin: 0xd9a066,
    hair: 0x2b2420,
    hairStyle: 'bun',
    shirt: 0xf2efe8,
    sleeves: 'long',
    pants: 0x2f3f6b,
    shoes: 0x2f3240,
  },
  {
    skin: 0xf3c9a5,
    hair: 0x6b4226,
    hairStyle: 'short',
    shirt: 0x3fa7a0,
    sleeves: 'long',
    pants: 0x2f3240,
    shoes: 0x2f3240,
  },
];
const GUARD_OUTFIT: Outfit = {
  skin: 0x7a4a2e,
  hair: 0x2b2420,
  hairStyle: 'bald',
  shirt: 0x23262f,
  sleeves: 'long',
  pants: 0x23262f,
  shoes: 0x111318,
};

/** Une personne du hall : où elle se tient, vers où elle regarde. */
interface Staff {
  readonly body: THREE.Group;
  readonly phase: number;
}

function person(outfit: Outfit, guard: boolean, phase: number): Staff {
  const body = buildCharacter(outfit, guard ? ['badge', 'blazer'] : ['badge']);
  // Même taille que les personnages de l'open space.
  body.scale.setScalar(CHARACTER_HEIGHT / BLOCKY_HEIGHT);
  body.traverse((node) => {
    if (node instanceof THREE.Mesh) node.castShadow = true;
  });
  const holder = new THREE.Group();
  holder.add(body);
  return { body: holder, phase };
}

/** Ce que le hall doit montrer à cet instant. */
export interface LobbyScene {
  readonly lobby: LobbyView;
  readonly items: readonly PlacedItemView[];
  /** Minute du jour affichée (0 à 1439) et jour de semaine (0 lundi … 6 dimanche). */
  readonly minute: number;
  readonly weekday: number;
}

/** Les secrétaires sont au comptoir en semaine, de 8 h à 19 h. */
export function receptionOpen(minute: number, weekday: number): boolean {
  return weekday < 5 && minute >= 8 * 60 && minute < 19 * 60;
}

/** L'agent est dans le hall : de 8 h à 20 h en semaine, ou tout le temps (gardiennage 24 h/24). */
export function guardOnDuty(guard: LobbyView['guard'], minute: number, weekday: number): boolean {
  if (!guard || guard === 'none') return false;
  if (guard === 'always') return true;
  return weekday < 5 && minute >= 8 * 60 && minute < 20 * 60;
}

/** Places des secrétaires derrière un comptoir posé, dans le repère de la scène. */
export function receptionSeats(desk: PlacedItemView): THREE.Vector3[] {
  const matrix = itemMatrix(desk);
  return [-0.65, 0.65].map((x) => new THREE.Vector3(x, 0, -0.55).applyMatrix4(matrix));
}

export class LobbyRenderer {
  readonly root = new THREE.Group();
  private gates: GateParts[] = [];
  private gatesKey = '';
  private readonly receptionists = RECEPTIONIST_OUTFITS.map((outfit, i) =>
    person(outfit, false, i * 1.7),
  );
  private readonly guard = person(GUARD_OUTFIT, true, 0.9);
  private readonly camera: THREE.Group;
  private time = 0;

  constructor() {
    this.root.name = 'lobby';
    for (const staff of [...this.receptionists, this.guard]) {
      staff.body.visible = false;
      this.root.add(staff.body);
    }
    this.camera = new THREE.Group();
    const pieces = new Pieces();
    pieces.box(0.18, 0.08, 0.16, 0xe9e6df, [0, 0, 0]);
    pieces.post(0.06, 0.06, 0.1, PALETTE.dark, [0, -0.08, 0.04], 10);
    pieces.light(0.03, 0.03, 0.01, 0xe0584a, [0.05, 0.02, 0.085]);
    this.camera.add(pieces.build('security-camera'));
    this.camera.visible = false;
    this.root.add(this.camera);
  }

  /** Portes à badge du plan (refaites seulement si le plan change). */
  setLayout(layout: OfficeLayout): void {
    const gates = layout.lobby?.gates ?? [];
    const key = gates.map((g) => `${g.x},${g.z}`).join('|');
    if (key === this.gatesKey) return;
    this.gatesKey = key;
    for (const gate of this.gates) this.root.remove(gate.root);
    this.gates = gates.map((cell) => buildGate(cell.x, cell.z));
    for (const gate of this.gates) this.root.add(gate.root);
    // La caméra est fixée en haut du mur de gauche du hall, tournée vers les portes.
    const first = gates[0];
    this.camera.visible = false;
    if (first) {
      this.camera.position.set(-0.32, 1.95, first.z + 2.5);
      this.camera.rotation.y = Math.PI / 2;
    }
  }

  /** Place le personnel selon l'heure, la formule de sécurité et les comptoirs posés. */
  sync(scene: LobbyScene): void {
    const { lobby } = scene;
    const desks = scene.items
      .filter((item) => item.kind === RECEPTION_DESK_ID && !item.host)
      // Le comptoir offert avec le hall d'abord, puis ceux de la boutique.
      .sort((a, b) => Number(b.id.startsWith('annex:')) - Number(a.id.startsWith('annex:')));
    const seats = desks.flatMap((desk) =>
      receptionSeats(desk).map((at) => ({ at, rotation: desk.rotation })),
    );
    const open = lobby.built && receptionOpen(scene.minute, scene.weekday);
    this.receptionists.forEach((staff, index) => {
      const seat = seats[index];
      staff.body.visible = open && index < lobby.receptionists && seat !== undefined;
      if (seat) {
        staff.body.position.copy(seat.at);
        staff.body.rotation.y = (seat.rotation * Math.PI) / 2;
      }
    });
    const gate = this.gates[0];
    const onDuty = lobby.built && guardOnDuty(lobby.guard, scene.minute, scene.weekday);
    this.guard.body.visible = onDuty && gate !== undefined;
    if (gate) {
      // L'agent se tient côté hall, à gauche des portes, tourné vers l'entrée.
      this.guard.body.position.set(gate.root.position.x - 1.7, 0, gate.root.position.z + 1.3);
      this.guard.body.rotation.y = Math.PI / 6;
    }
    this.camera.visible = lobby.built && lobby.guard !== null;
  }

  /**
   * Ouvre les portillons quand quelqu'un approche (personnages et chats), les referme ensuite,
   * et fait respirer le personnel. Sans animation : ouverts ou fermés d'un coup.
   */
  update(
    walkers: readonly { readonly x: number; readonly z: number; readonly visible: boolean }[],
    delta: number,
    animate: boolean,
  ): void {
    this.time += delta;
    for (const gate of this.gates) {
      const { x, z } = gate.root.position;
      const near = walkers.some(
        (w) => w.visible && Math.abs(w.x - x) < 0.6 && Math.abs(w.z - z) < 1.1,
      );
      const target = near ? 1 : 0;
      gate.open = animate ? gate.open + (target - gate.open) * Math.min(1, delta * 9) : target;
      for (const hinge of gate.flaps) {
        const side = (hinge.userData.side as number) ?? 1;
        hinge.rotation.y = side * gate.open * (Math.PI / 2);
      }
      for (const led of gate.leds) led.color.copy(gate.open > 0.5 ? GREEN : RED);
    }
    if (!animate) return;
    for (const staff of [...this.receptionists, this.guard]) {
      if (!staff.body.visible) continue;
      const inner = staff.body.children[0];
      if (inner) inner.rotation.y = Math.sin(this.time * 0.6 + staff.phase) * 0.25;
    }
  }

  dispose(): void {
    for (const gate of this.gates) this.root.remove(gate.root);
    this.gates = [];
  }
}
