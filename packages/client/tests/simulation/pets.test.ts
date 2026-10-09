import { describe, expect, it } from 'vitest';
import {
  FURNITURE_CATALOG,
  GameStateSchema,
  PET_NAMES,
  PETS,
  getFurniture,
  type Command,
  type GameState,
} from '@oss/shared';
import { CardLibrary } from '../../src/events/library';
import { canPlace, computeOfficeEffects } from '../../src/simulation/furniture';
import { petEffects } from '../../src/simulation/pets';
import { replay } from '../../src/simulation/replay';
import type { Simulation } from '../../src/simulation/simulation';
import { toGameView } from '../../src/view/adapter';
import { newSimulation } from './fixtures';

/** Startup riche, en planification, au garage. */
function richGarage(seed = 'pets'): Simulation {
  const simulation = newSimulation(seed);
  simulation.state.gauges.treasury = 1_000_000;
  return simulation;
}

/** Achète un objet et le pose sur la première case libre. */
function buyAnywhere(simulation: Simulation, itemId: string): Command {
  const item = getFurniture(itemId);
  if (!item) throw new Error(`objet inconnu : ${itemId}`);
  for (let y = 0; y < 30; y++)
    for (let x = 0; x < 30; x++) {
      if (!canPlace(simulation.state, item, x, y, 0)) continue;
      const command: Command = { type: 'BUY_FURNITURE', itemId, x, y, rotation: 0 };
      expect(simulation.dispatch(command).result).toEqual({ ok: true });
      return command;
    }
  throw new Error(`pas de place pour ${itemId}`);
}

function equip(simulation: Simulation): void {
  buyAnywhere(simulation, 'litter-open');
  buyAnywhere(simulation, 'cat-bowl');
  buyAnywhere(simulation, 'cat-tree-small');
}

const view = (state: GameState) =>
  toGameView(state, { speed: 1, running: false, card: () => undefined }).pets;

describe('Animaux : équipement', () => {
  it('3 litières, 3 arbres à chat de 1, 2 et 3 cases, 2 gamelles, du moins cher au plus cher', () => {
    const byNeed = (need: string) =>
      FURNITURE_CATALOG.filter((item) => 'petNeed' in item && item.petNeed === need);
    const litters = byNeed('litter');
    expect(litters.map((item) => item.id)).toEqual([
      'litter-open',
      'litter-covered',
      'litter-robot',
    ]);
    expect(litters.map((item) => item.price)).toEqual(
      [...litters.map((i) => i.price)].sort((a, b) => a - b),
    );
    const trees = byNeed('tree');
    expect(trees.map((item) => item.width * item.depth)).toEqual([1, 2, 3]);
    expect(byNeed('bowl')).toHaveLength(2);
  });
});

describe('Animaux : adoption', () => {
  it('refuse l’adoption tant que litière, gamelle et arbre à chat ne sont pas posés', () => {
    const simulation = richGarage();
    expect(view(simulation.state).blocker).toBe('NOT_ELIGIBLE');
    buyAnywhere(simulation, 'litter-covered');
    buyAnywhere(simulation, 'cat-feeder');
    expect(simulation.dispatch({ type: 'ADOPT_PET', coat: 'black' }).result).toEqual({
      ok: false,
      error: 'NOT_ELIGIBLE',
    });
    expect(view(simulation.state).needs).toEqual({ litter: true, bowl: true, tree: false });
    buyAnywhere(simulation, 'cat-tree-medium');
    expect(view(simulation.state).blocker).toBeNull();
  });

  it('coûte cher, donne un nom au chat et en accepte au plus 5', () => {
    const simulation = richGarage();
    equip(simulation);
    const before = simulation.state.gauges.treasury;
    expect(simulation.dispatch({ type: 'ADOPT_PET', coat: 'tabby' }).result).toEqual({ ok: true });
    expect(simulation.state.gauges.treasury).toBe(before - PETS.price);
    expect(PETS.price).toBeGreaterThanOrEqual(5000);
    const [cat] = simulation.state.pets;
    expect(cat).toMatchObject({ id: 'cat-1', coat: 'tabby', adoptedSprint: 1 });
    expect(PET_NAMES).toContain(cat?.name);
    for (let i = 1; i < PETS.max; i++)
      expect(simulation.dispatch({ type: 'ADOPT_PET', coat: 'white' }).result.ok).toBe(true);
    const names = simulation.state.pets.map((pet) => pet.name);
    expect(new Set(names).size).toBe(PETS.max);
    expect(simulation.dispatch({ type: 'ADOPT_PET', coat: 'white' }).result).toEqual({
      ok: false,
      error: 'NOT_ELIGIBLE',
    });
  });

  it('refuse sans trésorerie, et l’objet rangé ne compte pas', () => {
    const simulation = richGarage();
    equip(simulation);
    simulation.state.gauges.treasury = PETS.price - 1;
    expect(view(simulation.state).blocker).toBe('NOT_ENOUGH_MONEY');
    simulation.state.gauges.treasury = 1_000_000;
    const tree = Object.entries(simulation.state.components.furniture).find(
      ([, item]) => item.itemId === 'cat-tree-small',
    )?.[0];
    expect(tree).toBeDefined();
    simulation.dispatch({ type: 'STORE_FURNITURE', furnitureId: tree ?? '' });
    expect(view(simulation.state).needs.tree).toBe(false);
    expect(view(simulation.state).blocker).toBe('NOT_ELIGIBLE');
  });
});

describe('Animaux : effets et départ', () => {
  it('un chat heureux donne du moral et de la hype ; sans équipement, il boude', () => {
    const simulation = richGarage();
    equip(simulation);
    const without = computeOfficeEffects(simulation.state);
    simulation.dispatch({ type: 'ADOPT_PET', coat: 'ginger' });
    const happy = computeOfficeEffects(simulation.state);
    expect(happy.moral - without.moral).toBeCloseTo(PETS.happy.moral);
    expect(happy.hypePerDay - without.hypePerDay).toBeCloseTo(PETS.happy.hypePerDay);
    expect(happy.teamProductivity).toBeLessThan(without.teamProductivity);
    // On revend la litière : le chat boude.
    const litter = Object.entries(simulation.state.components.furniture).find(
      ([, item]) => item.itemId === 'litter-open',
    )?.[0];
    simulation.dispatch({ type: 'SELL_FURNITURE', furnitureId: litter ?? '' });
    expect(petEffects(simulation.state).moral).toBeLessThan(0);
    expect(view(simulation.state).happy).toBe(false);
  });

  it('confier un chat à une famille : pas de remboursement, l’équipe a un coup de blues', () => {
    const simulation = richGarage();
    equip(simulation);
    simulation.dispatch({ type: 'ADOPT_PET', coat: 'siamese' });
    const money = simulation.state.gauges.treasury;
    for (const mood of Object.values(simulation.state.components.mood)) mood.moral = 50;
    expect(simulation.dispatch({ type: 'REHOME_PET', petId: 'cat-1' }).result).toEqual({
      ok: true,
    });
    expect(simulation.state.pets).toHaveLength(0);
    expect(simulation.state.gauges.treasury).toBe(money);
    const after = Object.values(simulation.state.components.mood).map((mood) => mood.moral);
    expect(after.length).toBeGreaterThan(0);
    for (const value of after) expect(value).toBe(50 + PETS.rehomeMoral);
    expect(simulation.dispatch({ type: 'REHOME_PET', petId: 'cat-1' }).result).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
  });
});

describe('Animaux : sauvegardes et replays', () => {
  it('une sauvegarde d’avant les chats se recharge sans chat', () => {
    const old = JSON.parse(JSON.stringify(newSimulation('old').state)) as Record<string, unknown>;
    delete old.pets;
    delete (old.stats as Record<string, unknown>).petsAdopted;
    const parsed = GameStateSchema.parse(old);
    expect(parsed.pets).toEqual([]);
    expect(parsed.stats.petsAdopted).toBe(0);
  });

  it('adopter ne touche pas au RNG de la partie et se rejoue à l’identique', () => {
    const simulation = richGarage('pets-replay');
    const rng = [...simulation.state.rng];
    equip(simulation);
    simulation.dispatch({ type: 'ADOPT_PET', coat: 'calico' });
    expect(simulation.state.rng).toEqual(rng);
    // Rejeu : mêmes commandes, même chat (le trésor de départ fait partie de l'état de test).
    const replayed = replay({
      seed: 'pets-replay',
      mode: 'NORMAL',
      commands: [],
      cards: new CardLibrary([]),
    });
    replayed.state.gauges.treasury = 1_000_000;
    for (const entry of simulation.commands) replayed.dispatch(entry.command);
    expect(replayed.state.pets).toEqual(simulation.state.pets);
  });
});
