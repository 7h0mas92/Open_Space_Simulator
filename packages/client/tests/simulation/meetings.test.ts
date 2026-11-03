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
import {
  crisisAttendees,
  holdTeamMeeting,
  meetingFormatBlocker,
} from '../../src/simulation/meetings';
import { prodDown } from '../../src/simulation/systems/incidents';
import { replay } from '../../src/simulation/replay';
import { Simulation } from '../../src/simulation/simulation';
import { productivity, workSystem } from '../../src/simulation/systems/work';
import { clockAt, getClock } from '../../src/simulation/time';
import { toGameView } from '../../src/view/adapter';
import { makeContext, newSimulation, stateWithTeam } from './fixtures';

/** Startup en Seed, en planification, avec de quoi aménager. */
function richSeed(): Simulation {
  const simulation = newSimulation('meetings');
  simulation.state.phase = 'SEED';
  simulation.state.gauges.treasury = 1_000_000;
  return simulation;
}

/** Avance jusqu'à la réunion d'équipe du lundi matin (9h, dès l'arrivée). */
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

  it('réunit l’équipe à 9h, utile ou inutile, et la même graine donne le même verdict', () => {
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

describe('Salle de réunion : réunion du matin de 20 minutes', () => {
  it('a lieu à l’arrivée de l’équipe', () => {
    expect(MEETINGS.dailyHour).toBe(BALANCE.work.arrivalHour);
    expect(MEETINGS.dailyMinutes).toBe(20);
  });

  it('laisse les 10 dernières minutes de la demi-heure pour coder', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD']);
    const dev = ids[0] ?? '';
    state.stage = 'EXECUTION';
    state.meetingRoom = { format: 'standup', paid: 0, fittedAtSprint: 1 };
    const taskId = 'task-test';
    const task: Task = {
      title: { fr: 'Tâche', en: 'Task' },
      type: 'FEATURE',
      size: 13,
      progress: 0,
      work: 1000,
      column: 'IN_PROGRESS',
      order: 0,
      assigneeId: dev,
      qualitySum: 0,
      debtFactor: 0,
      shinyFramework: false,
      designApproved: true,
      hallucinated: false,
      createdAtSprint: 1,
      doneAtSprint: null,
    };
    state.components.task[taskId] = task;
    const worker = state.components.worker[dev];
    const activity = state.components.activity[dev];
    if (!worker || !activity) throw new Error('dev incomplet');
    worker.taskId = taskId;
    const ctx = makeContext(state);
    const full = productivity(state, ctx, dev, task);
    // Lundi 9h : réunion du matin.
    const nine = clockAt(1, 2);
    expect(nine.hour).toBe(9);
    activity.kind = 'MEETING';
    workSystem(state, ctx, nine);
    expect(state.components.task[taskId]?.progress).toBeCloseTo(full / 3);
    // Une autre réunion (celle du PO, à une autre heure) : rien n'avance.
    workSystem(state, ctx, clockAt(1, 6));
    expect(state.components.task[taskId]?.progress).toBeCloseTo(full / 3);
  });
});

describe('Salle de réunion : réunion de crise quand la prod tombe', () => {
  const cause = { fr: 'Panne', en: 'Outage' };

  function crisisTeam() {
    const team = stateWithTeam([
      'INTERN',
      'SENIOR_BEARD',
      'TEN_X',
      'RUSTACEAN',
      'DESIGNER',
      'PRODUCT_OWNER',
    ]);
    const { state, ids } = team;
    state.stage = 'EXECUTION';
    for (const id of ids) {
      const activity = state.components.activity[id];
      if (activity) activity.kind = 'WORKING';
    }
    // Qualités fixées pour savoir qui est le plus solide.
    const qualities = [3, 9, 6, 4, 8, 5];
    ids.forEach((id, index) => {
      const stats = state.components.stats[id];
      if (stats) stats.quality = qualities[index] ?? 5;
    });
    return team;
  }

  const fixTask = (state: GameState) =>
    Object.entries(state.components.task).find(([, task]) => task.template === 'prod-fix');

  it('réunit le coupable, les devs les plus solides et le PO, sans la designeuse', () => {
    const { state, ids } = crisisTeam();
    const [intern, senior, tenX, rust, designer, po] = ids;
    const { attendees, leadId } = crisisAttendees(state, intern ?? null);
    expect(attendees).toEqual([intern, senior, tenX, po]);
    expect(attendees).not.toContain(designer);
    expect(attendees).not.toContain(rust);
    expect(leadId).toBe(senior);
  });

  it('appelle d’abord le DevOps et le Tech Lead, et un manager s’il n’y a pas de PO', () => {
    const { state, ids } = stateWithTeam([
      'SENIOR_BEARD',
      'DEVOPS',
      'TECH_LEAD',
      'TEN_X',
      'MANAGER',
    ]);
    state.stage = 'EXECUTION';
    for (const id of ids) {
      const activity = state.components.activity[id];
      if (activity) activity.kind = 'WORKING';
      const stats = state.components.stats[id];
      if (stats) stats.quality = 5;
      const employment = state.components.employment[id];
      if (employment) employment.level = 1;
    }
    const [senior, devops, lead, tenX, manager] = ids;
    const stats = state.components.stats[senior ?? ''];
    if (stats) stats.quality = 9;
    const { attendees, leadId } = crisisAttendees(state, null);
    expect(attendees.slice(0, 2)).toEqual([devops, lead]);
    expect(attendees).toContain(senior);
    expect(attendees).not.toContain(tenX);
    expect(attendees.at(-1)).toBe(manager);
    expect(leadId).toBe(devops);
  });

  it('avance la réparation, la confie au meneur et garde l’équipe en salle', () => {
    const { state, ids } = crisisTeam();
    const [intern, senior] = ids;
    state.meetingRoom = { format: 'war-room', paid: 0, fittedAtSprint: 1 };
    const ctx = makeContext(state);
    const rng = [...state.rng];
    const moral = state.components.mood[intern ?? '']?.moral ?? 0;
    prodDown(state, ctx, cause, intern ?? null);
    const entry = fixTask(state);
    expect(entry).toBeDefined();
    const [taskId, task] = entry ?? ['', undefined];
    expect(task?.progress).toBeCloseTo((task?.work ?? 0) * 0.5);
    expect(task?.assigneeId).toBe(senior);
    expect(state.components.worker[senior ?? '']?.taskId).toBe(taskId);
    expect(state.components.activity[intern ?? '']).toMatchObject({
      kind: 'MEETING',
      untilTick: state.tick + 1 + MEETINGS.crisisTicks,
    });
    expect(state.components.activity[ids[4] ?? '']?.kind).toBe('WORKING');
    expect(state.components.mood[intern ?? '']?.moral).toBe(
      Math.max(0, moral + MEETINGS.crisisCulpritMoral),
    );
    expect(state.stats.crisisMeetings).toBe(1);
    expect(state.notifications.at(-1)?.kind).toBe('CRISIS_MEETING');
    // Aucun nombre tiré sur le générateur de la partie.
    expect(state.rng).toEqual(rng);
    const view = toGameView(state, { speed: 1, running: true, card: () => undefined });
    expect(view.meetingRoom.crisis).toBe(1);
    expect(view.meetingRoom.recent[0]?.crisis).toBe(true);
  });

  it('chaque formule fait avancer la réparation, la war room plus que les autres', () => {
    const warRoom = getMeetingFormat('war-room')?.crisisHeadStart ?? 0;
    for (const format of MEETING_FORMATS) {
      expect(format.crisisHeadStart, format.id).toBeGreaterThan(0);
      expect(format.crisisHeadStart, format.id).toBeLessThanOrEqual(warRoom);
    }
  });

  it('n’a pas lieu sans salle aménagée, et n’invite ni les absents ni les télétravailleurs', () => {
    const { state, ids } = crisisTeam();
    const ctx = makeContext(state);
    prodDown(state, ctx, cause, null);
    expect(fixTask(state)?.[1].progress).toBe(0);
    expect(state.stats.crisisMeetings).toBe(0);

    const other = crisisTeam();
    const [intern, senior, tenX] = other.ids;
    other.state.components.remote[senior ?? ''] = true;
    const activity = other.state.components.activity[tenX ?? ''];
    if (activity) activity.kind = 'GONE';
    const { attendees, leadId } = crisisAttendees(other.state, null);
    expect(attendees).not.toContain(senior);
    expect(attendees).not.toContain(tenX);
    expect(attendees).toContain(intern);
    expect(leadId).not.toBeNull();
    expect(ids.length).toBe(6);
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
    delete stats.crisisMeetings;
    const parsed: GameState = GameStateSchema.parse(old);
    expect(parsed.meetingRoom).toBeNull();
    expect(parsed.stats.meetingsUseful).toBe(0);
    expect(parsed.stats.crisisMeetings).toBe(0);
  });

  it('une partie avec salle de réunion se rejoue à l’identique (replay, anti-triche)', () => {
    const cards = new CardLibrary(EVENT_CARDS);
    // Partie avec son arbre R&D, comme le rejeu.
    const simulation = Simulation.create({ seed: 'organizer-replay', mode: 'NORMAL' }, cards);
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
