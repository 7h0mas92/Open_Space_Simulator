import { describe, expect, it } from 'vitest';
import { STORY_ACTS, STORY_TOTAL_SPRINTS, type GameState } from '@oss/shared';
import { defaultCardLibrary } from '../../src/events/defaultCards';
import { createBot, playWithBot } from '../../src/simulation/bots';
import { endGame } from '../../src/simulation/endings';
import { replay } from '../../src/simulation/replay';
import { Simulation } from '../../src/simulation/simulation';
import { actProgress, checkMission, currentAct, goalProgress } from '../../src/simulation/story';
import { toGameView } from '../../src/view/adapter';
import { makeContext } from './fixtures';

const cards = defaultCardLibrary();
const VIEW_CONTEXT = { speed: 1, running: false, card: () => undefined } as const;

function campaign(seed = 'histoire'): Simulation {
  return Simulation.create({ seed, mode: 'STORY', mission: 'campaign' }, cards);
}

function check(state: GameState) {
  const ctx = makeContext(state);
  checkMission(state, ctx);
  return ctx.outbox;
}

/** Saute à un acte (comme si les précédents étaient finis), au début d'un sprint. */
function atAct(simulation: Simulation, act: number): GameState {
  const { state } = simulation;
  if (!state.story?.campaign) throw new Error('Pas une histoire');
  state.story.campaign.act = act;
  state.phase = STORY_ACTS[act]?.phase ?? 'GARAGE';
  return state;
}

describe('Histoire en actes : point de départ', () => {
  it('commence au garage, au prologue, pour environ 60 sprints', () => {
    const { state } = campaign();
    expect(state.mode).toBe('STORY');
    expect(state.phase).toBe('GARAGE');
    expect(state.totalSprints).toBe(STORY_TOTAL_SPRINTS);
    expect(state.story?.missionId).toBeUndefined();
    expect(state.story?.campaign).toMatchObject({ act: 0, done: [], missed: [] });
    expect(currentAct(state)?.id).toBe('prologue');
  });

  it('5 actes, chaque mission de la campagne dans un seul acte, dates limites croissantes', () => {
    expect(STORY_ACTS.map((act) => act.id)).toEqual([
      'prologue',
      'race',
      'price-war',
      'giant',
      'bell',
    ]);
    const sides = STORY_ACTS.flatMap((act) => act.side);
    expect(new Set(sides).size).toBe(sides.length);
    expect(sides).toHaveLength(10);
    const deadlines = STORY_ACTS.map((act) => act.deadline);
    expect([...deadlines].sort((a, b) => a - b)).toEqual(deadlines);
    expect(deadlines.at(-1)).toBe(STORY_TOTAL_SPRINTS);
  });

  it('les autres modes n’ont ni histoire ni acte', () => {
    const normal = Simulation.create({ seed: 'n', mode: 'NORMAL' }, cards);
    expect(normal.state.story).toBeNull();
    expect(actProgress(normal.state)).toBeNull();
    expect(toGameView(normal.state, VIEW_CONTEXT).campaign).toBeNull();
  });

  it('une mission courte n’est pas une histoire', () => {
    const mission = Simulation.create({ seed: 'm', mode: 'STORY', mission: 'first-commit' }, cards);
    expect(mission.state.story?.campaign).toBeUndefined();
    expect(actProgress(mission.state)).toBeNull();
  });
});

describe('Histoire en actes : objectifs', () => {
  it('un objectif secondaire rempli est noté, sans finir la partie', () => {
    const { state } = campaign();
    state.stats.featuresShipped = 3;
    const outbox = check(state);
    expect(state.story?.campaign?.done).toEqual(['first-commit']);
    expect(state.stage).not.toBe('ENDED');
    expect(outbox.some((n) => n.kind === 'STORY_GOAL')).toBe(true);
    // Une seule fois.
    expect(check(state).filter((n) => n.kind === 'STORY_GOAL')).toHaveLength(0);
  });

  it('une contrainte enfreinte rate l’objectif secondaire', () => {
    const { state } = campaign();
    state.stats.coffeeShortageDays = 1;
    check(state);
    expect(state.story?.campaign?.missed).toContain('coffee-first');
    expect(state.stage).not.toBe('ENDED');
  });

  it('l’objectif principal ouvre l’acte suivant ; les statistiques repartent de zéro', () => {
    const { state } = campaign();
    state.stats.featuresShipped = 1;
    state.phase = 'SEED';
    const outbox = check(state);
    const story = state.story!;
    // « Sortir du garage » est rempli au passage, « Premier commit » ne l'est plus.
    expect(story.campaign?.done).toContain('leave-garage');
    expect(story.campaign?.missed).toEqual(
      expect.arrayContaining(['first-commit', 'coffee-first']),
    );
    expect(story.campaign?.act).toBe(1);
    expect(story.startSprint).toBe(state.sprint);
    expect(outbox.some((n) => n.kind === 'STORY_ACT')).toBe(true);
    expect(goalProgress(state, { kind: 'stat', stat: 'featuresShipped', min: 1 }).value).toBe(0);
  });

  it('la date limite dépassée arrête l’histoire', () => {
    const simulation = campaign();
    const { state } = simulation;
    state.sprint = STORY_ACTS[0]!.deadline;
    state.stage = 'DEMO';
    simulation.dispatch({ type: 'END_DEMO' });
    expect(state.stage).toBe('ENDED');
    expect(state.result?.campaign).toEqual({
      act: 'prologue',
      success: false,
      failure: 'TIME',
      ending: null,
    });
  });

  it('avant la date limite, la partie continue', () => {
    const simulation = campaign();
    const { state } = simulation;
    state.sprint = STORY_ACTS[0]!.deadline - 1;
    state.stage = 'DEMO';
    simulation.dispatch({ type: 'END_DEMO' });
    expect(state.stage).toBe('PLANNING');
    expect(state.result).toBeNull();
  });
});

describe('Histoire en actes : fins', () => {
  it('une entrée en Bourse à partir de « Le géant » termine l’histoire avec succès', () => {
    const simulation = campaign();
    const state = atAct(simulation, 3);
    state.valuation = 2_500_000_000;
    state.gauges.stability = 80;
    endGame(state, makeContext(state), 'IPO');
    check(state);
    expect(state.result?.campaign).toEqual({
      act: 'giant',
      success: true,
      failure: null,
      ending: 'IPO',
    });
  });

  it('au dernier acte, la cloche de la Bourse est remplie au moment de la sortie', () => {
    const simulation = campaign();
    const state = atAct(simulation, 4);
    state.valuation = 2_500_000_000;
    state.gauges.stability = 80;
    endGame(state, makeContext(state), 'ACQUISITION');
    check(state);
    expect(state.result?.campaign?.ending).toBe('ACQUISITION');
    expect(state.story?.campaign?.done).toContain('opening-bell');
  });

  it('vendre trop tôt arrête l’histoire', () => {
    const simulation = campaign();
    const state = atAct(simulation, 1);
    endGame(state, makeContext(state), 'ACQUISITION');
    check(state);
    expect(state.result?.campaign).toMatchObject({ success: false, failure: 'SOLD' });
  });

  it('la faillite arrête l’histoire', () => {
    const { state } = campaign();
    endGame(state, makeContext(state), 'BANKRUPTCY');
    check(state);
    expect(state.result?.campaign).toMatchObject({ success: false, failure: 'BANKRUPTCY' });
  });
});

describe('Histoire en actes : déterminisme', () => {
  it('le rejeu des commandes retrouve les mêmes objectifs', () => {
    const simulation = campaign('rejeu');
    playWithBot(
      simulation,
      createBot('balanced', 'rejeu'),
      cards,
      (state) => (state.story?.campaign?.act ?? 0) >= 1,
    );
    const { state } = simulation;
    expect(state.story?.campaign?.act).toBe(1);
    const again = replay({
      seed: 'rejeu',
      mode: 'STORY',
      mission: 'campaign',
      commands: simulation.commands,
      cards,
    });
    expect(again.state.story?.campaign?.done).toEqual(
      expect.arrayContaining(state.story?.campaign?.done ?? []),
    );
    expect(again.state.story?.campaign?.act).toBeGreaterThanOrEqual(1);
  });

  it('la vue donne l’acte, sa date limite et ses objectifs secondaires', () => {
    const { state } = campaign();
    const view = toGameView(state, VIEW_CONTEXT).campaign;
    expect(view).toMatchObject({ act: 'prologue', actIndex: 0, deadline: 12 });
    expect(view?.side.map((side) => side.id)).toEqual([
      'first-commit',
      'coffee-first',
      'leave-garage',
    ]);
    expect(view?.goals).toHaveLength(1);
  });
});
