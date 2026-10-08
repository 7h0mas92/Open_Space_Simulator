import { describe, expect, it } from 'vitest';
import { liveSprintMinutes, liveTime } from '../../src/view/liveTime';

const at = (day: number, minute: number, tickMs: number, syncedAt = 1000) => ({
  day,
  minute,
  tickMs,
  syncedAt,
});

describe('horloge continue', () => {
  it('reste sur l’heure du snapshot quand le temps est arrêté', () => {
    expect(liveTime(at(2, 600, Number.POSITIVE_INFINITY), 99_999)).toEqual({ day: 2, minute: 600 });
  });

  it('défile minute par minute pendant un tick de 30 minutes', () => {
    const time = at(0, 9 * 60, 450);
    expect(liveTime(time, 1000)).toEqual({ day: 0, minute: 540 });
    expect(liveTime(time, 1015)).toEqual({ day: 0, minute: 541 });
    expect(liveTime(time, 1225)).toEqual({ day: 0, minute: 555 });
  });

  it('ne dépasse jamais le tick suivant, même si le snapshot suivant tarde', () => {
    expect(liveSprintMinutes(at(0, 600, 450), 50_000)).toBe(630);
    expect(liveSprintMinutes(at(0, 600, 450), 0)).toBe(600);
  });

  it('passe minuit sur le jour suivant', () => {
    expect(liveTime(at(3, 23 * 60 + 45, 100), 1000 + 100)).toEqual({ day: 4, minute: 15 });
  });
});
