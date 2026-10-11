import { describe, expect, it } from 'vitest';
import {
  CommandSchema,
  DEFAULT_MONITOR,
  FURNITURE_CATALOG,
  GameStateSchema,
  MONITOR_ARM,
  MONITORS,
  monitorEffects,
  monitorPrice,
  type GameState,
} from '@oss/shared';
import { computeOfficeEffects, placeFurniture } from '../../src/simulation/furniture';
import { toGameView } from '../../src/view/adapter';
import { newSimulation, stateWithTeam } from './fixtures';

const gaming = { model: 'gaming', size: 'medium', mount: 'stand' } as const;

function richOffice(seed = 'monitors') {
  const simulation = newSimulation(seed);
  simulation.state.gauges.treasury = 1_000_000;
  const id = placeFurniture(simulation.state, 'desk', 1, 1, 0, 300);
  return { simulation, id };
}

const items = (state: GameState) =>
  toGameView(state, { speed: 1, running: false, card: () => undefined }).items;

describe('Écrans : catalogue', () => {
  it('5 modèles dont un incurvé, 3 tailles de plus en plus chères, textes FR et EN', () => {
    expect(MONITORS).toHaveLength(5);
    expect(MONITORS.map((m) => m.id)).toContain('curved');
    for (const model of MONITORS) {
      expect(model.prices).toEqual([...model.prices].sort((a, b) => a - b));
      expect(model.inches).toEqual([...model.inches].sort((a, b) => a - b));
      expect(model.name.fr && model.name.en && model.description.en).toBeTruthy();
    }
  });

  it('seuls le bureau de dev et le bureau debout ont un écran à choisir', () => {
    const stations = FURNITURE_CATALOG.filter((item) => 'monitor' in item && item.monitor);
    expect(stations.map((item) => item.id).sort()).toEqual(['desk', 'standing-desk']);
  });

  it('l’écran livré n’apporte rien de plus ; le bras coûte un supplément et fatigue moins', () => {
    expect(monitorEffects(DEFAULT_MONITOR)).toEqual({
      productivity: 0,
      quality: 0,
      moral: 0,
      debtPerDay: 0,
      energySaving: 0,
    });
    const arm = { ...gaming, mount: 'arm' } as const;
    expect(monitorPrice(arm)).toBe(monitorPrice(gaming) + MONITOR_ARM.price);
    expect(monitorEffects(arm).energySaving).toBe(MONITOR_ARM.energySaving);
  });
});

describe('Écrans : changer l’écran d’un bureau', () => {
  it('le nouvel écran est payé et gardé sur le bureau', () => {
    const { simulation, id } = richOffice();
    const before = simulation.state.gauges.treasury;
    const { result } = simulation.dispatch({ type: 'SET_MONITOR', furnitureId: id, ...gaming });
    expect(result).toEqual({ ok: true });
    expect(simulation.state.gauges.treasury).toBe(before - monitorPrice(gaming));
    expect(simulation.state.components.furniture[id]?.monitor).toEqual({
      ...gaming,
      price: monitorPrice(gaming),
    });
    expect(items(simulation.state).find((item) => item.id === id)?.monitor).toEqual(gaming);
  });

  it('l’ancien écran est repris à moitié prix ; le même écran est refusé', () => {
    const { simulation, id } = richOffice();
    simulation.dispatch({ type: 'SET_MONITOR', furnitureId: id, ...gaming });
    simulation.state.phase = 'SEED'; // l'incurvé est en vente dès la Seed
    const before = simulation.state.gauges.treasury;
    const curved = { model: 'curved', size: 'large', mount: 'arm' } as const;
    simulation.dispatch({ type: 'SET_MONITOR', furnitureId: id, ...curved });
    expect(simulation.state.gauges.treasury).toBe(
      before - monitorPrice(curved) + monitorPrice(gaming) / 2,
    );
    const again = simulation.dispatch({ type: 'SET_MONITOR', furnitureId: id, ...curved });
    expect(again.result).toEqual({ ok: false, error: 'NOT_ELIGIBLE' });
  });

  it('refuse un meuble sans écran, un modèle pas encore débloqué ou trop cher', () => {
    const { simulation, id } = richOffice();
    const sofa = placeFurniture(simulation.state, 'sofa', 5, 5, 0);
    expect(
      simulation.dispatch({ type: 'SET_MONITOR', furnitureId: sofa, ...gaming }).result,
    ).toEqual({ ok: false, error: 'INVALID_PLACEMENT' });
    // Au garage, l'incurvé n'est pas encore en vente.
    expect(simulation.state.phase).toBe('GARAGE');
    const curved = { model: 'curved', size: 'small', mount: 'stand' } as const;
    expect(simulation.dispatch({ type: 'SET_MONITOR', furnitureId: id, ...curved }).result).toEqual(
      { ok: false, error: 'LOCKED' },
    );
    simulation.state.gauges.treasury = 10;
    expect(simulation.dispatch({ type: 'SET_MONITOR', furnitureId: id, ...gaming }).result).toEqual(
      { ok: false, error: 'NOT_ENOUGH_MONEY' },
    );
    expect(simulation.state.components.furniture[id]?.monitor).toBeUndefined();
  });

  it('l’écran suit le bureau dans l’inventaire, et se revend avec lui', () => {
    const { simulation, id } = richOffice();
    simulation.dispatch({ type: 'SET_MONITOR', furnitureId: id, ...gaming });
    simulation.dispatch({ type: 'STORE_FURNITURE', furnitureId: id });
    expect(simulation.state.inventory[0]?.monitor?.model).toBe('gaming');
    simulation.dispatch({ type: 'PLACE_STORED', itemId: 'desk', x: 3, y: 3, rotation: 0 });
    const placed = Object.entries(simulation.state.components.furniture).find(
      ([, item]) => item.itemId === 'desk' && item.x === 3,
    );
    expect(placed?.[1].monitor?.model).toBe('gaming');
    const before = simulation.state.gauges.treasury;
    simulation.dispatch({ type: 'SELL_FURNITURE', furnitureId: placed![0] });
    expect(simulation.state.gauges.treasury).toBe(before + (300 + monitorPrice(gaming)) / 2);
  });
});

describe('Écrans : effets et compatibilité', () => {
  it('un bureau sans écran choisi garde exactement les effets d’avant', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD']);
    placeFurniture(state, 'desk', 1, 1, 0);
    const effects = computeOfficeEffects(state);
    expect(effects.seatProductivity[ids[0]!]).toBe(0.04);
    expect(effects.seatEnergySaving[ids[0]!]).toBe(0);
  });

  it('l’écran s’ajoute au poste : productivité, moral, et moins de fatigue sur un bras', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD']);
    const desk = placeFurniture(state, 'desk', 1, 1, 0);
    const placed = state.components.furniture[desk]!;
    placed.monitor = { model: 'gaming', size: 'large', mount: 'arm', price: 750 };
    const effects = computeOfficeEffects(state);
    expect(effects.seatProductivity[ids[0]!]).toBeCloseTo(0.04 + 0.03);
    expect(effects.seatEnergySaving[ids[0]!]).toBeCloseTo(MONITOR_ARM.energySaving);
    expect(effects.moral).toBeCloseTo(0.015);
    placed.monitor = { model: 'portrait', size: 'large', mount: 'stand', price: 380 };
    expect(computeOfficeEffects(state).debtPerDay).toBeCloseTo(-0.02);
  });

  it('l’écran et l’ordinateur du poste s’additionnent', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD']);
    const desk = placeFurniture(state, 'desk', 1, 1, 0);
    const placed = state.components.furniture[desk]!;
    placed.monitor = { model: 'curved', size: 'large', mount: 'stand', price: 1300 };
    placed.computer = 'gaming-neon';
    expect(computeOfficeEffects(state).seatProductivity[ids[0]!]).toBeCloseTo(0.04 + 0.05 + 0.01);
  });

  it('les sauvegardes et la commande restent valides (champ optionnel)', () => {
    const { simulation, id } = richOffice();
    simulation.dispatch({ type: 'SET_MONITOR', furnitureId: id, ...gaming });
    const saved = GameStateSchema.parse(JSON.parse(JSON.stringify(simulation.state)));
    expect(saved.components.furniture[id]?.monitor?.model).toBe('gaming');
    const old = JSON.parse(JSON.stringify(simulation.state)) as GameState;
    delete old.components.furniture[id]!.monitor;
    expect(GameStateSchema.parse(old).components.furniture[id]?.monitor).toBeUndefined();
    expect(
      CommandSchema.safeParse({ type: 'SET_MONITOR', furnitureId: id, ...gaming, size: 'huge' })
        .success,
    ).toBe(false);
  });
});
