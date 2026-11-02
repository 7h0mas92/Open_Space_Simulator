import { describe, expect, it } from 'vitest';
import { FLOOR_TINTS } from '@oss/shared';
import { FLOOR_TINT_COLORS, floorRect, floorZoneRooms, shade } from '../../../src/view/floors';
import { officeLayout } from '../../../src/view/layout';

describe('Sols : pièces du plan', () => {
  it('une zone par pièce, les ailes numérotées dans l’ordre', () => {
    const layout = officeLayout('SERIES_A', 2, 1);
    expect(floorZoneRooms(layout).map((r) => r.zone)).toEqual([
      'open',
      'kitchen',
      'meeting',
      'lounge',
      'wing-1',
      'wing-2',
      'arcade',
    ]);
  });

  it('deux pièces voisines se rejoignent au milieu de la cloison, sans déborder du bureau', () => {
    const layout = officeLayout('SEED');
    const rooms = Object.fromEntries(
      floorZoneRooms(layout).map(({ zone, room }) => [zone, floorRect(room, layout)]),
    );
    expect(rooms.open).toEqual({ x0: -0.5, x1: 10, z0: -0.5, z1: 9.5 });
    expect(rooms.kitchen).toEqual({ x0: 10, x1: 13.5, z0: -0.5, z1: 5 });
    expect(rooms.meeting).toEqual({ x0: 10, x1: 13.5, z0: 5, z1: 9.5 });
  });

  it('chaque teinte a une couleur, que shade éclaircit ou assombrit', () => {
    for (const tint of FLOOR_TINTS) expect(FLOOR_TINT_COLORS[tint]).toMatch(/^#[0-9a-f]{6}$/);
    expect(shade('#808080', 1)).toBe('rgb(128 128 128)');
    expect(shade('#808080', 0.5)).toBe('rgb(64 64 64)');
    expect(shade('#000000', 2)).toBe('rgb(255 255 255)');
  });
});
