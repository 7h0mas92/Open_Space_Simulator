import { describe, expect, it } from 'vitest';
import {
  ANNEX_DECOR,
  ANNEX_KINDS,
  GameStateSchema,
  annexDecorItem,
  getFurniture,
  type GameState,
} from '@oss/shared';
import type { Simulation } from '../../src/simulation/simulation';
import { toCommand, toGameView } from '../../src/view/adapter';
import { catalogItem } from '../../src/view/catalog';
import { shopStatus } from '../../src/view/placement';
import { newSimulation } from './fixtures';

/** Une partie en Série B : la salle d'arcade vient d'ouvrir. */
function withArcade(seed = 'annex-decor'): Simulation {
  const simulation = newSimulation(seed);
  simulation.state.phase = 'SERIES_A';
  simulation.state.fundingRounds = 3;
  simulation.state.gauges.treasury = 1_000_000;
  return simulation;
}

const viewOf = (state: GameState) =>
  toGameView(state, { speed: 1, running: false, card: () => undefined });

const decorOf = (state: GameState) => viewOf(state).items.filter((item) => item.annexDecor);

describe('Décor des annexes', () => {
  it('chaque objet du décor est un objet de la boutique', () => {
    for (const kind of ANNEX_KINDS)
      for (const id of ANNEX_DECOR[kind]) {
        expect(getFurniture(id), id).toBeDefined();
        expect(catalogItem(id), id).toBeDefined();
      }
  });

  it('les clés ne désignent que le décor des annexes ouvertes', () => {
    expect(annexDecorItem('0-3', 1)).toBe('pinball');
    expect(annexDecorItem('0-2', 1)).toBe('neon-sign');
    expect(annexDecorItem('1-0', 1)).toBeUndefined();
    expect(annexDecorItem('0-9', 1)).toBeUndefined();
    expect(annexDecorItem('pinball', 3)).toBeUndefined();
  });

  it('le décor de l’annexe est un objet posé, sans valeur de revente', () => {
    const decor = decorOf(withArcade().state);
    expect(decor.map((item) => item.kind).sort()).toEqual([...ANNEX_DECOR.arcade].sort());
    for (const item of decor) {
      expect(item.id).toBe(`annex:${item.annexDecor}`);
      expect(item.resale).toBe(0);
    }
    expect(decorOf(newSimulation().state)).toEqual([]);
  });

  it('le déplacer ou le tourner ne coûte rien et ne touche à aucune entité', () => {
    const simulation = withArcade();
    const view = viewOf(simulation.state);
    const pinball = view.items.find((item) => item.annexDecor === '0-3')!;
    const treasury = simulation.state.gauges.treasury;
    const nextEntityId = simulation.state.nextEntityId;
    const move = toCommand({ type: 'moveItem', itemId: pinball.id, x: 2, z: 16 }, view);
    expect(move).toEqual({ type: 'MOVE_ANNEX_DECOR', key: '0-3', x: 2, y: 16, rotation: 0 });
    expect(simulation.dispatch(move!).result).toEqual({ ok: true });
    const rotate = toCommand({ type: 'rotateItem', itemId: pinball.id }, viewOf(simulation.state));
    expect(simulation.dispatch(rotate!).result).toEqual({ ok: true });
    expect(simulation.state.annexDecor).toEqual({ '0-3': { x: 2, y: 16, rotation: 1 } });
    expect(simulation.state.gauges.treasury).toBe(treasury);
    expect(simulation.state.nextEntityId).toBe(nextEntityId);
    const moved = decorOf(simulation.state).find((item) => item.annexDecor === '0-3');
    expect(moved).toMatchObject({ x: 2, z: 16, rotation: 1 });
  });

  it('refuse un objet inconnu, hors du bureau ou posé sur un meuble', () => {
    const simulation = withArcade();
    const move = (key: string, x: number, y: number) =>
      simulation.dispatch({ type: 'MOVE_ANNEX_DECOR', key, x, y, rotation: 0 }).result;
    expect(move('1-0', 2, 16)).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(move('0-0', 99, 16)).toEqual({ ok: false, error: 'INVALID_PLACEMENT' });
    expect(
      simulation.dispatch({ type: 'BUY_FURNITURE', itemId: 'plant', x: 3, y: 17, rotation: 0 })
        .result,
    ).toEqual({ ok: true });
    expect(move('0-0', 3, 17)).toEqual({ ok: false, error: 'INVALID_PLACEMENT' });
    expect(simulation.state.annexDecor).toEqual({});
  });

  it('le décor offert ne tombe jamais sur un meuble déjà posé', () => {
    // Quand le bureau grandit, la place d'origine du décor bouge : un meuble peut déjà s'y
    // trouver (ici posé directement, comme avant une aile de filiale).
    const simulation = withArcade();
    const pinball = decorOf(simulation.state).find((item) => item.annexDecor === '0-3')!;
    expect(
      simulation.dispatch({
        type: 'BUY_FURNITURE',
        itemId: 'glass-partition',
        x: pinball.x,
        y: pinball.z,
        rotation: 1,
      }).result,
    ).toEqual({ ok: true });
    const moved = decorOf(simulation.state).find((item) => item.annexDecor === '0-3')!;
    expect(moved.z).toBe(pinball.z);
    expect(moved.x).not.toBe(pinball.x);
    expect(decorOf(simulation.state)).toHaveLength(ANNEX_DECOR.arcade.length);
  });

  it('le décor offert ne compte pas dans le maximum de la boutique', () => {
    const view = viewOf(withArcade().state);
    expect(shopStatus(catalogItem('arcade-cabinet')!, view)).toEqual({ owned: 0, block: null });
  });

  it('une vieille sauvegarde sans déplacement se charge avec le décor à sa place', () => {
    const json = JSON.parse(JSON.stringify(withArcade().state)) as Record<string, unknown>;
    delete json.annexDecor;
    expect(GameStateSchema.parse(json).annexDecor).toEqual({});
  });
});
