/**
 * État de l'interface en jeu (Zustand).
 *
 * L'interface lit le dernier instantané (`view`) et envoie des commandes typées via `dispatch`.
 * La source de la partie est derrière l'interface `GameSource` : aujourd'hui la fausse partie
 * (`view/mock.ts`), demain le pont vers le Web Worker de la simulation.
 */
import type { Phase } from '@oss/shared';
import { create } from 'zustand';
import type { PickTarget } from '../../render/GameRenderer';
import { MockGame } from '../../view/mock';
import type { CommandResult, GameCommand, GameView, Rotation } from '../../view/types';

/** Ce dont l'interface a besoin d'une partie en cours. */
export interface GameSource {
  readonly view: GameView;
  advance(realSeconds: number): number;
  dispatch(command: GameCommand): CommandResult;
}

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
  readonly key: string;
  readonly params?: Record<string, string | number>;
  readonly tone: 'info' | 'error' | 'success';
}

interface GameStore {
  source: GameSource | null;
  view: GameView | null;
  panel: PanelId | null;
  selected: PickTarget | null;
  build: BuildState | null;
  toast: Toast | null;
  fps: number;
  start(seed?: number, phase?: Phase): void;
  quit(): void;
  /** Avance la partie (appelé à chaque frame par l'écran de jeu). */
  advance(realSeconds: number): void;
  dispatch(command: GameCommand): CommandResult;
  openPanel(panel: PanelId | null): void;
  select(target: PickTarget | null): void;
  setBuild(build: BuildState | null): void;
  notify(key: string, tone?: Toast['tone'], params?: Toast['params']): void;
  setFps(fps: number): void;
}

let toastId = 0;

export const useGame = create<GameStore>((set, get) => ({
  source: null,
  view: null,
  panel: null,
  selected: null,
  build: null,
  toast: null,
  fps: 0,

  start(seed = Math.floor(Math.random() * 2 ** 31), phase = 'SEED') {
    const source = new MockGame(seed, phase);
    set({ source, view: source.view, panel: null, selected: null, build: null });
  },

  quit() {
    set({ source: null, view: null, panel: null, selected: null, build: null });
  },

  advance(realSeconds) {
    const { source } = get();
    if (source && source.advance(realSeconds) > 0) set({ view: source.view });
  },

  dispatch(command) {
    const { source } = get();
    if (!source) return { ok: false, reason: 'noGame' };
    const result = source.dispatch(command);
    set({ view: source.view });
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
