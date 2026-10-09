import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { AssetLibrary } from '../../../src/render/assets';
import { CharacterView } from '../../../src/render/characters';
import { ConfettiEffect, SmokeEffect } from '../../../src/render/effects';
import { itemMatrix, OfficeView } from '../../../src/render/office';
import { buildPrimitive, fallbackBox, fallbackCharacter } from '../../../src/render/primitives';
import { MISSING_ASSETS } from '../../../src/render/assetManifest';
import { officeLayout } from '../../../src/view/layout';
import { officeSimulation, SEED_OFFICE, viewOf } from '../fixtures/game';

/** Bibliothèque factice : aucun GLB (comme sans les packs Kenney), formes de secours partout. */
const noAssets = {
  loadFurniture: async () => null,
  itemTemplate: async () => fallbackBox(1, 1, 0.5),
  character: async () => null,
} as unknown as AssetLibrary;

describe('formes de remplacement', () => {
  it('construit une forme pour chaque modèle 3D manquant', () => {
    for (const asset of MISSING_ASSETS) {
      const group = buildPrimitive(asset.id);
      if (asset.replacement === 'primitive')
        expect(group.children.length, asset.id).toBeGreaterThan(0);
    }
    const character = fallbackCharacter(0xff0000);
    expect(character.getObjectByName('head')).toBeDefined();
  });

  it('dessine le canapé et la bibliothèque détaillés en peu de maillages, à la bonne taille', () => {
    for (const id of ['sofa', 'bookcase'] as const) {
      const group = buildPrimitive(id);
      // Une centaine de pièces (coussins, livres…), fusionnées en un maillage par matériau.
      expect(group.children.length, id).toBeLessThanOrEqual(16);
      const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
      expect(size.x, id).toBeLessThanOrEqual(2);
      expect(size.z, id).toBeLessThanOrEqual(1);
    }
    // Les accessoires se posent sur le dessus de la bibliothèque, à 1,58.
    const bookcase = new THREE.Box3().setFromObject(buildPrimitive('bookcase'));
    expect(bookcase.max.y).toBeCloseTo(1.58, 2);
    // Le canapé se repeint : ses tissus portent les noms listés dans le catalogue.
    const names = new Set<string>();
    buildPrimitive('sofa').traverse((child) => {
      if (child instanceof THREE.Mesh) names.add((child.material as THREE.Material).name);
    });
    expect(names).toContain('fabric');
    expect(names).toContain('fabricDark');
  });
});

describe('décor', () => {
  it('dessine le mobilier en InstancedMesh, un objet cliquable par instance', async () => {
    const office = new OfficeView(noAssets);
    const view = viewOf(officeSimulation(SEED_OFFICE));
    office.setLayout(officeLayout(view.phase));
    await office.setItems(view.items);
    const meshes = office.pickables as THREE.InstancedMesh[];
    expect(meshes.length).toBeGreaterThan(0);
    const desks = view.items.filter((item) => item.kind === 'desk');
    const deskMesh = meshes.find(
      (mesh) => mesh.count === desks.length && mesh.userData.itemIds[0] === desks[0]!.id,
    );
    expect(deskMesh).toBeDefined();
    // Moins d'objets dessinés que d'objets posés : c'est tout l'intérêt de l'instanciation.
    expect(meshes.length).toBeLessThan(view.items.length);
    office.setDetail(0.1, 0.5);
    office.dispose();
  });

  it('place un objet au centre de son emprise et le tourne par quarts de tour', () => {
    const matrix = itemMatrix({ id: 'd', kind: 'desk', x: 2, z: 3, rotation: 1 });
    const position = new THREE.Vector3().setFromMatrixPosition(matrix);
    expect(position.toArray()).toEqual([2, 0, 3.5]);
  });
});

describe('personnages', () => {
  it('se replient sur un personnage procédural sans GLB et suivent l’instantané', () => {
    const character = new CharacterView('dev-1', 'INTERN', 3, noAssets);
    character.update(
      {
        id: 'dev-1',
        x: 2,
        z: 4,
        facing: 1,
        pose: 'sleep',
        visible: true,
        thought: null,
        using: null,
      },
      0.1,
      false,
    );
    expect(character.root.position.toArray()).toEqual([2, 0, 4]);
    expect(character.outlineTarget.rotation.x).toBeGreaterThan(0.2); // penché sur le clavier
    character.update(
      {
        id: 'dev-1',
        x: 2,
        z: 4,
        facing: 1,
        pose: 'walk',
        visible: false,
        thought: null,
        using: null,
      },
      0.1,
      true,
    );
    expect(character.root.visible).toBe(false);
    character.dispose();
  });
});

describe('effets', () => {
  it('émet de la fumée pendant un incident puis la dissipe', () => {
    const smoke = new SmokeEffect(50, new THREE.Vector3(1, 0, 1));
    smoke.active = true;
    for (let i = 0; i < 10; i++) smoke.update(0.1);
    expect(smoke.count).toBeGreaterThan(0);
    smoke.active = false;
    for (let i = 0; i < 50; i++) smoke.update(0.1);
    expect(smoke.count).toBe(0);
  });

  it('lance des confettis qui retombent', () => {
    const confetti = new ConfettiEffect(40);
    confetti.burst(new THREE.Vector3());
    confetti.update(0.1);
    expect(confetti.count).toBe(40);
    for (let i = 0; i < 60; i++) confetti.update(0.1);
    expect(confetti.count).toBe(0);
  });
});
