import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { AssetLibrary } from '../../../src/render/assets';
import { lightingAt } from '../../../src/render/lighting';
import { OfficeLights, wallSlots } from '../../../src/render/officeLights';
import { windowGlass } from '../../../src/render/primitives';
import { litShare } from '../../../src/render/cityLights';
import {
  CITY_RADIUS,
  maxTop,
  planSkyline,
  SkylineView,
  STREET_LEVEL,
} from '../../../src/render/skyline';
import { FACADE_GRID } from '../../../src/render/skylineShaders';
import { officeLayout } from '../../../src/view/layout';

const PHASES = ['GARAGE', 'SEED', 'SERIES_A', 'UNICORN'] as const;

/** Distance horizontale entre une boîte et le rectangle de notre tour. */
function gap(
  box: { x: number; z: number; width: number; depth: number },
  rect: { x0: number; z0: number; x1: number; z1: number },
): number {
  const dx = Math.max(rect.x0 - (box.x + box.width / 2), 0, box.x - box.width / 2 - rect.x1);
  const dz = Math.max(rect.z0 - (box.z + box.depth / 2), 0, box.z - box.depth / 2 - rect.z1);
  return Math.hypot(dx, dz);
}

describe('vue sur New York', () => {
  it('est identique à chaque partie (graine fixe, sans le RNG du jeu)', () => {
    const layout = officeLayout('SEED');
    expect(planSkyline(layout)).toEqual(planSkyline(layout));
  });

  it('pose le bureau en haut d’une tour qui descend jusqu’à la rue', () => {
    for (const phase of PHASES) {
      const layout = officeLayout(phase);
      const plan = planSkyline(layout);
      const own = plan.towers[0]!;
      expect(own.bottom).toBe(STREET_LEVEL);
      expect(own.top).toBeLessThan(0);
      expect(own.x - own.width / 2).toBeLessThan(-0.7);
      expect(own.x + own.width / 2).toBeGreaterThan(layout.width - 0.3);
      expect(own.z + own.depth / 2).toBeGreaterThan(layout.depth - 0.3);
    }
  });

  it('ne cache jamais le bureau : les toits proches restent sous le plancher', () => {
    for (const phase of PHASES) {
      const layout = officeLayout(phase);
      const plan = planSkyline(layout);
      for (const box of plan.towers.slice(1)) {
        const distance = gap(box, plan.footprint);
        expect(distance, phase).toBeGreaterThan(0);
        expect(box.top, phase).toBeLessThanOrEqual(Math.max(maxTop(distance), 0));
        // Aucun immeuble ne déborde sur notre tour ni sur la rue du dessous.
        expect(box.bottom, phase).toBeGreaterThanOrEqual(STREET_LEVEL);
      }
      for (const point of [...plan.tanks, ...plan.trees])
        expect(Math.hypot(point.x - layout.width / 2, point.z - layout.depth / 2)).toBeLessThan(
          CITY_RADIUS + 20,
        );
    }
  });

  it('a l’allure de Manhattan : tours à gradins, réservoirs d’eau, parc, fleuve, taxis', () => {
    const plan = planSkyline(officeLayout('SERIES_A'));
    expect(plan.towers.length).toBeGreaterThan(200);
    expect(plan.towers.some((box) => box.top > 5)).toBe(true);
    expect(plan.tanks.length).toBeGreaterThan(10);
    expect(plan.trees.length).toBeGreaterThan(10);
    expect(plan.beacons.length).toBeGreaterThan(0);
    expect(plan.lanes.length).toBeGreaterThan(5);
    expect(plan.river.x1).toBeGreaterThan(plan.river.x0);
  });

  it('varie les immeubles : verre, brique, pierre, bandeaux, brownstones', () => {
    const plan = planSkyline(officeLayout('SERIES_A'));
    const styles = new Set(plan.towers.map((box) => box.style));
    expect([...styles].sort()).toEqual(['brick', 'brownstone', 'glass', 'limestone', 'ribbon']);
    expect(plan.towers.some((box) => box.use === 'office')).toBe(true);
    expect(plan.towers.some((box) => box.use === 'home')).toBe(true);
    // Équipements de toit, couronnes illuminées et arbres d'alignement.
    expect(plan.solids.length).toBeGreaterThan(plan.towers.length);
    expect(plan.crowns.length).toBeGreaterThan(0);
    expect(plan.trees.length).toBeGreaterThan(200);
  });

  it('pose les toits juste au-dessus d’un étage entier', () => {
    const plan = planSkyline(officeLayout('SEED'));
    for (const box of plan.towers
      .slice(1)
      .filter((tower) => tower.bottom === STREET_LEVEL + 0.25)) {
      const floor = FACADE_GRID[box.style ?? 'glass'].floor;
      const floors = (box.top - 0.35 - box.bottom) / floor;
      expect(Math.abs(floors - Math.round(floors))).toBeLessThan(1e-6);
    }
  });

  it('fait rouler les voitures dans la ville, jamais sur le fleuve', () => {
    const plan = planSkyline(officeLayout('GARAGE'));
    for (const lane of plan.lanes) {
      if (lane.axis === 'x') expect(lane.x - lane.length / 2).toBeGreaterThanOrEqual(plan.river.x1);
      else expect(lane.x < plan.river.x0 || lane.x > plan.river.x1).toBe(true);
    }
  });

  it('allume les fenêtres le soir et les éteint peu à peu dans la nuit', () => {
    // Les logements se remplissent le soir, les bureaux se vident après 18h.
    expect(litShare(21, 'home')).toBeGreaterThan(0.6);
    expect(litShare(21, 'office')).toBeLessThan(litShare(18, 'office'));
    expect(litShare(3.5, 'home')).toBeLessThan(0.12);
    expect(litShare(3.5, 'office')).toBeLessThan(0.12);
    // Pas de saut : d'une minute à l'autre, la part bouge à peine (extinction progressive).
    for (let minute = 0; minute < 1440; minute++)
      for (const use of ['home', 'office'] as const)
        expect(
          Math.abs(litShare((minute + 1) / 60, use) - litShare(minute / 60, use)),
        ).toBeLessThan(0.01);
    expect(litShare(24, 'home')).toBeCloseTo(litShare(0, 'home'));
  });

  it('dessine toute la ville en une poignée de maillages et l’allume la nuit', () => {
    const skyline = new SkylineView();
    skyline.setLayout(officeLayout('UNICORN'));
    expect(skyline.root.children.length).toBeLessThanOrEqual(12);
    expect(skyline.root.getObjectByName('skyline-crowns')).toBeDefined();
    const facades = skyline.root.getObjectByName('skyline-facades') as THREE.Mesh;
    const material = facades.material as THREE.ShaderMaterial;
    const glow = () => material.uniforms.glow?.value as number;
    const share = () => material.uniforms.homeShare?.value as number;
    skyline.update(lightingAt(12 * 60), 12 * 60, 0.1, 40, true);
    const day = glow();
    const noonShare = share();
    skyline.update(lightingAt(22 * 60), 22 * 60, 0.1, 40, true);
    expect(glow()).toBeGreaterThan(day + 0.5);
    expect(share()).toBeGreaterThan(noonShare);

    // Les voitures roulent, sauf si l'on réduit les animations.
    const taxis = skyline.root.getObjectByName('skyline-cars') as THREE.InstancedMesh;
    const before = new THREE.Matrix4();
    taxis.getMatrixAt(0, before);
    skyline.update(lightingAt(22 * 60), 22 * 60, 0.5, 40, false);
    const still = new THREE.Matrix4();
    taxis.getMatrixAt(0, still);
    expect(still.equals(before)).toBe(true);
    skyline.update(lightingAt(22 * 60), 22 * 60, 0.5, 40, true);
    const moved = new THREE.Matrix4();
    taxis.getMatrixAt(0, moved);
    expect(moved.equals(before)).toBe(false);

    // Même taille de bureau : rien n'est reconstruit.
    const mesh = skyline.root.getObjectByName('skyline-facades');
    skyline.setLayout(officeLayout('UNICORN'));
    expect(skyline.root.getObjectByName('skyline-facades')).toBe(mesh);
    skyline.dispose();
    expect(skyline.root.children).toHaveLength(0);
  });
});

describe('fenêtres et lumière du jour', () => {
  const noAssets = { loadFurniture: async () => null } as unknown as AssetLibrary;
  const count = (lights: OfficeLights, name: string) =>
    (lights.root.getObjectByName(name) as THREE.InstancedMesh).count;

  it('sans fenêtre, aucun soleil n’entre et toutes les appliques sont accrochées', async () => {
    const lights = new OfficeLights(noAssets);
    const layout = officeLayout('SEED');
    await lights.setLayout(layout, 0);
    expect(count(lights, 'sun-patches')).toBe(0);
    expect(count(lights, 'lamp-wash')).toBe(wallSlots(layout).length);
    lights.dispose();
  });

  it('fait entrer le soleil devant chaque fenêtre et décroche l’applique qu’elle couvre', async () => {
    const lights = new OfficeLights(noAssets);
    const layout = officeLayout('SEED');
    const lamp = wallSlots(layout).find((slot) => slot.turn === 0)!;
    await lights.setLayout(layout, 0, [
      { kind: 'glass-wall', wall: 0, start: lamp.x, length: 2, full: true },
      { kind: 'window-small', wall: 1, start: 2, length: 1, full: false },
    ]);
    expect(count(lights, 'sun-patches')).toBe(2);
    expect(count(lights, 'lamp-wash')).toBe(wallSlots(layout).length - 1);
    lights.dispose();
  });

  it('teinte le verre des fenêtres selon le ciel', () => {
    const lights = new OfficeLights(noAssets);
    expect(windowGlass.transparent).toBe(true);
    expect(windowGlass.opacity).toBeLessThan(0.5);
    lights.update(lightingAt(12 * 60), 40);
    const noon = windowGlass.color.getHex();
    lights.update(lightingAt(23 * 60), 40);
    expect(windowGlass.color.getHex()).not.toBe(noon);
    lights.dispose();
  });
});
