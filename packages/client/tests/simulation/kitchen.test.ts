import { GameStateSchema, INVENTORY_MAX, type GameState } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { defaultCardLibrary } from '../../src/events/defaultCards';
import { computeOfficeEffects, findFreeSlot } from '../../src/simulation/furniture';
import { migrateLegacyKitchen } from '../../src/simulation/kitchen';
import { Simulation } from '../../src/simulation/simulation';
import { newSimulation } from './fixtures';

/** Identifiant de l'objet posé de ce type (le premier trouvé). */
function idOf(state: GameState, itemId: string): string {
  const entry = Object.entries(state.components.furniture).find(([, f]) => f.itemId === itemId);
  if (!entry) throw new Error(`${itemId} absent`);
  return entry[0];
}

describe('Cuisine : meubles et électroménager séparés', () => {
  it('au garage, la cafetière est posée sur un bureau IKEA, pas au sol', () => {
    const { state } = newSimulation('garage-coffee');
    const coffee = state.components.furniture[idOf(state, 'drip-coffee-maker')]!;
    expect(coffee.hostId).toBeDefined();
    expect(state.components.furniture[coffee.hostId!]?.itemId).toBe('ikea-desk');
    expect(computeOfficeEffects(state).coffeeRestock).toBe(25);
  });

  it('un appareil se pose sur un meuble de cuisine, jamais au sol ni sur un bureau', () => {
    const simulation = newSimulation('kitchen-buy');
    const { state } = simulation;
    state.gauges.treasury = 1_000_000;
    const buy = (itemId: string, x: number, y: number) =>
      simulation.dispatch({ type: 'BUY_FURNITURE', itemId, x, y, rotation: 0 }).result;
    const onTop = (itemId: string, hostId: string, slot: number) =>
      simulation.dispatch({ type: 'BUY_ACCESSORY', itemId, hostId, slot, rotation: 0 }).result;

    // Pas d'appareil au sol.
    expect(buy('microwave-oven', 6, 0)).toEqual({ ok: false, error: 'INVALID_PLACEMENT' });
    // Le bureau de dev n'a pas de place pour l'électroménager, mais un mug y va.
    expect(buy('desk', 4, 4).ok).toBe(true);
    const desk = idOf(state, 'desk');
    expect(onTop('microwave-oven', desk, 0)).toEqual({ ok: false, error: 'INVALID_PLACEMENT' });
    expect(onTop('coffee-mug', desk, 0).ok).toBe(true);

    // Sur le meuble bas : deux appareils côte à côte, pas de troisième place.
    expect(buy('kitchen-doors', 6, 0).ok).toBe(true);
    const cabinet = idOf(state, 'kitchen-doors');
    expect(onTop('microwave-oven', cabinet, 0).ok).toBe(true);
    expect(onTop('kettle', cabinet, 1).ok).toBe(true);
    expect(onTop('espresso-machine', cabinet, 2)).toEqual({
      ok: false,
      error: 'INVALID_PLACEMENT',
    });
    const effects = computeOfficeEffects(state);
    expect(effects.restBonus).toBeCloseTo(0.5);
    expect(effects.coffeeRestock).toBe(25 + 6 + 2); // cafetière, bouilloire, mug
  });

  it('un meuble déplacé ou revendu emporte ses appareils', () => {
    const simulation = newSimulation('kitchen-move');
    const { state } = simulation;
    state.gauges.treasury = 1_000_000;
    simulation.dispatch({ type: 'BUY_FURNITURE', itemId: 'kitchen-sink', x: 5, y: 0, rotation: 0 });
    const sink = idOf(state, 'kitchen-sink');
    simulation.dispatch({
      type: 'BUY_ACCESSORY',
      itemId: 'espresso-machine',
      hostId: sink,
      slot: 1,
      rotation: 0,
    });
    expect(
      simulation.dispatch({ type: 'MOVE_FURNITURE', furnitureId: sink, x: 5, y: 4, rotation: 0 })
        .result.ok,
    ).toBe(true);
    expect(state.components.furniture[idOf(state, 'espresso-machine')]).toMatchObject({
      x: 5,
      y: 4,
      hostId: sink,
    });
    const cash = state.gauges.treasury;
    simulation.dispatch({ type: 'SELL_FURNITURE', furnitureId: sink });
    expect(state.gauges.treasury).toBe(cash + (650 + 2500) / 2);
  });

  it('trouve une place libre pour un appareil (joueurs automatiques)', () => {
    const { state } = newSimulation('kitchen-slot');
    const coffeeDesk = state.components.furniture[idOf(state, 'drip-coffee-maker')]!.hostId;
    // Chaque bureau IKEA a une place d'appareil : celle du second est prise par la cafetière.
    const free = findFreeSlot(state, 'microwave-oven');
    expect(free?.slot).toBe(0);
    expect(free?.hostId).not.toBe(coffeeDesk);
    expect(state.components.furniture[free!.hostId]?.itemId).toBe('ikea-desk');
    state.components.furniture[free!.hostId] = {
      ...state.components.furniture[free!.hostId]!,
      itemId: 'desk',
    };
    expect(findFreeSlot(state, 'microwave-oven')).toBeNull();
  });
});

describe('Vieilles sauvegardes de la cuisine', () => {
  /** Une partie sauvegardée avant la cuisine séparée : combinés au sol et dans l'inventaire. */
  function legacySave(): GameState {
    const { state } = newSimulation('legacy-kitchen');
    // Le garage d'avant : la cafetière d'un seul bloc au sol, en (7, 0).
    state.components.furniture = Object.fromEntries(
      Object.entries(state.components.furniture).filter(
        ([, item]) => item.itemId !== 'drip-coffee-maker',
      ),
    );
    const add = (itemId: string, x: number, price: number, color?: 'red') => {
      const id = `e${state.nextEntityId++}`;
      state.components.furniture[id] = {
        itemId,
        x,
        y: 0,
        rotation: 1,
        purchasePrice: price,
        ...(color ? { color } : {}),
      };
    };
    add('coffee-machine', 7, 0);
    add('premium-coffee-machine', 6, 2500, 'red');
    add('microwave', 5, 120);
    state.inventory.push({ itemId: 'microwave', purchasePrice: 120, color: 'red' });
    return GameStateSchema.parse(JSON.parse(JSON.stringify(state)));
  }

  it('chaque combiné devient un meuble de cuisine et son appareil, au même endroit', () => {
    const state = legacySave();
    // Avant la migration, les anciens identifiants ne sont plus reconnus : aucun effet.
    const before = computeOfficeEffects(state);
    expect(migrateLegacyKitchen(state)).toBe(4);
    const items = Object.values(state.components.furniture);
    for (const id of ['coffee-machine', 'premium-coffee-machine', 'microwave'])
      expect(items.some((item) => item.itemId === id)).toBe(false);

    const espresso = state.components.furniture[idOf(state, 'espresso-machine')]!;
    const cabinet = state.components.furniture[espresso.hostId!]!;
    expect(cabinet).toMatchObject({
      itemId: 'kitchen-drawers',
      x: 6,
      y: 0,
      rotation: 1,
      color: 'red',
      purchasePrice: 0,
    });
    expect(espresso).toMatchObject({ x: 6, y: 0, slot: 0, purchasePrice: 2500 });
    expect(items.filter((item) => item.itemId === 'kitchen-doors')).toHaveLength(2);

    // Même effet que les anciens combinés (cafetière +25 café, machine premium +50 café et
    // +0,15 moral, micro-ondes +0,1 moral et +0,5 récupération), plus le léger +moral des meubles.
    const after = computeOfficeEffects(state);
    expect(after.coffeeRestock - before.coffeeRestock).toBe(25 + 50);
    expect(after.restBonus - before.restBonus).toBeCloseTo(0.5);
    expect(after.moral - before.moral).toBeCloseTo(0.15 + 0.1 + 3 * 0.02);

    // Dans l'inventaire : l'appareil rangé, plus son meuble.
    expect(state.inventory.slice(-2)).toEqual([
      { itemId: 'microwave-oven', purchasePrice: 120 },
      { itemId: 'kitchen-doors', purchasePrice: 0, color: 'red' },
    ]);
    // L'état reste valide, et une deuxième passe ne change plus rien.
    expect(GameStateSchema.safeParse(state).success).toBe(true);
    expect(migrateLegacyKitchen(state)).toBe(0);
  });

  it('se fait au chargement de la partie, sans place perdue dans un inventaire plein', () => {
    const state = legacySave();
    while (state.inventory.length < INVENTORY_MAX)
      state.inventory.push({ itemId: 'plant', purchasePrice: 60 });
    const simulation = Simulation.restore(state, defaultCardLibrary());
    expect(simulation.state.inventory).toHaveLength(INVENTORY_MAX);
    expect(simulation.state.inventory.some((item) => item.itemId === 'microwave-oven')).toBe(true);
    expect(
      Object.values(simulation.state.components.furniture).some(
        (item) => item.itemId === 'coffee-machine',
      ),
    ).toBe(false);
  });
});
