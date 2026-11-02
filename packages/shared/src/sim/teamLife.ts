import { z } from 'zod';
import { civilFromDays, daysFromCivil, easterSunday, isoWeekday } from './calendar.js';
import type { GameMode } from '../game.js';

/*
 * Vie de l'équipe : congés payés, jours fériés, ponts et arrêts maladie.
 *
 * Un dev en congé ou en arrêt n'est pas au bureau et ne travaille pas ; son salaire reste
 * payé. Les jours fériés français sont calculés depuis la date réelle de la partie (écrite
 * dans la graine). Le hasard des petits arrêts maladie est tiré sur une graine à part
 * (graine de la partie + « leave » + jour) : le générateur principal n'est jamais utilisé.
 *
 * Ces règles ne s'appliquent qu'aux parties créées après leur ajout (champ `teamLife` non
 * nul) : une sauvegarde plus ancienne garde l'ancien comportement (démission à moral 0).
 */

export const TEAM_LIFE = {
  /** Jours de congé gagnés par sprint et réserve maximale. */
  leavePerSprint: 1,
  leaveMax: 10,
  /** Jours posés d'un coup au plus (une semaine de travail). */
  leaveDaysMax: 5,
  /** Une place de congé par tranche de 4 devs (au moins une), par semaine. */
  devsPerLeaveSlot: 4,
  /** Moral rendu au retour, par jour de congé posé, et au plus. */
  moralPerLeaveDay: 4,
  moralLeaveMax: 20,
  /** Réserve pleine : moral perdu chaque jour ouvré tant que rien n'est posé. */
  claimMoralPerDay: 1,
  /** Sprints de réserve pleine avant que le dev pose lui-même ses congés, et leur durée. */
  claimSprintsBeforeAuto: 2,
  autoLeaveDays: 5,
  /** Ponts refusés par le joueur : moral perdu par chaque dev qui en aurait profité. */
  bridgeRefusedMoral: 5,
  /** Burn-out (moral à 0) : arrêt de 10 jours ouvrés, retour à ce moral. */
  burnoutDays: 10,
  burnoutReturnMoral: 40,
  /** Un second burn-out dans ce nombre de sprints mène à la démission. */
  burnoutRelapseSprints: 10,
  /** Petits arrêts : chance par jour ouvré et par dev (doublée de novembre à février). */
  sickDaily: 0.005,
  sickWinterMultiplier: 2,
  sickWinterMonths: [11, 12, 1, 2] as readonly number[],
  sickDaysMin: 1,
  sickDaysMax: 3,
  /** L'endurance protège : -5 % de risque par point (jusqu'à -50 % à 10). */
  enduranceProtection: 0.05,
  /** Heure où l'on découvre les absences du jour (avant l'arrivée au bureau). */
  decisionHour: 8,
} as const;

/** Modes sans vie d'équipe : le défi « 3 sprints » est trop court pour des congés. */
const MODES_WITHOUT_TEAM_LIFE: readonly GameMode[] = ['SHIP_IN_3'];

export function teamLifeEnabled(mode: GameMode): boolean {
  return !MODES_WITHOUT_TEAM_LIFE.includes(mode);
}

/** Congé posé, pont, arrêt maladie court, arrêt pour burn-out. */
export const ABSENCE_KINDS = ['LEAVE', 'BRIDGE', 'SICK', 'BURNOUT'] as const;
export const AbsenceKindSchema = z.enum(ABSENCE_KINDS);
export type AbsenceKind = z.infer<typeof AbsenceKindSchema>;

export const AbsenceSchema = z.object({
  kind: AbsenceKindSchema,
  /** Premier jour d'absence et lendemain du dernier (jours de partie, 0 = premier lundi). */
  from: z.number().int().nonnegative(),
  until: z.number().int().nonnegative(),
  /** Jours ouvrés d'absence (pour le moral au retour d'un congé). */
  days: z.number().int().positive(),
});
export type Absence = z.infer<typeof AbsenceSchema>;

export const TeamLifeStateSchema = z.object({
  /** Jours de congé en réserve, par dev. */
  leave: z.record(z.string(), z.number().nonnegative()),
  /** Sprints passés avec la réserve pleine sans rien poser, par dev. */
  claims: z.record(z.string(), z.number().int().nonnegative()),
  /** Absence en cours ou prévue, par dev (une seule à la fois). */
  absences: z.record(z.string(), AbsenceSchema),
  /** Sprint du dernier burn-out, par dev. */
  lastBurnout: z.record(z.string(), z.number().int()),
  /** Sprint pour lequel le joueur a refusé les ponts (null : ponts acceptés). */
  bridgesRefusedSprint: z.number().int().nullable(),
});
export type TeamLifeState = z.infer<typeof TeamLifeStateSchema>;

export function emptyTeamLifeState(): TeamLifeState {
  return { leave: {}, claims: {}, absences: {}, lastBurnout: {}, bridgesRefusedSprint: null };
}

/** Les 11 jours fériés français. */
export const PUBLIC_HOLIDAYS = [
  'NEW_YEAR',
  'EASTER_MONDAY',
  'LABOUR_DAY',
  'VICTORY_1945',
  'ASCENSION',
  'WHIT_MONDAY',
  'BASTILLE_DAY',
  'ASSUMPTION',
  'ALL_SAINTS',
  'ARMISTICE',
  'CHRISTMAS',
] as const;
export type PublicHoliday = (typeof PUBLIC_HOLIDAYS)[number];

/** Jours fériés d'une année, en jours depuis 1970. */
export function publicHolidays(year: number): ReadonlyMap<number, PublicHoliday> {
  const easter = daysFromCivil(easterSunday(year));
  const fixed = (month: number, day: number) => daysFromCivil({ year, month, day });
  return new Map<number, PublicHoliday>([
    [fixed(1, 1), 'NEW_YEAR'],
    [easter + 1, 'EASTER_MONDAY'],
    [fixed(5, 1), 'LABOUR_DAY'],
    [fixed(5, 8), 'VICTORY_1945'],
    [easter + 39, 'ASCENSION'],
    [easter + 50, 'WHIT_MONDAY'],
    [fixed(7, 14), 'BASTILLE_DAY'],
    [fixed(8, 15), 'ASSUMPTION'],
    [fixed(11, 1), 'ALL_SAINTS'],
    [fixed(11, 11), 'ARMISTICE'],
    [fixed(12, 25), 'CHRISTMAS'],
  ]);
}

const holidayCache = new Map<number, ReadonlyMap<number, PublicHoliday>>();

/** Jour férié tombant ce jour (en jours depuis 1970), ou null. */
export function publicHolidayOn(days: number): PublicHoliday | null {
  const { year } = civilFromDays(days);
  let holidays = holidayCache.get(year);
  if (!holidays) {
    holidays = publicHolidays(year);
    holidayCache.set(year, holidays);
  }
  return holidays.get(days) ?? null;
}

/** Jour férié chômé : un jour de semaine (un férié le week-end ne change rien). */
export function workingHolidayOn(days: number): PublicHoliday | null {
  return isoWeekday(days) <= 5 ? publicHolidayOn(days) : null;
}

/**
 * Jour de pont : le vendredi après un jeudi férié, ou le lundi avant un mardi férié.
 */
export function isBridgeDay(days: number): boolean {
  const weekday = isoWeekday(days);
  if (weekday === 5) return workingHolidayOn(days - 1) !== null;
  if (weekday === 1) return workingHolidayOn(days + 1) !== null;
  return false;
}
