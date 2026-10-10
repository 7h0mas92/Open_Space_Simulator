import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildPrimitive } from '../../../src/render/primitives';
import { CATALOG } from '../../../src/view/catalog';

/** Les 8 plantes d'intérieur et leur forme Three.js. */
const PLANTS = {
  'snake-plant': 'snakePlant',
  pothos: 'pothos',
  bonsai: 'bonsai',
  'fiddle-leaf-fig': 'fiddleLeafFig',
  'kentia-palm': 'kentiaPalm',
  'olive-tree': 'oliveTree',
  'planter-box': 'planterBox',
  'giant-monstera': 'giantMonstera',
} as const;

describe('plantes d’intérieur', () => {
  it('chaque plante est au rayon Déco, avec sa forme et un pot repeignable', () => {
    for (const [kind, model] of Object.entries(PLANTS)) {
      const item = CATALOG.find((entry) => entry.kind === kind);
      expect(item, kind).toBeDefined();
      expect(item?.category).toBe('decor');
      expect(item?.model).toEqual({ source: 'primitive', model });
      expect(item?.paint.length).toBeGreaterThan(0);
    }
  });

  it('des petites, des grandes et des grosses : taille réelle conforme au catalogue', () => {
    for (const [kind, model] of Object.entries(PLANTS)) {
      const item = CATALOG.find((entry) => entry.kind === kind)!;
      const size = new THREE.Box3()
        .setFromObject(buildPrimitive(model))
        .getSize(new THREE.Vector3());
      // Posée au sol, à la hauteur annoncée, sans déborder beaucoup de son emprise.
      expect(size.y, kind).toBeGreaterThan(item.height * 0.8);
      expect(size.y, kind).toBeLessThan(item.height * 1.2);
      expect(size.x, kind).toBeLessThan(item.size[0] + 0.8);
      expect(size.z, kind).toBeLessThan(item.size[1] + 0.8);
    }
    const height = (kind: keyof typeof PLANTS) => CATALOG.find((e) => e.kind === kind)!.height;
    for (const small of ['snake-plant', 'pothos', 'bonsai'] as const)
      for (const tall of ['fiddle-leaf-fig', 'kentia-palm', 'olive-tree'] as const)
        expect(height(small)).toBeLessThan(height(tall));
  });

  it('les feuilles d’une même couleur sont fusionnées : quelques maillages par plante', () => {
    for (const model of Object.values(PLANTS)) {
      const meshes: THREE.Mesh[] = [];
      buildPrimitive(model).traverse((child) => {
        if (child instanceof THREE.Mesh) meshes.push(child);
      });
      expect(meshes.length, model).toBeGreaterThan(2);
      expect(meshes.length, model).toBeLessThan(25);
    }
  });

  it('la même plante à chaque partie (graine fixe)', () => {
    const vertices = (model: string) => {
      const group = buildPrimitive(model as 'bonsai');
      const box = new THREE.Box3().setFromObject(group);
      return [box.min.toArray(), box.max.toArray()].flat();
    };
    for (const model of Object.values(PLANTS)) expect(vertices(model)).toEqual(vertices(model));
  });
});
