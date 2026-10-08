/**
 * État de l'interface en jeu (Zustand).
 *
 * L'interface lit le dernier instantané (`view`) et envoie des commandes typées via `dispatch`.
 * La partie tourne dans le Web Worker de la simulation ; `GameSource` (view/source.ts) fait le
 * lien et convertit chaque snapshot en `GameView`.
 */
import {
  dailySeed,
  isoDate,
  utcDate,
  type EventCard,
  type FurnitureColor,
  type GameMode,
  type LocalizedText,
  type LoggedCommand,
  type NotificationKind,
  type SaveData,
} from '@oss/shared';
import { create } from 'zustand';
import { metaApi } from '../../api/meta';
import i18n from '../../i18n';
import type { PickTarget } from '../../render/GameRenderer';
import { catalogItem } from '../../view/catalog';
import { officeLayout, type Cell } from '../../view/layout';
import { checkPlacement, nearestValidCell, resolveAccessory } from '../../view/placement';
import { localized } from '../game/format';
import type { GameSource } from '../../view/source';
import type {
  CommandResult,
  GameCommand,
  GameNotification,
  GameView,
  PlacedItemView,
  Rotation,
} from '../../view/types';

export type { GameSource };

export const PANELS = [
  'kanban',
  'team',
  'hiring',
  'dashboard',
  'slack',
  'saves',
  'settings',
  'credits',
] as const;
export type PanelId = (typeof PANELS)[number];

/**
 * Mode construction (`null` hors construction) :
 * - `kind === null` : le catalogue est ouvert, on peut aussi toucher un objet posé ;
 * - `kind` renseigné : l'objet est « en main », le catalogue se replie et l'aperçu suit
 *   `cell` (souris, doigt ou flèches du clavier). Après une pose, l'objet reste en main pour
 *   en poser d'autres, jusqu'à « Annuler » ou « Terminer ».
 */
export interface BuildState {
  readonly kind: string | null;
  readonly rotation: Rotation;
  /** Objet existant en cours de déplacement. */
  readonly movingItemId: string | null;
  /** Case visée par l'aperçu (coin de l'emprise), `null` tant qu'elle n'est pas connue. */
  readonly cell?: Cell | null;
  /** Couleur des objets posés (et de l'aperçu). */
  readonly color: FurnitureColor;
  /** Exemplaires déjà posés depuis la prise en main (pose en série). */
  readonly placed: number;
}

/** Rien en main : le catalogue est ouvert. */
const EMPTY_BUILD: BuildState = {
  kind: null,
  rotation: 0,
  movingItemId: null,
  cell: null,
  color: 'natural',
  placed: 0,
};

/** Dernière couleur choisie pour chaque objet : on la retrouve en le reprenant en main. */
const lastColors = new Map<string, FurnitureColor>();

export interface Toast {
  readonly id: number;
  /** Clé i18n, ou texte déjà localisé venu de la simulation. */
  readonly key?: string;
  readonly text?: LocalizedText;
  readonly params?: Record<string, string | number>;
  readonly tone: 'info' | 'error' | 'success';
}

/** Notifications de la simulation montrées en toast (les autres restent silencieuses). */
const TOAST_KINDS: Partial<Record<NotificationKind, Toast['tone']>> = {
  HALLUCINATION: 'error',
  DESIGN_BLOCKED: 'info',
  PROD_DOWN: 'error',
  FRIDAY_17H: 'info',
  COFFEE_EMPTY: 'error',
  DEV_HIRED: 'success',
  OFFER_REFUSED: 'error',
  DEV_FIRED: 'info',
  DEV_RESIGNED: 'error',
  DEV_LEVEL_UP: 'success',
  DEV_BIRTHDAY: 'success',
  DEV_REMOTE: 'info',
  RUST_CONVERT: 'info',
  FUNDS_RAISED: 'success',
  PITCH_FAILED: 'error',
  PHASE_UP: 'success',
  SEASON_STARTED: 'success',
  ACQUISITION_OFFER: 'info',
  SPRINT_LOST: 'error',
  ACHIEVEMENT_UNLOCKED: 'success',
};

export type NotificationListener = (notifications: readonly GameNotification[]) => void;

/** Comment démarrer une partie. */
export interface StartOptions {
  seed?: string;
  mode?: GameMode;
  /** Source déjà prête (tests). */
  source?: GameSource;
  /** Reprendre une sauvegarde. */
  save?: { data: SaveData; cardsVersion: string };
  /** Revoir une partie du classement. */
  replay?: {
    seed: string;
    mode: GameMode;
    commands: readonly LoggedCommand[];
    cards: readonly EventCard[];
    cardsVersion: string;
    pseudo: string;
  };
}

/** Publication du score de fin de partie. */
export type Submission =
  | { status: 'idle' | 'pending' | 'guest' | 'replay' }
  | { status: 'done'; rank: number; newAchievements: readonly string[] }
  | { status: 'error'; code: string };

interface GameStore {
  source: GameSource | null;
  view: GameView | null;
  /** Partie en cours de démarrage (chargement du Web Worker). */
  loading: boolean;
  panel: PanelId | null;
  selected: PickTarget | null;
  build: BuildState | null;
  toast: Toast | null;
  fps: number;
  /** Pseudo du joueur dont on regarde le replay (null pour une partie jouée). */
  replayOf: string | null;
  submission: Submission;
  start(options?: StartOptions): Promise<void>;
  quit(): void;
  dispatch(command: GameCommand): Promise<CommandResult>;
  openPanel(panel: PanelId | null): void;
  select(target: PickTarget | null): void;
  setBuild(build: BuildState | null): void;
  /** Entre en mode construction (catalogue ouvert). */
  enterBuild(): void;
  exitBuild(): void;
  /** Prend un objet du catalogue en main : le catalogue se replie. */
  pickItem(kind: string): void;
  /** Reprend en main un objet déjà posé pour le déplacer. */
  startMove(itemId: string): void;
  setBuildCell(cell: Cell | null): void;
  rotateBuild(): void;
  /** Change la couleur de l'objet en main. */
  setBuildColor(color: FurnitureColor): void;
  /** Repose l'objet en main et revient au catalogue. */
  cancelPlacement(): void;
  /**
   * Pose l'objet en main sur `cell` (ou sur la case visée). Vrai si la pose a réussi. Un objet
   * acheté reste en main (pose en série) ; un objet déplacé ramène au catalogue.
   */
  placeAt(cell?: Cell): Promise<boolean>;
  notify(key: string, tone?: Toast['tone'], params?: Toast['params']): void;
  setFps(fps: number): void;
}

let toastId = 0;
let unsubscribeSource: (() => void) | null = null;
const notificationListeners = new Set<NotificationListener>();

/** Le rendu s'abonne aux notifications pour ses effets (confettis…), sans passer par React. */
export function onGameNotifications(listener: NotificationListener): () => void {
  notificationListeners.add(listener);
  return () => notificationListeners.delete(listener);
}

/** Graine aléatoire d'une partie (le Daily utilise la graine du jour, la même pour tous). */
/**
 * Graine d'une nouvelle partie : la date du jour, puis du hasard. La date fixe le calendrier de
 * la partie (Halloween tombe à Halloween), le hasard rend chaque partie unique.
 */
function randomSeed(): string {
  const now = new Date();
  const date = isoDate({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
  return `${date}.${Math.floor(Math.random() * 2 ** 31).toString(36)}`;
}

/** Graine du Daily : demandée au serveur, ou calculée localement hors ligne. */
async function todaySeed(): Promise<string> {
  try {
    return (await metaApi.daily()).seed;
  } catch {
    return dailySeed(utcDate(new Date()));
  }
}

/** Crée la source de la partie (import dynamique : la simulation n'est chargée qu'ici). */
async function createSource(options: StartOptions): Promise<GameSource> {
  if (options.source) return options.source;
  const [{ EngineSource }, cardsModule] = await Promise.all([
    import('../../view/source'),
    import('../../save/cards'),
  ]);
  if (options.replay) {
    const { seed, mode, commands, cards, cardsVersion } = options.replay;
    return EngineSource.start({ seed, mode, commands }, { cards, cardsVersion });
  }
  if (options.save) {
    const set = await cardsModule.cardsForVersion(options.save.cardsVersion);
    return EngineSource.start(
      { save: options.save.data },
      { cards: set.cards, cardsVersion: set.version },
    );
  }
  const mode = options.mode ?? 'NORMAL';
  const seed = options.seed ?? (mode === 'DAILY' ? await todaySeed() : randomSeed());
  const set = await cardsModule.currentCards();
  return EngineSource.start({ seed, mode }, { cards: set.cards, cardsVersion: set.version });
}

export const useGame = create<GameStore>((set, get) => ({
  source: null,
  view: null,
  loading: false,
  panel: null,
  selected: null,
  build: null,
  toast: null,
  fps: 0,
  replayOf: null,
  submission: { status: 'idle' },

  async start(options = {}) {
    get().quit();
    set({ loading: true });
    let source: GameSource;
    try {
      source = await createSource(options);
    } catch {
      set({ loading: false });
      get().notify('menu.startFailed', 'error');
      return;
    }
    unsubscribeSource = source.subscribe((view, notifications) => {
      set({ view });
      if (notifications.length === 0) return;
      for (const listener of notificationListeners) listener(notifications);
      const shown = notifications.findLast((n) => TOAST_KINDS[n.kind] !== undefined);
      if (shown)
        set({
          toast: { id: ++toastId, text: shown.text, tone: TOAST_KINDS[shown.kind] ?? 'info' },
        });
    });
    set({
      source,
      view: source.view,
      loading: false,
      panel: null,
      selected: null,
      build: null,
      replayOf: options.replay?.pseudo ?? null,
      submission: { status: options.replay ? 'replay' : 'idle' },
    });
  },

  quit() {
    unsubscribeSource?.();
    unsubscribeSource = null;
    get().source?.dispose();
    set({
      source: null,
      view: null,
      panel: null,
      selected: null,
      build: null,
      toast: null,
      replayOf: null,
      submission: { status: 'idle' },
    });
  },

  async dispatch(command) {
    const { source, replayOf } = get();
    if (!source) return { ok: false, reason: 'noGame' };
    // Replay : on ne peut que changer la vitesse.
    if (replayOf !== null && command.type !== 'setSpeed') return { ok: false, reason: 'LOCKED' };
    const result = await source.dispatch(command);
    if (!result.ok) get().notify(`results.${result.reason}`, 'error');
    return result;
  },

  openPanel(panel) {
    set({ panel });
  },

  select(target) {
    set({ selected: target });
  },

  setBuild(build) {
    set({ build });
  },

  enterBuild() {
    set({
      build: EMPTY_BUILD,
      panel: null,
      selected: null,
    });
  },

  exitBuild() {
    set({ build: null, selected: null });
  },

  pickItem(kind) {
    set({
      build: { ...EMPTY_BUILD, kind, color: lastColors.get(kind) ?? 'natural' },
      selected: null,
    });
  },

  startMove(itemId) {
    const item = get().view?.items.find((i) => i.id === itemId);
    if (!item) return;
    set({
      build: {
        kind: item.kind,
        rotation: item.rotation,
        movingItemId: item.id,
        cell: { x: item.x, z: item.z },
        color: item.color,
        placed: 0,
      },
      panel: null,
      selected: null,
    });
  },

  setBuildCell(cell) {
    const { build } = get();
    if (!build?.kind) return;
    if (build.cell?.x === cell?.x && build.cell?.z === cell?.z) return;
    set({ build: { ...build, cell } });
  },

  rotateBuild() {
    const { build } = get();
    if (!build?.kind) return;
    set({ build: { ...build, rotation: ((build.rotation + 1) % 4) as Rotation } });
  },

  setBuildColor(color) {
    const { build } = get();
    if (!build?.kind) return;
    if (!build.movingItemId) lastColors.set(build.kind, color);
    set({ build: { ...build, color } });
  },

  cancelPlacement() {
    set({ build: EMPTY_BUILD, selected: null });
  },

  async placeAt(target) {
    const { build, view, dispatch, notify } = get();
    const cell = target ?? build?.cell;
    if (!build?.kind || !view || !cell) return false;
    const def = catalogItem(build.kind);
    if (!def) return false;
    // Cloisons et entrée sont des contraintes du décor : vérifiées avant d'envoyer.
    const layout = officeLayout(view.phase);
    const request = {
      kind: build.kind,
      x: cell.x,
      z: cell.z,
      rotation: build.rotation,
      ignoreId: build.movingItemId ?? undefined,
    };
    const error = checkPlacement(layout, view.items, request);
    if (error) {
      notify(`results.${error}`, 'error');
      return false;
    }
    // Un accessoire se pose sur l'emplacement libre du meuble visé.
    const resolved = def.accessory ? resolveAccessory(view.items, request) : null;
    const host = resolved && 'host' in resolved ? resolved.host : null;
    if (def.accessory && !host) return false;
    const moving = build.movingItemId;
    const command: GameCommand | null = host
      ? moving
        ? { type: 'moveAccessory', itemId: moving, host, rotation: build.rotation }
        : {
            type: 'placeAccessory',
            kind: build.kind,
            host,
            rotation: build.rotation,
            color: build.color,
          }
      : moving
        ? { type: 'moveItem', itemId: moving, x: cell.x, z: cell.z, rotation: build.rotation }
        : {
            type: 'placeItem',
            kind: build.kind,
            x: cell.x,
            z: cell.z,
            rotation: build.rotation,
            color: build.color,
          };
    const result = await dispatch(command);
    if (!result.ok) return false;
    const name = localized(def.name, i18n.language);
    notify(moving ? 'build.moved' : 'build.placed', 'success', { item: name });
    if (!get().build) return true; // on a quitté la construction entre-temps
    if (moving) {
      get().cancelPlacement();
      return true;
    }

    // Pose en série : l'objet reste en main tant qu'on peut en acheter un autre.
    const owned = view.items.filter((item) => item.kind === build.kind).length + 1;
    if (owned >= def.maxCount || view.gauges.treasury - def.price < def.price) {
      notify(owned >= def.maxCount ? 'build.stopSoldOut' : 'build.stopMoney', 'info', {
        item: name,
      });
      get().cancelPlacement();
      return true;
    }
    // L'aperçu saute sur la place libre la plus proche (l'objet tout juste posé compte, même si
    // l'instantané de la simulation n'est pas encore arrivé).
    const justPlaced: PlacedItemView = {
      id: '@just-placed',
      kind: build.kind,
      x: cell.x,
      z: cell.z,
      rotation: build.rotation,
      resale: 0,
      color: build.color,
      host,
    };
    const items = [...(get().view ?? view).items, justPlaced];
    const next = nearestValidCell(
      layout,
      items,
      { kind: build.kind, rotation: build.rotation },
      cell,
    );
    const current = get().build;
    if (current?.kind === build.kind && !current.movingItemId) {
      set({ build: { ...current, cell: next ?? cell, placed: current.placed + 1 } });
    }
    return true;
  },

  notify(key, tone = 'info', params) {
    set({ toast: { id: ++toastId, key, tone, params } });
  },

  setFps(fps) {
    set({ fps });
  },
}));
