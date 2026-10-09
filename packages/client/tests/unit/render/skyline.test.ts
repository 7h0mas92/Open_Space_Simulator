import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { AssetLibrary } from '../../../src/render/assets';
import { lightingAt } from '../../../src/render/lighting';
import { glassTexture, OfficeLights } from '../../../src/render/officeLights';
import {
  CITY_RADIUS,
  facadeTextures,
  maxTop,
  planSkyline,
  SkylineView,
  STREET_LEVEL,
} from '../../../src/render/skyline';
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

  it('allume des fenêtres sur les façades, environ une sur trois', () => {
    const { map, lit } = facadeTextures();
    expect(map.pixel(0, 0)).toBe(0xffffff);
    let on = 0;
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 8; col++) if (lit.pixel(col * 8 + 3, row * 8 + 4) !== 0) on++;
    expect(on).toBeGreaterThan(8);
    expect(on).toBeLessThan(40);
  });

  it('dessine toute la ville en une poignée de maillages et l’allume la nuit', () => {
    const skyline = new SkylineView();
    skyline.setLayout(officeLayout('UNICORN'));
    expect(skyline.root.children.length).toBeLessThanOrEqual(12);
    const facades = skyline.root.getObjectByName('skyline-facades') as THREE.Mesh;
    const material = facades.material as THREE.MeshLambertMaterial;
    skyline.update(lightingAt(12 * 60), 0.1, 40, true);
    const day = material.emissiveIntensity;
    skyline.update(lightingAt(22 * 60), 0.1, 40, true);
    expect(material.emissiveIntensity).toBeGreaterThan(day + 0.5);

    // Les taxis roulent, sauf si l'on réduit les animations.
    const taxis = skyline.root.getObjectByName('skyline-taxis') as THREE.InstancedMesh;
    const before = new THREE.Matrix4();
    taxis.getMatrixAt(0, before);
    skyline.update(lightingAt(22 * 60), 0.5, 40, false);
    const still = new THREE.Matrix4();
    taxis.getMatrixAt(0, still);
    expect(still.equals(before)).toBe(true);
    skyline.update(lightingAt(22 * 60), 0.5, 40, true);
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

describe('baies vitrées', () => {
  it('remplace les murs du fond par des vitres teintées par le ciel', async () => {
    const lights = new OfficeLights({ loadFurniture: async () => null } as unknown as AssetLibrary);
    const layout = officeLayout('SEED');
    await lights.setLayout(layout, 0);
    const back = lights.root.getObjectByName('glass-back') as THREE.Mesh;
    const side = lights.root.getObjectByName('glass-side') as THREE.Mesh;
    expect(back).toBeDefined();
    expect(side).toBeDefined();
    const glass = back.material as THREE.MeshBasicMaterial;
    expect(glass.transparent).toBe(true);
    expect(glass.opacity).toBeLessThan(0.5);
    lights.update(lightingAt(12 * 60), 40);
    const noon = glass.color.getHex();
    lights.update(lightingAt(23 * 60), 40);
    expect(glass.color.getHex()).not.toBe(noon);
    // Un montant par case sur les deux murs, un poteau par applique.
    const mullions = lights.root.getObjectByName('glass-mullions') as THREE.InstancedMesh;
    expect(mullions.count).toBe(layout.width + 1 + layout.depth + 1);
    expect((lights.root.getObjectByName('glass-pillars') as THREE.InstancedMesh).count).toBe(
      (lights.root.getObjectByName('lamp-wash') as THREE.InstancedMesh).count,
    );
    lights.dispose();
  });

  it('dessine des reflets en diagonale sur le verre', () => {
    const glass = glassTexture();
    const colors = new Set<number>();
    for (let x = 0; x < 64; x++) colors.add(glass.pixel(x, 0));
    expect(colors.size).toBe(2);
  });
});
