/**
 * État de l'interface en jeu (Zustand).
 *
 * L'interface lit le dernier instantané (`view`) et envoie des commandes typées via `dispatch`.
 * La partie tourne dans le Web Worker de la simulation ; `GameSource` (view/source.ts) fait le
 * lien et convertit chaque snapshot en `GameView`.
 */
import type { GameMode, LocalizedText, NotificationKind } from '@oss/shared';
import { create } from 'zustand';
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
};

export type NotificationListener = (notifications: readonly GameNotification[]) => void;

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
  start(options?: { seed?: string; mode?: GameMode; source?: GameSource }): Promise<void>;
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

/** Graine aléatoire d'une partie normale (le mode Daily fournira la graine du jour). */
function randomSeed(): string {
  return Math.floor(Math.random() * 2 ** 31).toString(36);
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

  async start(options = {}) {
    get().quit();
    set({ loading: true });
    // Import dynamique : la simulation n'est chargée qu'au lancement d'une partie.
    const source: GameSource =
      options.source ??
      (await import('../../view/source').then(({ EngineSource }) =>
        EngineSource.start({ seed: options.seed ?? randomSeed(), mode: options.mode ?? 'NORMAL' }),
      ));
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
    set({ source, view: source.view, loading: false, panel: null, selected: null, build: null });
  },

  quit() {
    unsubscribeSource?.();
    unsubscribeSource = null;
    get().source?.dispose();
    set({ source: null, view: null, panel: null, selected: null, build: null, toast: null });
  },

  async dispatch(command) {
    const { source } = get();
    if (!source) return { ok: false, reason: 'noGame' };
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
