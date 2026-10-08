import { CHARACTER_PACKS, type ThemedPackId } from '@oss/shared';
import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  dressUp,
  PACK_COSTUMES,
  themedLookFor,
  themedLookKey,
} from '../../../src/render/characterPacks';
import { buildCharacter, lookFor, ROLE_LOOKS } from '../../../src/render/officeCharacters';
import { DEV_ROLES } from '../../../src/view/types';

const THEMED = CHARACTER_PACKS.filter((pack): pack is ThemedPackId => pack !== 'BASE');

describe('packs de personnages', () => {
  it('« Base » garde les looks habituels, seul ou mélangé à un pack à thème', () => {
    expect(themedLookFor('INTERN', 3, ['BASE'])).toEqual({
      look: lookFor('INTERN', 3),
      costume: null,
    });
    const mixed = Array.from({ length: 18 }, (_, look) =>
      themedLookFor('INTERN', look, ['BASE', 'PIRATES']),
    );
    expect(mixed.filter((themed) => themed.costume === null)).toHaveLength(9);
  });

  it('chaque pack à thème habille les 8 profils', () => {
    for (const pack of THEMED) {
      for (const role of DEV_ROLES)
        expect(PACK_COSTUMES[pack][role], `${pack} ${role}`).toBeDefined();
    }
  });

  it('sans pack actif, chaque dev garde son look habituel', () => {
    for (const role of DEV_ROLES) {
      for (let look = 0; look < 18; look += 1) {
        expect(themedLookFor(role, look, [])).toEqual({ look: lookFor(role, look), costume: null });
      }
    }
  });

  it('avec plusieurs packs, l’équipe se répartit entre eux, toujours de la même façon', () => {
    const packs = ['CHRISTMAS', 'HALLOWEEN'] as const;
    const costumes = new Set(
      Array.from({ length: 18 }, (_, look) => themedLookFor('INTERN', look, packs).costume),
    );
    expect(costumes).toEqual(
      new Set([PACK_COSTUMES.CHRISTMAS.INTERN, PACK_COSTUMES.HALLOWEEN.INTERN]),
    );
    expect(themedLookKey(themedLookFor('INTERN', 5, packs))).toBe(
      themedLookKey(themedLookFor('INTERN', 5, packs)),
    );
  });

  it('un chapeau de costume remplace béret et casquette, une citrouille cache aussi les lunettes', () => {
    const beret = ROLE_LOOKS.DESIGNER.findIndex((look) => look.accessories.includes('beret'));
    const christmas = themedLookFor('DESIGNER', beret, ['CHRISTMAS']);
    expect(christmas.look.accessories).not.toContain('beret');

    const cap = ROLE_LOOKS.INTERN.findIndex((look) => look.accessories.includes('capBack'));
    const halloween = themedLookFor('INTERN', cap, ['HALLOWEEN']);
    expect(halloween.costume?.head).toContain('pumpkinHead');
    expect(halloween.look.accessories).not.toContain('capBack');
    // La combinaison recouvre le badge du stagiaire.
    expect(halloween.look.accessories).not.toContain('badge');
  });

  it('accroche chaque pièce de costume au nœud animé qui la porte', () => {
    for (const pack of THEMED) {
      for (const role of DEV_ROLES) {
        const base = ROLE_LOOKS.SENIOR_BEARD.find((look) => look.kind === 'built');
        if (base?.kind !== 'built') throw new Error('personnage construit attendu');
        const character = buildCharacter(base.outfit, []);
        const costume = PACK_COSTUMES[pack][role];
        dressUp(character, costume);
        const head = character.getObjectByName('head');
        if (costume.head?.length || costume.mask !== undefined)
          expect(
            head?.getObjectByName('costume')?.children.length,
            `${pack} ${role}`,
          ).toBeGreaterThan(0);
        if (costume.suit) {
          for (const node of ['torso', 'arm-left', 'arm-right', 'leg-left', 'leg-right']) {
            const meshes: THREE.Object3D[] = [];
            character.getObjectByName(node)?.traverse((child) => {
              if (child.name.startsWith('costume-')) meshes.push(child);
            });
            expect(meshes.length, `${pack} ${role} ${node}`).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});
