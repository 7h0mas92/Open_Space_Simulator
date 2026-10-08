import {
  BALANCE,
  DECOR_THEMES,
  EVENT_CARDS,
  SEASONS,
  birthdayFromKey,
  calendarStartDays,
  civilFromDays,
  daysFromCivil,
  decoratedThemes,
  easterSunday,
  gameDate,
  isBirthdayParty,
  isoDate,
  isoWeekday,
  seasonsAt,
  type DecorTheme,
} from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { conditionsMet } from '../../src/events/conditions';
import { drawCard } from '../../src/events/draw';
import { CardLibrary } from '../../src/events/library';
import { hireDev } from '../../src/simulation/devs';
import { birthdayOf, calendarSystem } from '../../src/simulation/systems/calendar';
import { clockAt } from '../../src/simulation/time';
import { toGameView } from '../../src/view/adapter';
import { FixedRng, makeContext, newSimulation, stateWithTeam, testCard } from './fixtures';

const day = (iso: string) => {
  const [year, month, d] = iso.split('-').map(Number) as [number, number, number];
  return daysFromCivil({ year, month, day: d });
};

describe('Calendrier', () => {
  it('convertit les dates sans l’objet Date, dans les deux sens', () => {
    expect(daysFromCivil({ year: 1970, month: 1, day: 1 })).toBe(0);
    expect(isoDate(civilFromDays(day('2026-10-08')))).toBe('2026-10-08');
    expect(isoDate(civilFromDays(day('2028-02-29') + 1))).toBe('2028-03-01');
    expect(isoWeekday(day('2026-10-08'))).toBe(4); // un jeudi
  });

  it('calcule Pâques', () => {
    expect(easterSunday(2026)).toEqual({ year: 2026, month: 4, day: 5 });
    expect(easterSunday(2027)).toEqual({ year: 2027, month: 3, day: 28 });
  });

  it('fait commencer la partie le lundi de la semaine de la graine', () => {
    const start = calendarStartDays('2026-10-08.k3j2x');
    expect(isoDate(civilFromDays(start))).toBe('2026-10-05');
    expect(isoDate(gameDate('daily-2026-10-08', 3))).toBe('2026-10-08');
    // Graine sans date (anciennes parties) : toujours un lundi, toujours le même.
    const legacy = calendarStartDays('abc123');
    expect(isoWeekday(legacy)).toBe(1);
    expect(calendarStartDays('abc123')).toBe(legacy);
  });

  it('connaît les périodes de chaque thème, y compris celles à cheval sur deux années', () => {
    expect(seasonsAt(day('2026-10-31'))).toEqual(['HALLOWEEN']);
    expect(seasonsAt(day('2026-12-24'))).toEqual(['CHRISTMAS']);
    expect(seasonsAt(day('2027-01-02'))).toEqual(['NEW_YEAR']);
    expect(seasonsAt(day('2026-12-30'))).toEqual(['NEW_YEAR']);
    expect(seasonsAt(day('2026-04-03'))).toContain('EASTER');
    expect(seasonsAt(day('2026-11-30'))).toEqual(['CYBERPUNK']); // Cyber Monday 2026
    expect(seasonsAt(day('2026-10-08'))).toEqual([]);
    for (const theme of DECOR_THEMES) {
      const [from, to] = SEASONS[theme].range(2026);
      expect(to - from).toBeGreaterThanOrEqual(5);
      expect(to - from).toBeLessThanOrEqual(15);
    }
  });

  it('applique le réglage du back-office : désactivé, pendant la période, toujours', () => {
    const seasons: DecorTheme[] = ['HALLOWEEN'];
    expect(decoratedThemes(seasons, {})).toEqual(['HALLOWEEN']);
    expect(decoratedThemes(seasons, { HALLOWEEN: 'OFF' })).toEqual([]);
    expect(decoratedThemes([], { PIRATES: 'ALWAYS' })).toEqual(['PIRATES']);
  });
});

describe('Anniversaires', () => {
  it('tire une date valide sans toucher au générateur aléatoire', () => {
    const birthday = birthdayFromKey('seed:e1');
    expect(birthdayFromKey('seed:e1')).toEqual(birthday);
    expect(birthday.month).toBeGreaterThanOrEqual(1);
    expect(birthday.month).toBeLessThanOrEqual(12);
    expect(birthday).not.toEqual({ month: 2, day: 29 });
  });

  it('fête un anniversaire du week-end le lundi suivant', () => {
    // 10 octobre 2026 : un samedi.
    const birthday = { month: 10, day: 10 };
    expect(isBirthdayParty(birthday, day('2026-10-10'))).toBe(false);
    expect(isBirthdayParty(birthday, day('2026-10-12'))).toBe(true);
    expect(isBirthdayParty({ month: 10, day: 8 }, day('2026-10-08'))).toBe(true);
  });

  it('donne une date d’anniversaire aux candidats et la garde à l’embauche', () => {
    const sim = newSimulation('2026-10-08.test');
    const candidate = sim.state.candidates[0]!;
    expect(candidate.identity.birthday).toEqual(birthdayFromKey(`2026-10-08.test:${candidate.id}`));
    const id = hireDev(sim.state, makeContext(sim.state), candidate, candidate.askingSalary);
    expect(sim.state.components.identity[id]?.birthday).toEqual(candidate.identity.birthday);
  });

  it('le jour de la fête : un an de plus, du moral et une notification', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'TEN_X']);
    const [hero, colleague] = ids as [string, string];
    const identity = state.components.identity[hero]!;
    // Le premier jeudi de la partie (jour 3) devient son anniversaire.
    const thursday = civilFromDays(calendarStartDays(state.seed) + 3);
    identity.birthday = { month: thursday.month, day: thursday.day };
    state.components.identity[colleague]!.birthday = {
      month: thursday.month,
      day: thursday.day === 1 ? 2 : 1,
    };
    state.components.mood[hero]!.moral = 50;
    state.components.mood[colleague]!.moral = 50;
    const age = identity.age;
    const ctx = makeContext(state);

    calendarSystem(state, ctx, clockAt(1, 3 * 48 - 16)); // jeudi, minuit
    expect(identity.age).toBe(age + 1);
    expect(state.components.mood[hero]!.moral).toBe(50 + BALANCE.birthday.moral);
    expect(state.components.mood[colleague]!.moral).toBe(50 + BALANCE.birthday.teamMoral);
    expect(ctx.outbox.map((n) => n.kind)).toEqual(['DEV_BIRTHDAY']);
    expect(ctx.outbox[0]!.text.fr).toContain(identity.name);

    // L'affichage repère la fête du jour (table de gâteaux au bureau).
    state.sprintTick = 3 * 48 - 16;
    const view = toGameView(state, { speed: 1, running: true, card: () => undefined });
    expect(view.calendar.birthdays).toEqual([hero]);
    expect(isoDate(view.calendar.date)).toBe(isoDate(thursday));
    expect(view.devs.find((dev) => dev.id === hero)?.birthday).toEqual(birthdayOf(state, hero));
  });

  it('les anciennes sauvegardes sans date d’anniversaire en reçoivent une stable', () => {
    const { state, ids } = stateWithTeam(['INTERN']);
    const id = ids[0]!;
    delete state.components.identity[id]!.birthday;
    expect(birthdayOf(state, id)).toEqual(birthdayFromKey(`${state.seed}:${id}`));
  });
});

describe('Événements de saison', () => {
  const halloweenSeed = '2026-10-26.test';

  it('annonce la période en cours dès le début de la partie', () => {
    const sim = newSimulation(halloweenSeed);
    const announce = sim.state.notifications.find((n) => n.kind === 'SEASON_STARTED');
    expect(announce?.text.fr).toContain('Halloween');
    expect(newSimulation('2026-10-08.test').state.notifications.map((n) => n.kind)).not.toContain(
      'SEASON_STARTED',
    );
  });

  it('une carte de saison ne tombe que pendant sa période', () => {
    const card = testCard({ conditions: { season: 'HALLOWEEN' } });
    const { state } = stateWithTeam(['INTERN']);
    const monday = clockAt(1, 4);
    state.seed = halloweenSeed;
    expect(conditionsMet(state, card, monday)).toBe(true);
    state.seed = '2026-10-08.test';
    expect(conditionsMet(state, card, monday)).toBe(false);
  });

  it('pendant la période, les cartes de saison passent devant les autres', () => {
    const { state } = stateWithTeam(['INTERN']);
    state.seed = halloweenSeed;
    const seasonal = testCard({ id: 'seasonal', conditions: { season: 'HALLOWEEN' }, weight: 1 });
    const normal = testCard({ id: 'normal', weight: 100 });
    const ctx = {
      ...makeContext(state, { rng: new FixedRng(0) }),
      cards: new CardLibrary([normal, seasonal]),
    };
    expect(drawCard(state, ctx, clockAt(1, 4))).toBe(true);
    expect(state.events.pending?.cardId).toBe('seasonal');
  });

  it('chaque thème a ses cartes de saison', () => {
    for (const theme of DECOR_THEMES) {
      const cards = EVENT_CARDS.filter((card) => card.conditions.season === theme);
      expect(cards.length, theme).toBe(2);
      for (const card of cards) expect(card.cooldownSprints).toBeGreaterThanOrEqual(20);
    }
  });
});
