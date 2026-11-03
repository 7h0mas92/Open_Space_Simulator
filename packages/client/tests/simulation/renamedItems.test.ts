import { getFurniture, SaveDataSchema } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { CardLibrary } from '../../src/events/library';
import { computeOfficeEffects } from '../../src/simulation/furniture';
import { replay } from '../../src/simulation/replay';
import { Simulation } from '../../src/simulation/simulation';
import { newSimulation, openCatalogue } from './fixtures';

/** Premier bureau de la partie : il porte les accessoires. */
function firstDesk(simulation: Simulation): string {
  const desk = Object.entries(simulation.state.components.furniture).find(
    ([, item]) => item.itemId === 'ikea-desk',
  );
  return desk![0];
}

const shielded = (simulation: Simulation) =>
  Object.values(computeOfficeEffects(simulation.state).meetingShielded).filter(Boolean).length;

describe('Casques antibruit devenus écouteurs sans fil', () => {
  it('les anciens identifiants désignent les écouteurs', () => {
    expect(getFurniture('desk-headset')?.id).toBe('desk-earbuds');
    expect(getFurniture('noise-headsets')?.id).toBe('earbuds-dock');
  });

  it("une ancienne sauvegarde avec des casques se charge, avec l'effet des écouteurs", () => {
    const simulation = newSimulation('old-headsets');
    simulation.state.gauges.treasury = 100_000;
    simulation.dispatch({
      type: 'BUY_ACCESSORY',
      itemId: 'desk-earbuds',
      hostId: firstDesk(simulation),
      slot: 0,
      rotation: 0,
    });
    simulation.state.inventory.push({ itemId: 'earbuds-dock', purchasePrice: 900 });
    // Même sauvegarde, écrite avant le renommage.
    const json = JSON.stringify({ state: simulation.state, commands: simulation.commands })
      .replaceAll('desk-earbuds', 'desk-headset')
      .replaceAll('earbuds-dock', 'noise-headsets');
    const save = SaveDataSchema.parse(JSON.parse(json));
    const restored = Simulation.restore(save.state, new CardLibrary([]), save.commands);

    const items = Object.values(restored.state.components.furniture).map((item) => item.itemId);
    expect(items).toContain('desk-earbuds');
    expect(items).not.toContain('desk-headset');
    expect(restored.state.inventory).toEqual([{ itemId: 'earbuds-dock', purchasePrice: 900 }]);
    expect(shielded(restored)).toBe(1);
    // L'objet rangé se ressort sous son nouveau nom, et l'ancien nom marche encore.
    expect(restored.dispatch({ type: 'SELL_STORED', itemId: 'noise-headsets' }).result).toEqual({
      ok: true,
    });
  });

  it('un ancien journal de commandes se rejoue à l’identique', () => {
    const simulation = newSimulation('old-replay');
    const oldCommand = {
      type: 'BUY_ACCESSORY',
      itemId: 'desk-headset',
      hostId: firstDesk(simulation),
      slot: 0,
      rotation: 0,
    } as const;
    expect(simulation.dispatch(oldCommand).result).toEqual({ ok: true });
    // Le journal garde le nouvel identifiant.
    expect(simulation.commands.at(-1)?.command).toMatchObject({ itemId: 'desk-earbuds' });
    // Rejeu sans arbre R&D, comme la partie de test (`newSimulation` ouvre tout le catalogue).
    const replayed = replay({
      seed: 'old-replay',
      mode: 'NORMAL',
      commands: [],
      cards: new CardLibrary([]),
    });
    openCatalogue(replayed.state);
    replayed.dispatch(oldCommand);
    expect(shielded(replayed)).toBe(1);
    expect(replayed.state).toEqual(simulation.state);
  });
});
