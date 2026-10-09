/**
 * La salle de réunion aménagée, dans la scène.
 *
 * Le plan (table, places, objets contre le mur du fond) vient de `view/decor.ts` ; ce module
 * choisit les modèles selon la formule. Chaque formule a son propre mobilier : mange-debout pour
 * le stand-up, tableau blanc pour le brainstorming, parois vitrées et aquarium pour l'aquarium,
 * poufs et plantes pour la salle zen, murs d'écrans pour la war room, grande table en noyer pour
 * la salle du conseil. Les objets absents du Furniture Kit (tableau blanc, horloge, aquarium,
 * écrans de monitoring, tableau) sont des formes Three.js (voir la page Crédits).
 */
import * as THREE from 'three';
import type { MeetingFormatId } from '@oss/shared';
import type { FurnitureModel } from './assetManifest';
import { paintObject, type AssetLibrary } from './assets';
import type { FurnitureColor } from '../view/colors';
import type { MeetingPlan } from '../view/decor';
import type { OfficeLayout } from '../view/layout';
import { material, PALETTE } from './primitives';

type Builder = (assets: AssetLibrary) => Promise<THREE.Object3D>;

interface TableLook {
  readonly model: FurnitureModel;
  /** Une table par case (mange-debout) plutôt qu'une grande table étirée. */
  readonly perCell?: boolean;
  /** Hauteur relative (1 = hauteur du modèle). */
  readonly height?: number;
  readonly paint?: { readonly names: readonly string[]; readonly color: FurnitureColor };
  /** Tapis sous la table (salle zen). */
  readonly rug?: FurnitureModel;
}

interface SeatLook {
  readonly models: readonly FurnitureModel[];
  readonly scale?: number;
  readonly paint?: { readonly names: readonly string[]; readonly color: FurnitureColor };
}

interface FormatLook {
  readonly table: TableLook;
  /** `null` : on reste debout. */
  readonly seat: SeatLook | null;
  /** Objets contre le mur du fond, distribués à tour de rôle sur les cases du plan. */
  readonly wall: readonly Builder[];
  /** Parois vitrées au-dessus des cloisons de la salle (aquarium). */
  readonly glassWalls?: boolean;
}

// --- Formes Three.js -------------------------------------------------------------------------

const glowMaterials = new Map<number, THREE.MeshStandardMaterial>();
function glow(color: number): THREE.MeshStandardMaterial {
  let found = glowMaterials.get(color);
  if (!found) {
    found = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 });
    glowMaterials.set(color, found);
  }
  return found;
}

const glass = new THREE.MeshStandardMaterial({
  color: 0xbfe3f2,
  roughness: 0.05,
  metalness: 0.1,
  transparent: true,
  opacity: 0.28,
});

function box(
  w: number,
  h: number,
  d: number,
  mat: number | THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    typeof mat === 'number' ? material(mat) : mat,
  );
  mesh.position.set(x, y + h / 2, z);
  return mesh;
}

/** Tableau blanc sur pied, couvert de post-it. */
export function whiteboard(): THREE.Group {
  const group = new THREE.Group();
  group.add(box(0.06, 1.0, 0.06, PALETTE.metal, -0.42, 0, 0));
  group.add(box(0.06, 1.0, 0.06, PALETTE.metal, 0.42, 0, 0));
  group.add(box(0.96, 0.66, 0.05, PALETTE.metal, 0, 0.78, 0));
  group.add(box(0.9, 0.6, 0.06, PALETTE.white, 0, 0.81, 0));
  const notes = [PALETTE.yellow, PALETTE.pink, PALETTE.green, PALETTE.blue, PALETTE.orange];
  notes.forEach((color, index) => {
    const x = -0.3 + (index % 3) * 0.28;
    const y = 1.18 - Math.floor(index / 3) * 0.2;
    group.add(box(0.12, 0.12, 0.01, color, x, y, 0.035));
  });
  return group;
}

/** Grande horloge sur pied : « 15 minutes, pas une de plus ». */
export function standupClock(): THREE.Group {
  const group = new THREE.Group();
  group.add(box(0.06, 1.3, 0.06, PALETTE.dark, 0, 0, 0));
  group.add(box(0.36, 0.04, 0.36, PALETTE.dark, 0, 0, 0));
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 16), material(0xffffff));
  face.rotation.x = Math.PI / 2;
  face.position.set(0, 1.45, 0.02);
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.31, 0.05, 16),
    material(PALETTE.red),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 1.45, 0);
  group.add(rim, face);
  group.add(box(0.03, 0.2, 0.01, PALETTE.dark, 0, 1.45, 0.06));
  const minute = box(0.025, 0.24, 0.01, PALETTE.red, 0, 1.45, 0.07);
  minute.rotation.z = -Math.PI / 3;
  group.add(minute);
  return group;
}

/** Aquarium (le vrai) sur son meuble bas : le clin d'œil de la salle vitrée. */
export function fishTank(): THREE.Group {
  const group = new THREE.Group();
  group.add(box(0.9, 0.5, 0.5, PALETTE.woodDark));
  group.add(box(0.86, 0.42, 0.44, glow(0x2f8fd6), 0, 0.5, 0));
  group.add(box(0.9, 0.48, 0.48, glass, 0, 0.5, 0));
  group.add(box(0.12, 0.07, 0.03, PALETTE.orange, -0.15, 0.7, 0));
  group.add(box(0.1, 0.06, 0.03, PALETTE.yellow, 0.18, 0.62, 0.05));
  group.add(box(0.06, 0.18, 0.06, PALETTE.green, 0.3, 0.5, -0.1));
  return group;
}

/** Baie d'écrans de monitoring : courbes rouges et vertes, gyrophare au sommet. */
export function monitorWall(): THREE.Group {
  const group = new THREE.Group();
  group.add(box(0.08, 0.9, 0.08, PALETTE.dark, 0, 0, -0.1));
  group.add(box(0.92, 0.9, 0.08, PALETTE.dark, 0, 0.8, -0.05));
  const colors = [0x3ddc84, 0xff5a4f, 0xffc94a, 0x3ddc84];
  colors.forEach((color, index) => {
    const x = index % 2 === 0 ? -0.22 : 0.22;
    const y = index < 2 ? 1.25 : 0.86;
    group.add(box(0.4, 0.34, 0.02, glow(PALETTE.screen), x, y, 0));
    group.add(box(0.3, 0.05, 0.01, glow(color), x, y + 0.14, 0.015));
    group.add(box(0.05, 0.12, 0.01, glow(color), x - 0.1, y + 0.06, 0.015));
  });
  group.add(box(0.12, 0.12, 0.12, glow(0xff2d2d), 0, 1.7, -0.05));
  return group;
}

/** Tableau encadré sur chevalet (le portrait du fondateur, évidemment). */
export function boardPainting(): THREE.Group {
  const group = new THREE.Group();
  group.add(box(0.05, 1.1, 0.05, PALETTE.woodDark, -0.3, 0, 0.12));
  group.add(box(0.05, 1.1, 0.05, PALETTE.woodDark, 0.3, 0, 0.12));
  group.add(box(0.05, 1.2, 0.05, PALETTE.woodDark, 0, 0, -0.18));
  group.add(box(0.8, 0.7, 0.05, PALETTE.gold, 0, 0.8, 0.1));
  group.add(box(0.66, 0.56, 0.06, 0x3b5d8a, 0, 0.87, 0.1));
  group.add(box(0.2, 0.26, 0.07, PALETTE.skin, 0, 1.0, 0.1));
  group.add(box(0.34, 0.2, 0.07, PALETTE.dark, 0, 0.87, 0.1));
  return group;
}

/** Les formes Three.js de la salle, pour les tests (chacune doit dessiner quelque chose). */
export const MEETING_PRIMITIVES = {
  whiteboard,
  standupClock,
  fishTank,
  monitorWall,
  boardPainting,
} as const;

// --- Modèles Kenney --------------------------------------------------------------------------

const kenney =
  (model: FurnitureModel, scale = 1): Builder =>
  async (assets) => {
    const object =
      (await assets.loadFurniture(model))?.clone() ?? box(0.6, 0.6, 0.6, PALETTE.metal);
    object.scale.multiplyScalar(scale);
    return object;
  };
const shape =
  (build: () => THREE.Group): Builder =>
  () =>
    Promise.resolve(build());

/** Écran de télé posé sur son meuble (aquarium : les chiffres pour les visiteurs). */
const tvCabinet: Builder = async (assets) => {
  const group = new THREE.Group();
  const cabinet = await assets.loadFurniture('cabinetTelevision');
  const tv = await assets.loadFurniture('televisionModern');
  if (cabinet) group.add(cabinet.clone());
  if (tv) {
    const top = cabinet ? new THREE.Box3().setFromObject(cabinet).max.y : 0.5;
    const copy = tv.clone();
    copy.position.y = top;
    group.add(copy);
  }
  return group;
};

export const MEETING_LOOKS: Record<MeetingFormatId, FormatLook> = {
  standup: {
    table: { model: 'tableRound', perCell: true, height: 1.5 },
    seat: null,
    wall: [shape(standupClock), kenney('coatRackStanding')],
  },
  brainstorm: {
    table: { model: 'table' },
    seat: { models: ['chair'] },
    wall: [kenney('pottedPlant'), shape(whiteboard), kenney('bookcaseOpenLow')],
  },
  aquarium: {
    table: { model: 'tableGlass' },
    seat: { models: ['chairModernCushion'] },
    wall: [tvCabinet, shape(fishTank)],
    glassWalls: true,
  },
  zen: {
    table: { model: 'tableCoffee', height: 0.8, rug: 'rugRound' },
    seat: { models: ['pillowBlue', 'pillow'], scale: 1.7 },
    wall: [kenney('pottedPlant'), kenney('lampRoundFloor'), kenney('plantSmall1', 1.6)],
  },
  'war-room': {
    table: { model: 'tableCross', paint: { names: ['wood', 'woodDark'], color: 'graphite' } },
    seat: { models: ['chairDesk'] },
    wall: [shape(monitorWall)],
  },
  boardroom: {
    table: { model: 'table', paint: { names: ['wood', 'woodDark'], color: 'walnut' } },
    seat: { models: ['chairCushion'], paint: { names: ['carpet'], color: 'red' } },
    wall: [kenney('bookcaseClosed'), shape(boardPainting), kenney('lampSquareFloor')],
  },
};

/** Signature du mobilier d'une formule (les tests vérifient que chacune est unique). */
export function lookSignature(format: MeetingFormatId): string {
  const look = MEETING_LOOKS[format];
  return [
    look.table.model,
    look.table.perCell ? 'perCell' : '',
    look.table.paint?.color ?? '',
    look.table.rug ?? '',
    ...(look.seat?.models ?? ['standing']),
    look.seat?.paint?.color ?? '',
    look.wall.length,
    look.glassWalls ? 'glass' : '',
  ].join('|');
}

// --- Assemblage ------------------------------------------------------------------------------

function withShadows(object: THREE.Object3D): THREE.Object3D {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = !(child.material as THREE.Material).transparent;
      child.receiveShadow = true;
    }
  });
  return object;
}

/** Étire un modèle pour qu'il couvre `width` × `depth` cases (marge comprise). */
function fit(object: THREE.Object3D, width: number, depth: number, height = 1): THREE.Object3D {
  const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
  object.scale.set(
    (object.scale.x * width) / Math.max(0.1, size.x),
    object.scale.y * height,
    (object.scale.z * depth) / Math.max(0.1, size.z),
  );
  return object;
}

async function buildTable(plan: MeetingPlan, look: TableLook, assets: AssetLibrary) {
  const group = new THREE.Group();
  const model = await assets.loadFurniture(look.model);
  const make = () => {
    const copy = model?.clone() ?? box(0.9, 0.75, 0.9, PALETTE.wood);
    if (look.paint) paintObject(copy, look.paint.names, look.paint.color);
    return copy;
  };
  const { table } = plan;
  if (look.perCell) {
    for (let dz = 0; dz < table.depth; dz++) {
      for (let dx = 0; dx < table.width; dx++) {
        const piece = fit(make(), 0.75, 0.75, look.height ?? 1);
        piece.position.set(table.x + dx, 0, table.z + dz);
        group.add(piece);
      }
    }
  } else {
    const piece = fit(make(), table.width - 0.1, table.depth - 0.15, look.height ?? 1);
    piece.position.set(table.x + (table.width - 1) / 2, 0, table.z + (table.depth - 1) / 2);
    group.add(piece);
  }
  if (look.rug) {
    const rug = (await assets.loadFurniture(look.rug))?.clone();
    if (rug) {
      fit(rug, table.width + 1.6, table.depth + 1.6);
      rug.position.set(table.x + (table.width - 1) / 2, 0, table.z + (table.depth - 1) / 2);
      group.add(rug);
    }
  }
  return group;
}

async function buildSeats(plan: MeetingPlan, look: SeatLook, assets: AssetLibrary) {
  const group = new THREE.Group();
  const models = await Promise.all(look.models.map((model) => assets.loadFurniture(model)));
  plan.seats.forEach((seat, index) => {
    const model = models[index % models.length];
    if (!model) return;
    const copy = model.clone();
    if (look.paint) paintObject(copy, look.paint.names, look.paint.color);
    if (look.scale) copy.scale.multiplyScalar(look.scale);
    // Les modèles regardent vers +z : on tourne chaque siège vers le centre de la table.
    const angle = Math.atan2(seat.center.x - seat.cell.x, seat.center.z - seat.cell.z);
    copy.rotation.y = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
    copy.position.set(seat.cell.x, 0, seat.cell.z);
    group.add(copy);
  });
  return group;
}

/** Vitres posées sur les cloisons qui entourent la salle. */
function glassWalls(plan: MeetingPlan, layout: OfficeLayout): THREE.Group {
  const group = new THREE.Group();
  const { room } = plan;
  for (const cell of layout.partitions) {
    const besideX = cell.x === room.x - 1 || cell.x === room.x + room.width;
    const besideZ = cell.z === room.z - 1 || cell.z === room.z + room.depth;
    const alongX = cell.x >= room.x - 1 && cell.x <= room.x + room.width;
    const alongZ = cell.z >= room.z - 1 && cell.z <= room.z + room.depth;
    if ((besideX && alongZ) || (besideZ && alongX))
      group.add(box(0.96, 0.85, 0.96, glass, cell.x, 1.3, cell.z));
  }
  return group;
}

export async function buildMeetingRoom(
  plan: MeetingPlan,
  layout: OfficeLayout,
  assets: AssetLibrary,
): Promise<THREE.Group> {
  const look = MEETING_LOOKS[plan.format];
  const group = new THREE.Group();
  group.name = `meeting-room-${plan.format}`;
  group.add(await buildTable(plan, look.table, assets));
  if (look.seat) group.add(await buildSeats(plan, look.seat, assets));
  const props = await Promise.all(
    plan.wall.map((_, index) => {
      const build = look.wall[index % look.wall.length];
      return build ? build(assets) : Promise.resolve(new THREE.Group());
    }),
  );
  props.forEach((prop, index) => {
    const cell = plan.wall[index];
    if (!cell) return;
    prop.position.set(cell.x, prop.position.y, cell.z);
    group.add(prop);
  });
  if (look.glassWalls) group.add(glassWalls(plan, layout));
  withShadows(group);
  return group;
}

/** Libère les géométries des formes Three.js (les modèles Kenney sont partagés en cache). */
function disposeShapes(node: THREE.Object3D): void {
  node.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry.type === 'BoxGeometry')
      child.geometry.dispose();
  });
}

export class MeetingRoomView {
  readonly root = new THREE.Group();
  private key = '';
  private buildId = 0;

  constructor(private readonly assets: AssetLibrary) {
    this.root.name = 'meeting-room';
  }

  /** Reconstruit la salle si son plan a changé (formule, phase, meubles du joueur). */
  async update(key: string, plan: MeetingPlan | null, layout: OfficeLayout): Promise<void> {
    if (key === this.key) return;
    this.key = key;
    const buildId = ++this.buildId;
    const built = plan ? await buildMeetingRoom(plan, layout, this.assets) : null;
    if (buildId !== this.buildId) return; // un plan plus récent est arrivé entre-temps
    this.clear();
    if (built) this.root.add(built);
  }

  dispose(): void {
    this.clear();
  }

  private clear(): void {
    for (const child of [...this.root.children]) {
      this.root.remove(child);
      disposeShapes(child);
    }
  }
}
