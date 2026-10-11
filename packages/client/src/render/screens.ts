/**
 * Écrans allumés : quand un personnage travaille à son bureau, son écran s'allume avec un
 * contenu lié à son métier (code, maquettes, tableau Kanban, terminal d'IA…).
 *
 * Un InstancedMesh par contenu : quel que soit le nombre de bureaux occupés, au plus un appel
 * de dessin par contenu. Les textures sont générées en mémoire (voir `pixels.ts`) et défilent
 * pour donner vie à l'écran. Le rendu lit seulement les instantanés de l'IA visuelle.
 */
import type { DevRole } from '@oss/shared';
import * as THREE from 'three';
import type { AgentPose, AgentSnapshot } from '../ai/agents';
import type { ItemPlacement } from '../ai/grid';
import type { PlacedItemView } from '../view/types';
import { MONITOR_ANCHORS, monitorOfItem, monitorScreen } from './monitors';
import { itemMatrix } from './office';
import { PixelCanvas, pseudoRandom, radialGlowTexture } from './pixels';

export const SCREEN_CONTENTS = [
  'code',
  'rust',
  'vim',
  'design',
  'board',
  'terminal',
  'forum',
  'error',
  'sleep',
] as const;
export type ScreenContent = (typeof SCREEN_CONTENTS)[number];

/** Ce qu'affiche chaque profil quand il travaille. */
const CONTENT_BY_ROLE: Record<DevRole, ScreenContent> = {
  SENIOR_BEARD: 'vim',
  TEN_X: 'code',
  INTERN: 'forum',
  RUSTACEAN: 'rust',
  DESIGNER: 'design',
  PRODUCT_OWNER: 'board',
  AI_AGENT: 'terminal',
  GHOST: 'code',
  FRONTEND: 'code',
  BACKEND: 'terminal',
  FULLSTACK: 'code',
  TECH_LEAD: 'vim',
  DEVOPS: 'terminal',
  QA_TESTER: 'forum',
  SCRUM_MASTER: 'board',
  MANAGER: 'board',
  DEPUTY_DIRECTOR: 'board',
  DIRECTOR: 'board',
};

/** Poses pendant lesquelles l'écran du bureau reste allumé. */
const SCREEN_POSES: ReadonlySet<AgentPose> = new Set(['work', 'yell', 'sleep']);

/** Contenu de l'écran d'un personnage, ou `null` s'il ne se sert pas d'un écran. */
export function screenContentFor(role: DevRole, pose: AgentPose): ScreenContent | null {
  if (!SCREEN_POSES.has(pose)) return null;
  if (pose === 'yell') return 'error'; // il crie sur l'écran : build cassé
  if (pose === 'sleep') return 'sleep'; // économiseur d'écran
  return CONTENT_BY_ROLE[role];
}

/** Emplacement de la dalle d'écran dans le repère d'un meuble (centre de son emprise, au sol). */
interface ScreenMount {
  readonly at: readonly [number, number, number];
  readonly width: number;
  readonly height: number;
  /** Inclinaison vers l'arrière (écran de portable), en radians. */
  readonly tilt?: number;
  /** Hauteur du plateau sous l'écran (pour le reflet). */
  readonly surface: number;
  /** Écran incurvé : avancée des bords, le contenu se courbe avec la dalle. */
  readonly bend?: number;
}

/**
 * Dalle des bureaux sans écran à choisir : le portable du garage. Les postes de travail (bureau
 * de dev, bureau debout) prennent la dalle de leur écran (voir `monitors.ts`).
 */
export const SCREEN_MOUNTS: Readonly<Record<string, ScreenMount>> = {
  'ikea-desk': { at: [-0.3, 0.86, -0.13], width: 0.44, height: 0.27, tilt: 0.3, surface: 0.7 },
};

/** Ce qu'il faut savoir d'un objet posé pour trouver sa dalle : son type, son écran. */
type ScreenHost = ItemPlacement & Pick<PlacedItemView, 'monitor'>;

/** Dalle d'un bureau (celle de son écran, ou de son portable), `null` s'il n'en a pas. */
export function screenMountOf(item: Pick<ScreenHost, 'kind' | 'monitor'>): ScreenMount | null {
  const monitor = monitorOfItem(item);
  const anchor = MONITOR_ANCHORS[item.kind];
  if (monitor && anchor) {
    const screen = monitorScreen(item.kind, monitor);
    return screen ? { ...screen, surface: anchor.at[1] + 0.01 } : null;
  }
  return SCREEN_MOUNTS[item.kind] ?? null;
}

/** Couleur dominante de chaque contenu : reflet sur le bureau. */
export const SCREEN_GLOW: Record<ScreenContent, number> = {
  code: 0x5b8cff,
  rust: 0xff8a4c,
  vim: 0x55e07a,
  design: 0xf0f0ff,
  board: 0x8fc2ff,
  terminal: 0x3fe0e8,
  forum: 0xffe2c4,
  error: 0xff4040,
  sleep: 0x5a64d8,
};

/** Vitesse de défilement (fraction de texture par seconde) ; 0 = image fixe. */
const SCROLL: Record<ScreenContent, number> = {
  code: 0.03,
  rust: 0.025,
  vim: 0.015,
  design: 0,
  board: 0,
  terminal: 0.12,
  forum: 0.01,
  error: 0,
  sleep: 0.05,
};

/** Hauteur visible d'un écran dans sa texture (le reste défile). */
const VISIBLE_ROWS = 64;
const TEXTURE_WIDTH = 112;

/** Lignes de code : indentation et jetons colorés, comme dans un éditeur. */
function codeLines(
  canvas: PixelCanvas,
  seed: number,
  background: number,
  tokens: readonly number[],
  gutter: number | null,
): void {
  const random = pseudoRandom(seed);
  canvas.fill(background);
  let indent = 0;
  for (let y = 2; y < canvas.height; y += 6) {
    if (gutter !== null) canvas.rect(1, y, 5, 3, gutter);
    if (random() < 0.12) {
      indent = 0; // ligne vide, nouveau bloc
      continue;
    }
    let x = 10 + indent * 6;
    const count = 1 + Math.floor(random() * 4);
    for (let t = 0; t < count && x < canvas.width - 6; t++) {
      const w = 4 + Math.floor(random() * 18);
      canvas.rect(
        x,
        y,
        Math.min(w, canvas.width - 4 - x),
        3,
        tokens[Math.floor(random() * tokens.length)] ?? 0xffffff,
      );
      x += w + 3;
    }
    indent = Math.max(0, Math.min(4, indent + (random() < 0.3 ? 1 : random() < 0.3 ? -1 : 0)));
  }
}

/** Dessine le contenu d'un écran (toile de 112 px de large). */
export function paintScreen(content: ScreenContent): PixelCanvas {
  const scrolls = SCROLL[content] > 0;
  const canvas = new PixelCanvas(TEXTURE_WIDTH, scrolls ? VISIBLE_ROWS * 4 : VISIBLE_ROWS);
  const random = pseudoRandom(SCREEN_CONTENTS.indexOf(content) + 7);
  switch (content) {
    case 'code':
      codeLines(canvas, 1, 0x1e2233, [0xc792ea, 0x82aaff, 0xc3e88d, 0xf78c6c, 0xd6deeb], 0x3a4060);
      break;
    case 'rust':
      codeLines(canvas, 2, 0x2b1d16, [0xff8a4c, 0xf2c48d, 0xe06c4c, 0xd8d0c0], 0x5a3a2a);
      break;
    case 'vim':
      codeLines(canvas, 3, 0x0b120c, [0x55e07a, 0x3fa85c, 0x9cf0b0], null);
      // Les « ~ » de vim en bas de la marge.
      for (let y = 4; y < canvas.height; y += 6) canvas.rect(2, y, 3, 1, 0x2d6b3c);
      break;
    case 'design': {
      canvas.fill(0x2c2c34);
      canvas.rect(0, 0, 10, VISIBLE_ROWS, 0x1f1f25); // barre d'outils
      for (let y = 4; y < 50; y += 8) canvas.rect(3, y, 4, 4, 0x8a8aa0);
      canvas.rect(16, 6, 40, 52, 0xf6f4ef); // plan de travail
      canvas.rect(20, 10, 32, 10, 0xf27a9a);
      canvas.rect(20, 24, 14, 14, 0x7ac2f2);
      canvas.rect(38, 24, 14, 14, 0xf5c84c);
      canvas.rect(20, 42, 32, 4, 0x2c2c34);
      canvas.rect(20, 49, 22, 3, 0x9a9aa8);
      canvas.rect(62, 6, 40, 52, 0xf6f4ef); // deuxième écran de maquette
      canvas.rect(66, 10, 32, 24, 0xb39ddb);
      canvas.rect(66, 38, 32, 5, 0x2c2c34);
      // Sélection rose avec ses poignées (le padding est faux).
      canvas.rect(64, 36, 36, 1, 0xff4fa3).rect(64, 44, 36, 1, 0xff4fa3);
      canvas.rect(64, 36, 1, 9, 0xff4fa3).rect(99, 36, 1, 9, 0xff4fa3);
      for (const [x, y] of [
        [63, 35],
        [98, 35],
        [63, 43],
        [98, 43],
      ] as const)
        canvas.rect(x, y, 3, 3, 0xffffff);
      canvas.rect(104, 0, 8, VISIBLE_ROWS, 0x1f1f25); // panneau des propriétés
      break;
    }
    case 'board': {
      canvas.fill(0xeef2f8);
      canvas.rect(0, 0, TEXTURE_WIDTH, 8, 0x2f6fde); // barre de l'outil de tickets
      const columns = [0xdfe6f0, 0xdfe6f0, 0xdfe6f0, 0xdfe6f0];
      const stickies = [0xffe066, 0x8ce99a, 0x74c0fc, 0xffa8a8];
      columns.forEach((color, c) => {
        const x = 4 + c * 27;
        canvas.rect(x, 11, 24, 50, color);
        const cards = 1 + Math.floor(random() * 4);
        for (let i = 0; i < cards; i++)
          canvas.rect(x + 2, 14 + i * 11, 20, 9, stickies[(c + i) % stickies.length] ?? 0xffffff);
      });
      break;
    }
    case 'terminal': {
      canvas.fill(0x05070d);
      for (let y = 2; y < canvas.height; y += 5) {
        canvas.rect(2, y, 3, 3, 0xff5fd2); // invite
        const w = 10 + Math.floor(random() * 90);
        canvas.rect(8, y, w, 3, random() < 0.2 ? 0xff5fd2 : 0x3fe0e8);
      }
      break;
    }
    case 'forum': {
      canvas.fill(0xffffff);
      for (let y = 0; y < canvas.height; y += 32) {
        canvas.rect(0, y, TEXTURE_WIDTH, 6, 0xf48024); // barre orange du forum de questions
        canvas.rect(4, y + 10, 8, 18, 0xe8e8e8); // compteur de votes
        canvas.rect(18, y + 10, 70, 4, 0x0a6bc4); // titre de la question
        canvas.rect(18, y + 17, 88, 2, 0x9a9a9a);
        canvas.rect(18, y + 21, 80, 2, 0x9a9a9a);
        canvas.rect(18, y + 25, 30, 4, 0xe1ecf4);
      }
      break;
    }
    case 'error': {
      canvas.fill(0x8a1010);
      canvas.rect(0, 0, TEXTURE_WIDTH, 10, 0xff3030);
      // Une grande croix : le build est cassé.
      for (let i = 0; i < 30; i++) {
        canvas.rect(41 + i, 18 + i, 4, 3, 0xffffff);
        canvas.rect(71 - i, 18 + i, 4, 3, 0xffffff);
      }
      break;
    }
    case 'sleep': {
      canvas.fill(0x0c0f24);
      for (let i = 0; i < 40; i++)
        canvas.rect(random() * TEXTURE_WIDTH, random() * canvas.height, 2, 2, 0x5a64d8);
      break;
    }
  }
  return canvas;
}

/** Ce qu'il faut pour afficher les écrans : bureaux posés, rôle et instantané de chaque dev. */
export interface ScreenInput {
  readonly items: readonly PlacedItemView[];
  readonly roles: ReadonlyMap<string, DevRole>;
  readonly agents: readonly AgentSnapshot[];
}

/** Écrans allumés : bureau et contenu, triés pour un résultat stable. */
export function litScreens(input: ScreenInput): { item: PlacedItemView; content: ScreenContent }[] {
  const items = new Map(input.items.map((item) => [item.id, item]));
  const lit = new Map<string, ScreenContent>();
  for (const agent of input.agents) {
    if (!agent.visible || !agent.using) continue;
    const item = items.get(agent.using);
    const role = input.roles.get(agent.id);
    if (!item || !role || !screenMountOf(item)) continue;
    const content = screenContentFor(role, agent.pose);
    if (content) lit.set(item.id, content);
  }
  return [...lit]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .flatMap(([id, content]) => {
      const item = items.get(id);
      return item ? [{ item, content }] : [];
    });
}

/**
 * Matrice monde de la dalle d'écran d'un bureau. Pour un écran incurvé, l'échelle en z donne
 * l'avancée des bords à la dalle courbe (`curvedScreen`, dont z vaut x²).
 */
export function screenMatrix(item: ScreenHost): THREE.Matrix4 | null {
  const mount = screenMountOf(item);
  if (!mount) return null;
  const local = new THREE.Matrix4().compose(
    new THREE.Vector3(...mount.at),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(-(mount.tilt ?? 0), 0, 0)),
    new THREE.Vector3(mount.width, mount.height, (mount.bend ?? 0) * 4 || 1),
  );
  return itemMatrix(item).multiply(local);
}

/**
 * Dalle courbe de 1 x 1 : un plan découpé en bandes verticales dont les bords avancent
 * (z = x², soit 0,25 au bord). L'échelle en z de l'instance règle la courbure réelle.
 */
function curvedScreen(): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(1, 1, 16, 1);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    position.setZ(i, x * x);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

const MAX_SCREENS = 64;

export class ScreenGlow {
  readonly root = new THREE.Group();
  private readonly meshes = new Map<ScreenContent, THREE.InstancedMesh>();
  /** Mêmes contenus sur une dalle courbe, pour les écrans incurvés. */
  private readonly curved = new Map<ScreenContent, THREE.InstancedMesh>();
  /** Reflet de l'écran sur le plateau du bureau, surtout visible la nuit. */
  private readonly spill: THREE.InstancedMesh;
  private readonly spillMaterial: THREE.MeshBasicMaterial;
  private key = '';
  private elapsed = 0;

  constructor() {
    const plane = new THREE.PlaneGeometry(1, 1);
    const bent = curvedScreen();
    for (const content of SCREEN_CONTENTS) {
      const texture = paintScreen(content).texture();
      if (SCROLL[content] > 0) {
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 0.25);
      }
      // Pas de tone mapping : l'écran garde ses couleurs vives et le bloom le fait briller.
      const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
      for (const [store, geometry, name] of [
        [this.meshes, plane, `screen-${content}`],
        [this.curved, bent, `screen-curved-${content}`],
      ] as const) {
        const mesh = new THREE.InstancedMesh(geometry, material, MAX_SCREENS);
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.name = name;
        store.set(content, mesh);
        this.root.add(mesh);
      }
    }
    this.spillMaterial = new THREE.MeshBasicMaterial({
      map: radialGlowTexture(32, 1.6),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.spill = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      this.spillMaterial,
      MAX_SCREENS,
    );
    this.spill.count = 0;
    this.spill.frustumCulled = false;
    this.spill.name = 'screen-spill';
    this.root.add(this.spill);
  }

  /** Nombre d'écrans allumés (debug et tests). */
  get count(): number {
    let total = 0;
    for (const mesh of this.allMeshes()) total += mesh.count;
    return total;
  }

  private allMeshes(): THREE.InstancedMesh[] {
    return [...this.meshes.values(), ...this.curved.values()];
  }

  /**
   * Met à jour les écrans allumés et fait défiler leur contenu.
   * `darkness` (0 en plein jour, 1 la nuit) règle l'intensité du reflet.
   */
  update(input: ScreenInput, delta: number, darkness: number, animate: boolean): void {
    const screens = litScreens(input);
    const key = screens
      .map(
        ({ item, content }) =>
          `${item.id}:${content}:${item.x}:${item.z}:${item.rotation}` +
          (item.monitor ? `:${item.monitor.model}:${item.monitor.size}:${item.monitor.mount}` : ''),
      )
      .join('|');
    if (key !== this.key) {
      this.key = key;
      this.rebuild(screens);
    }
    this.spillMaterial.opacity = 0.25 + 0.55 * darkness;
    if (!animate) return;
    this.elapsed += delta;
    for (const [content, mesh] of this.meshes) {
      const map = (mesh.material as THREE.MeshBasicMaterial).map;
      const speed = SCROLL[content];
      const shown = mesh.count + (this.curved.get(content)?.count ?? 0);
      if (map && speed > 0 && shown > 0) map.offset.y = (this.elapsed * speed) % 1;
    }
  }

  dispose(): void {
    // Les dalles plates et courbes d'un même contenu partagent leur matériau.
    for (const mesh of this.meshes.values()) {
      (mesh.material as THREE.MeshBasicMaterial).map?.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    for (const mesh of this.allMeshes()) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.spillMaterial.map?.dispose();
    this.spillMaterial.dispose();
    this.spill.dispose();
  }

  private rebuild(screens: { item: PlacedItemView; content: ScreenContent }[]): void {
    for (const mesh of this.allMeshes()) mesh.count = 0;
    const color = new THREE.Color();
    let spills = 0;
    for (const { item, content } of screens.slice(0, MAX_SCREENS)) {
      const matrix = screenMatrix(item);
      const mount = screenMountOf(item);
      const mesh = (mount?.bend ? this.curved : this.meshes).get(content);
      if (!matrix || !mesh || !mount) continue;
      mesh.setMatrixAt(mesh.count++, matrix);
      // Le reflet : une tache de lumière sur le plateau, devant l'écran.
      const spill = itemMatrix(item).multiply(
        new THREE.Matrix4().compose(
          new THREE.Vector3(mount.at[0], mount.surface + 0.01, mount.at[2] + 0.3),
          new THREE.Quaternion(),
          new THREE.Vector3(mount.width * 1.6, 1, 0.8),
        ),
      );
      this.spill.setMatrixAt(spills, spill);
      this.spill.setColorAt(spills, color.setHex(SCREEN_GLOW[content]));
      spills++;
    }
    for (const mesh of this.allMeshes()) mesh.instanceMatrix.needsUpdate = true;
    this.spill.count = spills;
    this.spill.instanceMatrix.needsUpdate = true;
    if (this.spill.instanceColor) this.spill.instanceColor.needsUpdate = true;
  }
}
