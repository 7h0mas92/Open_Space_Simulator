/**
 * Le décor : sol, murs, cloisons et mobilier.
 *
 * Le mobilier est dessiné avec des InstancedMesh : tous les bureaux partagent un seul appel de
 * dessin par sous-maillage, quel que soit leur nombre (indispensable à 30 personnes en Licorne).
 */
import * as THREE from 'three';
import { DEFAULT_COMPUTER, type ComputerId, type WallFinishId, type WallZone } from '@oss/shared';
import { accessCell, type ItemPlacement } from '../ai/grid';
import { catalogItem, DESK_CHAIR, footprint } from '../view/catalog';
import type { FurnitureColor } from '../view/colors';
import { slotPosition } from '../view/placement';
import type { OfficeLayout, RoomKind } from '../view/layout';
import type { PlacedItemView, WallZoneView } from '../view/types';
import { wallLength, wallOpenings, type WallOpening, type WallSide } from '../view/windows';
import { paintObject, type AssetLibrary } from './assets';
import {
  buildPartitions,
  partitionCells,
  partitionShapes,
  PARTITION_THICKNESS,
} from './partitions';
import { workstation } from './computers';
import { buildWallSkins } from './wallFinishes';
import {
  buildMonitor,
  monitorKey,
  monitorLayout,
  monitorOfItem,
  parseMonitorKey,
} from './monitors';
import {
  buildPrimitive,
  material,
  PALETTE,
  WALL_AXIS,
  WALL_COLOR,
  WALL_HEIGHT,
  WALL_THICKNESS,
} from './primitives';

/** Un sol : deux teintes posées en damier, ou en lames (parquet, tapis de scène). */
interface FloorStyle {
  readonly colors: readonly [number, number];
  readonly pattern: 'checker' | 'planks';
}

const checker = (a: number, b: number): FloorStyle => ({ colors: [a, b], pattern: 'checker' });
const planks = (a: number, b: number): FloorStyle => ({ colors: [a, b], pattern: 'planks' });

/**
 * Décors de sol de chaque type de pièce. Le premier est le décor d'origine ; les autres sont
 * tirés de la graine (`Room.style`) : d'une partie à l'autre, les pièces changent de look.
 * Le nombre de décors doit correspondre à `ROOM_STYLES` (view/layout.ts), un test le vérifie.
 */
export const FLOOR_STYLES: Record<RoomKind, readonly FloorStyle[]> = {
  open: [
    checker(0xd9cbb4, 0xd0c1a8),
    planks(0xb98f64, 0xae855b), // parquet chêne
    checker(0xbfc2c8, 0xb8bbc1), // moquette grise
    checker(0xcfccc5, 0xc6c3bc), // béton ciré
  ],
  meeting: [
    checker(0xa9c0d9, 0x9fb6cf),
    checker(0x9fc4a8, 0x96bb9f), // moquette verte
    planks(0xc8a27a, 0xbe976f), // parquet
  ],
  kitchen: [
    checker(0xe8e3d6, 0xc9c2b2),
    checker(0xf1efe9, 0x4a4e57), // damier noir et blanc
    checker(0xd38b5d, 0xc97f52), // terre cuite
  ],
  lounge: [
    checker(0xc6b3d9, 0xbca8cf),
    checker(0xe5a874, 0xdb9e6a), // moquette orange
    checker(0x6a77a6, 0x63709e), // velours bleu nuit
  ],
  canteen: [
    checker(0xe3c9a0, 0xd8bd92),
    checker(0xc96f4f, 0xbd6545), // tomettes
    checker(0xbfe3d4, 0xb2d8c8), // carrelage menthe
  ],
  incubator: [
    checker(0xc4dbc0, 0xb8d0b3),
    planks(0xe0c9a2, 0xd7bf97), // parquet clair
    checker(0xbdbab3, 0xb6b3ac), // béton
  ],
  arcade: [checker(0x4a4380, 0x403a72)], // moquette d'arcade violette
  garden: [checker(0x8cc277, 0x82b86d)], // pelouse
  auditorium: [planks(0xb5525a, 0xa94a52)], // moquette rouge
};

/** Décor de sol d'une pièce (le décor d'origine si son style est inconnu). */
export function floorStyle(kind: RoomKind, style = 0): FloorStyle {
  const styles = FLOOR_STYLES[kind];
  return styles[style] ?? (styles[0] as FloorStyle);
}

/** Partie d'un gabarit : un maillage et sa transformation relative à la racine. */
export interface TemplatePart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material | THREE.Material[];
  readonly matrix: THREE.Matrix4;
}

/** Objets décoratifs masqués quand on dézoome (LOD), en plus des accessoires. */
const DECOR_KINDS = new Set([
  'small-plant',
  'snake-plant',
  'pothos',
  'bonsai',
  'trashcan',
  'earbuds-dock',
]);

/** Zone de sélection d'un mur fin posé : sa case, sur la hauteur d'un mur. */
const PARTITION_HIT_BOX = new THREE.BoxGeometry(1, 2.2, PARTITION_THICKNESS * 3).translate(
  0,
  1.1,
  0,
);
const PARTITION_HIT_MATERIAL = new THREE.MeshBasicMaterial();

/** Clé d'un gabarit : l'objet et sa couleur (`desk#blue`). */
function templateKey(kind: string, color: FurnitureColor): string {
  return `${kind}#${color}`;
}

export interface ItemHit {
  readonly itemId: string;
}

/** Aplatit un modèle en pièces (géométrie, matériau, matrice) prêtes à être instanciées. */
export function flattenTemplate(template: THREE.Object3D): TemplatePart[] {
  template.updateMatrixWorld(true);
  const parts: TemplatePart[] = [];
  template.traverse((child) => {
    if (child instanceof THREE.Mesh && !(child instanceof THREE.SkinnedMesh)) {
      parts.push({
        geometry: child.geometry,
        material: child.material,
        matrix: child.matrixWorld.clone(),
      });
    }
  });
  return parts;
}

/** Matrice monde d'un objet posé : centre de son emprise, rotation par quart de tour. */
export function itemMatrix(item: ItemPlacement): THREE.Matrix4 {
  const def = catalogItem(item.kind);
  const [w, d] = def ? footprint(def, item.rotation) : [1, 1];
  const position = new THREE.Vector3(item.x + (w - 1) / 2, 0, item.z + (d - 1) / 2);
  const rotation = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    (item.rotation * Math.PI) / 2,
  );
  return new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(1, 1, 1));
}

/**
 * Matrice monde d'un accessoire : l'emplacement du meuble qui le porte, tourné avec lui, puis
 * la rotation propre de l'accessoire. `null` si le meuble a disparu.
 */
export function accessoryMatrix(
  host: ItemPlacement,
  slot: number,
  rotation: number,
): THREE.Matrix4 | null {
  const position = slotPosition(host, slot);
  if (!position) return null;
  const turn = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    ((host.rotation + rotation) * Math.PI) / 2,
  );
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    turn,
    new THREE.Vector3(1, 1, 1),
  );
}

/** Matrice monde de n'importe quel objet posé (au sol ou sur un meuble). */
export function placedMatrix(
  item: PlacedItemView,
  items: readonly PlacedItemView[],
): THREE.Matrix4 | null {
  if (!item.host) return itemMatrix(item);
  const hostId = item.host.id;
  const host = items.find((other) => other.id === hostId);
  return host ? accessoryMatrix(host, item.host.slot, item.rotation) : null;
}

/** Gabarit de l'ordinateur d'un bureau : `@pc:desk:gaming-neon`. */
function computerKey(kind: string, computer: ComputerId): string {
  return `@pc:${kind}:${computer}`;
}

/** Matrice de l'écran d'un poste de travail, dans le repère du meuble. */
function monitorMatrix(kind: string, monitor: Parameters<typeof monitorLayout>[1]): THREE.Matrix4 {
  const layout = monitorLayout(kind, monitor);
  return new THREE.Matrix4().makeTranslation(...(layout?.origin ?? [0, 0, 0]));
}

/**
 * Objets ajoutés automatiquement autour de certains meubles : l'écran et l'ordinateur d'un
 * poste de travail (tour et clavier, ou portable), qui gardent leurs propres couleurs, et la
 * chaise d'un bureau, à la couleur du bureau.
 */
function extrasFor(
  item: PlacedItemView,
): { kind: string; matrix: THREE.Matrix4; color?: FurnitureColor }[] {
  const def = catalogItem(item.kind);
  const extras: { kind: string; matrix: THREE.Matrix4; color?: FurnitureColor }[] = [];
  const monitor = monitorOfItem(item);
  if (monitor)
    extras.push({
      kind: monitorKey(item.kind, monitor),
      matrix: itemMatrix(item).multiply(monitorMatrix(item.kind, monitor)),
      color: 'natural',
    });
  if (def?.workstation)
    extras.push({
      kind: computerKey(item.kind, item.computer ?? DEFAULT_COMPUTER),
      matrix: itemMatrix(item),
      color: 'natural',
    });
  if (def?.use !== 'desk' || item.kind === 'standing-desk') return extras;
  const chairCell = accessCell(item);
  const facing = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    (item.rotation * Math.PI) / 2 + Math.PI,
  );
  extras.push({
    kind: '@chair',
    matrix: new THREE.Matrix4().compose(
      new THREE.Vector3(chairCell.x, 0, chairCell.z),
      facing,
      new THREE.Vector3(1, 1, 1),
    ),
  });
  return extras;
}

/** Enseigne d'une aile « incubateur » : l'emoji et le nom de la filiale. */
export interface WingSign {
  readonly label: string;
  /** Filiale coulée ou revendue : enseigne éteinte. */
  readonly closed: boolean;
}

/** Texture de l'enseigne, dessinée sur un canvas (repli : panneau uni sans texte). */
function signTexture(sign: WingSign): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = sign.closed ? '#5b5f6e' : '#1f6f5c';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = sign.closed ? '#c4c0b6' : '#f4f1ea';
  context.font = 'bold 54px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(sign.label, canvas.width / 2, canvas.height / 2, canvas.width - 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class OfficeView {
  readonly root = new THREE.Group();
  /** Maillages cliquables (mobilier), pour le raycasting. */
  readonly pickables: THREE.Object3D[] = [];
  private readonly structure = new THREE.Group();
  /** Murs, cloisons et paillasson : refaits quand le plan ou les fenêtres changent. */
  private readonly walls = new THREE.Group();
  private layout: OfficeLayout | null = null;
  private wallsKey = '';
  private openings: readonly WallOpening[] = [];
  /** Murs fins posés par le joueur : dessinés avec les cloisons, pour s'y raccorder. */
  private partitionItems: readonly PlacedItemView[] = [];
  private finishes: Partial<Record<WallZone, WallFinishId>> = {};
  private readonly furniture = new THREE.Group();
  private readonly signs = new THREE.Group();
  private signsKey = '';
  private readonly decor: THREE.Object3D[] = [];
  private readonly templates = new Map<string, Promise<TemplatePart[]>>();
  private layoutKey = '';
  private itemsKey = '';
  private buildId = 0;

  constructor(private readonly assets: AssetLibrary) {
    this.root.add(this.structure, this.walls, this.furniture, this.signs);
  }

  /** Reconstruit sol et murs si le plan change (phase, aile, annexe, décor). */
  setLayout(layout: OfficeLayout): void {
    const styles = layout.rooms.map((room) => room.style ?? 0).join('');
    // Les cloisons et le décor fixe cèdent la place aux meubles posés : ils font partie de la clé.
    const partitions = layout.partitions.map((cell) => `${cell.x},${cell.z}`).join(';');
    const fixtures = (layout.fixtures ?? []).map((f) => `${f.kind}@${f.x},${f.z}`).join(';');
    const key = `${layout.phase}:${layout.width}x${layout.depth}:${styles}|${partitions}|${fixtures}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    this.layout = layout;
    disposeChildren(this.structure);
    this.structure.add(buildFloor(layout));
    this.refreshWalls();
  }

  /** Peintures et papiers peints des zones de mur. */
  setWallFinishes(zones: readonly WallZoneView[]): void {
    const finishes: Partial<Record<WallZone, WallFinishId>> = {};
    for (const { zone, finish } of zones) if (finish) finishes[zone] = finish;
    this.finishes = finishes;
    this.refreshWalls();
  }

  /**
   * Reconstruit les murs si le plan, les fenêtres posées (les murs sont percés) ou les
   * revêtements ont changé.
   */
  private refreshWalls(): void {
    const layout = this.layout;
    if (!layout) return;
    const openings = this.openings.map((o) => `${o.kind}:${o.wall}:${o.start}`).join(',');
    const partitions = this.partitionItems
      .map((i) => `${i.kind}:${i.x}:${i.z}:${i.rotation % 2}:${i.color}`)
      .join(',');
    const finishes = Object.entries(this.finishes)
      .map(([zone, finish]) => `${zone}=${finish}`)
      .join(',');
    const key = `${this.layoutKey}|${openings}|${finishes}|${partitions}`;
    if (key === this.wallsKey) return;
    this.wallsKey = key;
    disposeChildren(this.walls);
    this.walls.add(buildWalls(layout, this.openings, this.partitionItems));
    this.walls.add(buildWallSkins(layout, this.openings, this.finishes));
  }

  /** Enseignes des ailes des filiales, accrochées au mur du fond de chaque aile. */
  setWingSigns(layout: OfficeLayout, signs: readonly WingSign[]): void {
    const key = `${this.layoutKey}|${signs.map((s) => `${s.label}:${s.closed}`).join('|')}`;
    if (key === this.signsKey) return;
    this.signsKey = key;
    for (const child of [...this.signs.children]) {
      this.signs.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const mat = child.material as THREE.MeshStandardMaterial;
        mat.map?.dispose();
        mat.dispose();
      }
    }
    const wings = layout.rooms.filter((room) => room.kind === 'incubator');
    wings.forEach((room, index) => {
      const sign = signs[index];
      if (!sign) return;
      const texture = signTexture(sign);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(Math.min(3.6, room.width - 0.6), 0.9, 0.06),
        new THREE.MeshStandardMaterial({
          color: texture ? 0xffffff : sign.closed ? 0x5b5f6e : 0x1f6f5c,
          map: texture,
          emissive: sign.closed ? 0x000000 : 0x0d2f27,
          roughness: 0.6,
        }),
      );
      mesh.position.set(room.x + (room.width - 1) / 2, 1.45, -0.46);
      mesh.name = `wing-sign-${index}`;
      this.signs.add(mesh);
    });
  }

  /** Reconstruit le mobilier (instances) si les objets posés ont changé. */
  async setItems(items: readonly PlacedItemView[]): Promise<void> {
    const key = items
      .map(
        (i) =>
          `${i.id}:${i.kind}:${i.x}:${i.z}:${i.rotation}:${i.color}:${i.host?.slot ?? ''}:${i.computer ?? ''}` +
          (i.monitor ? `:${i.monitor.model}:${i.monitor.size}:${i.monitor.mount}` : ''),
      )
      .join('|');
    if (key === this.itemsKey) return;
    this.itemsKey = key;
    const buildId = ++this.buildId;
    this.openings = wallOpenings(items);
    this.partitionItems = items.filter((item) => catalogItem(item.kind)?.partition && !item.host);
    this.refreshWalls();

    const groups = new Map<string, { matrix: THREE.Matrix4; itemId: string }[]>();
    const add = (kind: string, matrix: THREE.Matrix4, itemId: string) => {
      const list = groups.get(kind) ?? [];
      list.push({ matrix, itemId });
      groups.set(kind, list);
    };
    const partitionHits: { matrix: THREE.Matrix4; itemId: string }[] = [];
    for (const item of items) {
      const matrix = placedMatrix(item, items);
      if (!matrix) continue;
      // Les murs fins sont dessinés avec les cloisons (raccords compris) : ici, seulement une
      // boîte invisible pour les sélectionner.
      if (catalogItem(item.kind)?.partition) {
        partitionHits.push({ matrix, itemId: item.id });
        continue;
      }
      add(templateKey(item.kind, item.color), matrix, item.id);
      // La chaise d'un bureau prend la couleur du bureau : un poste assorti. L'ordinateur, lui,
      // garde ses couleurs.
      for (const extra of extrasFor(item))
        add(templateKey(extra.kind, extra.color ?? item.color), extra.matrix, item.id);
    }

    const built = await Promise.all(
      [...groups].map(async ([kind, instances]) => ({
        kind,
        instances,
        parts: await this.template(kind),
      })),
    );
    if (buildId !== this.buildId) return; // une reconstruction plus récente a eu lieu

    disposeChildren(this.furniture, false);
    this.pickables.length = 0;
    this.decor.length = 0;
    for (const { kind, instances, parts } of built) {
      for (const part of parts) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, instances.length);
        instances.forEach(({ matrix }, index) => {
          mesh.setMatrixAt(index, matrix.clone().multiply(part.matrix));
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.itemIds = instances.map((i) => i.itemId);
        mesh.computeBoundingSphere();
        this.furniture.add(mesh);
        this.pickables.push(mesh);
        const itemKind = kind.split('#')[0] ?? kind;
        // Les petits accessoires disparaissent au dézoom, pas l'électroménager.
        const def = catalogItem(itemKind);
        if (DECOR_KINDS.has(itemKind) || (def?.accessory && !def.appliance)) this.decor.push(mesh);
      }
    }
    if (partitionHits.length > 0) {
      const hits = new THREE.InstancedMesh(
        PARTITION_HIT_BOX,
        PARTITION_HIT_MATERIAL,
        partitionHits.length,
      );
      partitionHits.forEach(({ matrix }, index) => hits.setMatrixAt(index, matrix));
      hits.instanceMatrix.needsUpdate = true;
      // Invisible, mais le lancer de rayons la touche quand même.
      hits.visible = false;
      hits.userData.itemIds = partitionHits.map((hit) => hit.itemId);
      hits.computeBoundingSphere();
      this.furniture.add(hits);
      this.pickables.push(hits);
    }
  }

  /** LOD simple : on masque les petits objets décoratifs quand on dézoome. */
  setDetail(zoom: number, lodZoom: number): void {
    const visible = zoom >= lodZoom;
    for (const mesh of this.decor) mesh.visible = visible;
  }

  /**
   * Construit un objet isolé (non instancié) : aperçu du mode construction, contour, vignette.
   * Un poste de travail vient avec son écran (`monitor`, sinon celui livré avec le bureau).
   */
  async single(
    kind: string,
    color: FurnitureColor = 'natural',
    monitor?: PlacedItemView['monitor'],
  ): Promise<THREE.Group> {
    const group = new THREE.Group();
    const add = (parts: readonly TemplatePart[], offset?: THREE.Matrix4) => {
      for (const part of parts) {
        const mesh = new THREE.Mesh(part.geometry, part.material);
        mesh.applyMatrix4(offset ? offset.clone().multiply(part.matrix) : part.matrix);
        group.add(mesh);
      }
    };
    // Un écran seul (vignette du rayon Écrans) : `@monitor:…`.
    if (parseMonitorKey(kind)) {
      add(await this.template(templateKey(kind, 'natural')));
      return group;
    }
    add(await this.template(templateKey(kind, color)));
    // Un poste de travail se montre avec son ordinateur d'origine (tour sobre et clavier).
    if (catalogItem(kind)?.workstation)
      add(await this.template(templateKey(computerKey(kind, DEFAULT_COMPUTER), 'natural')));
    const screen = monitorOfItem({ kind, monitor });
    if (screen)
      add(
        await this.template(templateKey(monitorKey(kind, screen), 'natural')),
        monitorMatrix(kind, screen),
      );
    return group;
  }

  dispose(): void {
    disposeChildren(this.structure);
    disposeChildren(this.walls);
    disposeChildren(this.signs);
    disposeChildren(this.furniture, false);
  }

  private template(kind: string): Promise<TemplatePart[]> {
    let promise = this.templates.get(kind);
    if (!promise) {
      promise = this.loadTemplate(kind).then(flattenTemplate);
      this.templates.set(kind, promise);
    }
    return promise;
  }

  private async loadTemplate(key: string): Promise<THREE.Object3D> {
    const [kind = key, color = 'natural'] = key.split('#') as [string, FurnitureColor];
    // La souris fait partie du bureau (voir `parts` dans le catalogue) ; l'écran, l'ordinateur
    // (tour et clavier, ou portable) et la chaise, posée sur la case d'accès, sont des gabarits
    // à part.
    if (kind.startsWith('@pc:')) {
      const [, deskKind = '', computer = DEFAULT_COMPUTER] = kind.split(':');
      const spot = catalogItem(deskKind)?.workstation;
      return spot ? workstation(spot, computer as ComputerId) : new THREE.Group();
    }
    if (kind === '@chair') {
      const chair = buildPrimitive(DESK_CHAIR.model);
      paintObject(chair, DESK_CHAIR.paint, color);
      return chair;
    }
    // L'écran d'un poste de travail, lui aussi un gabarit à part (un par modèle, taille, fixation).
    const monitor = parseMonitorKey(kind);
    if (monitor) return buildMonitor(monitor.kind, monitor.choice);
    return this.assets.itemTemplate(kind, color);
  }
}

function buildFloor(layout: OfficeLayout): THREE.Object3D {
  const geometry = new THREE.BoxGeometry(1, 0.1, 1);
  geometry.translate(0, -0.05, 0);
  const mesh = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }),
    layout.width * layout.depth,
  );
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  let index = 0;
  for (let z = 0; z < layout.depth; z++) {
    for (let x = 0; x < layout.width; x++) {
      matrix.makeTranslation(x, 0, z);
      mesh.setMatrixAt(index, matrix);
      const room = [...layout.rooms]
        .reverse()
        .find((r) => x >= r.x && x < r.x + r.width && z >= r.z && z < r.z + r.depth);
      const { colors, pattern } = floorStyle(room?.kind ?? 'open', room?.style);
      const even = pattern === 'planks' ? x % 2 === 0 : (x + z) % 2 === 0;
      mesh.setColorAt(index, color.setHex(even ? colors[0] : colors[1]));
      index++;
    }
  }
  mesh.receiveShadow = true;
  mesh.name = 'floor';
  return mesh;
}

/**
 * Pans pleins d'un mur du fond : les cases sans fenêtre, regroupées en segments [début, fin[.
 * Les fenêtres apportent leur propre pan de mur (allège, linteau), voir `wallWindow`.
 */
export function wallSpans(
  length: number,
  openings: readonly WallOpening[],
  wall: WallSide,
): [number, number][] {
  const open = new Uint8Array(length);
  for (const opening of openings) {
    if (opening.wall !== wall) continue;
    for (let k = opening.start; k < opening.start + opening.length && k < length; k++) open[k] = 1;
  }
  const spans: [number, number][] = [];
  let start = -1;
  for (let k = 0; k <= length; k++) {
    const closed = k < length && open[k] === 0;
    if (closed && start < 0) start = k;
    if (!closed && start >= 0) {
      spans.push([start, k]);
      start = -1;
    }
  }
  return spans;
}

function buildWalls(
  layout: OfficeLayout,
  openings: readonly WallOpening[],
  partitionItems: readonly PlacedItemView[],
): THREE.Object3D {
  const group = new THREE.Group();
  const wall = material(WALL_COLOR);
  const trim = material(PALETTE.woodDark);
  const { width, depth } = layout;
  const add = (w: number, h: number, d: number, x: number, z: number, mat = wall, y = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  // Murs du fond, pleins : les locaux n'ont pas de fenêtre au départ. Chaque fenêtre achetée
  // remplace le pan de mur de ses cases (la ville se voit à travers sa vitre).
  for (const [start, end] of wallSpans(wallLength(layout, 0), openings, 0))
    add(end - start, WALL_HEIGHT, WALL_THICKNESS, (start + end - 1) / 2, WALL_AXIS);
  for (const [start, end] of wallSpans(wallLength(layout, 1), openings, 1))
    add(WALL_THICKNESS, WALL_HEIGHT, end - start, WALL_AXIS, (start + end - 1) / 2);
  // Poteau d'angle et bouts des murs (au-delà de la dernière case, jusqu'aux murs avant).
  add(0.3, WALL_HEIGHT, 0.3, WALL_AXIS, WALL_AXIS);
  add(0.2, WALL_HEIGHT, WALL_THICKNESS, width - 0.4, WALL_AXIS);
  add(WALL_THICKNESS, WALL_HEIGHT, 0.1, WALL_AXIS, depth - 0.45);
  // Murs avant, bas (on voit l'intérieur depuis la caméra isométrique).
  add(width + 0.4, 0.25, 0.2, (width - 1) / 2, depth - 0.4, trim);
  add(0.2, 0.25, depth + 0.2, width - 0.4, (depth - 1) / 2, trim);
  // Cloisons du plan et murs fins posés : des murs fins continus, raccordés entre eux.
  group.add(buildPartitions(partitionShapes(partitionCells(layout, partitionItems), layout)));
  // Paillasson d'entrée.
  add(0.9, 0.02, 0.9, layout.entrance.x, layout.entrance.z, material(PALETTE.red));
  return group;
}

function disposeChildren(group: THREE.Group, disposeGeometry = true): void {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((node) => {
      if (node instanceof THREE.InstancedMesh) node.dispose();
      if (disposeGeometry && node instanceof THREE.Mesh) node.geometry.dispose();
    });
  }
}
