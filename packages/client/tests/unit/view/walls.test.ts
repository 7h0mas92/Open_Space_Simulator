import { describe, expect, it } from 'vitest';
import { WALL_FINISH_IDS, wallZones } from '@oss/shared';
import { buildWallSkins, skinRects } from '../../../src/render/wallFinishes';
import { WALL_HEIGHT, WINDOW_SHAPES } from '../../../src/render/primitives';
import { officeLayout } from '../../../src/view/layout';
import { WALL_LOOKS, finishHex, hasPattern, wallZoneSpans } from '../../../src/view/walls';
import type { WallOpening } from '../../../src/view/windows';

describe('zones de mur sur le plan', () => {
  it('une zone par pièce le long de chaque mur, sans trou ni chevauchement', () => {
    const layout = officeLayout('UNICORN', 2, 3, 'seed');
    const spans = wallZoneSpans(layout);
    expect(spans.map((s) => s.zone)).toEqual(wallZones({ phase: 'UNICORN', wings: 2, annexes: 3 }));
    for (const wall of [0, 1] as const) {
      const along = spans.filter((s) => s.wall === wall);
      expect(along[0]?.start).toBe(0);
      expect(along.at(-1)?.end).toBe(wall === 0 ? layout.width : layout.depth);
      along.slice(1).forEach((span, index) => expect(span.start).toBe(along[index]?.end));
    }
  });

  it('au garage, l’open space couvre les deux murs', () => {
    expect(wallZoneSpans(officeLayout('GARAGE'))).toEqual([
      { zone: 'back-open', wall: 0, start: 0, end: 8 },
      { zone: 'left-open', wall: 1, start: 0, end: 6 },
    ]);
  });

  it('chaque revêtement a une teinte, les papiers peints un motif', () => {
    for (const id of WALL_FINISH_IDS) expect(finishHex(id)).toBeGreaterThanOrEqual(0);
    expect(hasPattern('sage')).toBe(false);
    expect(hasPattern('brick')).toBe(true);
    expect(Object.keys(WALL_LOOKS)).toEqual([...WALL_FINISH_IDS]);
  });
});

describe('peau des murs', () => {
  const window = (kind: string, start: number, length: number, wall: 0 | 1 = 0): WallOpening => ({
    kind,
    wall,
    start,
    length,
    full: kind === 'glass-wall',
  });

  it('une zone sans fenêtre est un seul rectangle du sol au plafond', () => {
    expect(skinRects(-0.5, 7.7, [], 0)).toEqual([{ a: -0.5, b: 7.7, y0: 0, y1: WALL_HEIGHT }]);
  });

  it('une baie vitrée perce la peau ; une fenêtre garde allège, linteau et bords', () => {
    const glass = skinRects(-0.5, 7.5, [window('glass-wall', 2, 2)], 0);
    expect(glass).toEqual([
      { a: -0.5, b: 1.5, y0: 0, y1: WALL_HEIGHT },
      { a: 3.5, b: 7.5, y0: 0, y1: WALL_HEIGHT },
    ]);
    const shape = WINDOW_SHAPES['window-small']!;
    const small = skinRects(-0.5, 7.5, [window('window-small', 3, 1)], 0);
    expect(small).toContainEqual({ a: 2.5, b: 3.5, y0: 0, y1: shape.bottom });
    expect(small).toContainEqual({ a: 2.5, b: 3.5, y0: shape.top, y1: WALL_HEIGHT });
    expect(small).toHaveLength(6);
    // Les fenêtres de l'autre mur ne comptent pas.
    expect(skinRects(-0.5, 7.5, [window('glass-wall', 2, 2, 1)], 0)).toHaveLength(1);
  });

  it('une fenêtre à cheval sur deux zones est coupée à la limite', () => {
    const rects = skinRects(-0.5, 2.5, [window('window-large', 2, 3)], 0);
    expect(Math.max(...rects.map((r) => r.b))).toBe(2.5);
  });

  it('seules les zones couvertes reçoivent une peau', () => {
    const skins = buildWallSkins(officeLayout('SEED'), [], { 'back-kitchen': 'brick' });
    expect(skins.children.map((child) => child.name)).toEqual(['wall-back-kitchen']);
  });
});
