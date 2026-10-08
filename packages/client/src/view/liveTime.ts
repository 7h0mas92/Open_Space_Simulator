import { TIME } from '@oss/shared';
import type { GameTime } from './types';

/*
 * Horloge continue. La simulation avance par pas fixes de 30 minutes (c'est ce qui la rend
 * déterministe : replays, mode Daily, sauvegardes). L'affichage, lui, fait défiler l'heure
 * minute par minute entre deux pas, comme un chronomètre accéléré : à partir de l'instant où
 * le dernier snapshot est arrivé et de la durée réelle d'un tick, on sait où en est le tick
 * suivant. Rien de tout cela ne remonte vers la simulation.
 */

const MINUTES_PER_DAY = 24 * 60;

/** Moment affiché : jour du sprint et minute de la journée (entière). */
export interface LiveTime {
  readonly day: number;
  readonly minute: number;
}

/**
 * Minutes de jeu écoulées depuis le début du sprint, avec la fraction du tick en cours.
 * Ne dépasse jamais le tick suivant : l'heure affichée ne recule pas quand il arrive.
 */
export function liveSprintMinutes(
  time: Pick<GameTime, 'day' | 'minute' | 'tickMs' | 'syncedAt'>,
  nowMs: number,
): number {
  const base = time.day * MINUTES_PER_DAY + time.minute;
  if (!Number.isFinite(time.tickMs) || time.tickMs <= 0) return base;
  const progress = Math.min(1, Math.max(0, (nowMs - time.syncedAt) / time.tickMs));
  return base + progress * TIME.tickMinutes;
}

/** Jour et minute affichés à l'instant `nowMs`. */
export function liveTime(
  time: Pick<GameTime, 'day' | 'minute' | 'tickMs' | 'syncedAt'>,
  nowMs: number,
): LiveTime {
  const total = Math.floor(liveSprintMinutes(time, nowMs));
  return { day: Math.floor(total / MINUTES_PER_DAY), minute: total % MINUTES_PER_DAY };
}
