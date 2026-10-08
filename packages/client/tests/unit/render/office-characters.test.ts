import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../../../src/render/assetManifest';
import {
  addAccessories,
  BLOCKY_HEIGHT,
  buildCharacter,
  lookFor,
  lookKey,
  OFF_THEME_CHARACTERS,
  ROLE_LOOKS,
} from '../../../src/render/officeCharacters';
import { DEV_ROLES } from '../../../src/view/types';

/** Nœuds animés par les clips des GLB Blocky Characters. */
const ANIMATED_NODES = ['root', 'torso', 'head', 'arm-left', 'arm-right', 'leg-left', 'leg-right'];

describe('personnages selon le profil', () => {
  it('chaque profil a au moins un look, et jamais un personnage hors thème', () => {
    for (const role of DEV_ROLES) {
      const looks = ROLE_LOOKS[role];
      expect(looks.length, role).toBeGreaterThan(0);
      for (const look of looks) {
        if (look.kind === 'kenney') {
          expect(CHARACTER_IDS).toContain(look.id);
          expect(OFF_THEME_CHARACTERS).not.toContain(look.id);
        }
      }
    }
  });

  it('les looks sont tous différents, même entre profils', () => {
    const keys = DEV_ROLES.flatMap((role) => ROLE_LOOKS[role].map(lookKey));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('le tirage du dev choisit toujours le même look dans la liste de son profil', () => {
    for (const role of DEV_ROLES) {
      for (let look = 0; look < 18; look += 1) {
        expect(ROLE_LOOKS[role]).toContain(lookFor(role, look));
        expect(lookFor(role, look)).toBe(lookFor(role, look));
      }
    }
    // Chaque look du profil sort pour au moins un tirage.
    for (const role of DEV_ROLES) {
      const drawn = new Set(Array.from({ length: 18 }, (_, look) => lookFor(role, look)));
      expect(drawn.size).toBe(ROLE_LOOKS[role].length);
    }
  });
});

describe('personnages construits en Three.js', () => {
  const built = DEV_ROLES.flatMap((role) =>
    ROLE_LOOKS[role].flatMap((look) => (look.kind === 'built' ? [{ role, look }] : [])),
  );

  it('reprennent la hiérarchie des Blocky Characters pour jouer leurs clips', () => {
    expect(built.length).toBeGreaterThanOrEqual(12);
    for (const { role, look } of built) {
      const character = buildCharacter(look.outfit, look.accessories);
      for (const name of ANIMATED_NODES)
        expect(character.getObjectByName(name), role).toBeDefined();
      // Tête réduite à 0.1 comme dans les GLB (certains clips animent son échelle).
      expect(character.getObjectByName('head')?.scale.x).toBeCloseTo(0.1);
    }
  });

  it('mesurent la hauteur d’un personnage Kenney, hors accessoires', () => {
    const look = ROLE_LOOKS.INTERN.find((candidate) => candidate.kind === 'built');
    if (look?.kind !== 'built') throw new Error('Stagiaire construit attendu');
    const character = buildCharacter(look.outfit, []);
    character.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(character);
    expect(box.min.y).toBeCloseTo(0, 1);
    expect(box.max.y).toBeGreaterThan(BLOCKY_HEIGHT - 0.05);
    expect(box.max.y).toBeLessThan(BLOCKY_HEIGHT + 0.15);
  });

  it('restent légers : une dizaine de maillages par personnage', () => {
    for (const { look } of built) {
      let meshes = 0;
      buildCharacter(look.outfit, look.accessories).traverse((child) => {
        if (child instanceof THREE.Mesh) meshes += 1;
      });
      expect(meshes).toBeLessThanOrEqual(12);
    }
  });

  it('accrochent les accessoires à la tête et au torse d’un personnage Kenney', () => {
    // Squelette minimal au format des GLB Kenney.
    const root = new THREE.Group();
    const torso = new THREE.Group();
    torso.name = 'torso';
    const head = new THREE.Group();
    head.name = 'head';
    head.scale.setScalar(0.1);
    torso.add(head);
    root.add(torso);
    addAccessories(root, ['greyBeard', 'crabOnShoulder'], { hair: 0x333333, shirt: 0xffffff });
    expect(head.getObjectByName('head-accessories')).toBeDefined();
    expect(torso.getObjectByName('torso-accessories')).toBeDefined();
  });
});
