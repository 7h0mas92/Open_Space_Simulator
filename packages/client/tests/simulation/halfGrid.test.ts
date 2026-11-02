import { CommandSchema, FurnitureSchema, getFurniture } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { canPlace, placeFurniture } from '../../src/simulation/furniture';
import { newSimulation, stateWithTeam } from './fixtures';

/** Bureau vide de la Seed (sans le mobilier de départ). */
function emptySeedOffice() {
  const { state } = stateWithTeam([]);
  state.phase = 'SEED';
  state.components.furniture = {};
  return state;
}

const plant = getFurniture('plant')!;
const thinWall = getFurniture('thin-wall')!;
const screen = getFurniture('projection-screen-medium')!;

describe('Placement à la demi-case', () => {
  it('accepte les positions à la demi-case dans les commandes, refuse le quart', () => {
    const buy = (x: number) =>
      CommandSchema.safeParse({ type: 'BUY_FURNITURE', itemId: 'plant', x, y: 2, rotation: 0 });
    expect(buy(3).success).toBe(true);
    expect(buy(3.5).success).toBe(true);
    expect(buy(3.25).success).toBe(false);
    // Les anciennes sauvegardes (positions entières) restent valides.
    expect(
      FurnitureSchema.safeParse({ itemId: 'plant', x: 4, y: 1, rotation: 0, purchasePrice: 60 })
        .success,
    ).toBe(true);
  });

  it('pose et déplace un objet d’une demi-case', () => {
    const simulation = newSimulation('half-step');
    const buy = simulation.dispatch({
      type: 'BUY_FURNITURE',
      itemId: 'plant',
      x: 4.5,
      y: 3.5,
      rotation: 0,
    });
    expect(buy.result.ok).toBe(true);
    const [id, placed] = Object.entries(simulation.state.components.furniture).find(
      ([, f]) => f.itemId === 'plant' && f.x === 4.5,
    )!;
    expect(placed.y).toBe(3.5);
    expect(
      simulation.dispatch({ type: 'MOVE_FURNITURE', furnitureId: id, x: 5, y: 3.5, rotation: 0 })
        .result.ok,
    ).toBe(true);
  });

  it('garde les murs fins et les fenêtres sur des cases entières', () => {
    const state = emptySeedOffice();
    expect(canPlace(state, thinWall, 3, 3, 0)).toBe(true);
    expect(canPlace(state, thinWall, 3.5, 3, 0)).toBe(false);
    expect(canPlace(state, getFurniture('window-small')!, 2.5, 0, 0)).toBe(false);
  });

  it('laisse libre la demi-case de part et d’autre d’un mur fin', () => {
    const state = emptySeedOffice();
    // Mur le long de x sur la case (3, 3) : son trait passe en z = 3,5.
    placeFurniture(state, 'thin-wall', 3, 3, 0);
    expect(canPlace(state, plant, 3, 2.5, 0)).toBe(true);
    expect(canPlace(state, plant, 3, 3.5, 0)).toBe(true);
    expect(canPlace(state, plant, 3, 3, 0)).toBe(false);
    // Et l'inverse : un mur fin se pose à côté d'un objet qui ne traverse pas son trait.
    const other = emptySeedOffice();
    placeFurniture(other, 'plant', 6, 2.5, 0);
    expect(canPlace(other, thinWall, 6, 3, 0)).toBe(true);
    expect(canPlace(other, thinWall, 6, 3, 1)).toBe(false);
  });

  it('centre un objet de 3 cases dans une pièce de 4 fermée par des murs fins', () => {
    const state = emptySeedOffice();
    // Murs le long de z sur les colonnes 1 et 6 : traits en x = 1,5 et 6,5, 5 cases entre eux.
    for (let z = 0; z < 4; z++) {
      placeFurniture(state, 'thin-wall', 1, z, 1);
      placeFurniture(state, 'thin-wall', 6, z, 1);
    }
    // Écran de 3 cases centré entre les cases 2 à 5 : de x = 2,5 à 5,5.
    expect(canPlace(state, screen, 2.5, 1, 0)).toBe(true);
    // Collé au mur de gauche, dans la demi-case libre.
    expect(canPlace(state, screen, 1.5, 1, 0)).toBe(true);
    expect(canPlace(state, screen, 1, 1, 0)).toBe(false);
  });
});
