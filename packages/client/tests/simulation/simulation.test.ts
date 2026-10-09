import { GameStateSchema, SaveDataSchema, TIME } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { defaultCardLibrary } from '../../src/events/defaultCards';
import { createBot, playWithBot } from '../../src/simulation/bots';
import { replay, ReplayError } from '../../src/simulation/replay';
import { Simulation } from '../../src/simulation/simulation';
import { tasksInColumn } from '../../src/simulation/tasks';

const cards = defaultCardLibrary();

/** Joue une partie complète avec le bot « balanced ». */
function playFull(seed: string) {
  const simulation = Simulation.create({ seed, mode: 'NORMAL' }, cards);
  playWithBot(simulation, createBot('balanced', seed), cards);
  return simulation;
}

describe('Nouvelle partie', () => {
  it('démarre au garage, en planification, avec un dev, des candidats et un backlog', () => {
    const { state } = Simulation.create({ seed: 'start', mode: 'NORMAL' }, cards);
    expect(state.phase).toBe('GARAGE');
    expect(state.stage).toBe('PLANNING');
    expect(state.sprint).toBe(1);
    expect(Object.keys(state.components.identity)).toHaveLength(1);
    // 3 profils historiques et 2 de l'équipe web.
    expect(state.candidates).toHaveLength(5);
    expect(tasksInColumn(state, 'BACKLOG').length).toBeGreaterThanOrEqual(8);
    expect(state.gauges.treasury).toBe(2_000_000);
    expect(() => GameStateSchema.parse(state)).not.toThrow();
  });

  it('ne recrute que des stagiaires en mode Stagiaires Only', () => {
    const { state } = Simulation.create({ seed: 'interns', mode: 'INTERNS_ONLY' }, cards);
    expect(Object.values(state.components.identity).every((i) => i.role === 'INTERN')).toBe(true);
    expect(state.candidates.every((c) => c.identity.role === 'INTERN')).toBe(true);
  });

  it("n'avance pas pendant la planification", () => {
    const simulation = Simulation.create({ seed: 'plan', mode: 'NORMAL' }, cards);
    expect(simulation.isRunning).toBe(false);
    expect(simulation.step()).toEqual([]);
    expect(simulation.state.tick).toBe(0);
  });
});

describe('Déterminisme', () => {
  it('la même graine et les mêmes commandes donnent exactement la même partie', () => {
    const a = playFull('determinism');
    const b = playFull('determinism');
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.state.stage).toBe('ENDED');
  });

  it('des graines différentes donnent des parties différentes', () => {
    expect(JSON.stringify(playFull('seed-a').state)).not.toBe(
      JSON.stringify(playFull('seed-b').state),
    );
  });

  it('rejoue une partie à partir de la graine et des commandes (replay)', () => {
    const original = playFull('replay');
    const replayed = replay({ seed: 'replay', mode: 'NORMAL', commands: original.commands, cards });
    expect(JSON.stringify(replayed.state)).toBe(JSON.stringify(original.state));
  });

  it('détecte un journal de commandes falsifié', () => {
    const original = playFull('cheat');
    const forged = original.commands.map((entry) => ({ ...entry, tick: entry.tick + 10_000 }));
    expect(() => replay({ seed: 'cheat', mode: 'NORMAL', commands: forged, cards })).toThrow(
      ReplayError,
    );
    const refused = [{ tick: 0, command: { type: 'END_DEMO' as const } }];
    expect(() => replay({ seed: 'cheat', mode: 'NORMAL', commands: refused, cards })).toThrow(
      /refusée/,
    );
  });

  it('refuse une commande dont le tick est déjà passé', () => {
    const late = [
      { tick: 0, command: { type: 'START_SPRINT' as const } },
      { tick: 0, command: { type: 'START_SPRINT' as const } },
    ];
    expect(() => replay({ seed: 'late', mode: 'NORMAL', commands: late, cards })).toThrow(
      ReplayError,
    );
  });
});

describe('Sauvegarde instantanée', () => {
  it('une partie sauvegardée puis rechargée continue à l’identique', () => {
    const uninterrupted = Simulation.create({ seed: 'save', mode: 'NORMAL' }, cards);
    const interrupted = Simulation.create({ seed: 'save', mode: 'NORMAL' }, cards);
    const bot = () => createBot('balanced', 'save');

    // On joue 5 sprints, on sauvegarde (aller-retour JSON), on recharge et on finit la partie.
    const firstBot = bot();
    playWithBot(interrupted, firstBot, cards, (state) => state.sprint >= 5);
    expect(interrupted.state.sprint).toBe(5);
    const json = JSON.stringify({ state: interrupted.state, commands: interrupted.commands });
    const save = SaveDataSchema.parse(JSON.parse(json));
    const restored = Simulation.restore(save.state, cards, save.commands);
    playWithBot(restored, firstBot, cards);
    playWithBot(uninterrupted, bot(), cards);

    expect(JSON.stringify(restored.state)).toBe(JSON.stringify(uninterrupted.state));
    expect(restored.commands).toEqual(uninterrupted.commands);
  });
});

describe('Commandes invalides', () => {
  it("refuse une commande mal formée sans toucher à l'état", () => {
    const simulation = Simulation.create({ seed: 'invalid', mode: 'NORMAL' }, cards);
    const before = JSON.stringify(simulation.state);
    const { result } = simulation.dispatch({ type: 'NOPE' } as never);
    expect(result).toEqual({ ok: false, error: 'INVALID_COMMAND' });
    expect(simulation.dispatch({ type: 'END_DEMO' }).result.ok).toBe(false);
    expect(JSON.stringify(simulation.state)).toBe(before);
    expect(simulation.commands).toEqual([]);
  });
});

describe('Déroulement d’un sprint', () => {
  it('exécute 672 ticks puis passe en démo avec un bilan', () => {
    const simulation = Simulation.create({ seed: 'sprint', mode: 'NORMAL' }, cards);
    for (const id of tasksInColumn(simulation.state, 'BACKLOG').slice(0, 3)) {
      simulation.dispatch({ type: 'MOVE_TASK', taskId: id, column: 'TODO' });
    }
    expect(simulation.dispatch({ type: 'START_SPRINT' }).result.ok).toBe(true);
    let guard = 0;
    while (simulation.state.stage === 'EXECUTION' && guard++ < 50) {
      if (simulation.state.events.pending)
        simulation.dispatch({ type: 'RESOLVE_EVENT', choiceIndex: 0 });
      simulation.runUntilBlocked();
    }
    const { state } = simulation;
    expect(state.stage).toBe('DEMO');
    expect(state.tick).toBe(TIME.ticksPerSprint);
    expect(state.history.sprints).toHaveLength(1);
    expect(state.history.sprints[0]?.feedback).toHaveLength(3);
    expect(state.history.daily.length).toBeGreaterThanOrEqual(14);

    expect(simulation.dispatch({ type: 'END_DEMO' }).result.ok).toBe(true);
    expect(simulation.state.sprint).toBe(2);
    expect(simulation.state.stage).toBe('PLANNING');
  });

  // Parties complètes et rejouées : plusieurs secondes sur une machine chargée (CI).
  it('chaque bot termine une partie avec une issue', () => {
    for (const name of ['random', 'shipper', 'balanced', 'cautious'] as const) {
      const simulation = Simulation.create({ seed: `bot-${name}`, mode: 'NORMAL' }, cards);
      playWithBot(simulation, createBot(name, name), cards);
      expect(simulation.state.stage).toBe('ENDED');
      expect(simulation.state.result?.headline.fr).toMatch(/startup/);
    }
  }, 20_000);

  it('le défi « 3 sprints » se termine au bout de 3 sprints', () => {
    const simulation = Simulation.create({ seed: 'ship3', mode: 'SHIP_IN_3' }, cards);
    playWithBot(simulation, createBot('shipper', 'ship3'), cards);
    expect(simulation.state.stage).toBe('ENDED');
    expect(simulation.state.result?.sprint).toBe(3);
    expect(['ACQUISITION', 'ZOMBIE', 'BANKRUPTCY']).toContain(simulation.state.result?.outcome);
  });
});
