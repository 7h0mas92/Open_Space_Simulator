import * as THREE from 'three';
import { DEV_ROLES } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import type { AgentSnapshot } from '../../../src/ai/agents';
import type { AssetLibrary } from '../../../src/render/assets';
import { lightingAt } from '../../../src/render/lighting';
import {
  ceilingLights,
  OfficeLights,
  pickRealLights,
  wallSlots,
} from '../../../src/render/officeLights';
import { PixelCanvas, radialGlowTexture, softRectTexture } from '../../../src/render/pixels';
import { QUALITY_PRESETS } from '../../../src/render/quality';
import {
  litScreens,
  paintScreen,
  SCREEN_CONTENTS,
  screenMountOf,
  screenContentFor,
  screenMatrix,
  ScreenGlow,
} from '../../../src/render/screens';
import { CATALOG } from '../../../src/view/catalog';
import { officeLayout } from '../../../src/view/layout';
import { officeSimulation, SEED_OFFICE, viewOf } from '../fixtures/game';

const noAssets = { loadFurniture: async () => null } as unknown as AssetLibrary;

const agent = (id: string, using: string | null, pose: AgentSnapshot['pose'] = 'work') =>
  ({ id, x: 0, z: 0, facing: 0, pose, visible: true, thought: null, using }) as AgentSnapshot;

describe('toile de pixels', () => {
  it('dessine des rectangles depuis le haut et mélange l’opacité', () => {
    const canvas = new PixelCanvas(4, 4).fill(0x000000).rect(0, 0, 2, 1, 0xff0000);
    expect(canvas.pixel(0, 0)).toBe(0xff0000);
    expect(canvas.pixel(0, 1)).toBe(0x000000);
    canvas.rect(3, 3, 5, 5, 0xffffff, 0.5); // déborde : coupé au bord
    expect(canvas.pixel(3, 3)).toBe(0x808080);
  });

  it('fabrique des halos plus lumineux au centre qu’au bord', () => {
    const glow = radialGlowTexture(16);
    const data = glow.image.data as Uint8Array;
    const at = (x: number, y: number) => data[(y * 16 + x) * 4] ?? 0;
    expect(at(8, 8)).toBeGreaterThan(at(1, 8));
    expect(at(0, 0)).toBe(0);
    const rect = softRectTexture(16, 0.25).image.data as Uint8Array;
    expect(rect[(8 * 16 + 8) * 4]).toBe(255);
    expect(rect[0]).toBeLessThan(255);
  });
});

describe('écrans allumés', () => {
  it('affiche un contenu lié au métier, une erreur quand on crie, un économiseur en dormant', () => {
    expect(screenContentFor('DESIGNER', 'work')).toBe('design');
    expect(screenContentFor('PRODUCT_OWNER', 'work')).toBe('board');
    expect(screenContentFor('RUSTACEAN', 'work')).toBe('rust');
    expect(screenContentFor('AI_AGENT', 'work')).toBe('terminal');
    expect(screenContentFor('INTERN', 'yell')).toBe('error');
    expect(screenContentFor('TEN_X', 'sleep')).toBe('sleep');
    expect(screenContentFor('TEN_X', 'drink')).toBeNull();
    expect(screenContentFor('TEN_X', 'walk')).toBeNull();
    for (const role of DEV_ROLES) expect(screenContentFor(role, 'work')).not.toBeNull();
  });

  it('dessine une image différente pour chaque contenu', () => {
    const signatures = SCREEN_CONTENTS.map((content) => {
      const canvas = paintScreen(content);
      return [0, 10, 30, 50].map((y) => canvas.pixel(30, y).toString(16)).join(':');
    });
    expect(new Set(signatures).size).toBe(SCREEN_CONTENTS.length);
  });

  it('a un emplacement d’écran pour chaque bureau du catalogue', () => {
    for (const item of CATALOG.filter((entry) => entry.use === 'desk'))
      expect(screenMountOf({ kind: item.kind }), item.kind).not.toBeNull();
  });

  it('n’allume que l’écran des bureaux utilisés par un dev visible', () => {
    const view = viewOf(officeSimulation(SEED_OFFICE));
    const desks = view.items.filter((item) => item.kind === 'desk');
    const coffee = view.items.find((item) => item.kind === 'espresso-machine')!;
    const [first, second, third] = view.devs;
    const roles = new Map(view.devs.map((dev) => [dev.id, dev.role]));
    const lit = litScreens({
      items: view.items,
      roles,
      agents: [
        agent(first!.id, desks[0]!.id),
        agent(second!.id, coffee.id, 'drink'), // la machine à café n'a pas d'écran
        { ...agent(third!.id, desks[1]!.id), visible: false },
      ],
    });
    expect(lit).toHaveLength(1);
    expect(lit[0]?.item.id).toBe(desks[0]!.id);
    expect(lit[0]?.content).toBe(screenContentFor(first!.role, 'work'));
  });

  it('place la dalle devant l’écran du bureau, tournée avec lui', () => {
    const matrix = screenMatrix({ id: 'd', kind: 'desk', x: 4, z: 2, rotation: 0 })!;
    const position = new THREE.Vector3().setFromMatrixPosition(matrix);
    expect(position.y).toBeGreaterThan(0.9);
    expect(position.x).toBeCloseTo(4 + 0.5 - 0.35);
    const turned = screenMatrix({ id: 'd', kind: 'desk', x: 4, z: 2, rotation: 2 })!;
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(turned);
    expect(normal.z).toBeCloseTo(-1);
    expect(screenMatrix({ id: 'c', kind: 'plant', x: 0, z: 0, rotation: 0 })).toBeNull();
  });

  it('instancie les écrans : un appel de dessin par contenu, quel que soit le nombre', () => {
    const view = viewOf(officeSimulation(SEED_OFFICE));
    const desks = view.items.filter((item) => item.kind === 'desk');
    const glow = new ScreenGlow();
    const roles = new Map(view.devs.map((dev) => [dev.id, dev.role]));
    const agents = view.devs.slice(0, desks.length).map((dev, i) => agent(dev.id, desks[i]!.id));
    glow.update({ items: view.items, roles, agents }, 0.5, 1, true);
    expect(glow.count).toBe(agents.length);
    const meshes = glow.root.children.filter(
      (c) => c.name.startsWith('screen-') && c.name !== 'screen-spill',
    );
    // Chaque contenu existe sur une dalle plate et sur une dalle courbe (écran incurvé).
    expect(meshes).toHaveLength(SCREEN_CONTENTS.length * 2);
    glow.update({ items: view.items, roles, agents: [] }, 0.5, 0, false);
    expect(glow.count).toBe(0);
    glow.dispose();
  });
});

describe('éclairage de la salle', () => {
  it('allume les lampes le soir et fait entrer le soleil le jour', () => {
    expect(lightingAt(21 * 60).lamps).toBeGreaterThan(0.9);
    expect(lightingAt(12 * 60).lamps).toBeLessThan(0.2);
    expect(lightingAt(12 * 60).daylight).toBeGreaterThan(0.9);
    expect(lightingAt(23 * 60).daylight).toBe(0);
    expect(lightingAt(12 * 60).windowColor).not.toBe(lightingAt(23 * 60).windowColor);
  });

  it('accroche des appliques sur les deux murs du fond, sans déborder', () => {
    for (const phase of ['GARAGE', 'SEED', 'SERIES_A', 'UNICORN'] as const) {
      const layout = officeLayout(phase);
      const slots = wallSlots(layout);
      expect(
        slots.some((slot) => slot.turn === 0),
        phase,
      ).toBe(true);
      expect(
        slots.some((slot) => slot.turn === 1),
        phase,
      ).toBe(true);
      for (const slot of slots) {
        expect(slot.x).toBeLessThanOrEqual(layout.width - 1);
        expect(slot.z).toBeLessThanOrEqual(layout.depth - 1);
      }
    }
  });

  it('éclaire chaque salle par au moins un plafonnier, à l’intérieur de la salle', () => {
    const layout = officeLayout('UNICORN');
    const lights = ceilingLights(layout);
    for (const room of layout.rooms) {
      const inside = lights.filter(
        (l) =>
          l.x >= room.x - 0.5 &&
          l.x <= room.x + room.width - 0.5 &&
          l.z >= room.z - 0.5 &&
          l.z <= room.z + room.depth - 0.5,
      );
      expect(inside.length, room.kind).toBeGreaterThan(0);
    }
    expect(pickRealLights(lights, 3)).toHaveLength(3);
    expect(pickRealLights(lights, 0)).toEqual([]);
    expect(pickRealLights(lights.slice(0, 2), 6)).toHaveLength(2);
  });

  it('n’ajoute aucune vraie lampe en qualité basse (mobile)', async () => {
    expect(QUALITY_PRESETS.low.roomLights).toBe(0);
    const layout = officeLayout('SERIES_A');
    const low = new OfficeLights(noAssets);
    await low.setLayout(layout, QUALITY_PRESETS.low.roomLights);
    expect(low.realLights).toBe(0);
    const high = new OfficeLights(noAssets);
    await high.setLayout(layout, QUALITY_PRESETS.high.roomLights);
    expect(high.realLights).toBe(QUALITY_PRESETS.high.roomLights);
    // Sans le modèle Kenney, les appliques retombent sur une forme Three.js.
    expect(high.root.getObjectByName('wall-lamps')).toBeDefined();

    const lights: THREE.PointLight[] = [];
    high.root.traverse((node) => {
      if (node instanceof THREE.PointLight) lights.push(node);
    });
    high.update(lightingAt(12 * 60), 40);
    const day = lights[0]?.intensity ?? 0;
    high.update(lightingAt(21 * 60), 40);
    expect(lights[0]?.intensity ?? 0).toBeGreaterThan(day);
    expect(high.root.getObjectByName('sun-patches')?.visible).toBe(false);
    low.dispose();
    high.dispose();
  });
});
