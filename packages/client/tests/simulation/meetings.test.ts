import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  EVENT_CARDS,
  GameStateSchema,
  MEETING_FORMATS,
  MEETINGS,
  getMeetingFormat,
  type GameState,
  type Task,
} from '@oss/shared';
import { CardLibrary } from '../../src/events/library';
import { createBot, playWithBot } from '../../src/simulation/bots';
import { computeOfficeEffects } from '../../src/simulation/furniture';
import { holdTeamMeeting, meetingFormatBlocker } from '../../src/simulation/meetings';
import { replay } from '../../src/simulation/replay';
import type { Simulation } from '../../src/simulation/simulation';
import { productivity } from '../../src/simulation/systems/work';
import { getClock } from '../../src/simulation/time';
import { toGameView } from '../../src/view/adapter';
import { makeContext, newSimulation, stateWithTeam } from './fixtures';

/** Startup en Seed, en planification, avec de quoi aménager. */
function richSeed(): Simulation {
  const simulation = newSimulation('meetings');
  simulation.state.phase = 'SEED';
  simulation.state.gauges.treasury = 1_000_000;
  return simulation;
}

/** Avance jusqu'à la réunion d'équipe du lundi matin (9h30). */
function runToMorningMeeting(simulation: Simulation): void {
  expect(simulation.dispatch({ type: 'START_SPRINT' }).result.ok).toBe(true);
  for (let i = 0; i < 48; i++) {
    const clock = getClock(simulation.state);
    if (clock.hour === MEETINGS.dailyHour && !clock.isWeekend) return;
    simulation.step();
  }
  throw new Error('pas de réunion trouvée');
}

describe('Salle de réunion : aménagement', () => {
  it('n’existe pas au garage', () => {
    const simulation = newSimulation('meetings');
    expect(simulation.state.phase).toBe('GARAGE');
    const result = simulation.dispatch({ type: 'FIT_MEETING_ROOM', format: 'standup' }).result;
    expect(result).toEqual({ ok: false, error: 'LOCKED' });
    expect(
      toGameView(simulation.state, { speed: 1, running: false, card: () => undefined }).meetingRoom
        .unlocked,
    ).toBe(false);
  });

  it('s’aménage, se remplace à moitié remboursé et se vide', () => {
    const simulation = richSeed();
    const { state } = simulation;
    const start = state.gauges.treasury;
    expect(simulation.dispatch({ type: 'FIT_MEETING_ROOM', format: 'brainstorm' }).result).toEqual({
      ok: true,
    });
    expect(state.meetingRoom).toMatchObject({ format: 'brainstorm', paid: 2500 });
    expect(state.gauges.treasury).toBe(start - 2500);
    expect(state.notifications.at(-1)?.kind).toBe('MEETING_ROOM_FITTED');

    // Déjà installée : rien à faire.
    expect(simulation.dispatch({ type: 'FIT_MEETING_ROOM', format: 'brainstorm' }).result).toEqual({
      ok: false,
      error: 'NOT_ELIGIBLE',
    });
    // Remplacement : l'ancien aménagement est revendu à moitié prix.
    expect(simulation.dispatch({ type: 'FIT_MEETING_ROOM', format: 'aquarium' }).result.ok).toBe(
      true,
    );
    expect(state.gauges.treasury).toBe(start - 2500 + 1250 - 4000);
    expect(simulation.dispatch({ type: 'CLEAR_MEETING_ROOM' }).result.ok).toBe(true);
    expect(state.meetingRoom).toBeNull();
    expect(state.gauges.treasury).toBe(start - 2500 + 1250 - 4000 + 2000);
    expect(simulation.dispatch({ type: 'CLEAR_MEETING_ROOM' }).result).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
  });

  it('les formules haut de gamme attendent leur phase, et il faut pouvoir payer', () => {
    const simulation = richSeed();
    const { state } = simulation;
    expect(meetingFormatBlocker(state, getMeetingFormat('zen'))).toBe('LOCKED');
    expect(meetingFormatBlocker(state, getMeetingFormat('boardroom'))).toBe('LOCKED');
    state.phase = 'UNICORN';
    expect(meetingFormatBlocker(state, getMeetingFormat('boardroom'))).toBeNull();
    state.gauges.treasury = 100;
    expect(meetingFormatBlocker(state, getMeetingFormat('standup'))).toBe('NOT_ENOUGH_MONEY');
    expect(simulation.dispatch({ type: 'FIT_MEETING_ROOM', format: 'standup' }).result).toEqual({
      ok: false,
      error: 'NOT_ENOUGH_MONEY',
    });
  });

  it('chaque formule a un bonus et un malus réels', () => {
    for (const format of MEETING_FORMATS) {
      const values = [
        ...Object.values(format.effects),
        format.poPenalty - 1,
        ...Object.values(format.useless),
      ];
      expect(values.some((v) => v > 0) || format.poPenalty < 1, format.id).toBe(true);
      expect(values.some((v) => v < 0) || format.poPenalty > 1, format.id).toBe(true);
      expect(format.usefulOdds).toBeGreaterThan(0);
      expect(format.usefulOdds).toBeLessThan(1);
    }
  });
});

describe('Salle de réunion : effets', () => {
  it('ajoute ses effets à ceux du mobilier', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD', 'PRODUCT_OWNER']);
    const before = computeOfficeEffects(state);
    expect(before.meetingPenalty).toBe(1);
    state.meetingRoom = { format: 'aquarium', paid: 4000, fittedAtSprint: 1 };
    const after = computeOfficeEffects(state);
    expect(after.hypePerDay - before.hypePerDay).toBeCloseTo(0.05);
    expect(after.teamProductivity - before.teamProductivity).toBeCloseTo(-0.02);
  });

  it('la salle stand-up allège les réunions du PO, le brainstorming les alourdit', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'PRODUCT_OWNER']);
    const dev = ids[0] ?? '';
    const task = { type: 'FEATURE', shinyFramework: false } as Task;
    const rate = (format: 'standup' | 'brainstorm' | null) => {
      state.meetingRoom = format ? { format, paid: 0, fittedAtSprint: 1 } : null;
      const ctx = makeContext(state);
      // On isole le malus des réunions : la salle brainstorming donne aussi de la qualité.
      return productivity(state, ctx, dev, task) / (1 + ctx.office.teamProductivity);
    };
    const none = rate(null);
    const penalty = BALANCE.work.poMeetingPenalty;
    expect(rate('standup') / none).toBeCloseTo((1 - penalty * 0.5) / (1 - penalty));
    expect(rate('brainstorm') / none).toBeCloseTo((1 - penalty * 1.5) / (1 - penalty));
  });
});

describe('Salle de réunion : réunion d’équipe du matin', () => {
  it('n’a pas lieu tant que la salle est vide', () => {
    const simulation = richSeed();
    runToMorningMeeting(simulation);
    simulation.step();
    expect(simulation.state.stats.meetings).toBe(0);
    expect(simulation.state.stats.meetingsUseful + simulation.state.stats.meetingsUseless).toBe(0);
  });

  it('réunit l’équipe à 9h30, utile ou inutile, et la même graine donne le même verdict', () => {
    const play = () => {
      const simulation = richSeed();
      expect(simulation.dispatch({ type: 'FIT_MEETING_ROOM', format: 'aquarium' }).result.ok).toBe(
        true,
      );
      runToMorningMeeting(simulation);
      const notifications = simulation.step();
      return { simulation, notifications };
    };
    const { simulation, notifications } = play();
    const { state } = simulation;
    expect(state.stats.meetings).toBe(1);
    expect(state.stats.meetingsUseful + state.stats.meetingsUseless).toBe(1);
    const present = Object.entries(state.components.activity).filter(
      ([id]) => !(id in state.components.remote),
    );
    expect(present.length).toBeGreaterThan(0);
    for (const [, activity] of present) expect(activity.kind).toBe('MEETING');
    const outcome = notifications.find(
      (n) => n.kind === 'MEETING_USEFUL' || n.kind === 'MEETING_USELESS',
    );
    expect(outcome).toBeDefined();
    expect(play().notifications.map((n) => n.kind)).toEqual(notifications.map((n) => n.kind));
    const view = toGameView(state, { speed: 1, running: true, card: () => undefined });
    expect(view.meetingRoom.recent).toHaveLength(1);
    expect(view.meetingRoom.format).toBe('aquarium');
  });

  it('ne touche jamais au générateur de la partie', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'INTERN']);
    state.meetingRoom = { format: 'zen', paid: 0, fittedAtSprint: 1 };
    const rng = [...state.rng];
    const ctx = makeContext(state);
    for (let tick = 0; tick < 50; tick++) {
      state.tick = tick;
      holdTeamMeeting(state, ctx, ids);
    }
    expect(state.rng).toEqual(rng);
    // Sur 50 réunions, il y en a des utiles et des inutiles.
    expect(state.stats.meetingsUseful).toBeGreaterThan(0);
    expect(state.stats.meetingsUseless).toBeGreaterThan(0);
  });
});

describe('Salle de réunion : sauvegardes et replays', () => {
  it('une sauvegarde d’avant les salles de réunion se recharge avec une salle vide', () => {
    const simulation = newSimulation('old-save');
    const old = JSON.parse(JSON.stringify(simulation.state)) as Record<string, unknown>;
    delete old.meetingRoom;
    const stats = old.stats as Record<string, unknown>;
    delete stats.meetingsUseful;
    delete stats.meetingsUseless;
    const parsed: GameState = GameStateSchema.parse(old);
    expect(parsed.meetingRoom).toBeNull();
    expect(parsed.stats.meetingsUseful).toBe(0);
  });

  it('une partie avec salle de réunion se rejoue à l’identique (replay, anti-triche)', () => {
    const cards = new CardLibrary(EVENT_CARDS);
    const simulation = newSimulation('organizer-replay', 'NORMAL', [...EVENT_CARDS]);
    playWithBot(simulation, createBot('organizer', 'organizer-replay'), cards);
    expect(simulation.commands.some((c) => c.command.type === 'FIT_MEETING_ROOM')).toBe(true);
    const replayed = replay({
      seed: 'organizer-replay',
      mode: 'NORMAL',
      commands: simulation.commands,
      cards,
    });
    expect(replayed.state).toEqual(simulation.state);
  });
});
