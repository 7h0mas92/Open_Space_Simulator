import { describe, expect, it } from 'vitest';
import { ProjectionView, step, UNROLL_SECONDS } from '../../../src/render/projection';
import type { PlacedItemView } from '../../../src/view/types';

const placed = (item: Partial<PlacedItemView> & Pick<PlacedItemView, 'id' | 'kind'>) =>
  ({ x: 0, z: 0, rotation: 0, resale: 0, color: 'natural', host: null, ...item }) as PlacedItemView;

const items: PlacedItemView[] = [
  placed({ id: 'e1', kind: 'projection-screen-medium', x: 3, z: 0 }),
  placed({ id: 'e2', kind: 'desk', x: 4, z: 5, rotation: 2 }),
  placed({ id: 'e3', kind: 'projector', host: { id: 'e2', slot: 0 }, on: true }),
];

describe('Écran de projection déroulant', () => {
  it('se déroule, puis l’image s’allume ; s’éteint, puis s’enroule', () => {
    const rig = { unroll: 0, glow: 0, projected: true };
    step(rig, UNROLL_SECONDS / 2, true);
    expect(rig.unroll).toBeCloseTo(0.5);
    expect(rig.glow).toBe(0);
    for (let i = 0; i < 40; i += 1) step(rig, 0.1, true);
    expect(rig).toMatchObject({ unroll: 1, glow: 1 });
    rig.projected = false;
    step(rig, 0.1, true);
    expect(rig.unroll).toBe(1); // l'image s'éteint d'abord
    for (let i = 0; i < 40; i += 1) step(rig, 0.1, true);
    expect(rig).toMatchObject({ unroll: 0, glow: 0 });
  });

  it('sans animation, la toile passe directement à son état final', () => {
    const rig = { unroll: 0, glow: 0, projected: true };
    step(rig, 0.016, false);
    expect(rig).toMatchObject({ unroll: 1, glow: 1 });
  });

  it('suit les projections de la simulation et retire les écrans revendus', () => {
    const view = new ProjectionView();
    view.sync(items, [{ projector: 'e3', screen: 'e1' }]);
    expect(view.screenCount).toBe(1);
    for (let i = 0; i < 30; i += 1) view.update(0.1, true);
    expect(view.unrollOf('e1')).toBe(1);
    expect(view.root.getObjectByName('projector-beam')?.visible).toBe(true);
    view.sync(items, []);
    for (let i = 0; i < 30; i += 1) view.update(0.1, true);
    expect(view.unrollOf('e1')).toBe(0);
    view.sync(items.slice(1), []);
    expect(view.screenCount).toBe(0);
    view.dispose();
  });
});
