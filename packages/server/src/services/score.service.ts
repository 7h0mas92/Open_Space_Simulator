import { utcDate, type ScoreDto } from '@oss/shared';
import type { Score, User } from '../generated/prisma/client.js';

export type ScoreWithUser = Score & { user: Pick<User, 'pseudo'> };

export function toScoreDto(score: ScoreWithUser): ScoreDto {
  return {
    id: score.id,
    pseudo: score.user.pseudo,
    mode: score.mode,
    valuation: score.valuation,
    outcome: score.outcome,
    phaseReached: score.phaseReached,
    sprintsPlayed: score.sprintsPlayed,
    dailyDate: score.dailyDate ? utcDate(score.dailyDate) : null,
    createdAt: score.createdAt.toISOString(),
  };
}

/** Dates acceptées pour un score du Daily : aujourd'hui, ou hier (partie finie après minuit). */
export function acceptedDailyDates(now: Date): string[] {
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
  return [utcDate(now), utcDate(yesterday)];
}
