import {
  GameStateSchema,
  TEAM_LIFE,
  civilFromDays,
  daysFromCivil,
  isBridgeDay,
  publicHolidayOn,
  publicHolidays,
} from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { activitySystem } from '../../src/simulation/systems/activity';
import { dailySystem } from '../../src/simulation/systems/daily';
import { assignTask, createTask } from '../../src/simulation/tasks';
import {
  bookLeave,
  burnOut,
  cancelLeave,
  holidayOf,
  isAbsent,
  leavePlanning,
  leaveSlots,
  refuseBridges,
  sprintHasBridge,
  teamLifeSystem,
} from '../../src/simulation/teamLife';
import { clockAt, getClock } from '../../src/simulation/time';
import { createEmptyState } from '../../src/simulation/state';
import { makeContext, newSimulation, stateWithTeam } from './fixtures';

/** Horloge à un jour (0 = lundi) et une heure donnés du sprint 1. */
const at = (day: number, hour: number) => clockAt(1, (day * 24 + hour - 8) * 2);

/** Partie qui commence le lundi 11 mai 2026 : jeudi 14 mai, Ascension ; vendredi 15, pont. */
const MAY_SEED = '2026-05-11.test';

function mayTeam() {
  const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'TEN_X', 'DESIGNER', 'INTERN']);
  state.seed = MAY_SEED;
  return { state, ids };
}

describe('Jours fériés', () => {
  it('connaît les 11 jours fériés français, Pâques compris', () => {
    const holidays = publicHolidays(2026);
    expect(holidays.size).toBe(11);
    const named = (month: number, day: number) =>
      publicHolidayOn(daysFromCivil({ year: 2026, month, day }));
    expect(named(4, 6)).toBe('EASTER_MONDAY');
    expect(named(5, 14)).toBe('ASCENSION');
    expect(named(5, 25)).toBe('WHIT_MONDAY');
    expect(named(7, 14)).toBe('BASTILLE_DAY');
    expect(named(12, 25)).toBe('CHRISTMAS');
    expect(named(3, 3)).toBeNull();
  });

  it('un férié le jeudi crée un pont le vendredi, un férié le mardi un pont le lundi', () => {
    expect(isBridgeDay(daysFromCivil({ year: 2026, month: 5, day: 15 }))).toBe(true);
    // 11 novembre 2025 : un mardi.
    expect(isBridgeDay(daysFromCivil({ year: 2025, month: 11, day: 10 }))).toBe(true);
    expect(isBridgeDay(daysFromCivil({ year: 2026, month: 5, day: 12 }))).toBe(false);
  });

  it('un jour férié est chômé : horloge de week-end, personne au bureau', () => {
    const { state, ids } = mayTeam();
    state.stage = 'EXECUTION';
    state.sprintTick = (3 * 24 + 10 - 8) * 2; // jeudi 10h
    const clock = getClock(state);
    expect(civilFromDays(daysFromCivil({ year: 2026, month: 5, day: 11 }) + clock.day).day).toBe(
      14,
    );
    expect(clock.holiday).toBe(true);
    expect(clock.isWeekend).toBe(true);
    activitySystem(state, makeContext(state), clock);
    for (const id of ids) expect(state.components.activity[id]?.kind).toBe('GONE');
  });

  it('sans vie d’équipe (vieille sauvegarde), le jour férié est un jour normal', () => {
    const { state } = mayTeam();
    state.teamLife = null;
    state.sprintTick = (3 * 24 + 10 - 8) * 2;
    expect(getClock(state).holiday).toBe(false);
    expect(holidayOf(state, 3)).toBeNull();
  });
});

describe('Congés payés', () => {
  it('se gagnent à chaque planification, jusqu’à 10 jours', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'GHOST']);
    state.sprint = 2;
    leavePlanning(state, makeContext(state));
    expect(state.teamLife?.leave[ids[0]!]).toBe(1);
    // Le Dev Fantôme ne prend pas de congés.
    expect(state.teamLife?.leave[ids[1]!]).toBeUndefined();
    for (let sprint = 3; sprint < 20; sprint++) {
      state.sprint = sprint;
      leavePlanning(state, makeContext(state));
      if (state.teamLife?.absences[ids[0]!]) break;
    }
    expect(state.teamLife?.leave[ids[0]!]).toBeLessThanOrEqual(TEAM_LIFE.leaveMax);
  });

  it('se posent en planification, dans la limite de la réserve et des places', () => {
    const { state, ids } = mayTeam();
    const life = state.teamLife!;
    for (const id of ids) life.leave[id] = 5;
    expect(leaveSlots(state)).toBe(1);
    expect(bookLeave(state, ids[0]!, 1, 6)).toEqual({ ok: false, error: 'NOT_ENOUGH_LEAVE' });
    expect(bookLeave(state, ids[0]!, 1, 3)).toEqual({ ok: true });
    expect(life.leave[ids[0]!]).toBe(2);
    expect(bookLeave(state, ids[1]!, 1, 2)).toEqual({ ok: false, error: 'LEAVE_SLOTS_FULL' });
    expect(bookLeave(state, ids[1]!, 0, 2)).toEqual({ ok: true });
    expect(cancelLeave(state, ids[1]!)).toEqual({ ok: true });
    expect(life.leave[ids[1]!]).toBe(5);
    state.stage = 'EXECUTION';
    expect(bookLeave(state, ids[1]!, 0, 2)).toEqual({ ok: false, error: 'WRONG_STAGE' });
  });

  it('le dev part le jour prévu (sa tâche est libérée) et revient reposé', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'TEN_X']);
    const devId = ids[0]!;
    state.teamLife!.leave[devId] = 5;
    expect(bookLeave(state, devId, 0, 2)).toEqual({ ok: true });
    state.stage = 'EXECUTION';
    const ctx = makeContext(state);
    const taskId = createTask(state, ctx.rng, 'FEATURE');
    assignTask(state, taskId, devId);
    const mood = state.components.mood[devId]!;
    mood.moral = 50;
    mood.energy = 20;

    teamLifeSystem(state, ctx, at(0, 8));
    expect(state.components.worker[devId]?.taskId).toBeNull();
    expect(ctx.outbox.some((n) => n.kind === 'DEV_ON_LEAVE')).toBe(true);
    expect(isAbsent(state, devId, at(1, 10))).toBe(true);
    activitySystem(state, ctx, at(1, 10));
    expect(state.components.activity[devId]?.kind).toBe('GONE');

    teamLifeSystem(state, ctx, at(2, 8));
    expect(isAbsent(state, devId, at(2, 10))).toBe(false);
    expect(mood.energy).toBe(100);
    expect(mood.moral).toBe(50 + 2 * TEAM_LIFE.moralPerLeaveDay);
  });

  it('une réserve pleine trop longtemps : le dev pose lui-même 5 jours', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD']);
    const devId = ids[0]!;
    state.teamLife!.leave[devId] = TEAM_LIFE.leaveMax;
    state.sprint = 4;
    leavePlanning(state, makeContext(state));
    expect(state.teamLife!.absences[devId]).toBeUndefined();
    state.sprint = 5;
    const ctx = makeContext(state);
    leavePlanning(state, ctx);
    expect(state.teamLife!.absences[devId]).toMatchObject({ kind: 'LEAVE', days: 5 });
    expect(state.teamLife!.leave[devId]).toBe(TEAM_LIFE.leaveMax - 5);
  });
});

describe('Ponts', () => {
  it('ceux qui ont des jours en réserve font le pont, sauf si le joueur refuse', () => {
    const { state, ids } = mayTeam();
    const life = state.teamLife!;
    life.leave[ids[0]!] = 2;
    expect(sprintHasBridge(state)).toBe(true);
    const ctx = makeContext(state);
    teamLifeSystem(state, ctx, at(4, 8));
    expect(life.absences[ids[0]!]?.kind).toBe('BRIDGE');
    expect(life.leave[ids[0]!]).toBe(1);
    // Sans réserve, on vient travailler.
    expect(life.absences[ids[1]!]).toBeUndefined();

    const { state: other, ids: otherIds } = mayTeam();
    other.teamLife!.leave[otherIds[0]!] = 2;
    const moral = other.components.mood[otherIds[0]!]!.moral;
    expect(refuseBridges(other, true)).toEqual({ ok: true });
    expect(other.components.mood[otherIds[0]!]!.moral).toBe(moral - TEAM_LIFE.bridgeRefusedMoral);
    teamLifeSystem(other, makeContext(other), at(4, 8));
    expect(other.teamLife!.absences[otherIds[0]!]).toBeUndefined();
  });
});

describe('Arrêts maladie', () => {
  it('un burn-out donne un arrêt d’un sprint ; une rechute, la démission', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'TEN_X']);
    const devId = ids[0]!;
    state.components.mood[devId]!.moral = 0;
    state.gauges.debt = 100;
    state.gauges.coffee = 0;
    const ctx = makeContext(state);
    dailySystem(state, ctx, at(1, 0));
    expect(state.components.identity[devId]).toBeDefined();
    expect(state.teamLife!.absences[devId]).toMatchObject({ kind: 'BURNOUT', days: 10 });
    expect(state.stats.burnouts).toBe(1);
    expect(ctx.outbox.some((n) => n.kind === 'DEV_BURNOUT')).toBe(true);
    // Pendant l'arrêt, le moral ne bouge plus et le dev ne démissionne pas.
    dailySystem(state, ctx, at(2, 0));
    expect(state.components.identity[devId]).toBeDefined();
    // Retour après 10 jours ouvrés.
    const until = state.teamLife!.absences[devId]!.until;
    teamLifeSystem(state, ctx, clockAt(1 + Math.floor(until / 14), (until % 14) * 24 * 2));
    expect(state.teamLife!.absences[devId]).toBeUndefined();
    expect(state.components.mood[devId]!.moral).toBeGreaterThanOrEqual(
      TEAM_LIFE.burnoutReturnMoral,
    );
    // Rechute : démission.
    burnOut(state, ctx, devId, until);
    expect(state.components.identity[devId]).toBeUndefined();
    expect(state.teamLife!.leave[devId]).toBeUndefined();
  });

  it('les petits arrêts sont tirés sur une graine à part, sans toucher au RNG de la partie', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD', 'TEN_X', 'INTERN', 'DESIGNER']);
    const before = [...state.rng];
    let sick = 0;
    for (let sprint = 1; sprint <= 39; sprint++) {
      state.sprint = sprint;
      for (let day = 0; day < 5; day++) {
        const ctx = makeContext(state);
        teamLifeSystem(state, ctx, clockAt(sprint, day * 48));
        sick += ctx.outbox.filter((n) => n.kind === 'DEV_SICK').length;
      }
    }
    expect(state.rng).toEqual(before);
    expect(sick).toBeGreaterThan(0);
    expect(sick).toBeLessThan(40);
  });
});

describe('Compatibilité', () => {
  it('seules les nouvelles parties ont la vie d’équipe (pas le défi « 3 sprints »)', () => {
    expect(createEmptyState({ seed: 'a', mode: 'NORMAL' }).teamLife).not.toBeNull();
    expect(createEmptyState({ seed: 'a', mode: 'DAILY' }).teamLife).not.toBeNull();
    expect(createEmptyState({ seed: 'a', mode: 'SHIP_IN_3' }).teamLife).toBeNull();
  });

  it('une vieille sauvegarde se charge sans vie d’équipe', () => {
    const state = createEmptyState({ seed: 'a', mode: 'NORMAL' });
    const old: Record<string, unknown> = { ...state };
    delete old.teamLife;
    expect(GameStateSchema.parse(old).teamLife).toBeNull();
    const refused = bookLeave(GameStateSchema.parse(old), 'x', 0, 1);
    expect(refused).toEqual({ ok: false, error: 'NOT_AVAILABLE' });
  });

  it('une partie reste déterministe : même graine, même partie', () => {
    const run = () => {
      const simulation = newSimulation('2026-05-11.daily');
      simulation.dispatch({ type: 'START_SPRINT' });
      for (let i = 0; i < 3 * 672 && simulation.state.stage !== 'ENDED'; i++) {
        if (simulation.state.stage === 'PLANNING' || simulation.state.stage === 'DEMO')
          simulation.dispatch({
            type: simulation.state.stage === 'DEMO' ? 'END_DEMO' : 'START_SPRINT',
          });
        simulation.step();
      }
      return JSON.stringify(simulation.state);
    };
    expect(run()).toBe(run());
  });
});
