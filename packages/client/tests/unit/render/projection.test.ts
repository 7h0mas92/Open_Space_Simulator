import { describe, expect, it } from 'vitest';
import {
  blankFabric,
  FABRIC_WHITE,
  ProjectionView,
  slideTextures,
  step,
  UNROLL_SECONDS,
} from '../../../src/render/projection';
import type { PlacedItemView } from '../../../src/view/types';

const placed = (item: Partial<PlacedItemView> & Pick<PlacedItemView, 'id' | 'kind'>) =>
  ({ x: 0, z: 0, rotation: 0, resale: 0, color: 'natural', host: null, ...item }) as PlacedItemView;

const items: PlacedItemView[] = [
  placed({ id: 'e1', kind: 'projection-screen-medium', x: 3, z: 0 }),
  placed({ id: 'e2', kind: 'desk', x: 4, z: 5, rotation: 2 }),
  placed({ id: 'e3', kind: 'projector', host: { id: 'e2', slot: 0 }, on: true }),
];

/** Couleurs (0xRRGGBB) des pixels d'une texture de toile. */
function colors(texture: { image: { data: ArrayLike<number> | null } }): number[] {
  const data = texture.image.data ?? [];
  const out: number[] = [];
  for (let i = 0; i < data.length; i += 4)
    out.push(((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0));
  return out;
}

describe('Écran de projection déroulant', () => {
  it('la toile vierge est toute blanche, sans bande noire autour', () => {
    expect(new Set(colors(blankFabric()))).toEqual(new Set([FABRIC_WHITE]));
  });

  it('les diapositives gardent un bord blanc, sans cadre noir', () => {
    for (const slide of slideTextures()) {
      const { width, height } = slide.image;
      const all = colors(slide);
      const edge = all.filter((_, i) => {
        const x = i % width;
        const y = Math.floor(i / width);
        return x === 0 || y === 0 || x === width - 1 || y === height - 1;
      });
      expect(new Set(edge)).toEqual(new Set([FABRIC_WHITE]));
    }
  });

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
