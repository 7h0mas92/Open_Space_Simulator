import { getFurniture, type DevRole, type GameMode, type Phase } from '@oss/shared';
import { createGameEngine, InlineWorker } from '../../../src/engine';
import { DEFAULT_CARDS, defaultCardLibrary } from '../../../src/events/defaultCards';
import { generateDev, hireDev } from '../../../src/simulation/devs';
import { computeOfficeEffects, placeFurniture } from '../../../src/simulation/furniture';
import { Rng } from '../../../src/simulation/rng';
import { Simulation } from '../../../src/simulation/simulation';
import { toGameView } from '../../../src/view/adapter';
import { EngineSource } from '../../../src/view/source';
import type { GameView } from '../../../src/view/types';

export interface OfficeOptions {
  readonly seed?: string;
  readonly mode?: GameMode;
  readonly phase?: Phase;
  /** Devs ajoutés à l'équipe de départ (un premier dev au garage). */
  readonly extraRoles?: readonly DevRole[];
  /**
   * Mobilier ajouté au mobilier de départ. Un accessoire (l'électroménager…) se pose sur l'objet
   * listé juste avant lui, au premier emplacement libre.
   */
  readonly furniture?: readonly { kind: string; x: number; z: number; rotation?: number }[];
}

/**
 * Une vraie partie (la simulation, pas une maquette), préparée pour les tests : on choisit la
 * phase, l'équipe et le mobilier sans jouer les sprints qui y mènent.
 */
export function officeSimulation(options: OfficeOptions = {}): Simulation {
  const simulation = Simulation.create(
    { seed: options.seed ?? 'tests', mode: options.mode ?? 'NORMAL' },
    defaultCardLibrary(),
  );
  const { state } = simulation;
  state.phase = options.phase ?? 'SEED';
  const ctx = {
    rng: new Rng([11, 22, 33, 44]),
    cards: defaultCardLibrary(),
    outbox: [],
    office: computeOfficeEffects(state),
  };
  for (const role of options.extraRoles ?? []) {
    const profile = generateDev(ctx.rng, role);
    hireDev(state, ctx, profile, profile.askingSalary);
  }
  let previous: string | undefined;
  for (const item of options.furniture ?? []) {
    const id = placeFurniture(state, item.kind, item.x, item.z, item.rotation ?? 0);
    const placed = state.components.furniture[id];
    if (getFurniture(item.kind)?.accessory && previous && placed) {
      placed.hostId = previous;
      placed.slot = Object.values(state.components.furniture).filter(
        (other) => other.hostId === previous && other !== placed,
      ).length;
    } else previous = id;
  }
  return simulation;
}

/** Le bureau de la phase Seed utilisé par la plupart des tests : 4 devs, 5 bureaux, une cuisine. */
export const SEED_OFFICE: OfficeOptions = {
  phase: 'SEED',
  extraRoles: ['PRODUCT_OWNER', 'GHOST', 'INTERN'],
  furniture: [
    { kind: 'desk', x: 4, z: 1 },
    { kind: 'desk', x: 4, z: 3 },
    { kind: 'desk', x: 1, z: 6 },
    { kind: 'kitchen-drawers', x: 12, z: 1 },
    { kind: 'espresso-machine', x: 12, z: 1 },
  ],
};

export function viewOf(simulation: Simulation): GameView {
  return toGameView(simulation.state, {
    speed: 1,
    running: simulation.isRunning,
    card: (id) => DEFAULT_CARDS.find((card) => card.id === id),
  });
}

/**
 * Source de partie branchée sur un moteur sans thread ni minuterie : le temps n'avance que
 * quand le test appelle `worker.frame()`.
 */
export async function testSource(simulation: Simulation) {
  const worker = new InlineWorker({ autoStart: false });
  const source = await EngineSource.start(
    { save: { state: structuredClone(simulation.state), commands: [] } },
    { engine: createGameEngine(worker) },
  );
  return { source, worker };
}
