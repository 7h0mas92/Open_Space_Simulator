/**
 * Chef d'orchestre du rendu Three.js.
 *
 * Il lit des instantanés (`GameView`), fait avancer l'IA visuelle par pas fixes, interpole entre
 * deux pas et dessine. Il ne modifie jamais l'état du jeu : les clics sont remontés à
 * l'interface par des callbacks, qui décide de la commande à envoyer.
 */
import {
  decoratedThemes,
  type CharacterPackId,
  type DecorMode,
  type DecorTheme,
} from '@oss/shared';
import * as THREE from 'three';
import type { DevRole } from '@oss/shared';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AGENT_TICK_SECONDS, AgentWorld, type AgentSnapshot } from '../ai/agents';
import { CatWorld, type CatSnapshot } from '../ai/cats';
import { itemCells } from '../ai/grid';
import { catalogItem, footprint } from '../view/catalog';
import { decorKey, planDecor } from '../view/decor';
import { layoutOf, officeLayout, type Cell, type OfficeLayout } from '../view/layout';
import { liveSprintMinutes } from '../view/liveTime';
import type { FurnitureColor } from '../view/colors';
import {
  checkPlacement,
  nearestValidCell,
  resolveAccessory,
  slotPosition,
} from '../view/placement';
import type { GameView, Rotation } from '../view/types';
import { aimWindow, isWallItem, wallOpenings, type WallSide } from '../view/windows';
import { AssetLibrary } from './assets';
import { CharacterView } from './characters';
import { DecorationsView } from './decorations';
import { MeetingRoomView } from './meetingRoom';
import { THEME_MODELS } from './decorModels';
import { ConfettiEffect, SmokeEffect } from './effects';
import { EDGE_PAN_SPEED, edgePanVelocity, exitPoint } from './edgePan';
import { GestureRecognizer, type GestureEvent } from './gestures';
import { interpolateAgent } from './interpolation';
import { PetsView } from './pets';
import {
  cameraDirection,
  clampTarget,
  clampZoom,
  scaleZoomFactor,
  wheelZoomFactor,
  type ZoomSpeed,
  fitZoom,
  frustum,
  panDelta,
  type IsoCameraState,
} from './isoCamera';
import { lightingAt, type LightingState } from './lighting';
import { accessoryMatrix, itemMatrix, OfficeView } from './office';
import { OfficeLights } from './officeLights';
import { pixelRatioFor, QUALITY_PRESETS, type QualityLevel } from './quality';
import { ProjectionView, unrolledPreview } from './projection';
import { ScreenGlow } from './screens';
import { SkylineView } from './skyline';

export type PickTarget =
  | { readonly type: 'dev'; readonly id: string }
  | { readonly type: 'item'; readonly id: string }
  | { readonly type: 'cell'; readonly cell: Cell };

/** Hauteur à laquelle on vise un mur pour y poser une fenêtre. */
const WALL_AIM_HEIGHT = 1.2;

/** Mode construction : `kind` à `null` quand le catalogue est ouvert (rien en main). */
export interface BuildPreview {
  readonly kind: string | null;
  readonly rotation: Rotation;
  /** Objet déplacé (il ne se bloque pas lui-même). */
  readonly movingItemId?: string;
  /** Case visée par l'aperçu, `null` tant qu'elle n'est pas connue. */
  readonly cell: Cell | null;
  /** Couleur choisie : l'aperçu la montre. */
  readonly color?: FurnitureColor;
}

export interface RendererOptions {
  readonly canvas: HTMLCanvasElement;
  /** Calque HTML pour les bulles de pensée. */
  readonly overlay: HTMLElement;
  readonly quality: QualityLevel;
  readonly reducedMotion: boolean;
  /** Défilement de la caméra quand la souris atteint ou quitte un bord de l'écran. */
  readonly edgePan: boolean;
  readonly zoomSpeed?: ZoomSpeed;
  readonly translate: (key: string) => string;
  readonly onPick?: (target: PickTarget | null) => void;
  /** Pose directe (clic de souris) en mode construction. */
  readonly onPlace?: (cell: Cell) => void;
  /**
   * L'aperçu change de case : survol de la souris, tap ou glisser du doigt, ou case de départ
   * proposée quand on prend un objet en main.
   */
  /** Case visée en mode construction ; `wall` : mur visé pour une fenêtre. */
  readonly onBuildCell?: (cell: Cell, wall?: WallSide) => void;
  readonly onFps?: (fps: number) => void;
}

const MAX_STEPS_PER_FRAME = 8;
/** Écart d'heure suivi tel quel par l'éclairage ; au-delà, il le rattrape en douceur. */
const SMOOTH_SNAP_MINUTES = 45;
/** Distance caméra-cible et plan lointain : la vue plonge jusqu'à la rue de New York. */
const CAMERA_DISTANCE = 120;
const CAMERA_FAR = 420;
/** Brume sur la ville : au-delà du bureau (≈ 120 à 145 de la caméra), jusqu'à l'horizon. */
const HAZE_NEAR = 150;
const HAZE_FAR = 300;
const SELECTION_COLOR = 0xf5b942;
const VALID_COLOR = 0x4caf6e;
const INVALID_COLOR = 0xe0584a;
/** Aperçu d'une pose impossible : l'objet passe en rouge translucide. */
const INVALID_GHOST = new THREE.MeshBasicMaterial({
  color: INVALID_COLOR,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});

export class GameRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  // Loin du bureau (l'ortho ne change pas d'échelle) pour embrasser la ville jusqu'à la rue.
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, CAMERA_FAR);
  private readonly sun = new THREE.DirectionalLight(0xffffff, 1.5);
  private readonly hemi = new THREE.HemisphereLight(0xd6e6ff, 0x6b5a48, 0.9);
  private readonly assets = new AssetLibrary();
  private readonly office = new OfficeView(this.assets);
  private readonly decorations = new DecorationsView(this.assets);
  private readonly meetingRoom = new MeetingRoomView(this.assets);
  /** Réglage de chaque thème de décoration au back-office (absent = pendant sa période). */
  private decorModes: Partial<Record<DecorTheme, DecorMode>> = {};
  private readonly roomLights = new OfficeLights(this.assets);
  private readonly screens = new ScreenGlow();
  /** Toiles des écrans déroulants, faisceaux et objectifs des projecteurs allumés. */
  private readonly projection = new ProjectionView();
  /** La ville de New York autour de la tour, vue par les baies vitrées. */
  private readonly skyline = new SkylineView();
  /** Rôle de chaque dev : choisit le contenu de son écran. */
  private roles = new Map<string, DevRole>();
  private readonly characters = new Map<string, CharacterView>();
  private readonly world: AgentWorld;
  /** Les chats du bureau : leur IA (déplacements) et leurs modèles. */
  private readonly cats = new CatWorld(1);
  private readonly pets = new PetsView();
  private previousCats = new Map<string, CatSnapshot>();
  private currentCats: CatSnapshot[] = [];
  private readonly gestures = new GestureRecognizer();
  private readonly raycaster = new THREE.Raycaster();
  private readonly smoke: SmokeEffect;
  private readonly confetti: ConfettiEffect;
  /** Heure affichée par l'éclairage (lissée), en minutes. */
  private displayMinute: number | null = null;
  private readonly selectionMarker: THREE.LineSegments;
  private readonly bubbles = new Map<string, HTMLDivElement>();
  private composer: EffectComposer | null = null;
  private outlinePass: OutlinePass | null = null;

  private view: GameView | null = null;
  private decorPlanKey = '';
  private decorPlan: ReturnType<typeof planDecor> | null = null;
  /** Packs de personnages actifs (costumes de Noël, d'Halloween…). */
  private characterPacks: readonly CharacterPackId[] = [];
  private layout: OfficeLayout = officeLayout('GARAGE');
  private quality: QualityLevel;
  private reducedMotion: boolean;
  private edgePan: boolean;
  /** Souris au repos au-dessus de la scène (px relatifs au canvas), ou `null`. */
  private edgePointer: { x: number; y: number } | null = null;
  private zoomSpeed: ZoomSpeed;
  private cameraState: IsoCameraState = { targetX: 4, targetZ: 3, zoom: 1, quarter: 0 };
  private previous = new Map<string, AgentSnapshot>();
  private current: AgentSnapshot[] = [];
  private accumulator = 0;
  private lastFrame = 0;
  private frameHandle = 0;
  private fpsFrames = 0;
  private fpsSince = 0;
  private selected: PickTarget | null = null;
  private build: BuildPreview | null = null;
  private ghost: THREE.Object3D | null = null;
  private ghostKey = '';
  /** Grille et emprise visibles en mode construction. */
  private readonly buildGrid = new THREE.Group();
  private readonly footprintTile: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private gridKey = '';
  /** Le dernier appui vient-il d'un doigt (tap = viser) ou de la souris (clic = poser) ? */
  private touchInput = false;
  /** Un doigt fait glisser l'aperçu (au lieu de déplacer la caméra). */
  private draggingGhost = false;
  private readonly resizeObserver: ResizeObserver;
  private readonly cleanup: (() => void)[] = [];

  constructor(private readonly options: RendererOptions) {
    this.quality = options.quality;
    this.reducedMotion = options.reducedMotion;
    this.edgePan = options.edgePan;
    this.zoomSpeed = options.zoomSpeed ?? 'normal';
    this.world = new AgentWorld(1);
    const preset = QUALITY_PRESETS[this.quality];
    this.renderer = new THREE.WebGLRenderer({
      canvas: options.canvas,
      antialias: preset.antialias,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Les compteurs (appels de dessin) couvrent toute la frame, post-processing compris.
    this.renderer.info.autoReset = false;

    this.sun.castShadow = true;
    this.scene.add(
      this.hemi,
      this.sun,
      this.sun.target,
      this.skyline.root,
      this.office.root,
      this.decorations.root,
      this.meetingRoom.root,
      this.roomLights.root,
      this.screens.root,
      this.projection.root,
      this.pets.root,
    );

    this.smoke = new SmokeEffect(preset.maxParticles);
    this.confetti = new ConfettiEffect(Math.min(200, preset.maxParticles));
    this.scene.add(this.smoke.root, this.confetti.root);

    this.selectionMarker = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.02, 1)),
      new THREE.LineBasicMaterial({ color: SELECTION_COLOR }),
    );
    this.selectionMarker.visible = false;
    this.scene.add(this.selectionMarker);

    this.footprintTile = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: VALID_COLOR,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    this.footprintTile.visible = false;
    this.buildGrid.visible = false;
    this.scene.add(this.buildGrid, this.footprintTile);

    this.applyQuality();
    this.bindInput();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(options.canvas.parentElement ?? options.canvas);
    this.resize();
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  // --- API publique (appelée par l'interface) ----------------------------------------------

  setView(view: GameView): void {
    const phaseChanged =
      !this.view ||
      this.view.phase !== view.phase ||
      this.view.group.wings !== view.group.wings ||
      this.view.funding.annexes !== view.funding.annexes;
    this.view = view;
    this.layout = layoutOf(view);
    this.office.setLayout(this.layout);
    this.skyline.setLayout(this.layout);
    const english = document.documentElement.lang.startsWith('en');
    this.office.setWingSigns(
      this.layout,
      view.group.ventures.map((venture) => ({
        label: `${venture.icon} ${english ? venture.name.en : venture.name.fr}`,
        closed: venture.status !== 'ACTIVE',
      })),
    );
    this.office.setWallFinishes(view.walls.zones);
    void this.office.setItems(view.items);
    this.projection.sync(view.items, view.projections);
    this.updateDecor(view);
    void this.roomLights.setLayout(
      this.layout,
      QUALITY_PRESETS[this.quality].roomLights,
      wallOpenings(view.items),
    );
    this.roles = new Map(view.devs.map((dev) => [dev.id, dev.role]));
    this.world.sync(view);
    this.cats.sync(view, this.decorPlan?.blocked ?? []);
    this.pets.sync(view.pets.pets);
    if (phaseChanged) this.fitCamera();

    const ids = new Set(view.devs.map((dev) => dev.id));
    for (const [id, character] of this.characters) {
      if (!ids.has(id)) {
        this.scene.remove(character.root);
        character.dispose();
        this.characters.delete(id);
        this.bubbles.get(id)?.remove();
        this.bubbles.delete(id);
      }
    }
    for (const dev of view.devs) {
      if (!this.characters.has(dev.id)) {
        const character = new CharacterView(
          dev.id,
          dev.role,
          dev.look,
          this.assets,
          this.characterPacks,
        );
        this.characters.set(dev.id, character);
        this.scene.add(character.root);
      }
    }
    if (this.current.length === 0) this.current = this.world.snapshot();
    this.smoke.active = view.incident && !this.reducedMotion;
    this.smoke.setSource(new THREE.Vector3(this.layout.width / 3, 0, this.layout.depth / 3));
    this.updateSelectionMarker();
    this.refreshBuildGrid();
    this.positionGhost();
  }

  setQuality(level: QualityLevel): void {
    if (level === this.quality) return;
    this.quality = level;
    this.applyQuality();
    this.resize();
  }

  /** Change le réglage des décorations de saison (back-office). */
  setDecorModes(modes: Partial<Record<DecorTheme, DecorMode>>): void {
    this.decorModes = { ...modes };
    if (this.view) this.setView(this.view);
  }

  /** Change les packs de personnages actifs : toute l'équipe est rhabillée. */
  setCharacterPacks(packs: readonly CharacterPackId[]): void {
    if (packs.join() === this.characterPacks.join()) return;
    this.characterPacks = [...packs];
    for (const character of this.characters.values()) {
      this.scene.remove(character.root);
      character.dispose();
    }
    this.characters.clear();
    if (this.view) this.setView(this.view);
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  setEdgePan(enabled: boolean): void {
    this.edgePan = enabled;
  }

  setZoomSpeed(speed: ZoomSpeed): void {
    this.zoomSpeed = speed;
  }

  /** Mode construction : grille, aperçu de l'objet en main. `null` pour quitter. */
  setBuildPreview(preview: BuildPreview | null): void {
    this.build = preview;
    if (!preview?.kind) this.draggingGhost = false;
    this.gestures.panLocked = this.draggingGhost;
    this.refreshBuildGrid();
    void this.refreshGhost();
    if (preview?.kind && !preview.cell) {
      // Objet pris en main : on le pose d'abord sur une case libre au centre de l'écran.
      const start = this.startCell(preview);
      if (start) queueMicrotask(() => this.options.onBuildCell?.(start));
    }
  }

  /**
   * Vignette 3D d'un objet du catalogue (image PNG en data URL), rendue hors écran avec le même
   * modèle que la scène. `null` si le rendu échoue.
   */
  async thumbnail(kind: string, size = 128): Promise<string | null> {
    const object = await this.office.single(kind);
    // Un écran déroulant se montre déroulé, sinon on ne verrait que son caisson.
    const unrolled = unrolledPreview(kind);
    if (unrolled) object.add(unrolled);
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(3, 6, 4);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b5a48, 1.4), sun, object);
    const sphere = new THREE.Box3().setFromObject(object).getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(0.2, sphere.radius) * 0.85;
    const camera = new THREE.OrthographicCamera(-radius, radius, radius, -radius, 0.1, 100);
    camera.position
      .copy(sphere.center)
      .add(new THREE.Vector3(1, 0.85, 1).normalize().multiplyScalar(radius * 4));
    camera.lookAt(sphere.center);

    const target = new THREE.WebGLRenderTarget(size, size);
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const clearColor = this.renderer.getClearColor(new THREE.Color());
    const clearAlpha = this.renderer.getClearAlpha();
    try {
      this.renderer.setRenderTarget(target);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.clear();
      this.renderer.render(scene, camera);
      const pixels = new Uint8Array(size * size * 4);
      this.renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) return null;
      const image = context.createImageData(size, size);
      // WebGL lit les lignes de bas en haut : on retourne l'image.
      for (let row = 0; row < size; row++) {
        const from = (size - 1 - row) * size * 4;
        image.data.set(pixels.subarray(from, from + size * 4), row * size * 4);
      }
      context.putImageData(image, 0, 0);
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    } finally {
      this.renderer.setRenderTarget(null);
      this.renderer.setClearColor(clearColor, clearAlpha);
      target.dispose();
      unrolled?.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.geometry.dispose();
        const mat = node.material as THREE.MeshBasicMaterial;
        mat.map?.dispose();
        mat.dispose();
      });
    }
  }

  select(target: PickTarget | null): void {
    this.selected = target;
    this.updateSelectionMarker();
  }

  /** Confettis (levée de fonds réussie). */
  celebrate(): void {
    if (this.reducedMotion) return;
    this.confetti.burst(new THREE.Vector3(this.layout.width / 2, 0, this.layout.depth / 2));
  }

  rotateCamera(direction: 1 | -1): void {
    this.cameraState = {
      ...this.cameraState,
      quarter: (this.cameraState.quarter + direction + 4) % 4,
    };
    this.applyCamera();
  }

  zoomBy(factor: number): void {
    this.cameraState = { ...this.cameraState, zoom: clampZoom(this.cameraState.zoom * factor) };
    this.applyCamera();
  }

  /** Infos de debug pour les tests end-to-end. */
  debugInfo(): {
    items: number;
    characters: number;
    visible: number;
    drawCalls: number;
    zoom: number;
    target: { x: number; z: number };
    pixelRatio: number;
    /** Position à l'écran (px) du centre de l'aperçu en mode construction. */
    ghost: { x: number; y: number } | null;
    /** Écrans allumés par les devs au travail. */
    screens: number;
    /** Vraies lampes ponctuelles de la salle. */
    roomLights: number;
    /** Chats visibles dans la scène. */
    cats: number;
  } {
    const tile = this.footprintTile;
    let ghost: { x: number; y: number } | null = null;
    if (tile.visible) {
      const projected = tile.position.clone().project(this.camera);
      const canvas = this.options.canvas;
      ghost = {
        x: ((projected.x + 1) / 2) * canvas.clientWidth,
        y: ((1 - projected.y) / 2) * canvas.clientHeight,
      };
    }
    return {
      items: this.view?.items.length ?? 0,
      characters: this.characters.size,
      visible: [...this.characters.values()].filter((c) => c.root.visible).length,
      drawCalls: this.renderer.info.render.calls,
      zoom: this.cameraState.zoom,
      target: { x: this.cameraState.targetX, z: this.cameraState.targetZ },
      pixelRatio: this.renderer.getPixelRatio(),
      ghost,
      screens: this.screens.count,
      roomLights: this.roomLights.realLights,
      cats: this.currentCats.filter((cat) => cat.visible).length,
    };
  }

  dispose(): void {
    cancelAnimationFrame(this.frameHandle);
    this.resizeObserver.disconnect();
    for (const undo of this.cleanup) undo();
    for (const character of this.characters.values()) character.dispose();
    for (const bubble of this.bubbles.values()) bubble.remove();
    this.office.dispose();
    this.decorations.dispose();
    this.meetingRoom.dispose();
    this.roomLights.dispose();
    this.skyline.dispose();
    this.screens.dispose();
    this.projection.dispose();
    this.pets.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
  }

  // --- Décorations -------------------------------------------------------------------------

  /**
   * Décorations de saison, table d'anniversaire du jour et mobilier de la salle de réunion
   * (obstacles pour les personnages).
   */
  private updateDecor(view: GameView): void {
    const themes = decoratedThemes(view.calendar.seasons, this.decorModes);
    const birthday = view.calendar.birthdays.length > 0;
    const format = view.meetingRoom.format;
    const key = decorKey(this.layout, view.items, themes, birthday, format);
    if (key === this.decorPlanKey && this.decorPlan) return;
    const plan = planDecor(
      this.layout,
      view.items,
      themes,
      birthday,
      (theme) => THEME_MODELS[theme].floor.length,
      format,
    );
    this.decorPlanKey = key;
    this.decorPlan = plan;
    this.world.setDecor(plan.blocked, plan.party, plan.meeting?.seats ?? []);
    void this.decorations.update(key, plan, this.layout, view.items);
    void this.meetingRoom.update(key, plan.meeting, this.layout);
  }

  // --- Boucle ------------------------------------------------------------------------------

  private readonly frame = (now: number): void => {
    this.frameHandle = requestAnimationFrame(this.frame);
    const delta = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;

    const view = this.view;
    const speed = !view
      ? 0
      : view.time.speed === 0
        ? 0
        : view.step === 'EXECUTION'
          ? view.time.speed
          : 1;
    this.accumulator += delta * speed;
    let steps = 0;
    while (this.accumulator >= AGENT_TICK_SECONDS && steps < MAX_STEPS_PER_FRAME) {
      this.previous = new Map(this.current.map((agent) => [agent.id, agent]));
      this.world.step();
      this.current = this.world.snapshot();
      this.previousCats = new Map(this.currentCats.map((cat) => [cat.id, cat]));
      this.cats.step();
      this.currentCats = this.cats.snapshot();
      this.accumulator -= AGENT_TICK_SECONDS;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0; // onglet en arrière-plan : on rattrape pas
    const alpha = this.accumulator / AGENT_TICK_SECONDS;

    for (const agent of this.current) {
      const shown = interpolateAgent(this.previous.get(agent.id), agent, alpha);
      this.characters.get(agent.id)?.update(shown, delta * speed, this.reducedMotion);
    }
    if (this.currentCats.length === 0 && view && view.pets.pets.length > 0)
      this.currentCats = this.cats.snapshot();
    this.pets.update(this.previousCats, this.currentCats, alpha, delta * speed, this.reducedMotion);

    if (view) {
      const minute = liveSprintMinutes(view.time, now) % 1440;
      const shownMinute = this.smoothMinute(minute, delta);
      const light = this.applyLighting(shownMinute);
      this.roomLights.update(light, this.pixelsPerUnit());
      this.skyline.update(light, shownMinute, delta, this.pixelsPerUnit(), !this.reducedMotion);
      this.screens.update(
        { items: view.items, roles: this.roles, agents: this.current },
        delta,
        1 - light.daylight,
        !this.reducedMotion,
      );
    }
    this.projection.update(delta, !this.reducedMotion);
    this.smoke.update(delta);
    this.confetti.update(delta);
    this.decorations.animate(now / 1000, this.reducedMotion);
    for (const event of this.gestures.poll(now)) this.handleGesture(event);
    this.applyEdgePan(delta);
    this.office.setDetail(this.cameraState.zoom, QUALITY_PRESETS[this.quality].decorLodZoom);
    this.updateSelectionMarker();

    this.renderer.info.reset();
    if (this.composer) this.composer.render(delta);
    else this.renderer.render(this.scene, this.camera);
    this.updateBubbles();

    this.fpsFrames++;
    if (now - this.fpsSince >= 1000) {
      this.options.onFps?.(Math.round((this.fpsFrames * 1000) / (now - this.fpsSince || 1)));
      this.fpsFrames = 0;
      this.fpsSince = now;
    }
  };

  // --- Rendu ---------------------------------------------------------------------------------

  private applyQuality(): void {
    const preset = QUALITY_PRESETS[this.quality];
    this.skyline.setQuality(this.quality);
    this.renderer.shadowMap.enabled = preset.shadows;
    this.sun.castShadow = preset.shadows;
    if (preset.shadows) {
      this.sun.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.sun.shadow.bias = -0.0005;
      this.sun.shadow.normalBias = 0.02;
      this.sun.shadow.radius = 3;
    }
    this.scene.traverse((node) => {
      if (node instanceof THREE.Mesh) node.material.needsUpdate = true;
    });

    void this.roomLights.setLayout(
      this.layout,
      preset.roomLights,
      wallOpenings(this.view?.items ?? []),
    );

    this.composer?.dispose();
    this.composer = null;
    this.outlinePass = null;
    if (preset.outline || preset.bloom) {
      const size = this.renderer.getSize(new THREE.Vector2());
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      if (preset.outline) {
        this.outlinePass = new OutlinePass(
          new THREE.Vector2(size.x || 1, size.y || 1),
          this.scene,
          this.camera,
        );
        this.outlinePass.visibleEdgeColor.setHex(SELECTION_COLOR);
        this.outlinePass.hiddenEdgeColor.setHex(0x7a5c1e);
        this.outlinePass.edgeStrength = 4;
        this.outlinePass.edgeThickness = 1.5;
        this.composer.addPass(this.outlinePass);
      }
      if (preset.bloom)
        this.composer.addPass(
          new UnrealBloomPass(new THREE.Vector2(size.x || 1, size.y || 1), 0.25, 0.4, 0.9),
        );
      this.composer.addPass(new OutputPass());
    }
  }

  private resize(): void {
    const parent = this.options.canvas.parentElement ?? this.options.canvas;
    const width = Math.max(1, parent.clientWidth);
    const height = Math.max(1, parent.clientHeight);
    this.renderer.setPixelRatio(pixelRatioFor(this.quality, window.devicePixelRatio));
    this.renderer.setSize(width, height, false);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(width, height);
    this.applyCamera();
  }

  private fitCamera(): void {
    const { width, depth } = this.layout;
    const size = this.renderer.getSize(new THREE.Vector2());
    this.cameraState = {
      targetX: (width - 1) / 2,
      targetZ: (depth - 1) / 2,
      zoom: fitZoom(width, depth, size.x / Math.max(1, size.y)),
      quarter: this.cameraState.quarter,
    };
    this.applyCamera();
  }

  private applyCamera(): void {
    this.cameraState = clampTarget(this.cameraState, this.layout.width, this.layout.depth);
    const size = this.renderer.getSize(new THREE.Vector2());
    const { halfWidth, halfHeight } = frustum(size.x / Math.max(1, size.y), this.cameraState.zoom);
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    const dir = cameraDirection(this.cameraState.quarter);
    const distance = CAMERA_DISTANCE;
    const { targetX, targetZ } = this.cameraState;
    this.camera.position.set(
      targetX + dir.x * distance,
      dir.y * distance,
      targetZ + dir.z * distance,
    );
    this.camera.lookAt(targetX, 0, targetZ);
    this.camera.updateProjectionMatrix();
  }

  /**
   * L'heure suit l'horloge continue (view/liveTime.ts). Un grand saut (chargement, nouveau
   * sprint) est rattrapé en douceur, par le chemin le plus court sur le cadran, minuit compris.
   */
  private smoothMinute(target: number, delta: number): number {
    if (this.displayMinute === null || this.reducedMotion) {
      this.displayMinute = target;
      return target;
    }
    const diff = ((target - this.displayMinute + 2160) % 1440) - 720;
    if (Math.abs(diff) <= SMOOTH_SNAP_MINUTES) {
      this.displayMinute = target;
      return target;
    }
    this.displayMinute = (this.displayMinute + diff * Math.min(1, delta * 4) + 1440) % 1440;
    return this.displayMinute;
  }

  /** Pixels (du tampon de rendu) par case : taille des halos, que l'ortho ne met pas à l'échelle. */
  private pixelsPerUnit(): number {
    const height = this.renderer.getDrawingBufferSize(new THREE.Vector2()).y;
    return height / Math.max(0.001, this.camera.top - this.camera.bottom);
  }

  private applyLighting(minute: number): LightingState {
    const light = lightingAt(minute);
    const { width, depth } = this.layout;
    const cx = width / 2;
    const cz = depth / 2;
    const radius = Math.max(width, depth);
    this.sun.intensity = light.sun;
    this.sun.color.setHex(light.sunColor);
    this.hemi.intensity = light.ambient;
    this.hemi.color.setHex(light.skyColor);
    this.scene.background = new THREE.Color(light.background);
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.setHex(light.background);
    else this.scene.fog = new THREE.Fog(light.background, HAZE_NEAR, HAZE_FAR);
    this.sun.position.set(
      cx + Math.cos(light.sunAzimuth) * radius,
      radius * 1.2,
      cz + Math.sin(light.sunAzimuth) * radius * 0.6 + radius * 0.5,
    );
    this.sun.target.position.set(cx, 0, cz);
    const shadowCamera = this.sun.shadow.camera;
    shadowCamera.left = -radius;
    shadowCamera.right = radius;
    shadowCamera.top = radius;
    shadowCamera.bottom = -radius;
    shadowCamera.far = radius * 5;
    shadowCamera.updateProjectionMatrix();
    return light;
  }

  private updateBubbles(): void {
    const canvas = this.options.canvas;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const point = new THREE.Vector3();
    for (const agent of this.current) {
      let bubble = this.bubbles.get(agent.id);
      const character = this.characters.get(agent.id);
      if (!agent.thought || !agent.visible || !character) {
        if (bubble) bubble.hidden = true;
        continue;
      }
      if (!bubble) {
        bubble = document.createElement('div');
        bubble.className = 'thought-bubble';
        bubble.setAttribute('aria-hidden', 'true');
        this.options.overlay.appendChild(bubble);
        this.bubbles.set(agent.id, bubble);
      }
      const text = this.options.translate(`thoughts.${agent.thought}`);
      if (bubble.textContent !== text) bubble.textContent = text;
      point.set(character.root.position.x, 1.55, character.root.position.z).project(this.camera);
      bubble.hidden = point.z > 1;
      bubble.style.transform = `translate(${((point.x + 1) / 2) * width}px, ${((1 - point.y) / 2) * height}px) translate(-50%, -100%)`;
    }
  }

  private updateSelectionMarker(): void {
    const target = this.selected;
    const marker = this.selectionMarker;
    marker.visible = false;
    if (this.outlinePass) this.outlinePass.selectedObjects = [];
    if (!target || !this.view) return;
    if (target.type === 'dev') {
      const character = this.characters.get(target.id);
      if (!character || !character.root.visible) return;
      marker.visible = true;
      marker.position.set(character.root.position.x, 0.02, character.root.position.z);
      marker.scale.set(0.9, 1, 0.9);
      marker.rotation.set(0, 0, 0);
      if (this.outlinePass) this.outlinePass.selectedObjects = [character.outlineTarget];
    } else if (target.type === 'item') {
      const item = this.view.items.find((i) => i.id === target.id);
      const def = item && catalogItem(item.kind);
      if (!item || !def) return;
      if (item.host) {
        // Accessoire : un petit carré sur le plateau, à son emplacement.
        const hostId = item.host.id;
        const host = this.view.items.find((i) => i.id === hostId);
        const position = host && slotPosition(host, item.host.slot);
        if (!position) return;
        marker.visible = true;
        marker.position.set(position[0], position[1] + 0.02, position[2]);
        marker.scale.set(0.4, 1, 0.4);
        marker.rotation.set(0, 0, 0);
        return;
      }
      const [w, d] = footprint(def, item.rotation);
      marker.visible = true;
      marker.position.set(item.x + (w - 1) / 2, 0.02, item.z + (d - 1) / 2);
      marker.scale.set(w, 1, d);
      marker.rotation.set(0, 0, 0);
    }
  }

  private async refreshGhost(): Promise<void> {
    const color = this.build?.color ?? 'natural';
    const key = this.build?.kind ? `${this.build.kind}#${color}` : '';
    if (key !== this.ghostKey) {
      this.ghostKey = key;
      if (this.ghost) this.scene.remove(this.ghost);
      this.ghost = null;
      if (this.build?.kind) {
        // L'aperçu garde ses vraies couleurs (on voit la teinte choisie) ; rouge si impossible.
        const ghost = await this.office.single(this.build.kind, color);
        if (this.ghostKey !== key) return;
        ghost.traverse((node) => {
          if (node instanceof THREE.Mesh) node.userData.material = node.material;
        });
        this.ghost = ghost;
        this.scene.add(ghost);
      }
    }
    this.positionGhost();
  }

  /** Case de départ d'un objet pris en main : la case libre la plus proche du centre de l'écran. */
  private startCell(preview: BuildPreview): Cell | null {
    if (!preview.kind || !this.view) return null;
    const canvas = this.options.canvas;
    const center = this.cellAt(canvas.clientWidth / 2, canvas.clientHeight / 2) ?? {
      x: Math.floor(this.layout.width / 2),
      z: Math.floor(this.layout.depth / 2),
    };
    return (
      nearestValidCell(
        this.layout,
        this.view.items,
        { kind: preview.kind, rotation: preview.rotation, ignoreId: preview.movingItemId },
        center,
      ) ?? center
    );
  }

  /** Quadrillage du sol, visible seulement en mode construction (refait si le bureau grandit). */
  private refreshBuildGrid(): void {
    this.buildGrid.visible = this.build !== null;
    const key = `${this.layout.width}x${this.layout.depth}`;
    if (!this.build || key === this.gridKey) return;
    this.gridKey = key;
    for (const child of this.buildGrid.children) {
      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    this.buildGrid.clear();
    const { width, depth } = this.layout;
    const points: THREE.Vector3[] = [];
    const y = 0.012;
    for (let x = 0; x <= width; x++) {
      points.push(new THREE.Vector3(x - 0.5, y, -0.5), new THREE.Vector3(x - 0.5, y, depth - 0.5));
    }
    for (let z = 0; z <= depth; z++) {
      points.push(new THREE.Vector3(-0.5, y, z - 0.5), new THREE.Vector3(width - 0.5, y, z - 0.5));
    }
    this.buildGrid.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 }),
      ),
    );
  }

  /** La case est-elle sous l'aperçu de l'objet en main ? (pour le faire glisser au doigt) */
  private onGhost(cell: Cell | null): boolean {
    const build = this.build;
    if (!cell || !build?.kind || !build.cell) return false;
    const def = catalogItem(build.kind);
    const [w, d] = def ? footprint(def, build.rotation) : [1, 1];
    return (
      cell.x >= build.cell.x &&
      cell.x < build.cell.x + w &&
      cell.z >= build.cell.z &&
      cell.z < build.cell.z + d
    );
  }

  /**
   * Case visée en mode construction. Un accessoire vise le dessus des meubles : on cherche le
   * meuble sous le pointeur (et non le sol derrière lui, décalé par la vue isométrique).
   */
  private aimCell(x: number, y: number): Cell | null {
    const kind = this.build?.kind;
    if (kind && catalogItem(kind)?.accessory && this.view) {
      this.raycaster.setFromCamera(this.ndc(x, y), this.camera);
      const hit = this.raycaster.intersectObjects(this.office.pickables, false)[0];
      const ids = hit?.object.userData.itemIds as string[] | undefined;
      const id = hit?.instanceId !== undefined ? ids?.[hit.instanceId] : undefined;
      const item = id ? this.view.items.find((i) => i.id === id) : undefined;
      const hostId = item?.host?.id ?? item?.id;
      const host = this.view.items.find((i) => i.id === hostId);
      if (hit && host) {
        // La case du meuble la plus proche du point touché.
        let best: Cell | null = null;
        let bestDistance = Infinity;
        for (const cell of itemCells(host)) {
          const distance = (cell.x - hit.point.x) ** 2 + (cell.z - hit.point.z) ** 2;
          if (distance < bestDistance) {
            best = cell;
            bestDistance = distance;
          }
        }
        if (best) return best;
      }
    }
    return this.cellAt(x, y);
  }

  private aimAt(x: number, y: number): void {
    const kind = this.build?.kind;
    if (kind && isWallItem(kind)) {
      // Une fenêtre vise le mur : la case sous le pointeur à mi-hauteur, au mur le plus proche.
      const aimed = this.wallAim(x, y);
      const current = this.build?.cell;
      if (
        aimed &&
        (aimed.cell.x !== current?.x ||
          aimed.cell.z !== current.z ||
          aimed.rotation !== this.build?.rotation)
      )
        this.options.onBuildCell?.(aimed.cell, aimed.rotation === 1 ? 1 : 0);
      return;
    }
    const cell = this.aimCell(x, y);
    const current = this.build?.cell;
    if (cell && (cell.x !== current?.x || cell.z !== current?.z)) this.options.onBuildCell?.(cell);
  }

  private positionGhost(): void {
    const build = this.build;
    const cell = build?.kind ? build.cell : null;
    this.footprintTile.visible = cell !== null && this.view !== null;
    if (this.ghost) this.ghost.visible = cell !== null;
    if (!build?.kind || !cell || !this.view) return;
    const request = {
      kind: build.kind,
      x: cell.x,
      z: cell.z,
      rotation: build.rotation,
      ignoreId: build.movingItemId,
    };
    const valid = checkPlacement(this.layout, this.view.items, request) === null;
    const def = catalogItem(build.kind);
    let matrix = itemMatrix({ id: '', ...request });
    if (def?.accessory) {
      // Accessoire : l'aperçu se pose sur l'emplacement libre du meuble visé.
      const resolved = resolveAccessory(this.view.items, request);
      const host =
        'host' in resolved ? this.view.items.find((i) => i.id === resolved.host.id) : undefined;
      const slotMatrix =
        host && 'host' in resolved
          ? accessoryMatrix(host, resolved.host.slot, build.rotation)
          : null;
      if (slotMatrix) matrix = slotMatrix;
      const position = new THREE.Vector3().setFromMatrixPosition(matrix);
      this.footprintTile.position.set(position.x, position.y + 0.012, position.z);
      this.footprintTile.scale.set(0.45, 1, 0.45);
    } else {
      const [w, d] = def ? footprint(def, build.rotation) : [1, 1];
      this.footprintTile.position.set(cell.x + (w - 1) / 2, 0.015, cell.z + (d - 1) / 2);
      this.footprintTile.scale.set(w, 1, d);
    }
    this.footprintTile.material.color.setHex(valid ? VALID_COLOR : INVALID_COLOR);
    if (!this.ghost) return;
    this.ghost.matrixAutoUpdate = false;
    this.ghost.matrix.copy(matrix);
    this.ghost.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.material = valid
          ? (node.userData.material as THREE.Material | THREE.Material[])
          : INVALID_GHOST;
      }
    });
  }

  // --- Entrées -------------------------------------------------------------------------------

  private bindInput(): void {
    const canvas = this.options.canvas;
    const sample = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        id: event.pointerId,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        time: event.timeStamp,
        touch: event.pointerType !== 'mouse',
      };
    };
    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      canvas.addEventListener(type, handler, options);
      this.cleanup.push(() => canvas.removeEventListener(type, handler));
    };

    on('pointerdown', (event) => {
      canvas.setPointerCapture?.(event.pointerId);
      const point = sample(event);
      this.touchInput = point.touch;
      // Au doigt, glisser depuis l'aperçu le déplace ; ailleurs, le glisser déplace la caméra.
      if (event.isPrimary) {
        const kind = this.build?.kind;
        const aimed =
          kind && isWallItem(kind)
            ? (this.wallAim(point.x, point.y)?.cell ?? null)
            : this.aimCell(point.x, point.y);
        this.draggingGhost = point.touch && this.onGhost(aimed);
        this.gestures.panLocked = this.draggingGhost;
      }
      this.gestures.down(point).forEach((e) => this.handleGesture(e));
    });
    on('pointermove', (event) =>
      this.gestures.move(sample(event)).forEach((e) => this.handleGesture(e)),
    );
    on('pointerup', (event) => {
      this.gestures.up(sample(event)).forEach((e) => this.handleGesture(e));
      this.draggingGhost = false;
      this.gestures.panLocked = false;
    });
    on('pointercancel', (event) => {
      this.gestures.cancel(event.pointerId);
      this.draggingGhost = false;
      this.gestures.panLocked = false;
    });
    on(
      'wheel',
      (event) => {
        event.preventDefault();
        this.zoomBy(wheelZoomFactor(event, this.zoomSpeed));
      },
      { passive: false },
    );
    on('contextmenu', (event) => event.preventDefault());
    this.bindEdgePan();
    on('keydown', (event) => {
      const step = 40;
      const keys: Record<string, () => void> = {
        ArrowLeft: () => this.pan(step, 0),
        ArrowRight: () => this.pan(-step, 0),
        ArrowUp: () => this.pan(0, step),
        ArrowDown: () => this.pan(0, -step),
        '+': () => this.zoomBy(1.15),
        '=': () => this.zoomBy(1.15),
        '-': () => this.zoomBy(1 / 1.15),
        q: () => this.rotateCamera(-1),
        e: () => this.rotateCamera(1),
      };
      // Objet en main : les flèches déplacent l'aperçu (géré par l'interface), pas la caméra.
      if (this.build?.kind && event.key.startsWith('Arrow')) return;
      const run = keys[event.key];
      if (run) {
        event.preventDefault();
        run();
      }
    });
  }

  /**
   * Suit la souris sur toute la page : seule une souris sans bouton enfoncé, au-dessus de la
   * scène (pas d'un panneau de l'interface), fait défiler la vue près d'un bord.
   */
  private bindEdgePan(): void {
    const canvas = this.options.canvas;
    const listen = <T extends Event>(
      target: Window | Document,
      type: string,
      handler: (event: T) => void,
    ) => {
      const listener = handler as EventListener;
      target.addEventListener(type, listener);
      this.cleanup.push(() => target.removeEventListener(type, listener));
    };
    listen<PointerEvent>(window, 'pointermove', (event) => {
      if (event.pointerType !== 'mouse' || event.buttons !== 0 || event.target !== canvas) {
        this.edgePointer = null;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      this.edgePointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    });
    // La souris sort de la fenêtre (relatedTarget nul) depuis la scène : on continue de défiler.
    listen<MouseEvent>(document, 'mouseout', (event) => {
      if (event.relatedTarget !== null || !this.edgePointer) return;
      const rect = canvas.getBoundingClientRect();
      this.edgePointer = exitPoint(
        event.clientX - rect.left,
        event.clientY - rect.top,
        rect.width,
        rect.height,
      );
    });
    const stop = () => {
      this.edgePointer = null;
    };
    listen(window, 'blur', stop);
    listen(document, 'visibilitychange', stop);
    listen(window, 'pointerdown', stop);
  }

  private applyEdgePan(delta: number): void {
    if (!this.edgePan || !this.edgePointer || delta === 0) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    const { x, y } = this.edgePointer;
    const { vx, vy } = edgePanVelocity(x, y, size.x, size.y);
    if (vx === 0 && vy === 0) return;
    // Souris à droite : la vue part à droite, donc le sol glisse vers la gauche.
    this.pan(-vx * EDGE_PAN_SPEED * delta, -vy * EDGE_PAN_SPEED * delta);
    // En construction, l'objet fantôme reste sous la souris pendant que la vue défile.
    if (this.build) this.handleGesture({ type: 'hover', x, y });
  }

  private pan(dx: number, dy: number): void {
    const height = this.renderer.getSize(new THREE.Vector2()).y;
    const delta = panDelta(this.cameraState, dx, dy, height);
    this.cameraState = {
      ...this.cameraState,
      targetX: this.cameraState.targetX + delta.dx,
      targetZ: this.cameraState.targetZ + delta.dz,
    };
    this.applyCamera();
  }

  private handleGesture(event: GestureEvent): void {
    switch (event.type) {
      case 'pan':
        this.pan(event.dx, event.dy);
        break;
      case 'pinch':
        this.zoomBy(scaleZoomFactor(event.scale, this.zoomSpeed));
        break;
      case 'hover':
        // La souris vise en survolant ; le doigt seulement en faisant glisser l'aperçu.
        if (this.build?.kind && (!this.touchInput || this.draggingGhost)) {
          this.aimAt(event.x, event.y);
        }
        break;
      case 'drop':
        if (this.build?.kind) this.aimAt(event.x, event.y);
        break;
      case 'tap':
      case 'longPress': {
        if (this.build?.kind) {
          // Souris : le clic pose. Doigt : le tap vise, le bouton « Poser » confirme.
          if (isWallItem(this.build.kind)) {
            const aimed = this.wallAim(event.x, event.y);
            if (!aimed || event.type === 'longPress') break;
            this.aimAt(event.x, event.y);
            if (!this.touchInput) this.options.onPlace?.(aimed.cell);
            break;
          }
          const cell = this.aimCell(event.x, event.y);
          if (!cell || event.type === 'longPress') break;
          if (this.touchInput) this.aimAt(event.x, event.y);
          else this.options.onPlace?.(cell);
          break;
        }
        // Souris : clic = sélection. Tactile : appui long = sélection (le tap marche aussi).
        this.options.onPick?.(this.pick(event.x, event.y));
        break;
      }
    }
  }

  private ndc(x: number, y: number): THREE.Vector2 {
    const canvas = this.options.canvas;
    return new THREE.Vector2((x / canvas.clientWidth) * 2 - 1, -(y / canvas.clientHeight) * 2 + 1);
  }

  /** Fenêtre visée : le pointeur coupe un plan à mi-hauteur des murs, ramené dans le bureau. */
  private wallAim(x: number, y: number): ReturnType<typeof aimWindow> | null {
    const kind = this.build?.kind;
    if (!kind) return null;
    this.raycaster.setFromCamera(this.ndc(x, y), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WALL_AIM_HEIGHT);
    const hit = this.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    if (!hit) return null;
    const clamp = (value: number, max: number) => Math.max(0, Math.min(max - 1, Math.round(value)));
    const cell = { x: clamp(hit.x, this.layout.width), z: clamp(hit.z, this.layout.depth) };
    return aimWindow(this.layout, kind, cell);
  }

  private cellAt(x: number, y: number): Cell | null {
    this.raycaster.setFromCamera(this.ndc(x, y), this.camera);
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = this.raycaster.ray.intersectPlane(ground, new THREE.Vector3());
    if (!hit) return null;
    const cell = { x: Math.round(hit.x), z: Math.round(hit.z) };
    return cell.x >= 0 && cell.z >= 0 && cell.x < this.layout.width && cell.z < this.layout.depth
      ? cell
      : null;
  }

  private pick(x: number, y: number): PickTarget | null {
    this.raycaster.setFromCamera(this.ndc(x, y), this.camera);
    const hitBoxes = [...this.characters.values()]
      .filter((c) => c.root.visible)
      .map((c) => c.hitBox);
    const devHit = this.raycaster.intersectObjects(hitBoxes, false)[0];
    if (devHit) return { type: 'dev', id: String(devHit.object.userData.devId) };
    const itemHit = this.raycaster.intersectObjects(this.office.pickables, false)[0];
    if (itemHit && itemHit.instanceId !== undefined) {
      const ids = itemHit.object.userData.itemIds as string[] | undefined;
      const id = ids?.[itemHit.instanceId];
      if (id) return { type: 'item', id };
    }
    const cell = this.cellAt(x, y);
    return cell ? { type: 'cell', cell } : null;
  }
}
