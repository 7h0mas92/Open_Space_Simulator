/**
 * Chef d'orchestre du rendu Three.js.
 *
 * Il lit des instantanés (`GameView`), fait avancer l'IA visuelle par pas fixes, interpole entre
 * deux pas et dessine. Il ne modifie jamais l'état du jeu : les clics sont remontés à
 * l'interface par des callbacks, qui décide de la commande à envoyer.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AGENT_TICK_SECONDS, AgentWorld, type AgentSnapshot } from '../ai/agents';
import { catalogItem, footprint } from '../view/catalog';
import { officeLayout, type Cell, type OfficeLayout } from '../view/layout';
import { checkPlacement } from '../view/placement';
import type { GameView, Rotation } from '../view/types';
import { AssetLibrary } from './assets';
import { CharacterView } from './characters';
import { ConfettiEffect, SmokeEffect } from './effects';
import { GestureRecognizer, type GestureEvent } from './gestures';
import { interpolateAgent } from './interpolation';
import {
  cameraDirection,
  clampTarget,
  clampZoom,
  fitZoom,
  frustum,
  panDelta,
  type IsoCameraState,
} from './isoCamera';
import { lightingAt } from './lighting';
import { itemMatrix, OfficeView } from './office';
import { pixelRatioFor, QUALITY_PRESETS, type QualityLevel } from './quality';

export type PickTarget =
  | { readonly type: 'dev'; readonly id: string }
  | { readonly type: 'item'; readonly id: string }
  | { readonly type: 'cell'; readonly cell: Cell };

export interface BuildPreview {
  readonly kind: string;
  readonly rotation: Rotation;
  /** Objet déplacé (il ne se bloque pas lui-même). */
  readonly movingItemId?: string;
}

export interface RendererOptions {
  readonly canvas: HTMLCanvasElement;
  /** Calque HTML pour les bulles de pensée. */
  readonly overlay: HTMLElement;
  readonly quality: QualityLevel;
  readonly reducedMotion: boolean;
  readonly translate: (key: string) => string;
  readonly onPick?: (target: PickTarget | null) => void;
  /** Pose (clic, tap ou dépôt) en mode construction. */
  readonly onPlace?: (cell: Cell) => void;
  readonly onFps?: (fps: number) => void;
}

const MAX_STEPS_PER_FRAME = 8;
const SELECTION_COLOR = 0xf5b942;

export class GameRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  private readonly sun = new THREE.DirectionalLight(0xffffff, 1.5);
  private readonly hemi = new THREE.HemisphereLight(0xd6e6ff, 0x6b5a48, 0.9);
  private readonly assets = new AssetLibrary();
  private readonly office = new OfficeView(this.assets);
  private readonly characters = new Map<string, CharacterView>();
  private readonly world: AgentWorld;
  private readonly gestures = new GestureRecognizer();
  private readonly raycaster = new THREE.Raycaster();
  private readonly smoke: SmokeEffect;
  private readonly confetti: ConfettiEffect;
  private readonly selectionMarker: THREE.LineSegments;
  private readonly bubbles = new Map<string, HTMLDivElement>();
  private composer: EffectComposer | null = null;
  private outlinePass: OutlinePass | null = null;

  private view: GameView | null = null;
  private layout: OfficeLayout = officeLayout('GARAGE');
  private quality: QualityLevel;
  private reducedMotion: boolean;
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
  private hoverCell: Cell | null = null;
  private readonly resizeObserver: ResizeObserver;
  private readonly cleanup: (() => void)[] = [];

  constructor(private readonly options: RendererOptions) {
    this.quality = options.quality;
    this.reducedMotion = options.reducedMotion;
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
    this.scene.add(this.hemi, this.sun, this.sun.target, this.office.root);

    this.smoke = new SmokeEffect(preset.maxParticles);
    this.confetti = new ConfettiEffect(Math.min(200, preset.maxParticles));
    this.scene.add(this.smoke.root, this.confetti.root);

    this.selectionMarker = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.02, 1)),
      new THREE.LineBasicMaterial({ color: SELECTION_COLOR }),
    );
    this.selectionMarker.visible = false;
    this.scene.add(this.selectionMarker);

    this.applyQuality();
    this.bindInput();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(options.canvas.parentElement ?? options.canvas);
    this.resize();
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  // --- API publique (appelée par l'interface) ----------------------------------------------

  setView(view: GameView): void {
    const phaseChanged = !this.view || this.view.phase !== view.phase;
    this.view = view;
    this.layout = officeLayout(view.phase);
    this.office.setLayout(this.layout);
    void this.office.setItems(view.items);
    this.world.sync(view);
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
        const character = new CharacterView(dev.id, dev.look, this.assets);
        this.characters.set(dev.id, character);
        this.scene.add(character.root);
      }
    }
    if (this.current.length === 0) this.current = this.world.snapshot();
    this.smoke.active = view.incident && !this.reducedMotion;
    this.smoke.setSource(new THREE.Vector3(this.layout.width / 3, 0, this.layout.depth / 3));
    this.updateSelectionMarker();
  }

  setQuality(level: QualityLevel): void {
    if (level === this.quality) return;
    this.quality = level;
    this.applyQuality();
    this.resize();
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  /** Mode construction : aperçu de l'objet sous le pointeur. `null` pour quitter. */
  setBuildPreview(preview: BuildPreview | null): void {
    this.build = preview;
    this.gestures.panLocked = preview !== null;
    void this.refreshGhost();
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
    pixelRatio: number;
  } {
    return {
      items: this.view?.items.length ?? 0,
      characters: this.characters.size,
      visible: [...this.characters.values()].filter((c) => c.root.visible).length,
      drawCalls: this.renderer.info.render.calls,
      zoom: this.cameraState.zoom,
      pixelRatio: this.renderer.getPixelRatio(),
    };
  }

  dispose(): void {
    cancelAnimationFrame(this.frameHandle);
    this.resizeObserver.disconnect();
    for (const undo of this.cleanup) undo();
    for (const character of this.characters.values()) character.dispose();
    for (const bubble of this.bubbles.values()) bubble.remove();
    this.office.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
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
      this.accumulator -= AGENT_TICK_SECONDS;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0; // onglet en arrière-plan : on rattrape pas
    const alpha = this.accumulator / AGENT_TICK_SECONDS;

    for (const agent of this.current) {
      const shown = interpolateAgent(this.previous.get(agent.id), agent, alpha);
      this.characters.get(agent.id)?.update(shown, delta * speed, this.reducedMotion);
    }

    if (view) this.applyLighting(view.time.minute);
    this.smoke.update(delta);
    this.confetti.update(delta);
    for (const event of this.gestures.poll(now)) this.handleGesture(event);
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
    const distance = 60;
    const { targetX, targetZ } = this.cameraState;
    this.camera.position.set(
      targetX + dir.x * distance,
      dir.y * distance,
      targetZ + dir.z * distance,
    );
    this.camera.lookAt(targetX, 0, targetZ);
    this.camera.updateProjectionMatrix();
  }

  private applyLighting(minute: number): void {
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
      const [w, d] = footprint(def, item.rotation);
      marker.visible = true;
      marker.position.set(item.x + (w - 1) / 2, 0.02, item.z + (d - 1) / 2);
      marker.scale.set(w, 1, d);
      marker.rotation.set(0, 0, 0);
    }
  }

  private async refreshGhost(): Promise<void> {
    const key = this.build ? `${this.build.kind}` : '';
    if (key !== this.ghostKey) {
      this.ghostKey = key;
      if (this.ghost) this.scene.remove(this.ghost);
      this.ghost = null;
      if (this.build) {
        const ghost = await this.office.single(this.build.kind);
        if (this.ghostKey !== key) return;
        ghost.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.material = new THREE.MeshBasicMaterial({
              color: 0x4caf6e,
              transparent: true,
              opacity: 0.55,
              depthWrite: false,
            });
          }
        });
        this.ghost = ghost;
        this.scene.add(ghost);
      }
    }
    this.positionGhost();
  }

  private positionGhost(): void {
    if (!this.ghost || !this.build || !this.view) return;
    const cell = this.hoverCell;
    this.ghost.visible = cell !== null;
    if (!cell) return;
    const request = {
      kind: this.build.kind,
      x: cell.x,
      z: cell.z,
      rotation: this.build.rotation,
      ignoreId: this.build.movingItemId,
    };
    const valid = checkPlacement(this.layout, this.view.items, request) === null;
    this.ghost.matrixAutoUpdate = false;
    this.ghost.matrix.copy(itemMatrix({ id: '', ...request }));
    this.ghost.traverse((node) => {
      if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshBasicMaterial) {
        node.material.color.setHex(valid ? 0x4caf6e : 0xe0584a);
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
      this.gestures.down(sample(event)).forEach((e) => this.handleGesture(e));
      if (this.build) this.handleGesture({ type: 'hover', x: sample(event).x, y: sample(event).y });
    });
    on('pointermove', (event) =>
      this.gestures.move(sample(event)).forEach((e) => this.handleGesture(e)),
    );
    on('pointerup', (event) =>
      this.gestures.up(sample(event)).forEach((e) => this.handleGesture(e)),
    );
    on('pointercancel', (event) => this.gestures.cancel(event.pointerId));
    on('pointerleave', () => {
      this.hoverCell = null;
      this.positionGhost();
    });
    on(
      'wheel',
      (event) => {
        event.preventDefault();
        this.zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12);
      },
      { passive: false },
    );
    on('contextmenu', (event) => event.preventDefault());
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
      const run = keys[event.key];
      if (run) {
        event.preventDefault();
        run();
      }
    });
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
        this.zoomBy(event.scale);
        break;
      case 'hover':
        if (this.build) {
          this.hoverCell = this.cellAt(event.x, event.y);
          this.positionGhost();
        }
        break;
      case 'drop':
      case 'tap':
      case 'longPress': {
        if (this.build) {
          const cell = this.cellAt(event.x, event.y);
          if (cell && event.type !== 'longPress') this.options.onPlace?.(cell);
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
