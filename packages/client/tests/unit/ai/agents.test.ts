import { describe, expect, it } from 'vitest';
import { AgentWorld } from '../../../src/ai/agents';
import { ALL_THOUGHTS, pickThought } from '../../../src/ai/thoughts';
import { Random } from '../../../src/ai/random';
import { MockGame } from '../../../src/view/mock';
import type { DevActivity, GameView } from '../../../src/view/types';
import fr from '../../../src/i18n/fr.json';
import en from '../../../src/i18n/en.json';

function withActivity(view: GameView, activity: DevActivity): GameView {
  return {
    ...view,
    devs: view.devs.map((dev) => ({
      ...dev,
      activity: dev.role === 'GHOST' ? 'REMOTE' : activity,
    })),
  };
}

function run(world: AgentWorld, view: GameView, steps: number) {
  world.sync(view);
  for (let i = 0; i < steps; i++) world.step();
  return world.snapshot();
}

describe('IA des personnages', () => {
  const view = new MockGame(42).view;

  it('est déterministe : même graine, mêmes positions', () => {
    const a = run(new AgentWorld(7), view, 200);
    const b = run(new AgentWorld(7), view, 200);
    expect(a).toEqual(b);
  });

  it('chaque dev rejoint un bureau différent et s’y assoit', () => {
    const snapshot = run(new AgentWorld(1), withActivity(view, 'WORKING'), 400);
    const visible = snapshot.filter((agent) => agent.visible);
    expect(visible.length).toBe(view.devs.length - 1); // le Dev Fantôme est en télétravail
    for (const agent of visible) expect(agent.pose).toBe('work');
    const cells = new Set(visible.map((a) => `${a.x},${a.z}`));
    expect(cells.size).toBe(visible.length);
  });

  it('le Dev Fantôme est invisible', () => {
    const snapshot = run(new AgentWorld(1), view, 10);
    const ghost = view.devs.find((dev) => dev.role === 'GHOST')!;
    expect(snapshot.find((a) => a.id === ghost.id)?.visible).toBe(false);
  });

  it('les devs vont au café sans se marcher dessus', () => {
    const snapshot = run(new AgentWorld(3), withActivity(view, 'COFFEE'), 500);
    const visible = snapshot.filter((agent) => agent.visible);
    expect(visible.every((a) => a.pose === 'drink')).toBe(true);
    expect(new Set(visible.map((a) => `${a.x},${a.z}`)).size).toBe(visible.length);
    // La machine à café est dans la cuisine (x > 10 en phase Seed).
    expect(visible.some((a) => a.x > 10)).toBe(true);
  });

  it('les devs qui partent le soir disparaissent par l’entrée', () => {
    const snapshot = run(new AgentWorld(3), withActivity(view, 'LEAVING'), 400);
    expect(snapshot.every((a) => !a.visible)).toBe(true);
  });

  it('réunion, babyfoot, discussion, dispute, sieste et cris ont chacun leur posture', () => {
    const expected: Partial<Record<DevActivity, string>> = {
      MEETING: 'meeting',
      CHATTING: 'talk',
      ARGUING: 'argue',
      SLEEPING: 'sleep',
      YELLING: 'yell',
    };
    for (const [activity, pose] of Object.entries(expected)) {
      const snapshot = run(new AgentWorld(5), withActivity(view, activity as DevActivity), 500);
      const poses = snapshot.filter((a) => a.visible).map((a) => a.pose);
      expect(poses, activity).toContain(pose);
    }
    // Sans babyfoot en phase Seed, les joueurs se rabattent sur la machine à café.
    const snapshot = run(new AgentWorld(5), withActivity(view, 'BABYFOOT'), 500);
    expect(snapshot.filter((a) => a.visible).every((a) => a.pose === 'play')).toBe(true);
  });

  it('suit les changements de bureau et de phase', () => {
    const world = new AgentWorld(9);
    run(world, view, 50);
    const game = new MockGame(42);
    game.setPhase('SERIES_A');
    const snapshot = run(world, withActivity(game.view, 'WORKING'), 600);
    expect(snapshot.filter((a) => a.visible).every((a) => a.pose === 'work')).toBe(true);
  });
});

describe('bulles de pensée', () => {
  it('privilégie la prod qui tombe pendant un incident', () => {
    const random = new Random(1);
    const thoughts = Array.from({ length: 50 }, () =>
      pickThought(
        { activity: 'WORKING', role: 'INTERN', morale: 80, incident: true, fridayFive: false },
        random,
      ),
    );
    expect(thoughts).toContain('prodDown');
  });

  it('un dev en télétravail ne pense pas (on ne le voit pas)', () => {
    expect(
      pickThought(
        { activity: 'REMOTE', role: 'GHOST', morale: 10, incident: true, fridayFive: true },
        new Random(1),
      ),
    ).toBeNull();
  });

  it('toutes les pensées sont traduites en français et en anglais', () => {
    for (const key of ALL_THOUGHTS) {
      expect(fr.thoughts, key).toHaveProperty(key);
      expect(en.thoughts, key).toHaveProperty(key);
    }
  });
});
