import { COMPUTERS, GameStateSchema, getComputer, getFurniture } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { canPlace, computeOfficeEffects } from '../../src/simulation/furniture';
import { viewOf } from '../unit/fixtures/game';
import { newSimulation } from './fixtures';

/** Pose un bureau de dev sur la première place libre et renvoie son identifiant. */
function buyDesk(simulation: ReturnType<typeof newSimulation>): string {
  const desk = getFurniture('desk')!;
  for (let y = 0; y < 12; y += 1)
    for (let x = 0; x < 12; x += 1)
      if (canPlace(simulation.state, desk, x, y, 0)) {
        const before = new Set(Object.keys(simulation.state.components.furniture));
        expect(
          simulation.dispatch({ type: 'BUY_FURNITURE', itemId: 'desk', x, y, rotation: 0 }).result,
        ).toEqual({ ok: true });
        return Object.keys(simulation.state.components.furniture).find((id) => !before.has(id))!;
      }
  throw new Error('aucune place libre');
}

describe('ordinateurs des postes de travail', () => {
  it('propose une tour sobre, trois tours gaming et un portable qui remplace le clavier', () => {
    expect(COMPUTERS.map((c) => c.id)).toEqual([
      'tower',
      'gaming-neon',
      'gaming-liquid',
      'gaming-titan',
      'pro-laptop',
    ]);
    expect(COMPUTERS.filter((c) => c.laptop).map((c) => c.id)).toEqual(['pro-laptop']);
    expect(getComputer(undefined)).toMatchObject({ id: 'tower', price: 0, effects: {} });
  });

  it("un bureau neuf a la tour sobre, qu'on remplace en payant la différence", () => {
    const simulation = newSimulation('computers');
    const deskId = buyDesk(simulation);
    const desk = () => simulation.state.components.furniture[deskId]!;
    expect(desk().computer).toBeUndefined();
    expect(viewOf(simulation).items.find((i) => i.id === deskId)?.computer).toBe('tower');
    const cash = simulation.state.gauges.treasury;
    const set = (computer: 'tower' | 'gaming-neon' | 'pro-laptop') =>
      simulation.dispatch({ type: 'SET_COMPUTER', furnitureId: deskId, computer }).result;

    expect(set('gaming-neon')).toEqual({ ok: true });
    expect(desk().computer).toBe('gaming-neon');
    expect(simulation.state.gauges.treasury).toBe(cash - 900);
    expect(desk().purchasePrice).toBe(300 + 900);

    // L'ancien est revendu à moitié prix, le nouveau payé.
    expect(set('pro-laptop')).toEqual({ ok: true });
    expect(simulation.state.gauges.treasury).toBe(cash - 900 + 450 - 2_800);
    expect(desk().purchasePrice).toBe(300 + 2_800);

    // Retour à la tour d'origine : le champ disparaît, le bureau revient à son prix.
    expect(set('tower')).toEqual({ ok: true });
    expect(desk().computer).toBeUndefined();
    expect(desk().purchasePrice).toBe(300);
    expect(GameStateSchema.safeParse(simulation.state).success).toBe(true);
  });

  it('refuse un ordinateur pas encore débloqué, trop cher ou sur un meuble sans poste', () => {
    const simulation = newSimulation('computers-refused');
    const deskId = buyDesk(simulation);
    const dispatch = (furnitureId: string, computer: 'gaming-titan' | 'gaming-neon') =>
      simulation.dispatch({ type: 'SET_COMPUTER', furnitureId, computer }).result;
    expect(dispatch(deskId, 'gaming-titan')).toEqual({ ok: false, error: 'LOCKED' });
    const ikea = Object.entries(simulation.state.components.furniture).find(
      ([, f]) => f.itemId === 'ikea-desk',
    )![0];
    expect(dispatch(ikea, 'gaming-neon')).toEqual({ ok: false, error: 'NOT_ELIGIBLE' });
    expect(dispatch('e999', 'gaming-neon')).toEqual({ ok: false, error: 'NOT_FOUND' });
    simulation.state.gauges.treasury = 100;
    expect(dispatch(deskId, 'gaming-neon')).toEqual({ ok: false, error: 'NOT_ENOUGH_MONEY' });
  });

  it('ajoute ses effets à ceux du bureau', () => {
    const simulation = newSimulation('computers-effects');
    const deskId = buyDesk(simulation);
    const before = computeOfficeEffects(simulation.state);
    simulation.dispatch({ type: 'SET_COMPUTER', furnitureId: deskId, computer: 'pro-laptop' });
    const after = computeOfficeEffects(simulation.state);
    expect(after.quality).toBeCloseTo(before.quality + 0.003, 6);
    expect(after.hypePerDay).toBeCloseTo(before.hypePerDay + 0.005, 6);
    const seats = (effects: typeof before) =>
      Object.values(effects.seatProductivity).reduce((sum, value) => sum + value, 0);
    // Le bonus du poste va au dev qui s'y installe.
    expect(Object.keys(before.seatProductivity).length).toBeGreaterThan(0);
    expect(seats(after)).toBeCloseTo(seats(before) + 0.01, 6);
  });

  it("l'ordinateur suit le bureau dans l'inventaire et revient avec lui", () => {
    const simulation = newSimulation('computers-stored');
    const deskId = buyDesk(simulation);
    simulation.dispatch({ type: 'SET_COMPUTER', furnitureId: deskId, computer: 'gaming-neon' });
    const { x, y } = simulation.state.components.furniture[deskId]!;
    simulation.dispatch({ type: 'STORE_FURNITURE', furnitureId: deskId });
    expect(simulation.state.inventory.at(-1)).toMatchObject({
      itemId: 'desk',
      computer: 'gaming-neon',
      purchasePrice: 1_200,
    });
    simulation.dispatch({ type: 'PLACE_STORED', itemId: 'desk', x, y, rotation: 0 });
    const placed = Object.values(simulation.state.components.furniture).find(
      (f) => f.itemId === 'desk' && f.x === x && f.y === y,
    );
    expect(placed?.computer).toBe('gaming-neon');
  });
});
