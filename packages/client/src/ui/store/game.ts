/**
 * État de l'interface en jeu (Zustand).
 *
 * L'interface lit le dernier instantané (`view`) et envoie des commandes typées via `dispatch`.
 * La partie tourne dans le Web Worker de la simulation ; `GameSource` (view/source.ts) fait le
 * lien et convertit chaque snapshot en `GameView`.
 */
import {
  dailySeed,
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
import type { PickTarget } from '../../render/GameRenderer';
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
  'build',
  'dashboard',
  'slack',
  'saves',
  'settings',
  'credits',
] as const;
export type PanelId = (typeof PANELS)[number];

export interface BuildState {
  readonly kind: string | null;
  readonly rotation: Rotation;
  /** Objet existant en cours de déplacement. */
  readonly movingItemId: string | null;
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
  RUST_CONVERT: 'info',
  FUNDS_RAISED: 'success',
  PITCH_FAILED: 'error',
  PHASE_UP: 'success',
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
function randomSeed(): string {
  return Math.floor(Math.random() * 2 ** 31).toString(36);
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

  notify(key, tone = 'info', params) {
    set({ toast: { id: ++toastId, key, tone, params } });
  },

  setFps(fps) {
    set({ fps });
  },
}));
