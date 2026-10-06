/** API publique du moteur (thread principal). */
export {
  createGameEngine,
  InlineWorker,
  type GameEngine,
  type SnapshotListener,
  type WorkerLike,
} from './bridge';
export { GameClock, MAX_TICKS_PER_FRAME, TICK_MS_AT_X1, isSpeed } from './clock';
export { SnapshotBuffer, lerp } from './interpolation';
export type { EngineSnapshot, GameStart, MainToWorker, WorkerToMain } from './protocol';
export { SimulationHost } from './host';
