import { describe, expect, it } from 'vitest';
import { toCommand } from '../../../src/view/adapter';
import { officeSimulation, SEED_OFFICE, viewOf } from '../fixtures/game';

describe('adaptateur simulation → vue', () => {
  const simulation = officeSimulation(SEED_OFFICE);
  const view = viewOf(simulation);

  it('traduit l’état de la simulation en instantané d’affichage', () => {
    expect(view).toMatchObject({ phase: 'SEED', step: 'PLANNING', teamMax: 6, event: null });
    expect(view.time).toMatchObject({ sprint: 1, totalSprints: 39, day: 0, minute: 8 * 60 });
    expect(view.devs).toHaveLength(4);
    // Le Dev Fantôme télétravaille ; en planification, les autres sont à leur bureau.
    expect(view.devs.find((dev) => dev.role === 'GHOST')?.activity).toBe('REMOTE');
    expect(view.devs.filter((dev) => dev.role !== 'GHOST').map((dev) => dev.activity)).toEqual([
      'WORKING',
      'WORKING',
      'WORKING',
    ]);
    expect(view.tasks.every((task) => task.column === 'BACKLOG')).toBe(true);
    expect(view.candidates).toHaveLength(5);
    expect(view.items.find((item) => item.kind === 'espresso-machine')).toMatchObject({
      x: 12,
      z: 1,
      resale: 0,
    });
    expect(view.pitchBlocker).toBeNull();
  });

  it('suit les étapes : exécution, carte d’événement, incident', () => {
    const running = officeSimulation(SEED_OFFICE);
    running.dispatch({ type: 'START_SPRINT' });
    running.state.events.pending = { cardId: 'coffee-machine-broken', level: 1, drawnAtTick: 0 };
    running.state.notifications.push({
      tick: running.state.tick,
      kind: 'PROD_DOWN',
      text: { fr: 'Prod down', en: 'Prod down' },
      entityId: null,
    });
    const next = viewOf(running);
    expect(next.step).toBe('EXECUTION');
    expect(next.pitchBlocker).toBe('WRONG_STAGE');
    expect(next.incident).toBe(true);
    expect(next.event?.level).toBe(1);
    expect(next.event?.choices.length).toBeGreaterThanOrEqual(2);
  });

  it('traduit les commandes de l’interface en commandes de la simulation', () => {
    const item = view.items[0]!;
    expect(toCommand({ type: 'setSpeed', speed: 2 }, view)).toBeNull();
    expect(toCommand({ type: 'moveTask', taskId: 'e9', column: 'DOING', index: 0 }, view)).toBe(
      null,
    );
    expect(toCommand({ type: 'moveTask', taskId: 'e9', column: 'TODO', index: 1 }, view)).toEqual({
      type: 'MOVE_TASK',
      taskId: 'e9',
      column: 'TODO',
      index: 1,
    });
    expect(toCommand({ type: 'hire', candidateId: 'c1-0', offer: 5000 }, view)).toEqual({
      type: 'MAKE_OFFER',
      candidateId: 'c1-0',
      salary: 5000,
    });
    expect(toCommand({ type: 'rotateItem', itemId: item.id }, view)).toEqual({
      type: 'MOVE_FURNITURE',
      furnitureId: item.id,
      x: item.x,
      y: item.z,
      rotation: (item.rotation + 1) % 4,
    });
    expect(toCommand({ type: 'placeItem', kind: 'plant', x: 3, z: 4, rotation: 1 }, view)).toEqual({
      type: 'BUY_FURNITURE',
      itemId: 'plant',
      x: 3,
      y: 4,
      rotation: 1,
    });
    expect(toCommand({ type: 'endDemo' }, view)).toEqual({ type: 'END_DEMO' });
  });
});
