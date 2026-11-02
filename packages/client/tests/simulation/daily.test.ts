import { describe, expect, it } from 'vitest';
import { DAILY_SYNC, GameStateSchema, TIME, type GameState } from '@oss/shared';
import {
  checkDuplicateWork,
  dailyFocus,
  duplicateOdds,
  holdTeamMeeting,
} from '../../src/simulation/meetings';
import { assignTask, createTask } from '../../src/simulation/tasks';
import { clockAt, getClock } from '../../src/simulation/time';
import { toGameView } from '../../src/view/adapter';
import { ticketBoard, ticketKey } from '../../src/view/ticketBoard';
import { makeContext, stateWithTeam } from './fixtures';

/** Une équipe de devs du code en exécution, chacun avec un ticket de code en cours. */
function busyTeam(count = 4): { state: GameState; ids: string[]; tasks: string[] } {
  const { state, ids } = stateWithTeam(Array.from({ length: count }, () => 'SENIOR_BEARD'));
  state.phase = 'SEED';
  state.stage = 'EXECUTION';
  const ctx = makeContext(state);
  const tasks = ids.map((id) => {
    const taskId = createTask(state, ctx.rng, 'FEATURE');
    assignTask(state, taskId, id);
    const task = state.components.task[taskId];
    if (task) {
      task.column = 'IN_PROGRESS';
      task.progress = task.work * 0.5;
      task.qualitySum = task.progress * 0.5;
    }
    const activity = state.components.activity[id];
    if (activity) activity.kind = 'WORKING';
    return taskId;
  });
  return { state, ids, tasks };
}

/** Place l'état au tick du lundi `day` (0 = premier lundi) à l'heure donnée. */
function at(state: GameState, day: number, hour: number): void {
  const ticksPerDay = (24 * 60) / TIME.tickMinutes;
  const start = TIME.sprintStartMinute / TIME.tickMinutes;
  state.sprintTick = day * ticksPerDay + (hour * 60) / TIME.tickMinutes - start;
  state.tick = state.sprintTick;
}

describe('Daily : le point sur les tickets', () => {
  it('note où en est chaque participant, et ce qui a avancé depuis la veille', () => {
    const { state, ids, tasks } = busyTeam(2);
    state.meetingRoom = { format: 'standup', paid: 0, fittedAtSprint: 1 };
    const ctx = makeContext(state);
    at(state, 0, 9);
    holdTeamMeeting(state, ctx, ids);
    expect(state.morningSync?.day).toBe(getClock(state).day);
    expect(state.morningSync?.entries).toEqual([
      { devId: ids[0], taskId: tasks[0], progress: 0.5, before: null },
      { devId: ids[1], taskId: tasks[1], progress: 0.5, before: null },
    ]);
    const task = state.components.task[tasks[0] ?? ''];
    if (task) task.progress = task.work * 0.8;
    at(state, 1, 9);
    holdTeamMeeting(state, ctx, ids);
    expect(state.morningSync?.entries[0]).toMatchObject({ progress: 0.8, before: 0.5 });
    expect(state.morningSync?.entries[1]).toMatchObject({ progress: 0.5, before: 0.5 });
  });

  it('un Daily utile donne un bonus jusqu’au soir, seulement aux participants', () => {
    const { state, ids } = busyTeam(2);
    const [first = '', second = ''] = ids;
    state.morningSync = { day: 0, tick: 0, useful: true, attendees: [first], entries: [] };
    at(state, 0, 14);
    expect(dailyFocus(state, first)).toBe(DAILY_SYNC.focusBonus);
    expect(dailyFocus(state, second)).toBe(0);
    at(state, 1, 9.5);
    expect(dailyFocus(state, first)).toBe(0);
    state.morningSync = { ...state.morningSync, day: 1, useful: false };
    expect(dailyFocus(state, first)).toBe(0);
  });

  it('les anciennes sauvegardes n’ont pas de Daily', () => {
    const { state } = busyTeam(1);
    const old: Record<string, unknown> = { ...state };
    delete old.morningSync;
    const parsed = GameStateSchema.parse({
      ...old,
      stats: { ...state.stats, duplicateWork: undefined },
    });
    expect(parsed.morningSync).toBeNull();
    expect(parsed.stats.duplicateWork).toBe(0);
  });
});

describe('Daily : travail en double', () => {
  it('la chance monte avec l’équipe et disparaît quand tout le monde était au Daily', () => {
    expect(duplicateOdds(2, 2)).toBe(0);
    expect(duplicateOdds(3, 3)).toBeCloseTo(DAILY_SYNC.duplicateOddsPerCoder);
    expect(duplicateOdds(6, 6)).toBeCloseTo(DAILY_SYNC.duplicateOddsPerCoder * 4);
    expect(duplicateOdds(30, 30)).toBe(DAILY_SYNC.duplicateMaxOdds);
    expect(duplicateOdds(6, 3)).toBeCloseTo(duplicateOdds(6, 6) / 2);
    expect(duplicateOdds(6, 0)).toBe(0);
  });

  it('sans Daily, un ticket perd une partie de son avancement, sans toucher au RNG de la partie', () => {
    let losses = 0;
    for (let day = 0; day < 5; day++) {
      for (let run = 0; run < 12; run++) {
        const { state, tasks } = busyTeam(8);
        state.seed = `double-${run}`;
        const rng = [...state.rng];
        at(state, day, DAILY_SYNC.duplicateHour);
        const before = tasks.map((id) => state.components.task[id]?.progress ?? 0);
        const clock = getClock(state);
        checkDuplicateWork(state, makeContext(state), clock);
        expect(state.rng).toEqual(rng);
        const after = tasks.map((id) => state.components.task[id]?.progress ?? 0);
        const changed = after.filter((value, index) => value < (before[index] ?? 0));
        expect(changed.length).toBeLessThanOrEqual(1);
        if (changed.length === 1) {
          losses += 1;
          expect(state.stats.duplicateWork).toBe(1);
          expect(state.notifications.at(-1)?.kind).toBe('DUPLICATE_WORK');
        }
      }
    }
    // 8 devs : environ 36 % de chance par jour.
    expect(losses).toBeGreaterThan(8);
    expect(losses).toBeLessThan(45);
  });

  it('jamais quand toute l’équipe était au Daily, au garage, le week-end ou à une autre heure', () => {
    for (let run = 0; run < 30; run++) {
      const { state, ids } = busyTeam(8);
      state.seed = `sync-${run}`;
      at(state, 0, DAILY_SYNC.duplicateHour);
      state.morningSync = {
        day: getClock(state).day,
        tick: state.tick - 2,
        useful: false,
        attendees: [...ids],
        entries: [],
      };
      checkDuplicateWork(state, makeContext(state), getClock(state));
      state.morningSync = null;
      state.phase = 'GARAGE';
      checkDuplicateWork(state, makeContext(state), getClock(state));
      state.phase = 'SEED';
      checkDuplicateWork(state, makeContext(state), clockAt(1, state.sprintTick + 2));
      at(state, 5, DAILY_SYNC.duplicateHour);
      checkDuplicateWork(state, makeContext(state), getClock(state));
      expect(state.stats.duplicateWork).toBe(0);
    }
  });
});

describe('Kanbanana : le tableau de l’appli de tickets', () => {
  it('range les tickets du sprint et met en avant ceux dont on a parlé au Daily', () => {
    const { state, ids, tasks } = busyTeam(3);
    state.meetingRoom = { format: 'standup', paid: 0, fittedAtSprint: 1 };
    const ctx = makeContext(state);
    at(state, 0, 9);
    holdTeamMeeting(state, ctx, ids.slice(0, 2));
    state.tick += 1;
    const view = toGameView(state, { speed: 1, running: true, card: () => undefined });
    expect(view.meetingRoom.daily?.live).toBe(true);
    const board = ticketBoard(view);
    const doing = board.columns.find((column) => column.id === 'DOING')?.cards ?? [];
    expect(doing).toHaveLength(3);
    expect(doing.slice(0, 2).every((card) => card.daily !== null)).toBe(true);
    expect(doing[2]?.daily).toBeNull();
    expect(doing[0]?.key).toBe(ticketKey(doing[0]?.id ?? ''));
    expect(board.daily?.speakers.map((speaker) => speaker.ticket?.id)).toEqual(tasks.slice(0, 2));
    expect(ticketKey('e42')).toBe('OSS-42');
    state.tick += 1;
    const later = toGameView(state, { speed: 1, running: true, card: () => undefined });
    expect(later.meetingRoom.daily?.live).toBe(false);
    expect(later.meetingRoom.daily?.today).toBe(true);
  });
});
