/**
 * Le décor : sol, murs, cloisons et mobilier.
 *
 * Le mobilier est dessiné avec des InstancedMesh : tous les bureaux partagent un seul appel de
 * dessin par sous-maillage, quel que soit leur nombre (indispensable à 30 personnes en Licorne).
 */
import * as THREE from 'three';
import { accessCell, type ItemPlacement } from '../ai/grid';
import { catalogItem, footprint } from '../view/catalog';
import type { FurnitureColor } from '../view/colors';
import { slotPosition } from '../view/placement';
import type { OfficeLayout, RoomKind } from '../view/layout';
import type { PlacedItemView } from '../view/types';
import { paintObject, type AssetLibrary } from './assets';
import { material, PALETTE } from './primitives';

const FLOOR_COLORS: Record<RoomKind, readonly [number, number]> = {
  open: [0xd9cbb4, 0xd0c1a8],
  meeting: [0xa9c0d9, 0x9fb6cf],
  kitchen: [0xe8e3d6, 0xc9c2b2],
  lounge: [0xc6b3d9, 0xbca8cf],
  canteen: [0xe3c9a0, 0xd8bd92],
};
const WALL_HEIGHT = 2.2;
const PARTITION_HEIGHT = 1.3;

/** Partie d'un gabarit : un maillage et sa transformation relative à la racine. */
export interface TemplatePart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material | THREE.Material[];
  readonly matrix: THREE.Matrix4;
}

/** Objets décoratifs masqués quand on dézoome (LOD), en plus des accessoires. */
const DECOR_KINDS = new Set(['small-plant', 'microwave', 'trashcan', 'noise-headsets']);

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

/** Objets ajoutés automatiquement autour de certains meubles (la chaise d'un bureau). */
function extrasFor(item: PlacedItemView): { kind: string; matrix: THREE.Matrix4 }[] {
  const def = catalogItem(item.kind);
  if (def?.use !== 'desk' || item.kind === 'standing-desk') return [];
  const chairCell = accessCell(item);
  const facing = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    (item.rotation * Math.PI) / 2 + Math.PI,
  );
  return [
    {
      kind: '@chair',
      matrix: new THREE.Matrix4().compose(
        new THREE.Vector3(chairCell.x, 0, chairCell.z),
        facing,
        new THREE.Vector3(1, 1, 1),
      ),
    },
  ];
}

export class OfficeView {
  readonly root = new THREE.Group();
  /** Maillages cliquables (mobilier), pour le raycasting. */
  readonly pickables: THREE.Object3D[] = [];
  private readonly structure = new THREE.Group();
  private readonly furniture = new THREE.Group();
  private readonly decor: THREE.Object3D[] = [];
  private readonly templates = new Map<string, Promise<TemplatePart[]>>();
  private layoutKey = '';
  private itemsKey = '';
  private buildId = 0;

  constructor(private readonly assets: AssetLibrary) {
    this.root.add(this.structure, this.furniture);
  }

  /** Reconstruit sol et murs si la phase change. */
  setLayout(layout: OfficeLayout): void {
    const key = `${layout.phase}:${layout.width}x${layout.depth}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    disposeChildren(this.structure);
    this.structure.add(buildFloor(layout), buildWalls(layout));
  }

  /** Reconstruit le mobilier (instances) si les objets posés ont changé. */
  async setItems(items: readonly PlacedItemView[]): Promise<void> {
    const key = items
      .map((i) => `${i.id}:${i.kind}:${i.x}:${i.z}:${i.rotation}:${i.color}:${i.host?.slot ?? ''}`)
      .join('|');
    if (key === this.itemsKey) return;
    this.itemsKey = key;
    const buildId = ++this.buildId;

    const groups = new Map<string, { matrix: THREE.Matrix4; itemId: string }[]>();
    const add = (kind: string, matrix: THREE.Matrix4, itemId: string) => {
      const list = groups.get(kind) ?? [];
      list.push({ matrix, itemId });
      groups.set(kind, list);
    };
    for (const item of items) {
      const matrix = placedMatrix(item, items);
      if (!matrix) continue;
      add(templateKey(item.kind, item.color), matrix, item.id);
      // La chaise d'un bureau prend la couleur du bureau : un poste assorti.
      for (const extra of extrasFor(item))
        add(templateKey(extra.kind, item.color), extra.matrix, item.id);
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
        if (DECOR_KINDS.has(itemKind) || catalogItem(itemKind)?.accessory) this.decor.push(mesh);
      }
    }
  }

  /** LOD simple : on masque les petits objets décoratifs quand on dézoome. */
  setDetail(zoom: number, lodZoom: number): void {
    const visible = zoom >= lodZoom;
    for (const mesh of this.decor) mesh.visible = visible;
  }

  /** Construit un objet isolé (non instancié) : aperçu du mode construction, contour. */
  async single(kind: string, color: FurnitureColor = 'natural'): Promise<THREE.Group> {
    const parts = await this.template(templateKey(kind, color));
    const group = new THREE.Group();
    for (const part of parts) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.applyMatrix4(part.matrix);
      group.add(mesh);
    }
    return group;
  }

  dispose(): void {
    disposeChildren(this.structure);
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
    // L'écran et le clavier font partie du bureau (voir `parts` dans le catalogue) ; seule la
    // chaise, posée sur la case d'accès, est un gabarit à part.
    if (kind === '@chair') {
      const chair = (await this.assets.loadFurniture('chairDesk'))?.clone() ?? new THREE.Group();
      paintObject(chair, ['carpet'], color);
      return chair;
    }
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
      const [a, b] = FLOOR_COLORS[room?.kind ?? 'open'];
      mesh.setColorAt(index, color.setHex((x + z) % 2 === 0 ? a : b));
      index++;
    }
  }
  mesh.receiveShadow = true;
  mesh.name = 'floor';
  return mesh;
}

function buildWalls(layout: OfficeLayout): THREE.Object3D {
  const group = new THREE.Group();
  const wall = material(0xece6da);
  const trim = material(PALETTE.woodDark);
  const { width, depth } = layout;
  const add = (w: number, h: number, d: number, x: number, z: number, mat = wall) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  // Murs du fond, hauts ; murs avant, bas (on voit l'intérieur depuis la caméra isométrique).
  add(width + 0.4, WALL_HEIGHT, 0.2, (width - 1) / 2, -0.6);
  add(0.2, WALL_HEIGHT, depth + 0.2, -0.6, (depth - 1) / 2);
  add(width + 0.4, 0.25, 0.2, (width - 1) / 2, depth - 0.4, trim);
  add(0.2, 0.25, depth + 0.2, width - 0.4, (depth - 1) / 2, trim);
  // Cloisons intérieures, à mi-hauteur.
  for (const cell of layout.partitions)
    add(0.96, PARTITION_HEIGHT, 0.96, cell.x, cell.z, material(0xd8d2c4));
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
