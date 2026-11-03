import type { DevRole, EventCard, GameMode, GameState } from '@oss/shared';
import { CardLibrary } from '../../src/events/library';
import { generateDev, hireDev } from '../../src/simulation/devs';
import { computeOfficeEffects } from '../../src/simulation/furniture';
import type { SimContext } from '../../src/simulation/helpers';
import { Rng } from '../../src/simulation/rng';
import { Simulation } from '../../src/simulation/simulation';
import { createEmptyState } from '../../src/simulation/state';

/** Générateur « truqué » : renvoie toujours la même valeur (0 = tout arrive, 0.999 = rien). */
export class FixedRng extends Rng {
  constructor(private readonly value: number) {
    super([1, 2, 3, 4]);
  }

  override next(): number {
    return this.value;
  }
}

export function makeContext(
  state: GameState,
  options: { rng?: Rng; cards?: EventCard[] } = {},
): SimContext {
  return {
    rng: options.rng ?? new Rng(state.rng),
    cards: new CardLibrary(options.cards ?? []),
    outbox: [],
    office: computeOfficeEffects(state),
  };
}

/**
 * Retire l'arbre R&D d'une partie : tout le catalogue s'achète. Les tests d'un objet ou d'une
 * pièce testent cet objet, pas l'arbre (vérifié à part dans `research.test.ts`).
 */
export function openCatalogue<T extends GameState>(state: T): T {
  state.research = null;
  return state;
}

/** État vide avec une équipe choisie (sans tirage de candidats ni backlog). */
export function stateWithTeam(
  roles: DevRole[],
  mode: GameMode = 'NORMAL',
): { state: GameState; ids: string[] } {
  const state = openCatalogue(createEmptyState({ seed: 'fixture', mode }));
  state.phase = 'SERIES_A';
  const ctx = makeContext(state);
  const ids = roles.map((role) => {
    const profile = generateDev(ctx.rng, role);
    return hireDev(state, ctx, profile, profile.askingSalary);
  });
  return { state, ids };
}

export function newSimulation(
  seed = 'test',
  mode: GameMode = 'NORMAL',
  cards?: EventCard[],
): Simulation {
  const simulation = Simulation.create({ seed, mode }, new CardLibrary(cards ?? []));
  openCatalogue(simulation.state);
  return simulation;
}

/** Une carte minimale pour les tests. */
export function testCard(overrides: Partial<EventCard> = {}): EventCard {
  return {
    id: 'test-card',
    title: { fr: 'Titre', en: 'Title' },
    description: { fr: 'Description', en: 'Description' },
    conditions: {},
    weight: 10,
    cooldownSprints: 0,
    choices: [
      { label: { fr: 'A', en: 'A' }, effects: { hype: 5 } },
      { label: { fr: 'B', en: 'B' }, effects: { debt: 5 } },
    ],
    ...overrides,
  };
}
