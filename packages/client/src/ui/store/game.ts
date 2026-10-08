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
import { checkPlacement } from '../../view/placement';
import { localized } from '../game/format';
import type { GameSource } from '../../view/source';
import type {
  CommandResult,
  GameCommand,
  GameNotification,
  GameView,
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
 *   `cell` (souris, doigt ou flèches du clavier) jusqu'à la pose.
 */
export interface BuildState {
  readonly kind: string | null;
  readonly rotation: Rotation;
  /** Objet existant en cours de déplacement. */
  readonly movingItemId: string | null;
  /** Case visée par l'aperçu (coin de l'emprise), `null` tant qu'elle n'est pas connue. */
  readonly cell?: Cell | null;
}

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
  /** Repose l'objet en main et revient au catalogue. */
  cancelPlacement(): void;
  /** Pose l'objet en main sur `cell` (ou sur la case visée). Vrai si la pose a réussi. */
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
      build: { kind: null, rotation: 0, movingItemId: null, cell: null },
      panel: null,
      selected: null,
    });
  },

  exitBuild() {
    set({ build: null, selected: null });
  },

  pickItem(kind) {
    set({ build: { kind, rotation: 0, movingItemId: null, cell: null }, selected: null });
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

  cancelPlacement() {
    set({ build: { kind: null, rotation: 0, movingItemId: null, cell: null }, selected: null });
  },

  async placeAt(target) {
    const { build, view, dispatch, notify } = get();
    const cell = target ?? build?.cell;
    if (!build?.kind || !view || !cell) return false;
    // Cloisons et entrée sont des contraintes du décor : vérifiées avant d'envoyer.
    const error = checkPlacement(officeLayout(view.phase), view.items, {
      kind: build.kind,
      x: cell.x,
      z: cell.z,
      rotation: build.rotation,
      ignoreId: build.movingItemId ?? undefined,
    });
    if (error) {
      notify(`results.${error}`, 'error');
      return false;
    }
    const result = await dispatch(
      build.movingItemId
        ? {
            type: 'moveItem',
            itemId: build.movingItemId,
            x: cell.x,
            z: cell.z,
            rotation: build.rotation,
          }
        : { type: 'placeItem', kind: build.kind, x: cell.x, z: cell.z, rotation: build.rotation },
    );
    if (!result.ok) return false;
    const def = catalogItem(build.kind);
    const name = def ? localized(def.name, i18n.language) : build.kind;
    notify(build.movingItemId ? 'build.moved' : 'build.placed', 'success', { item: name });
    // Retour au catalogue (si on est toujours en construction).
    if (get().build) get().cancelPlacement();
    return true;
  },

  notify(key, tone = 'info', params) {
    set({ toast: { id: ++toastId, key, tone, params } });
  },

  setFps(fps) {
    set({ fps });
  },
}));
