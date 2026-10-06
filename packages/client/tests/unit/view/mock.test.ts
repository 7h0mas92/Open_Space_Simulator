import { describe, expect, it } from 'vitest';
import { checkPlacement } from '../../../src/view/placement';
import { officeLayout } from '../../../src/view/layout';
import { MockGame } from '../../../src/view/mock';

describe('fausse partie', () => {
  it('ne bouge pas pendant la planification puis avance après le lancement du sprint', () => {
    const game = new MockGame(1);
    expect(game.advance(1)).toBe(0);
    game.dispatch({ type: 'startSprint' });
    expect(game.advance(1)).toBeGreaterThan(0);
    expect(game.view.time.minute).toBeGreaterThan(9 * 60);
  });

  it('est déterministe', () => {
    const play = () => {
      const game = new MockGame(77);
      game.dispatch({ type: 'startSprint' });
      for (let i = 0; i < 300; i++) game.advance(0.5);
      return game.view;
    };
    expect(play()).toEqual(play());
  });

  it('respecte la pause et la vitesse x4', () => {
    const game = new MockGame(1);
    game.dispatch({ type: 'startSprint' });
    game.dispatch({ type: 'setSpeed', speed: 0 });
    expect(game.advance(1)).toBe(0);
    game.dispatch({ type: 'setSpeed', speed: 4 });
    expect(game.advance(1)).toBe(40);
  });

  it('déplace une tâche dans le Kanban à la bonne position', () => {
    const game = new MockGame(1);
    const [first, second] = game.view.tasks;
    game.dispatch({ type: 'moveTask', taskId: first!.id, column: 'TODO', index: 0 });
    game.dispatch({ type: 'moveTask', taskId: second!.id, column: 'TODO', index: 0 });
    const todo = game.view.tasks.filter((t) => t.column === 'TODO').map((t) => t.id);
    expect(todo).toEqual([second!.id, first!.id]);
    expect(game.dispatch({ type: 'moveTask', taskId: 'x', column: 'TODO', index: 0 }).ok).toBe(
      false,
    );
  });

  it('achète, tourne, déplace et revend un objet', () => {
    const game = new MockGame(1);
    const treasury = game.view.gauges.treasury;
    expect(game.dispatch({ type: 'placeItem', kind: 'plant', x: 5, z: 8, rotation: 0 }).ok).toBe(
      true,
    );
    const plant = game.view.items.at(-1)!;
    expect(game.view.gauges.treasury).toBe(treasury - 90);
    expect(game.dispatch({ type: 'rotateItem', itemId: plant.id }).ok).toBe(true);
    expect(game.dispatch({ type: 'moveItem', itemId: plant.id, x: 6, z: 8 }).ok).toBe(true);
    expect(game.dispatch({ type: 'sellItem', itemId: plant.id }).ok).toBe(true);
    expect(game.view.gauges.treasury).toBe(treasury - 45);
  });

  it('refuse un objet verrouillé ou mal placé', () => {
    const game = new MockGame(1);
    expect(game.dispatch({ type: 'placeItem', kind: 'slide', x: 5, z: 6, rotation: 0 })).toEqual({
      ok: false,
      reason: 'locked',
    });
    expect(game.dispatch({ type: 'placeItem', kind: 'plant', x: 1, z: 1, rotation: 0 })).toEqual({
      ok: false,
      reason: 'overlap',
    });
  });

  it('embauche, refuse une offre trop basse et licencie', () => {
    const game = new MockGame(1);
    const [a, b] = game.view.candidates;
    expect(game.dispatch({ type: 'hire', candidateId: b!.id, offer: 1 })).toEqual({
      ok: false,
      reason: 'refused',
    });
    const team = game.view.devs.length;
    expect(
      game.dispatch({ type: 'hire', candidateId: a!.id, offer: a!.askingSalary * 1.1 }).ok,
    ).toBe(true);
    expect(game.view.devs).toHaveLength(team + 1);
    const fired = game.view.devs[0]!;
    expect(game.dispatch({ type: 'fire', devId: fired.id }).ok).toBe(true);
    expect(game.view.devs.every((dev) => dev.history[0] === 'colleagueFired')).toBe(true);
  });

  it('enchaîne les journées puis revient en planification en fin de sprint', () => {
    const game = new MockGame(3);
    game.dispatch({ type: 'startSprint' });
    for (let i = 0; i < 2000 && game.view.step === 'EXECUTION'; i++) game.advance(1);
    expect(game.view.step).toBe('PLANNING');
    expect(game.view.time.sprint).toBe(2);
    expect(game.view.history.length).toBeGreaterThan(10);
  });
});

describe('placement', () => {
  const layout = officeLayout('SEED');
  it('détecte les sorties de grille, murs, chevauchements et l’entrée', () => {
    expect(checkPlacement(layout, [], { kind: 'desk', x: 13, z: 0, rotation: 0 })).toBe(
      'outOfBounds',
    );
    expect(checkPlacement(layout, [], { kind: 'plant', x: 10, z: 0, rotation: 0 })).toBe('wall');
    expect(checkPlacement(layout, [], { kind: 'plant', x: 0, z: 9, rotation: 0 })).toBe('entrance');
    expect(checkPlacement(layout, [], { kind: 'nope', x: 0, z: 0, rotation: 0 })).toBe(
      'unknownItem',
    );
    const items = [{ id: 'a', kind: 'desk', x: 2, z: 2, rotation: 0 as const }];
    expect(checkPlacement(layout, items, { kind: 'plant', x: 3, z: 2, rotation: 0 })).toBe(
      'overlap',
    );
    expect(checkPlacement(layout, items, { kind: 'rug', x: 2, z: 2, rotation: 0 })).toBeNull();
    expect(
      checkPlacement(layout, items, { kind: 'desk', x: 3, z: 2, rotation: 0, ignoreId: 'a' }),
    ).toBeNull();
  });
});
