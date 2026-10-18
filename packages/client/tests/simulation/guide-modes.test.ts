import { GAME_MODES, difficultyOf, type GameMode } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { defaultCardLibrary } from '../../src/events/defaultCards';
import { createBot } from '../../src/simulation/bots';
import { Simulation } from '../../src/simulation/simulation';
import { FRIDAY_CARD_ID } from '../../src/simulation/systems/incidents';
import type { Command } from '@oss/shared';
import {
  LESSON_IDS,
  LESSONS,
  nextLesson,
  stepsOf,
  type GuideScope,
  type LessonId,
} from '../../src/ui/tutorial/lessons';
import { viewOf } from '../unit/fixtures/game';

interface Opening {
  readonly sprint: number;
  readonly step: string;
  readonly tick: number;
}

interface Played {
  readonly opened: Partial<Record<LessonId, Opening>>;
  readonly order: LessonId[];
  /** Tick de la première carte tirée (null si aucune). */
  readonly firstCardTick: number | null;
  /** Nombre maximal de cartes tirées au hasard pendant un même sprint. */
  readonly maxCardsPerSprint: number;
  /** Nombre total de cartes « Vendredi 17h04 », imposées par une panne. */
  readonly fridayCards: number;
  /** Cartes que le joueur n'a pas eu le temps de choisir (résolues toutes seules). */
  readonly autoResolved: number;
  readonly lastSprint: number;
}

/**
 * Joue une vraie partie avec un bot, en faisant lire au « joueur » chaque chapitre dès
 * qu'il s'ouvre. Le tutoriel est observé toutes les heures de jeu, comme le ferait l'écran.
 */
function playWithGuide(mode: GameMode, seed: string, scope: GuideScope = 'full'): Played {
  const cards = defaultCardLibrary();
  const simulation = Simulation.create({ seed, mode }, cards);
  const bot = createBot('balanced', seed);
  const seen = new Set<LessonId>();
  const opened: Partial<Record<LessonId, Opening>> = {};
  const order: LessonId[] = [];
  let firstCardTick: number | null = null;
  let maxCardsPerSprint = 0;
  let fridayCards = 0;
  let autoResolved = 0;
  let lastPending: unknown = null;
  const drawn = new Map<number, number>();

  const read = () => {
    const view = viewOf(simulation);
    for (let id = nextLesson(view, seen, scope); id; id = nextLesson(view, seen, scope)) {
      opened[id] = { sprint: view.time.sprint, step: view.step, tick: simulation.state.tick };
      order.push(id);
      seen.add(id);
    }
  };

  for (let i = 0; i < 40_000 && simulation.state.stage !== 'ENDED'; i++) {
    const { state } = simulation;
    const { pending } = state.events;
    if (pending && pending !== lastPending) {
      firstCardTick ??= state.tick;
      if (pending.cardId === FRIDAY_CARD_ID) fridayCards++;
      else drawn.set(state.sprint, (drawn.get(state.sprint) ?? 0) + 1);
      maxCardsPerSprint = Math.max(maxCardsPerSprint, drawn.get(state.sprint) ?? 0);
    }
    lastPending = pending;
    if (simulation.isRunning) {
      if (state.tick % TICKS_PER_LOOK === 0) read();
      simulation.step();
      if (pending && simulation.state.events.pending !== pending) autoResolved++;
      continue;
    }
    read();
    const commands = bot.decide(state, cards);
    let progressed = false;
    for (const command of commands)
      progressed = simulation.dispatch(command).result.ok || progressed;
    if (!progressed) {
      const fallback: Command = state.events.pending
        ? { type: 'RESOLVE_EVENT', choiceIndex: 0 }
        : state.stage === 'PITCH'
          ? { type: 'CLOSE_PITCH' }
          : state.stage === 'DEMO'
            ? { type: 'END_DEMO' }
            : { type: 'START_SPRINT' };
      simulation.dispatch(fallback);
    }
  }
  return {
    opened,
    order,
    firstCardTick,
    maxCardsPerSprint,
    fridayCards,
    autoResolved,
    lastSprint: simulation.state.sprint,
  };
}

/** L'écran se met à jour bien plus souvent ; une fois par heure de jeu suffit ici. */
const TICKS_PER_LOOK = 2;
const SEEDS = ['guide-1', 'guide-2', 'guide-3'];
/** L'incident dépend du hasard (une panne peut ne jamais arriver) : il n'est pas exigé. */
const EXPECTED = LESSON_IDS.filter((id) => id !== 'incident');

describe('Chaque chapitre a du contenu dans chaque mode', () => {
  it.each(GAME_MODES)('%s', (mode) => {
    for (const lesson of LESSONS)
      expect(stepsOf(lesson, mode).length, lesson.id).toBeGreaterThan(0);
  });
});

describe.each(GAME_MODES)('Tutoriel complet en partie réelle : %s', (mode) => {
  const games = SEEDS.map((seed) => playWithGuide(mode, seed));

  it('ouvre tous les chapitres, dans l’ordre du sommaire', () => {
    for (const game of games) {
      expect(Object.keys(game.opened).sort()).toEqual(expect.arrayContaining([...EXPECTED].sort()));
      const ranks = game.order
        .filter((id) => id !== 'incident')
        .map((id) => LESSON_IDS.indexOf(id));
      // Seules les crises peuvent passer devant (une carte tombe quand elle veut).
      const withoutEvents = game.order
        .filter((id) => id !== 'incident' && id !== 'events')
        .map((id) => LESSON_IDS.indexOf(id));
      expect(withoutEvents).toEqual([...withoutEvents].sort((a, b) => a - b));
      expect(ranks.length).toBeGreaterThanOrEqual(EXPECTED.length);
    }
  });

  it('ouvre les premiers chapitres au premier sprint, au bon moment', () => {
    for (const { opened } of games) {
      expect(opened.basics).toMatchObject({ sprint: 1, step: 'PLANNING' });
      expect(opened.rules).toMatchObject({ sprint: 1, step: 'PLANNING' });
      expect(opened.planning).toMatchObject({ sprint: 1, step: 'PLANNING' });
      expect(opened.execution).toMatchObject({ sprint: 1, step: 'EXECUTION' });
      expect(opened.demo).toMatchObject({ sprint: 1, step: 'DEMO' });
      // Les fins de partie s'expliquent avant la fin, même dans le défi « 3 sprints ».
      if (mode === 'SHIP_IN_3') expect(opened.endings!.sprint).toBeLessThanOrEqual(3);
    }
  });

  it('respecte le nombre de cartes tirées au hasard par sprint du mode', () => {
    const max = difficultyOf(mode).eventsPerSprint;
    for (const game of games) {
      expect(game.firstCardTick).not.toBeNull();
      expect(game.maxCardsPerSprint).toBeLessThanOrEqual(max);
    }
  });

  if (mode === 'HARDCORE') {
    it('explique les crises avant la première carte, qui n’attend pas', () => {
      for (const game of games) {
        expect(game.opened.events!.tick).toBeLessThanOrEqual(game.firstCardTick!);
        expect(game.autoResolved).toBeGreaterThan(0);
      }
    });
  } else {
    it('ouvre le chapitre des crises sur la première carte, qui attend le joueur', () => {
      for (const game of games) {
        expect(game.opened.events!.tick).toBe(game.firstCardTick);
        expect(game.autoResolved).toBe(0);
      }
    });
  }
});

describe('Joueur qui connaît déjà le jeu', () => {
  it.each(GAME_MODES)('%s : seules les règles du mode s’ouvrent', (mode) => {
    const { order } = playWithGuide(mode, 'veteran', 'mode');
    expect(order).toEqual(mode === 'NORMAL' ? [] : ['rules']);
  });
});
