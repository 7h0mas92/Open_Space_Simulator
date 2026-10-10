/**
 * Vidéoprojecteurs et écrans de projection déroulants.
 *
 * Les modèles fixes (le projecteur, le caisson posé au sol) sont des gabarits instanciés comme
 * le reste du mobilier (`office.ts`). Ce fichier anime en plus ce qui bouge : la toile qui sort
 * du caisson quand un projecteur allumé la vise et y rentre quand il s'éteint, le mât et la barre
 * du haut qui la tiennent, l'image projetée, le faisceau et l'objectif allumé.
 *
 * Le rendu ne décide de rien : quels écrans sont déroulés vient de la simulation
 * (`GameView.projections`, calculé par `projectionPairs` dans `@oss/shared`).
 */
import * as THREE from 'three';
import type { PlacedItemView, ProjectionView as Projection } from '../view/types';
import { itemMatrix, placedMatrix } from './office';
import { PixelCanvas, radialGlowTexture } from './pixels';
import {
  ALUMINIUM,
  CAP,
  CASE_TOP,
  FABRIC_Z,
  LENS,
  POLE_Z,
  SCREEN_SIZES,
  type ScreenSize,
} from './projectionModels';

/** Temps pour dérouler ou enrouler complètement la toile, en secondes. */
export const UNROLL_SECONDS = 1.8;
/** Temps pour que l'image apparaisse une fois la toile déroulée. */
const GLOW_SECONDS = 0.5;
/** Chaque diapositive reste affichée ce temps-là. */
const SLIDE_SECONDS = 8;

// --- Images projetées ----------------------------------------------------------------------

/** Bordure noire des toiles de projection, en pixels de texture. */
const BORDER = 6;

function framed(width: number, height: number): PixelCanvas {
  const canvas = new PixelCanvas(width, height).fill(0x15171c);
  canvas.rect(BORDER, BORDER, width - BORDER * 2, height - BORDER * 2, 0xf4f4f0);
  return canvas;
}

/** Toile vierge (non projetée) : blanche, bordée de noir. */
export function blankFabric(): THREE.DataTexture {
  return framed(64, 40).texture();
}

/**
 * Diapositives projetées à tour de rôle : la roadmap, le graphique des utilisateurs et le
 * burndown du sprint. Dessinées en mémoire, sans police ni image.
 */
export function slideTextures(): THREE.DataTexture[] {
  const w = 256;
  const h = 160;
  const title = (canvas: PixelCanvas, color: number) => {
    canvas.rect(BORDER, BORDER, w - BORDER * 2, 22, color);
    canvas.rect(18, 14, 90, 6, 0xffffff);
  };
  // Croissance des utilisateurs : barres qui montent.
  const growth = framed(w, h);
  title(growth, 0x4f7fd9);
  [20, 28, 26, 40, 52, 64, 88, 104].forEach((bar, i) =>
    growth.rect(28 + i * 26, 140 - bar, 16, bar, i === 7 ? 0x4caf6e : 0x7ea6e8),
  );
  growth.rect(22, 140, 212, 2, 0x343a4f);
  // Roadmap : colonnes de cartes, comme un Kanban.
  const roadmap = framed(w, h);
  title(roadmap, 0x8f6ad8);
  const cards = [0xf5b942, 0x7cc8b4, 0xe0584a, 0x4f7fd9];
  for (let col = 0; col < 3; col += 1) {
    roadmap.rect(22 + col * 74, 40, 66, 4, 0x343a4f);
    for (let row = 0; row < 3 - (col === 2 ? 1 : 0); row += 1)
      roadmap.rect(26 + col * 74, 52 + row * 30, 58, 22, cards[(col + row) % 4] ?? 0xf5b942);
  }
  // Burndown : une diagonale idéale et la vraie courbe, en escalier.
  const burndown = framed(w, h);
  title(burndown, 0xe0584a);
  burndown.rect(26, 40, 2, 100, 0x343a4f);
  burndown.rect(26, 140, 204, 2, 0x343a4f);
  for (let i = 0; i < 40; i += 1) burndown.rect(30 + i * 5, 42 + i * 2.4, 4, 3, 0x9aa3b5);
  const actual = [96, 96, 90, 84, 84, 70, 58, 52, 40, 22];
  actual.forEach((left, i) => burndown.rect(30 + i * 20, 140 - left, 20, 4, 0xe0584a));
  return [growth.texture(), roadmap.texture(), burndown.texture()];
}

// --- Animation -----------------------------------------------------------------------------

/** Une toile posée : son état d'animation et ses maillages. */
interface ScreenRig {
  readonly group: THREE.Group;
  readonly size: ScreenSize;
  readonly fabric: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  readonly blank: THREE.DataTexture;
  readonly bar: THREE.Mesh;
  readonly pole: THREE.Mesh;
  /** Part de la toile sortie du caisson (0 : enroulée, 1 : déroulée). */
  unroll: number;
  /** Intensité de l'image projetée (0 à 1), seulement une fois la toile déroulée. */
  glow: number;
  /** Un projecteur allumé la vise. */
  projected: boolean;
  /** Décalage de diaporama, pour que deux écrans ne montrent pas la même chose. */
  readonly offset: number;
}

/** Faisceau d'un projecteur vers sa toile, et son objectif allumé. */
interface Beam {
  readonly screen: string;
  readonly cone: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
}

/** Objectif d'un projecteur allumé : blanc s'il projette, ambre en attente d'un écran. */
interface Lens {
  readonly sprite: THREE.Sprite;
  readonly screen: string | null;
}

const STANDBY = 0xffb347;

export class ProjectionView {
  readonly root = new THREE.Group();
  private readonly screens = new Map<string, ScreenRig>();
  private beams = new Map<string, Beam>();
  private lenses = new Map<string, Lens>();
  private readonly slides = slideTextures();
  private readonly glowTexture = radialGlowTexture(64, 2.2);
  private key = '';
  private clock = 0;

  constructor() {
    this.root.name = 'projection';
  }

  /** Nombre d'écrans déroulants posés (tests, statistiques). */
  get screenCount(): number {
    return this.screens.size;
  }

  /** Part déroulée de la toile d'un écran (0 à 1), ou `null` s'il n'existe pas. */
  unrollOf(screenId: string): number | null {
    return this.screens.get(screenId)?.unroll ?? null;
  }

  /** Met à jour écrans et faisceaux quand les objets posés ou les projections changent. */
  sync(items: readonly PlacedItemView[], projections: readonly Projection[]): void {
    const relevant = items.filter((item) => SCREEN_SIZES[item.kind] || item.kind === 'projector');
    const key = [
      relevant.map(
        (i) =>
          `${i.id}:${i.x}:${i.z}:${i.rotation}:${i.host?.id ?? ''}:${i.host?.slot ?? ''}:${i.on ? 1 : 0}`,
      ),
      projections.map((p) => `${p.projector}>${p.screen}`),
      // Le meuble d'un projecteur peut bouger sans que le projecteur change.
      items
        .filter((host) => relevant.some((i) => i.host?.id === host.id))
        .map((h) => `${h.id}:${h.x}:${h.z}:${h.rotation}`),
    ].join('|');
    if (key === this.key) return;
    this.key = key;

    const projected = new Set(projections.map((p) => p.screen));
    const seen = new Set<string>();
    for (const item of items) {
      const size = SCREEN_SIZES[item.kind];
      if (!size) continue;
      seen.add(item.id);
      const rig = this.screens.get(item.id) ?? this.createScreen(item.id, size);
      rig.group.matrixAutoUpdate = false;
      rig.group.matrix.copy(itemMatrix(item));
      rig.projected = projected.has(item.id);
    }
    for (const [id, rig] of this.screens) {
      if (seen.has(id)) continue;
      this.root.remove(rig.group);
      disposeScreen(rig);
      this.screens.delete(id);
    }

    // Faisceaux et objectifs : peu nombreux, refaits à chaque changement.
    for (const beam of this.beams.values()) {
      this.root.remove(beam.cone);
      beam.cone.geometry.dispose();
      beam.cone.material.dispose();
    }
    for (const lens of this.lenses.values()) {
      this.root.remove(lens.sprite);
      lens.sprite.material.dispose();
    }
    this.beams = new Map();
    this.lenses = new Map();
    const screenOf = new Map(projections.map((p) => [p.projector, p.screen]));
    for (const item of items) {
      if (item.kind !== 'projector' || !item.on) continue;
      const matrix = placedMatrix(item, items);
      if (!matrix) continue;
      const lens = new THREE.Vector3(...LENS).applyMatrix4(matrix);
      const screenId = screenOf.get(item.id) ?? null;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTexture,
          color: screenId ? 0xffffff : STANDBY,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
        }),
      );
      sprite.position.copy(lens).add(new THREE.Vector3(0, 0, 0));
      sprite.scale.setScalar(screenId ? 0.22 : 0.08);
      this.root.add(sprite);
      this.lenses.set(item.id, { sprite, screen: screenId });
      const rig = screenId ? this.screens.get(screenId) : undefined;
      if (!screenId || !rig) continue;
      const cone = beamCone(lens, rig);
      this.root.add(cone);
      this.beams.set(item.id, { screen: screenId, cone });
    }
  }

  /** Avance l'animation : toiles qui montent ou descendent, image qui s'allume, diaporama. */
  update(delta: number, animate: boolean): void {
    this.clock += delta;
    for (const rig of this.screens.values()) {
      step(rig, delta, animate);
      this.apply(rig);
    }
    for (const beam of this.beams.values()) {
      const glow = this.screens.get(beam.screen)?.glow ?? 0;
      beam.cone.visible = glow > 0.01;
      beam.cone.material.opacity = 0.09 * glow;
    }
    for (const lens of this.lenses.values()) {
      const glow = lens.screen ? (this.screens.get(lens.screen)?.glow ?? 0) : 1;
      lens.sprite.material.opacity = lens.screen ? 0.35 + 0.65 * glow : 0.9;
    }
  }

  dispose(): void {
    for (const rig of this.screens.values()) disposeScreen(rig);
    this.screens.clear();
    for (const beam of this.beams.values()) {
      beam.cone.geometry.dispose();
      beam.cone.material.dispose();
    }
    for (const lens of this.lenses.values()) lens.sprite.material.dispose();
    for (const slide of this.slides) slide.dispose();
    this.glowTexture.dispose();
    this.root.clear();
  }

  private createScreen(id: string, size: ScreenSize): ScreenRig {
    const group = new THREE.Group();
    group.name = `projection-screen-${id}`;
    const blank = blankFabric();
    const fabric = new THREE.Mesh(
      new THREE.PlaneGeometry(size.width, size.height),
      new THREE.MeshStandardMaterial({
        map: blank,
        emissive: 0xffffff,
        emissiveMap: this.slides[0] ?? null,
        emissiveIntensity: 0,
        roughness: 0.95,
        side: THREE.DoubleSide,
      }),
    );
    fabric.castShadow = true;
    fabric.receiveShadow = true;
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(size.width + 0.06, 0.035, 0.035),
      new THREE.MeshStandardMaterial({ color: CAP, roughness: 0.6 }),
    );
    bar.castShadow = true;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 1, 6).translate(0, 0.5, 0),
      new THREE.MeshStandardMaterial({ color: ALUMINIUM, metalness: 0.4, roughness: 0.4 }),
    );
    pole.position.set(0, CASE_TOP, POLE_Z);
    group.add(fabric, bar, pole);
    this.root.add(group);
    const rig: ScreenRig = {
      group,
      size,
      fabric,
      blank,
      bar,
      pole,
      unroll: 0,
      glow: 0,
      projected: false,
      offset: this.screens.size,
    };
    this.screens.set(id, rig);
    this.apply(rig);
    return rig;
  }

  /** Recopie l'état d'animation d'une toile dans ses maillages. */
  private apply(rig: ScreenRig): void {
    const { size, fabric, blank, bar, pole } = rig;
    const unroll = rig.unroll;
    const shown = unroll > 0.002;
    fabric.visible = shown;
    pole.visible = shown;
    fabric.scale.y = Math.max(unroll, 0.002);
    fabric.position.set(0, CASE_TOP + (size.height * unroll) / 2, FABRIC_Z);
    // La toile sort par le haut : on voit d'abord le haut de l'image.
    blank.repeat.set(1, Math.max(unroll, 0.002));
    blank.offset.set(0, 1 - Math.max(unroll, 0.002));
    bar.position.set(0, CASE_TOP + size.height * unroll + 0.012, FABRIC_Z);
    pole.scale.y = Math.max(size.height * unroll, 0.001);
    const material = fabric.material;
    if (rig.glow > 0) {
      const slide = this.slides[(Math.floor(this.clock / SLIDE_SECONDS) + rig.offset) % 3];
      if (slide && material.map !== slide) {
        material.map = slide;
        material.emissiveMap = slide;
      }
    } else if (material.map !== blank) material.map = blank;
    material.emissiveIntensity = 0.35 * rig.glow;
  }
}

/**
 * Toile déroulée, image projetée, mât et barre d'un écran, dans le repère du caisson : pour la
 * vignette du catalogue, où l'écran doit se reconnaître. `null` si l'objet n'est pas un écran.
 */
export function unrolledPreview(kind: string): THREE.Group | null {
  const size = SCREEN_SIZES[kind];
  if (!size) return null;
  const group = new THREE.Group();
  const [slide, ...others] = slideTextures();
  for (const texture of others) texture.dispose();
  const fabric = new THREE.Mesh(
    new THREE.PlaneGeometry(size.width, size.height),
    new THREE.MeshBasicMaterial({ map: slide ?? null }),
  );
  fabric.position.set(0, CASE_TOP + size.height / 2, FABRIC_Z);
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(size.width + 0.06, 0.035, 0.035),
    new THREE.MeshStandardMaterial({ color: CAP }),
  );
  bar.position.set(0, CASE_TOP + size.height + 0.012, FABRIC_Z);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, size.height, 6),
    new THREE.MeshStandardMaterial({ color: ALUMINIUM }),
  );
  pole.position.set(0, CASE_TOP + size.height / 2, POLE_Z);
  group.add(fabric, bar, pole);
  return group;
}

/** Avance l'animation d'une toile : d'abord dérouler puis allumer, d'abord éteindre puis enrouler. */
export function step(
  rig: { unroll: number; glow: number; projected: boolean },
  delta: number,
  animate: boolean,
): void {
  if (!animate) {
    rig.unroll = rig.projected ? 1 : 0;
    rig.glow = rig.projected ? 1 : 0;
    return;
  }
  if (rig.projected) {
    if (rig.unroll < 1) rig.unroll = Math.min(1, rig.unroll + delta / UNROLL_SECONDS);
    else rig.glow = Math.min(1, rig.glow + delta / GLOW_SECONDS);
  } else if (rig.glow > 0) rig.glow = Math.max(0, rig.glow - delta / (GLOW_SECONDS / 2));
  else rig.unroll = Math.max(0, rig.unroll - delta / UNROLL_SECONDS);
}

/** Pyramide de lumière translucide entre l'objectif et les quatre coins de l'image. */
function beamCone(
  lens: THREE.Vector3,
  rig: ScreenRig,
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> {
  const { width, height } = rig.size;
  const inset = 0.04;
  const corners = [
    [-width / 2 + inset, CASE_TOP + inset],
    [width / 2 - inset, CASE_TOP + inset],
    [width / 2 - inset, CASE_TOP + height - inset],
    [-width / 2 + inset, CASE_TOP + height - inset],
  ].map(([x, y]) => new THREE.Vector3(x, y, FABRIC_Z + 0.01).applyMatrix4(rig.group.matrix));
  const positions: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const a = corners[i] as THREE.Vector3;
    const b = corners[(i + 1) % 4] as THREE.Vector3;
    positions.push(lens.x, lens.y, lens.z, a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const cone = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0xfff6dc,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  cone.name = 'projector-beam';
  cone.visible = false;
  return cone;
}

function disposeScreen(rig: ScreenRig): void {
  rig.fabric.geometry.dispose();
  rig.fabric.material.dispose();
  rig.blank.dispose();
  rig.bar.geometry.dispose();
  (rig.bar.material as THREE.Material).dispose();
  rig.pole.geometry.dispose();
  (rig.pole.material as THREE.Material).dispose();
}
