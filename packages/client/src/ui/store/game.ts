/**
 * État de l'interface en jeu (Zustand).
 *
 * L'interface lit le dernier instantané (`view`) et envoie des commandes typées via `dispatch`.
 * La partie tourne dans le Web Worker de la simulation ; `GameSource` (view/source.ts) fait le
 * lien et convertit chaque snapshot en `GameView`.
 */
import {
  UNLOCK_MODES,
  dailySeed,
  isoDate,
  utcDate,
  careerSeed,
  type CareerLegendId,
  type StoryMissionId,
  type StoryRewardId,
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
import { storyProgress } from '../../save/story';
import i18n from '../../i18n';
import type { PickTarget } from '../../render/GameRenderer';
import { catalogItem } from '../../view/catalog';
import { layoutOf, type Cell } from '../../view/layout';
import { isWallItem, snapToWall, type WallSide } from '../../view/windows';
import { checkPlacement, nearestValidCell, resolveAccessory } from '../../view/placement';
import { localized } from '../game/format';
import { DEFAULT_TEAM_FILTERS, type TeamFilters } from '../team/filters';
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
  'group',
  'meetings',
  /** Appli de tickets « Kanbanana » de la salle de réunion (ouverte depuis le Daily). */
  'tickets',
  'pets',
  'servers',
  'lobby',
  'cleaning',
  'subscriptions',
  'funding',
  'career',
  'mission',
  'dashboard',
  'slack',
  'saves',
  'leaderboard',
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
  /**
   * Objet sorti de l'inventaire : la pose est gratuite et prend le premier exemplaire rangé de
   * ce type et de cette couleur (`color`).
   */
  readonly fromStock?: boolean;
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
  RAISE_GRANTED: 'success',
  RAISE_REFUSED: 'info',
  DEV_NOTICE: 'error',
  DEV_LEVEL_UP: 'success',
  DEV_BIRTHDAY: 'success',
  DEV_REMOTE: 'info',
  RUST_CONVERT: 'info',
  FUNDS_RAISED: 'success',
  PITCH_FAILED: 'error',
  PHASE_UP: 'success',
  SEASON_STARTED: 'success',
  ACQUISITION_OFFER: 'info',
  VENTURE_FOUNDED: 'success',
  VENTURE_DIED: 'error',
  VENTURE_SOLD: 'success',
  VENTURE_DIVIDENDS: 'info',
  MEETING_ROOM_FITTED: 'success',
  CRISIS_MEETING: 'info',
  PET_ADOPTED: 'success',
  PET_REHOMED: 'info',
  FIBRE_SUBSCRIBED: 'success',
  FIBRE_CANCELLED: 'info',
  FIBRE_CUT: 'error',
  LOBBY_BUILT: 'success',
  RECEPTIONIST_HIRED: 'success',
  RECEPTIONIST_LEFT: 'info',
  SECURITY_SUBSCRIBED: 'success',
  SECURITY_CANCELLED: 'info',
  SECURITY_CUT: 'error',
  INTERNET_SATURATED: 'error',
  INTERNET_OK: 'success',
  SERVER_ROOM_WARM: 'info',
  SERVER_ROOM_OVERHEAT: 'error',
  SERVER_ROOM_COOL: 'success',
  OFFICE_DIRTY: 'error',
  CLEANING_BOOKED: 'success',
  CLEANING_STARTED: 'info',
  CLEANING_DONE: 'success',
  CLEANING_SUBSCRIBED: 'success',
  CLEANING_CANCELLED: 'info',
  CLEANING_CUT: 'error',
  URGENT_TASK: 'error',
  URGENT_DONE: 'success',
  URGENT_MISSED: 'error',
  WEEKLY_TASKS: 'info',
  WEEKLY_MISSED: 'info',
  OBJECTIVE_SET: 'info',
  OBJECTIVE_DONE: 'success',
  OBJECTIVE_FAILED: 'info',
  CAREER_MILESTONE: 'success',
  CAREER_MISSED: 'error',
  SPRINT_LOST: 'error',
  ACHIEVEMENT_UNLOCKED: 'success',
};

export type NotificationListener = (notifications: readonly GameNotification[]) => void;

/** Comment démarrer une partie. */
export interface StartOptions {
  seed?: string;
  mode?: GameMode;
  /** Mode Carrière : la légende à suivre (écrite dans la graine). */
  legend?: CareerLegendId;
  /** Mode Histoire : la mission à jouer. */
  mission?: StoryMissionId;
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
    /** Récompenses du mode Histoire utilisées par la partie. */
    unlocks?: readonly StoryRewardId[];
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
  /** Filtres et tri de la liste de l'équipe, gardés d'une ouverture du panneau à l'autre. */
  teamFilters: TeamFilters;
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
  /** Prend en main un objet rangé dans l'inventaire (type et couleur). */
  pickStored(kind: string, color: FurnitureColor): void;
  /** Reprend en main un objet déjà posé pour le déplacer. */
  startMove(itemId: string): void;
  /** Case visée en mode construction ; `wall` : mur choisi pour une fenêtre. */
  setBuildCell(cell: Cell | null, wall?: WallSide): void;
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
  setTeamFilters(filters: TeamFilters): void;
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
    const { seed, mode, commands, cards, cardsVersion, unlocks } = options.replay;
    return EngineSource.start(
      { seed, mode, commands, ...(unlocks ? { unlocks } : {}) },
      { cards, cardsVersion },
    );
  }
  if (options.save) {
    const set = await cardsModule.cardsForVersion(options.save.cardsVersion);
    return EngineSource.start(
      { save: options.save.data },
      { cards: set.cards, cardsVersion: set.version },
    );
  }
  const mode = options.mode ?? 'NORMAL';
  const seed =
    options.seed ??
    (mode === 'DAILY'
      ? await todaySeed()
      : mode === 'CAREER'
        ? careerSeed(options.legend ?? 'pepin', randomSeed())
        : randomSeed());
  const set = await cardsModule.currentCards();
  // Récompenses du mode Histoire : seulement dans les modes qui les acceptent.
  const unlocks = UNLOCK_MODES.includes(mode) ? await storyProgress.unlocks().catch(() => []) : [];
  return EngineSource.start(
    {
      seed,
      mode,
      ...(mode === 'STORY' && options.mission ? { mission: options.mission } : {}),
      ...(unlocks.length > 0 ? { unlocks } : {}),
    },
    { cards: set.cards, cardsVersion: set.version },
  );
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
  teamFilters: DEFAULT_TEAM_FILTERS,

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
      teamFilters: DEFAULT_TEAM_FILTERS,
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

  pickStored(kind, color) {
    set({ build: { ...EMPTY_BUILD, kind, color, fromStock: true }, selected: null });
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

  setBuildCell(cell, wall) {
    const { build, view } = get();
    if (!build?.kind) return;
    // Une fenêtre reste accrochée à un mur du fond : celui demandé, sinon le sien.
    if (cell && view && isWallItem(build.kind)) {
      const side = wall ?? (build.rotation === 1 ? 1 : 0);
      const snapped = snapToWall(layoutOf(view), build.kind, cell, side);
      if (
        build.cell?.x === snapped.cell.x &&
        build.cell.z === snapped.cell.z &&
        build.rotation === snapped.rotation
      )
        return;
      set({ build: { ...build, ...snapped } });
      return;
    }
    if (build.cell?.x === cell?.x && build.cell?.z === cell?.z) return;
    set({ build: { ...build, cell } });
  },

  rotateBuild() {
    const { build, view } = get();
    if (!build?.kind) return;
    // « Tourner » une fenêtre la fait passer sur l'autre mur, à la même position.
    if (view && isWallItem(build.kind)) {
      const wall = build.rotation === 0 ? 1 : 0;
      const along = build.cell ? (build.rotation === 0 ? build.cell.x : build.cell.z) : 0;
      const layout = layoutOf(view);
      const snapped = snapToWall(
        layout,
        build.kind,
        wall === 0 ? { x: along, z: 0 } : { x: 0, z: along },
        wall,
      );
      // Place prise sur l'autre mur : la fenêtre saute sur la place libre la plus proche.
      const free = nearestValidCell(
        layout,
        view.items,
        { kind: build.kind, rotation: snapped.rotation, ignoreId: build.movingItemId ?? undefined },
        snapped.cell,
      );
      set({ build: { ...build, rotation: snapped.rotation, cell: free ?? snapped.cell } });
      return;
    }
    set({ build: { ...build, rotation: ((build.rotation + 1) % 4) as Rotation } });
  },

  setBuildColor(color) {
    const { build } = get();
    if (!build?.kind) return;
    if (build.fromStock) return; // un objet rangé garde sa couleur (« Peindre » une fois posé)
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
    const layout = layoutOf(view);
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
    // Objet sorti de l'inventaire : la pile de ce type et de cette couleur.
    const stock = build.fromStock
      ? view.inventory.find((stored) => stored.kind === build.kind && stored.color === build.color)
      : undefined;
    if (build.fromStock && !stock) {
      get().cancelPlacement();
      return false;
    }
    const command: GameCommand | null = stock
      ? host
        ? {
            type: 'placeStoredAccessory',
            kind: stock.kind,
            color: stock.color,
            host,
            rotation: build.rotation,
          }
        : {
            type: 'placeStored',
            kind: stock.kind,
            color: stock.color,
            x: cell.x,
            z: cell.z,
            rotation: build.rotation,
          }
      : host
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

    if (stock) {
      // Pose en série depuis l'inventaire : tant qu'il en reste en stock.
      if (stock.count <= 1) {
        notify('build.stopInventory', 'info', { item: name });
        get().cancelPlacement();
        return true;
      }
    }
    // Pose en série : l'objet reste en main tant qu'on peut en acheter un autre.
    const owned =
      view.items.filter((item) => item.kind === build.kind && !item.annexDecor).length +
      view.inventory.reduce((sum, s) => sum + (s.kind === build.kind ? s.count : 0), 0) +
      1;
    if (!stock && (owned >= def.maxCount || view.gauges.treasury - def.price < def.price)) {
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

  setTeamFilters(teamFilters) {
    set({ teamFilters });
  },
}));
