import { describe, expect, it } from 'vitest';
import {
  ENDLESS,
  EventCardSchema,
  FREE_SEASON_NEWCOMER_SPRINTS,
  STORY_ACT_IDS,
  STORY_CARDS,
  STORY_CARD_SCHEDULE,
  STORY_SCENES,
  TIME,
  endlessCostMultiplier,
  freeSeasonStart,
  type GameState,
} from '@oss/shared';
import { defaultCardLibrary } from '../../src/events/defaultCards';
import { applyEffects } from '../../src/events/effects';
import { storyCardSystem } from '../../src/events/storyCards';
import { createBot, playWithBot } from '../../src/simulation/bots';
import { rivalsSprint } from '../../src/simulation/rivals';
import { Simulation } from '../../src/simulation/simulation';
import { checkMission } from '../../src/simulation/story';
import { clockAt } from '../../src/simulation/time';
import { TEMPLATES_BY_TRIGGER } from '../../src/slack/templates';
import { toGameView } from '../../src/view/adapter';
import { makeContext } from './fixtures';

const cards = defaultCardLibrary();
const VIEW_CONTEXT = { speed: 1, running: false, card: () => undefined } as const;

function campaign(seed = 'scenes'): Simulation {
  return Simulation.create({ seed, mode: 'STORY', mission: 'campaign' }, cards);
}

/** Pas de simulation du mardi 10h (jour 1 du sprint). */
const TUESDAY_10 = (24 * 60 + 10 * 60 - TIME.sprintStartMinute) / TIME.tickMinutes;

function atAct(state: GameState, act: number): void {
  if (!state.story?.campaign) throw new Error('Pas une histoire');
  state.story.campaign.act = act;
  state.phase = act >= 3 ? 'UNICORN' : act === 2 ? 'SERIES_A' : act === 1 ? 'SEED' : 'GARAGE';
}

describe('Histoire : scènes et cartes écrites', () => {
  it('une scène par acte et par fin, chaque réplique en français et en anglais', () => {
    for (const act of STORY_ACT_IDS) expect(STORY_SCENES[act].length).toBeGreaterThan(2);
    for (const lines of Object.values(STORY_SCENES))
      for (const line of lines) {
        expect(line.text.fr.length).toBeGreaterThan(10);
        expect(line.text.en.length).toBeGreaterThan(10);
      }
  });

  it('10 cartes d’histoire valides, hors tirage, deux par acte, retrouvées par la bibliothèque', () => {
    expect(STORY_CARDS).toHaveLength(10);
    for (const card of STORY_CARDS) {
      expect(EventCardSchema.parse(card)).toEqual(card);
      expect(card.weight).toBe(0);
      expect(cards.get(card.id)).toBe(card);
    }
    const scheduled = STORY_ACT_IDS.flatMap((act) =>
      STORY_CARD_SCHEDULE[act].map((entry) => entry.cardId),
    );
    expect(new Set(scheduled)).toEqual(new Set(STORY_CARDS.map((card) => card.id)));
    // La bibliothèque tirable ne change pas : les autres modes ne voient jamais ces cartes.
    expect(cards.cards.some((card) => card.id.startsWith('story-'))).toBe(false);
  });

  it('la carte de l’acte tombe le mardi 10h de son sprint, une seule fois, sans tirage', () => {
    const { state } = campaign();
    state.stage = 'EXECUTION';
    state.sprint = 2;
    const ctx = makeContext(state, { cards: [] });
    const rngBefore = [...state.rng];
    expect(storyCardSystem(state, ctx, clockAt(2, TUESDAY_10 - 1))).toBe(false);
    expect(storyCardSystem(state, ctx, clockAt(2, TUESDAY_10))).toBe(true);
    expect(state.events.pending?.cardId).toBe('story-stolen-slides');
    expect(state.rng).toEqual(rngBefore);
    state.events.pending = null;
    expect(storyCardSystem(state, ctx, clockAt(2, TUESDAY_10 + 2))).toBe(false);
  });

  it('hors de l’histoire en actes, aucune carte d’histoire', () => {
    const normal = Simulation.create({ seed: 'n', mode: 'NORMAL' }, cards);
    normal.state.sprint = 5;
    const ctx = makeContext(normal.state);
    expect(storyCardSystem(normal.state, ctx, clockAt(5, TUESDAY_10))).toBe(false);
  });

  it('l’effet « rivals » change les utilisateurs des rivaux en jeu', () => {
    const { state } = campaign();
    const synergix = state.story!.campaign!.rivals[0]!;
    const before = synergix.users;
    const card = cards.get('story-data-leak')!;
    applyEffects(state, makeContext(state), card, card.choices[0]!.effects, 0);
    expect(synergix.users).toBeCloseTo(before * 0.9);
  });

  it('Mamie Josette et Inès Kader écrivent dans le Slack', () => {
    for (const trigger of ['STORY_ACT', 'STORY_END', 'RIVAL_ACTION'] as const) {
      const authors = (TEMPLATES_BY_TRIGGER.get(trigger) ?? []).map((t) =>
        t.author.kind === 'bot' ? t.author.bot : 'dev',
      );
      expect(authors.some((a) => a === 'josette' || a === 'ines')).toBe(true);
    }
  });
});

describe('Histoire : fins écrites et Saison libre', () => {
  it('l’entrée en Bourse à partir du « Géant » ouvre la Saison libre au lieu de finir', () => {
    const simulation = campaign();
    const { state } = simulation;
    atAct(state, 3);
    state.stage = 'PLANNING';
    state.gauges.stability = 90;
    state.valuation = 2_000_000_000;
    expect(simulation.dispatch({ type: 'LAUNCH_IPO' }).result.ok).toBe(true);
    expect(state.stage).not.toBe('ENDED');
    expect(state.story?.campaign?.freeSeason).toEqual({
      fromSprint: state.sprint,
      valuation: 2_400_000_000,
    });
    expect(state.totalSprints).toBe(ENDLESS.sprintCap);
    expect(state.notifications.some((n) => n.kind === 'STORY_END')).toBe(true);
    const view = toGameView(state, VIEW_CONTEXT).campaign;
    expect(view?.freeSeason).toBe(true);
  });

  it('trop tôt, l’entrée en Bourse termine la partie comme d’habitude', () => {
    const simulation = campaign();
    const { state } = simulation;
    atAct(state, 2);
    state.phase = 'UNICORN';
    state.stage = 'PLANNING';
    state.gauges.stability = 90;
    simulation.dispatch({ type: 'LAUNCH_IPO' });
    expect(state.stage).toBe('ENDED');
    expect(state.result?.campaign).toMatchObject({ success: false, failure: 'SOLD' });
  });

  it('en Saison libre, la concurrence monte et de nouvelles startups arrivent', () => {
    const simulation = campaign();
    const { state } = simulation;
    atAct(state, 4);
    state.stage = 'PLANNING';
    state.gauges.stability = 90;
    simulation.dispatch({ type: 'LAUNCH_IPO' });
    const from = freeSeasonStart(state.story);
    expect(from).toBe(state.sprint);
    expect(endlessCostMultiplier(state.mode, state.sprint + 10, from)).toBeGreaterThan(1.3);
    expect(endlessCostMultiplier(state.mode, state.sprint + 10)).toBe(1);
    state.sprint += FREE_SEASON_NEWCOMER_SPRINTS;
    rivalsSprint(state, makeContext(state));
    expect(state.story?.campaign?.rivals.some((r) => r.id === 'quantik')).toBe(true);
  });

  it('« Terminer la partie » finit sur l’entrée en Bourse, histoire réussie', () => {
    const simulation = campaign();
    const { state } = simulation;
    atAct(state, 4);
    state.stage = 'PLANNING';
    state.gauges.stability = 90;
    simulation.dispatch({ type: 'LAUNCH_IPO' });
    state.sprint += 3;
    expect(simulation.dispatch({ type: 'END_STORY' }).result.ok).toBe(true);
    checkMission(state, makeContext(state));
    expect(state.result?.outcome).toBe('IPO');
    expect(state.result?.campaign).toMatchObject({
      success: true,
      ending: 'IPO',
      freeSeasonSprints: 3,
    });
  });

  it('« Terminer la partie » est refusé hors Saison libre', () => {
    const simulation = campaign();
    expect(simulation.dispatch({ type: 'END_STORY' }).result.ok).toBe(false);
  });

  it('les bots finissent l’histoire sans boucler en Saison libre', () => {
    const simulation = campaign('bot-fin');
    playWithBot(simulation, createBot('balanced', 'bot-fin'), cards);
    expect(simulation.state.stage).toBe('ENDED');
    expect(simulation.state.sprint).toBeLessThanOrEqual(80);
  });
});
