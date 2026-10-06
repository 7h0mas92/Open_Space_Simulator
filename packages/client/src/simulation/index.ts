/**
 * API publique de la simulation. Le moteur (Web Worker), le script d'équilibrage et,
 * plus tard, le serveur (vérification des scores) n'importent que depuis ce fichier.
 */
export { Simulation, SYSTEMS, type DispatchResult, type System } from './simulation';
export { checkAchievements, unlockAchievement } from './achievements';
export { replay, ReplayError, type ReplayOptions } from './replay';
export { createEmptyState, type GameConfig } from './state';
export { Rng, seedToState, type RngState } from './rng';
export { clockAt, getClock, type SimClock } from './time';
export {
  computeValuation,
  monthlyExpenses,
  monthlyPayroll,
  monthlyRevenue,
  runwayMonths,
} from './economy';
export { acceptanceChance } from './devs';
export {
  canPlace,
  computeOfficeEffects,
  phaseIndex,
  RESALE_RATIO,
  type OfficeEffects,
} from './furniture';
export { tasksInColumn } from './tasks';
export { devIds, teamMax, teamMoral, teamSize, formatMoney } from './helpers';
export { CardLibrary } from '../events/library';
export { DEFAULT_CARDS, defaultCardLibrary } from '../events/defaultCards';
export {
  BOT_NAMES,
  createBot,
  playWithBot,
  scoreEffects,
  findFreeSpot,
  type Bot,
  type BotName,
} from './bots';
