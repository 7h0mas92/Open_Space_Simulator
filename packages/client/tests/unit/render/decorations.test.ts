import { DECOR_THEMES } from '@oss/shared';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { accessCell, buildNavGrid, NEIGHBORS_4 } from '../../../src/ai/grid';
import { partyProps, THEME_MODELS } from '../../../src/render/decorModels';
import { decorKey, planDecor } from '../../../src/view/decor';
import { officeLayout, roomAt, type Cell } from '../../../src/view/layout';
import { officeSimulation, SEED_OFFICE, viewOf } from '../fixtures/game';

const floorCount = (theme: (typeof DECOR_THEMES)[number]) => THEME_MODELS[theme].floor.length;

function meshCount(object: THREE.Object3D): number {
  let count = 0;
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) count++;
  });
  return count;
}

describe('Décorations de saison', () => {
  it('chaque thème a 3 objets au sol, un objet de bureau et un décor mural', () => {
    for (const theme of DECOR_THEMES) {
      const models = THEME_MODELS[theme];
      expect(models.floor, theme).toHaveLength(3);
      for (const build of models.floor) expect(meshCount(build()), theme).toBeGreaterThan(1);
      expect(meshCount(models.desk()), theme).toBeGreaterThan(0);
      expect(meshCount(models.wall(14, 10)), theme).toBeGreaterThan(10);
    }
  });

  it('les objets au sol tiennent dans leur case et ne dépassent pas les murs', () => {
    for (const theme of DECOR_THEMES) {
      for (const build of THEME_MODELS[theme].floor) {
        const box = new THREE.Box3().setFromObject(build());
        expect(box.max.x - box.min.x, theme).toBeLessThanOrEqual(1.1);
        expect(box.max.z - box.min.z, theme).toBeLessThanOrEqual(1.1);
        expect(box.max.y, theme).toBeLessThanOrEqual(2.2);
      }
    }
  });

  it('les décorations ne coupent jamais le chemin vers un meuble', () => {
    const view = viewOf(officeSimulation(SEED_OFFICE));
    const layout = officeLayout(view.phase);
    const plan = planDecor(layout, view.items, ['HALLOWEEN', 'CHRISTMAS'], true, floorCount);
    expect(plan.floor.length).toBeGreaterThanOrEqual(4);
    expect(new Set(plan.floor.map((piece) => piece.theme))).toEqual(
      new Set(['HALLOWEEN', 'CHRISTMAS']),
    );

    const grid = buildNavGrid(layout, view.items);
    for (const cell of plan.blocked) {
      expect(grid.walkable(cell.x, cell.z)).toBe(true); // posé sur une case libre
      grid.block(cell.x, cell.z);
    }
    const seen = new Set<string>();
    const queue: Cell[] = [layout.entrance];
    for (const cell of queue) {
      for (const [dx, dz] of NEIGHBORS_4) {
        const next = { x: cell.x + dx, z: cell.z + dz };
        if (!grid.walkable(next.x, next.z) || seen.has(`${next.x},${next.z}`)) continue;
        seen.add(`${next.x},${next.z}`);
        queue.push(next);
      }
    }
    for (const item of view.items) {
      const access = accessCell(item);
      if (grid.walkable(access.x, access.z)) expect(seen.has(`${access.x},${access.z}`)).toBe(true);
    }
  });

  it('installe la table d’anniversaire dans la cuisine, sur deux cases, accessible', () => {
    const view = viewOf(officeSimulation(SEED_OFFICE));
    const layout = officeLayout(view.phase);
    const plan = planDecor(layout, view.items, [], true, floorCount);
    expect(plan.floor).toHaveLength(0);
    expect(plan.party).not.toBeNull();
    const party = plan.party!;
    expect(roomAt(layout, party.cell)?.kind).toBe('kitchen');
    expect(plan.blocked).toEqual([party.cell, { x: party.cell.x + 1, z: party.cell.z }]);
    expect(buildNavGrid(layout, view.items).walkable(party.access.x, party.access.z)).toBe(true);
    // Pas de fête : pas de table.
    expect(planDecor(layout, view.items, [], false, floorCount).party).toBeNull();
  });

  it('ne reconstruit le décor que si quelque chose change', () => {
    const view = viewOf(officeSimulation(SEED_OFFICE));
    const layout = officeLayout(view.phase);
    const key = decorKey(layout, view.items, ['EASTER'], false);
    expect(decorKey(layout, view.items, ['EASTER'], false)).toBe(key);
    expect(decorKey(layout, view.items, ['EASTER'], true)).not.toBe(key);
    expect(decorKey(layout, view.items.slice(1), ['EASTER'], false)).not.toBe(key);
  });

  it('la table de fête porte un gâteau à bougies, des cadeaux et des ballons', () => {
    const props = partyProps(0.66);
    expect(meshCount(props)).toBeGreaterThan(30);
    const box = new THREE.Box3().setFromObject(props);
    expect(box.min.y).toBeGreaterThan(-0.001);
    expect(box.max.y).toBeLessThan(2.3);
  });
});
