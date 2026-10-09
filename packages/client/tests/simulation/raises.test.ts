import { describe, expect, it } from 'vitest';
import { BALANCE, EVENT_CARDS, GameStateSchema, type GameState } from '@oss/shared';
import { CardLibrary } from '../../src/events/library';
import { createBot, playWithBot } from '../../src/simulation/bots';
import { generateDev, hireDev } from '../../src/simulation/devs';
import { answerRaise, raisePlanning } from '../../src/simulation/raises';
import { replay } from '../../src/simulation/replay';
import { Rng } from '../../src/simulation/rng';
import { Simulation } from '../../src/simulation/simulation';
import { createEmptyState } from '../../src/simulation/state';
import { toGameView } from '../../src/view/adapter';
import { makeContext } from './fixtures';

const SPRINT = 10;

/** Startup en planification au sprint 10, avec `size` devs arrivés au sprint 1. */
function planningState(seed: string, size = 3): GameState {
  const state = createEmptyState({ seed, mode: 'NORMAL' });
  state.phase = 'SEED';
  const ctx = makeContext(state, { rng: new Rng([5, 6, 7, 8]) });
  for (let i = 0; i < size; i++) {
    const profile = generateDev(ctx.rng, 'SENIOR_BEARD');
    hireDev(state, ctx, profile, profile.askingSalary);
  }
  state.sprint = SPRINT;
  state.stage = 'PLANNING';
  state.raises.nextSprint = SPRINT;
  return state;
}

/** Première graine (parmi quelques dizaines) dont l'état vérifie `accept`. */
function findSeed(make: (seed: string) => GameState, accept: (state: GameState) => boolean) {
  for (let i = 0; i < 200; i++) {
    const state = make(`raise-${i}`);
    if (accept(state)) return state;
  }
  throw new Error('aucune graine ne convient');
}

/** État avec une demande en attente. */
function withRequest(): GameState {
  return findSeed(
    (seed) => {
      const state = planningState(seed);
      raisePlanning(state, makeContext(state));
      return state;
    },
    (state) => state.raises.pending !== null,
  );
}

const skillSum = (state: GameState, devId: string) => {
  const stats = state.components.stats[devId];
  return stats ? stats.speed + stats.quality + stats.endurance : 0;
};

describe('Demandes d’augmentation : déclenchement', () => {
  it('programme la première occasion entre 5 et 10 sprints plus tard', () => {
    const state = planningState('schedule');
    state.raises.nextSprint = null;
    raisePlanning(state, makeContext(state));
    const next = state.raises.nextSprint ?? 0;
    expect(next - SPRINT).toBeGreaterThanOrEqual(BALANCE.raises.minIntervalSprints);
    expect(next - SPRINT).toBeLessThanOrEqual(BALANCE.raises.maxIntervalSprints);
    expect(state.raises.pending).toBeNull();
  });

  it('ne se déclenche pas avec moins de 3 devs, et l’occasion attend', () => {
    for (let i = 0; i < 30; i++) {
      const state = planningState(`small-${i}`, 2);
      raisePlanning(state, makeContext(state));
      expect(state.raises.pending).toBeNull();
      expect(state.raises.nextSprint).toBe(SPRINT);
    }
  });

  it('se déclenche environ selon la probabilité réglée, puis reprogramme l’occasion', () => {
    let requests = 0;
    const games = 200;
    for (let i = 0; i < games; i++) {
      const state = planningState(`odds-${i}`);
      raisePlanning(state, makeContext(state));
      if (state.raises.pending) requests += 1;
      const gap = (state.raises.nextSprint ?? 0) - SPRINT;
      expect(gap).toBeGreaterThanOrEqual(BALANCE.raises.minIntervalSprints);
      expect(gap).toBeLessThanOrEqual(BALANCE.raises.maxIntervalSprints);
    }
    expect(requests / games).toBeGreaterThan(BALANCE.raises.chance - 0.15);
    expect(requests / games).toBeLessThan(BALANCE.raises.chance + 0.15);
  });

  it('demande un salaire 10 à 20 % plus haut, toujours le même pour une graine', () => {
    const state = withRequest();
    const request = state.raises.pending;
    expect(request).not.toBeNull();
    if (!request) return;
    const ratio = request.requestedSalary / request.currentSalary;
    expect(ratio).toBeGreaterThanOrEqual(1 + BALANCE.raises.minRaise - 0.01);
    expect(ratio).toBeLessThanOrEqual(1 + BALANCE.raises.maxRaise + 0.01);
    const again = planningState(state.seed);
    raisePlanning(again, makeContext(again));
    expect(again.raises).toEqual(state.raises);
  });

  it('n’utilise jamais le générateur de la partie', () => {
    const state = withRequest();
    const before = [...state.rng];
    answerRaise(state, makeContext(state), false);
    state.sprint += BALANCE.raises.noticeSprints;
    raisePlanning(state, makeContext(state));
    expect(state.rng).toEqual(before);
  });

  it('bloque le lancement du sprint tant que le joueur n’a pas répondu', () => {
    const state = withRequest();
    const simulation = Simulation.restore(state, new CardLibrary([]));
    expect(simulation.dispatch({ type: 'START_SPRINT' }).result).toEqual({
      ok: false,
      error: 'RAISE_PENDING',
    });
    expect(simulation.dispatch({ type: 'ANSWER_RAISE', accept: true }).result).toEqual({
      ok: true,
    });
    expect(simulation.dispatch({ type: 'START_SPRINT' }).result).toEqual({ ok: true });
  });

  it('apparaît dans la vue pour la fenêtre de décision', () => {
    const state = withRequest();
    const view = toGameView(state, { speed: 1, running: false, card: () => undefined });
    expect(view.raiseRequest?.devId).toBe(state.raises.pending?.devId);
    expect(view.raiseRequest?.resignChance).toBe(BALANCE.raises.resignChance);
  });
});

describe('Demandes d’augmentation : réponse du joueur', () => {
  it('acceptée : nouveau salaire, plus de moral, compétences en hausse', () => {
    const state = withRequest();
    const request = state.raises.pending;
    if (!request) throw new Error('pas de demande');
    const { devId } = request;
    const moral = state.components.mood[devId]?.moral ?? 0;
    const skills = skillSum(state, devId);
    const ctx = makeContext(state);
    expect(answerRaise(state, ctx, true)).toEqual({ ok: true });
    expect(state.components.employment[devId]?.salary).toBe(request.requestedSalary);
    expect(state.components.mood[devId]?.moral).toBeGreaterThan(moral);
    expect(skillSum(state, devId)).toBe(skills + BALANCE.raises.skillsGained);
    expect(state.raises).toMatchObject({ pending: null, granted: 1, refused: 0 });
    expect(ctx.outbox.map((n) => n.kind)).toContain('RAISE_GRANTED');
  });

  it('refusée : démission, départ deux planifications plus tard', () => {
    const state = findSeed(
      (seed) => {
        const s = planningState(seed);
        raisePlanning(s, makeContext(s));
        if (s.raises.pending) answerRaise(s, makeContext(s), false);
        return s;
      },
      (s) => s.raises.departures.length > 0,
    );
    const departure = state.raises.departures[0];
    if (!departure) throw new Error('pas de départ');
    expect(departure.leavesAtSprint).toBe(SPRINT + BALANCE.raises.noticeSprints);
    const view = toGameView(state, { speed: 1, running: false, card: () => undefined });
    expect(view.devs.find((dev) => dev.id === departure.devId)?.leavingAtSprint).toBe(
      departure.leavesAtSprint,
    );

    state.sprint = SPRINT + 1;
    raisePlanning(state, makeContext(state));
    expect(state.components.identity[departure.devId]).toBeDefined();

    state.sprint = SPRINT + 2;
    const ctx = makeContext(state);
    raisePlanning(state, ctx);
    expect(state.components.identity[departure.devId]).toBeUndefined();
    expect(state.raises.departures).toEqual([]);
    expect(ctx.outbox.map((n) => n.kind)).toContain('DEV_RESIGNED');
  });

  it('refusée : sinon le dev reste mais perd des compétences', () => {
    const state = findSeed(
      (seed) => {
        const s = planningState(seed);
        raisePlanning(s, makeContext(s));
        return s;
      },
      (s) => {
        if (!s.raises.pending) return false;
        const copy = structuredClone(s);
        answerRaise(copy, makeContext(copy), false);
        return copy.raises.departures.length === 0;
      },
    );
    const devId = state.raises.pending?.devId ?? '';
    const skills = skillSum(state, devId);
    const salary = state.components.employment[devId]?.salary;
    const ctx = makeContext(state);
    answerRaise(state, ctx, false);
    expect(skillSum(state, devId)).toBe(skills - BALANCE.raises.skillsLost);
    expect(state.components.employment[devId]?.salary).toBe(salary);
    expect(state.raises.refused).toBe(1);
    expect(ctx.outbox.map((n) => n.kind)).toContain('RAISE_REFUSED');
  });

  it('un dev licencié pendant son préavis n’est plus attendu au départ', () => {
    const state = withRequest();
    const devId = state.raises.pending?.devId ?? '';
    state.raises.departures.push({ devId, leavesAtSprint: SPRINT + 2 });
    const simulation = Simulation.restore(state, new CardLibrary([]));
    expect(simulation.dispatch({ type: 'FIRE_DEV', devId }).result).toEqual({ ok: true });
    expect(state.raises.pending).toBeNull();
    expect(state.raises.departures).toEqual([]);
  });

  it('refuse une réponse sans demande, ou hors planification', () => {
    const state = planningState('none');
    expect(answerRaise(state, makeContext(state), true)).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
    const pending = withRequest();
    pending.stage = 'EXECUTION';
    expect(answerRaise(pending, makeContext(pending), true)).toEqual({
      ok: false,
      error: 'WRONG_STAGE',
    });
  });
});

describe('Demandes d’augmentation : sauvegardes et parties complètes', () => {
  it('une sauvegarde d’avant les augmentations se charge', () => {
    const state = planningState('old-save');
    const json = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    delete json.raises;
    const parsed = GameStateSchema.parse(json);
    expect(parsed.raises).toEqual({
      nextSprint: null,
      pending: null,
      departures: [],
      granted: 0,
      refused: 0,
    });
  });

  // Parties complètes et rejouées : plusieurs secondes sur une machine chargée (CI).
  it('les bots répondent aux demandes et la partie se rejoue à l’identique', () => {
    const cards = new CardLibrary(EVENT_CARDS);
    let answered = 0;
    for (const seed of ['raise-game-1', 'raise-game-2']) {
      const simulation = Simulation.create({ seed, mode: 'NORMAL' }, cards);
      playWithBot(simulation, createBot('balanced', seed), cards);
      answered += simulation.state.raises.granted + simulation.state.raises.refused;
      const replayed = replay({ seed, mode: 'NORMAL', commands: simulation.commands, cards });
      expect(replayed.state).toEqual(simulation.state);
    }
    expect(answered).toBeGreaterThan(0);
  }, 20_000);
});
