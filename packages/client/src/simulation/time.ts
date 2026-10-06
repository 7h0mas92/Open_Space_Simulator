import { TIME, type GameState } from '@oss/shared';

/** Heure simulée, dérivée du tick : utile au cycle jour/nuit et aux conditions de cartes. */
export interface SimClock {
  /** Jour dans le sprint (0 à 13). */
  dayInSprint: number;
  /** Jour depuis le début de la partie. */
  day: number;
  /** De 1 (lundi) à 7 (dimanche). */
  dayOfWeek: number;
  /** Heure décimale (14.5 = 14h30). */
  hour: number;
  isWeekend: boolean;
  /** Vendredi entre 17h et 18h : le moment où la prod tombe. */
  isFriday17: boolean;
}

export function clockAt(sprint: number, sprintTick: number): SimClock {
  const minutes = TIME.sprintStartMinute + sprintTick * TIME.tickMinutes;
  const dayInSprint = Math.floor(minutes / 1440);
  const hour = (minutes % 1440) / 60;
  const dayOfWeek = (dayInSprint % 7) + 1;
  return {
    dayInSprint,
    day: (sprint - 1) * TIME.daysPerSprint + dayInSprint,
    dayOfWeek,
    hour,
    isWeekend: dayOfWeek >= 6,
    isFriday17: dayOfWeek === 5 && hour >= 17 && hour < 18,
  };
}

export function getClock(state: GameState): SimClock {
  return clockAt(state.sprint, state.sprintTick);
}

/** Vrai au premier tick d'une heure donnée (ex. : `isAtHour(clock, 12)` à midi pile). */
export function isAtHour(clock: SimClock, hour: number): boolean {
  return clock.hour === hour;
}
