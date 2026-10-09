import {
  PHASES,
  RECENT_TASK_TITLES_MAX,
  hashString,
  seasonsAt,
  type GameState,
  type TaskTrade,
  type TaskType,
} from '@oss/shared';
import {
  DESIGN_EXTRA_TITLES,
  DESIGN_TASKS,
  GROWTH_TASK_TITLES,
  PRODUCT_EXTRA_TITLES,
  PRODUCT_TASKS,
  SEASON_TASK_TITLES,
  TASK_TITLES,
  type GrowthPhase,
  type TradeTaskTemplate,
  type TradeTitles,
} from './data/tasks';
import { calendarDay } from './systems/calendar';
import { getClock } from './time';

/**
 * Choix du titre d'une nouvelle tâche du backlog. Le titre est purement décoratif : il ne
 * change ni la taille, ni le type, ni l'effet de la tâche. On évite donc les répétitions sans
 * consommer de tirage en plus dans le générateur de la partie (replays et Daily inchangés).
 *
 * - Le catalogue grandit avec la phase (`GROWTH_TASK_TITLES`).
 * - Pendant une période du calendrier, environ une tâche de code sur trois est de saison.
 * - Un titre déjà sur le tableau, ou proposé récemment, n'est pas repris tant qu'il en reste
 *   d'autres.
 */

type TitlePair = readonly [string, string];

/** Part des tâches de code qui prennent le titre de saison, pendant la période. */
export const SEASON_TITLE_CHANCE = 1 / 3;

const GROWTH_PHASES: readonly GrowthPhase[] = ['SEED', 'SERIES_A', 'UNICORN'];

/** Nombre dans [0, 1) tiré d'une clé : stable, sans toucher au générateur de la partie. */
function hashRoll(key: string): number {
  return hashString(key) / 4294967296;
}

function tradeTitles(templates: readonly TradeTaskTemplate[], extra: TradeTitles, type: TaskType) {
  return [
    ...templates.filter((template) => template.type === type).map((template) => template.title),
    ...(extra[type] ?? []),
  ];
}

/** Tous les titres possibles pour ce métier et ce type, compte tenu de la phase atteinte. */
export function titlePool(state: GameState, trade: TaskTrade, type: TaskType): TitlePair[] {
  if (trade === 'DESIGN') return tradeTitles(DESIGN_TASKS, DESIGN_EXTRA_TITLES, type);
  if (trade === 'PRODUCT') return tradeTitles(PRODUCT_TASKS, PRODUCT_EXTRA_TITLES, type);
  const reached = PHASES.indexOf(state.phase);
  const growth = GROWTH_PHASES.filter((phase) => PHASES.indexOf(phase) <= reached).flatMap(
    (phase) => GROWTH_TASK_TITLES[phase][type],
  );
  return [...TASK_TITLES[type], ...growth];
}

/** Titres (en français) des tâches encore sur le tableau, toutes colonnes confondues. */
function titlesOnBoard(state: GameState): Set<string> {
  const titles = new Set<string>();
  for (const id in state.components.task) {
    const task = state.components.task[id];
    if (task) titles.add(task.title.fr);
  }
  return titles;
}

/** Titre de saison du jour pour ce type, s'il y en a un qui n'a pas déjà servi récemment. */
function seasonTitle(state: GameState, type: TaskType, used: Set<string>): TitlePair | null {
  const days = calendarDay(state, getClock(state).day);
  const key = `${state.seed}#task-title#${state.nextEntityId}`;
  if (hashRoll(`${key}#season`) >= SEASON_TITLE_CHANCE) return null;
  const titles = seasonsAt(days)
    .map((theme) => SEASON_TASK_TITLES[theme][type])
    .filter((title) => !used.has(title[0]));
  if (titles.length === 0) return null;
  return titles[Math.floor(hashRoll(`${key}#theme`) * titles.length)] ?? null;
}

/**
 * Choisit le titre d'une tâche. `roll` (dans [0, 1)) désigne le titre parmi ceux encore
 * neufs : pour le code, c'est le tirage qu'utilisait déjà l'ancien `rng.pick`.
 */
export function pickTaskTitle(
  state: GameState,
  trade: TaskTrade,
  type: TaskType,
  roll: number,
): TitlePair {
  const onBoard = titlesOnBoard(state);
  const used = new Set([...onBoard, ...state.recentTaskTitles]);
  const seasonal = trade === 'DEV' ? seasonTitle(state, type, used) : null;
  const pool = titlePool(state, trade, type);
  const notOnBoard = pool.filter((title) => !onBoard.has(title[0]));
  const fresh = notOnBoard.filter((title) => !used.has(title[0]));
  const choices = fresh.length > 0 ? fresh : notOnBoard.length > 0 ? notOnBoard : pool;
  const title = seasonal ?? choices[Math.floor(roll * choices.length)] ?? pool[0];
  if (!title) throw new Error(`Aucun titre de tâche pour ${trade} / ${type}`);
  rememberTitle(state, title[0]);
  return title;
}

/** Ajoute un titre à la mémoire des titres récents (les plus anciens sont oubliés). */
function rememberTitle(state: GameState, title: string): void {
  const recent = state.recentTaskTitles.filter((known) => known !== title);
  recent.push(title);
  state.recentTaskTitles = recent.slice(-RECENT_TASK_TITLES_MAX);
}

/** Tirage du titre d'une tâche hors code, tiré de la graine (le type a déjà pris le tirage). */
export function tradeTitleRoll(state: GameState): number {
  return hashRoll(`${state.seed}#task-title#${state.nextEntityId}#pick`);
}
