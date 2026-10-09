import { MEETING_FORMAT_IDS, type Phase } from '@oss/shared';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AgentWorld } from '../../../src/ai/agents';
import { buildNavGrid, NEIGHBORS_4 } from '../../../src/ai/grid';
import type { AssetLibrary } from '../../../src/render/assets';
import {
  buildMeetingRoom,
  lookSignature,
  MEETING_LOOKS,
  MEETING_PRIMITIVES,
} from '../../../src/render/meetingRoom';
import { planDecor } from '../../../src/view/decor';
import { officeLayout, roomAt, type Cell, type OfficeLayout } from '../../../src/view/layout';

/** Bibliothèque factice : aucun GLB, formes de secours partout. */
const noAssets = { loadFurniture: async () => null } as unknown as AssetLibrary;

const PHASES: Phase[] = ['SEED', 'SERIES_A', 'UNICORN'];

/** Cases atteignables depuis l'entrée, avec des cases bloquées en plus. */
function reachable(layout: OfficeLayout, blocked: readonly Cell[]): Set<string> {
  const grid = buildNavGrid(layout, []);
  for (const cell of blocked) grid.block(cell.x, cell.z);
  const seen = new Set<string>([`${layout.entrance.x},${layout.entrance.z}`]);
  const queue: Cell[] = [layout.entrance];
  for (const cell of queue) {
    for (const [dx, dz] of NEIGHBORS_4) {
      const next = { x: cell.x + dx, z: cell.z + dz };
      const key = `${next.x},${next.z}`;
      if (!grid.walkable(next.x, next.z) || seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return seen;
}

describe('Salle de réunion : plan', () => {
  it('pas de mobilier tant que la salle est vide, ni au garage', () => {
    const empty = planDecor(officeLayout('SEED'), [], [], false, () => 0);
    expect(empty.meeting).toBeNull();
    const garage = planDecor(officeLayout('GARAGE'), [], [], false, () => 0, 'brainstorm');
    expect(garage.meeting).toBeNull();
  });

  it('une table, des places atteignables, et aucune salle coupée du reste', () => {
    for (const phase of PHASES) {
      const layout = officeLayout(phase);
      for (const format of MEETING_FORMAT_IDS) {
        const plan = planDecor(layout, [], [], false, () => 0, format);
        const meeting = plan.meeting;
        expect(meeting, `${phase} ${format}`).not.toBeNull();
        if (!meeting) continue;
        const room = meeting.room;
        expect(room.kind).toBe('meeting');
        // La table et les objets restent dans la salle.
        for (const cell of [...meeting.wall, { x: meeting.table.x, z: meeting.table.z }])
          expect(roomAt(layout, cell)?.kind, `${phase} ${format}`).toBe('meeting');
        expect(meeting.seats.length, `${phase} ${format}`).toBeGreaterThanOrEqual(3);
        // Chaque place, et chaque case des autres salles, reste atteignable depuis l'entrée.
        const open = reachable(layout, plan.blocked);
        const before = reachable(layout, []);
        for (const seat of meeting.seats)
          expect(open.has(`${seat.cell.x},${seat.cell.z}`)).toBe(true);
        for (const key of before) {
          const [x = 0, z = 0] = key.split(',').map(Number);
          if (roomAt(layout, { x, z })?.kind !== 'meeting')
            expect(open.has(key), `${phase} ${format} ${key}`).toBe(true);
        }
      }
    }
  });

  it('la war room est tapissée d’écrans, les autres salles restent sobres', () => {
    const layout = officeLayout('UNICORN');
    const count = (format: (typeof MEETING_FORMAT_IDS)[number]) =>
      planDecor(layout, [], [], false, () => 0, format).meeting?.wall.length ?? 0;
    expect(count('war-room')).toBeGreaterThan(count('brainstorm'));
    expect(count('standup')).toBeLessThanOrEqual(2);
  });

  it('les participants prennent chacun une place autour de la table', () => {
    const world = new AgentWorld(1);
    const plan = planDecor(officeLayout('SEED'), [], [], false, () => 0, 'brainstorm');
    world.setDecor(plan.blocked, plan.party, plan.meeting?.seats ?? []);
    const agent = { x: 0, z: 0 } as Parameters<AgentWorld['meetingSpot']>[0];
    const spot = world.meetingSpot(agent);
    expect(spot && plan.meeting?.seats.some((s) => s.cell === spot.access)).toBe(true);
  });
});

describe('Salle de réunion : rendu', () => {
  it('chaque formule a un mobilier qui lui est propre', () => {
    const signatures = MEETING_FORMAT_IDS.map(lookSignature);
    expect(new Set(signatures).size).toBe(MEETING_FORMAT_IDS.length);
  });

  it('chaque forme Three.js dessine quelque chose et tient dans sa case', () => {
    for (const [name, build] of Object.entries(MEETING_PRIMITIVES)) {
      const shape = build();
      expect(shape.children.length, name).toBeGreaterThan(0);
      const box = new THREE.Box3().setFromObject(shape);
      expect(box.max.x - box.min.x, name).toBeLessThanOrEqual(1);
      expect(box.max.z - box.min.z, name).toBeLessThanOrEqual(1);
    }
  });

  it('meuble la salle même sans les modèles Kenney (formes de secours)', async () => {
    for (const format of MEETING_FORMAT_IDS) {
      const layout = officeLayout('UNICORN');
      const plan = planDecor(layout, [], [], false, () => 0, format).meeting;
      if (!plan) throw new Error(format);
      const group = await buildMeetingRoom(plan, layout, noAssets);
      expect(group.name).toBe(`meeting-room-${format}`);
      expect(group.children.length, format).toBeGreaterThan(plan.wall.length);
    }
    expect(MEETING_LOOKS.aquarium.glassWalls).toBe(true);
  });
});
