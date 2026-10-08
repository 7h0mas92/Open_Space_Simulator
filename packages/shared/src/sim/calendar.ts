import { z } from 'zod';
import type { LocalizedText } from '../i18n.js';

/**
 * Calendrier de la partie : à quelle date réelle correspond chaque jour simulé.
 *
 * La partie commence un lundi. La date de départ est tirée de la graine, jamais de l'horloge
 * de l'ordinateur : une même graine donne le même calendrier (Daily, replays, anti-triche).
 * - Graine contenant une date (`daily-2026-10-08`, `2026-10-08.k3j2x`) : le lundi de cette
 *   semaine. Les nouvelles parties ont une graine datée du jour : Halloween tombe donc à
 *   Halloween.
 * - Autre graine (anciennes sauvegardes) : un lundi de 2026 choisi par un hachage de la graine.
 *
 * Tout est calculé en jours entiers, sans l'objet `Date` (même résultat partout).
 */

export interface CalendarDate {
  readonly year: number;
  /** De 1 (janvier) à 12. */
  readonly month: number;
  /** De 1 à 31. */
  readonly day: number;
}

/** Jours écoulés depuis le 1er janvier 1970 (algorithme « days from civil » de H. Hinnant). */
export function daysFromCivil(date: CalendarDate): number {
  const y = date.month <= 2 ? date.year - 1 : date.year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (date.month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + date.day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverse de `daysFromCivil`. */
export function civilFromDays(days: number): CalendarDate {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

/** Jour de la semaine : 1 = lundi … 7 = dimanche (le 1er janvier 1970 était un jeudi). */
export function isoWeekday(days: number): number {
  return ((((days + 3) % 7) + 7) % 7) + 1;
}

/** Date au format `AAAA-MM-JJ`. */
export function isoDate(date: CalendarDate): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

/** Hachage FNV-1a 32 bits : stable, rapide, sans consommer le générateur aléatoire. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

const SEED_DATE = /(\d{4})-(\d{2})-(\d{2})/;

/** Premier jour de la partie (un lundi), en jours depuis 1970. */
export function calendarStartDays(seed: string): number {
  const match = SEED_DATE.exec(seed);
  let days: number;
  if (match) {
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const valid = month >= 1 && month <= 12 && day >= 1 && day <= 31;
    days = valid
      ? daysFromCivil({ year, month, day })
      : daysFromCivil({ year: 2026, month: 1, day: 5 });
  } else {
    days = daysFromCivil({ year: 2026, month: 1, day: 1 }) + (hashString(seed) % 365);
  }
  return days - (isoWeekday(days) - 1);
}

/** Date réelle d'un jour de partie (0 = premier lundi). */
export function gameDate(seed: string, gameDay: number): CalendarDate {
  return civilFromDays(calendarStartDays(seed) + gameDay);
}

/** Dimanche de Pâques (calendrier grégorien, algorithme dit « anonyme »). */
export function easterSunday(year: number): CalendarDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

/** Le n-ième jour de semaine `weekday` (1 = lundi) d'un mois. */
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  const first = daysFromCivil({ year, month, day: 1 });
  const offset = (weekday - isoWeekday(first) + 7) % 7;
  return first + offset + (n - 1) * 7;
}

/**
 * Thèmes de décoration. Les identifiants sont ceux des packs de personnages quand le thème
 * existe aussi en costumes (Noël, Halloween…), pour qu'un même thème habille les deux.
 */
export const DECOR_THEMES = [
  'NEW_YEAR',
  'VALENTINE',
  'EASTER',
  'SPACE',
  'MEDIEVAL',
  'SUPERHEROES',
  'RETRO_80S',
  'SUMMER',
  'PIRATES',
  'HALLOWEEN',
  'CYBERPUNK',
  'CHRISTMAS',
] as const;
export const DecorThemeSchema = z.enum(DECOR_THEMES);
export type DecorTheme = z.infer<typeof DecorThemeSchema>;

/**
 * Réglage d'un thème dans le back-office :
 * - `OFF` : jamais de décoration ;
 * - `SEASON` : le bureau se décore pendant la période du thème (réglage par défaut) ;
 * - `ALWAYS` : décoration permanente, quelle que soit la date.
 */
export const DECOR_MODES = ['OFF', 'SEASON', 'ALWAYS'] as const;
export const DecorModeSchema = z.enum(DECOR_MODES);
export type DecorMode = z.infer<typeof DecorModeSchema>;

export interface SeasonDefinition {
  readonly theme: DecorTheme;
  readonly name: LocalizedText;
  /** Emoji affiché à côté de l'horloge pendant la période. */
  readonly icon: string;
  /** Pourquoi ces dates (affiché dans le back-office). */
  readonly reason: LocalizedText;
  /** Premier et dernier jour de la période, en jours depuis 1970, pour une année donnée. */
  readonly range: (year: number) => readonly [number, number];
}

const fixed =
  (from: [number, number], to: [number, number]) =>
  (year: number): readonly [number, number] => [
    daysFromCivil({ year, month: from[0], day: from[1] }),
    daysFromCivil({ year: from[0] > to[0] ? year + 1 : year, month: to[0], day: to[1] }),
  ];

/** Les périodes : une semaine environ chacune, des événements courts. */
export const SEASONS: Readonly<Record<DecorTheme, SeasonDefinition>> = {
  NEW_YEAR: {
    theme: 'NEW_YEAR',
    icon: '🎆',
    name: { fr: 'Nouvel An', en: 'New Year' },
    reason: { fr: 'Du 29 décembre au 3 janvier', en: 'December 29 to January 3' },
    range: fixed([12, 29], [1, 3]),
  },
  VALENTINE: {
    theme: 'VALENTINE',
    icon: '💘',
    name: { fr: 'Saint-Valentin', en: "Valentine's Day" },
    reason: { fr: 'Du 9 au 14 février', en: 'February 9 to 14' },
    range: fixed([2, 9], [2, 14]),
  },
  EASTER: {
    theme: 'EASTER',
    icon: '🥚',
    name: { fr: 'Pâques', en: 'Easter' },
    reason: {
      fr: 'La semaine avant Pâques, jusqu’au lundi de Pâques',
      en: 'The week before Easter, up to Easter Monday',
    },
    range: (year) => {
      const sunday = daysFromCivil(easterSunday(year));
      return [sunday - 6, sunday + 1];
    },
  },
  SPACE: {
    theme: 'SPACE',
    icon: '🚀',
    name: { fr: 'Semaine de l’espace', en: 'Space week' },
    reason: {
      fr: 'Du 6 au 12 avril (premier vol habité, 12 avril 1961)',
      en: 'April 6 to 12 (first human spaceflight, April 12, 1961)',
    },
    range: fixed([4, 6], [4, 12]),
  },
  MEDIEVAL: {
    theme: 'MEDIEVAL',
    icon: '🏰',
    name: { fr: 'Fête médiévale', en: 'Medieval fair' },
    reason: {
      fr: 'Du 17 au 23 avril (la Saint-Georges et son dragon)',
      en: "April 17 to 23 (Saint George's Day and its dragon)",
    },
    range: fixed([4, 17], [4, 23]),
  },
  SUPERHEROES: {
    theme: 'SUPERHEROES',
    icon: '🦸',
    name: { fr: 'Journée des super-héros', en: 'Superhero day' },
    reason: { fr: 'Du 24 au 30 avril (journée du 28 avril)', en: 'April 24 to 30 (April 28)' },
    range: fixed([4, 24], [4, 30]),
  },
  RETRO_80S: {
    theme: 'RETRO_80S',
    icon: '🕹️',
    name: { fr: 'Semaine rétro', en: 'Retro week' },
    reason: {
      fr: 'Du 16 au 22 mai (sortie du premier jeu de labyrinthe à pastilles, 22 mai 1980)',
      en: 'May 16 to 22 (the dot-eating maze game came out on May 22, 1980)',
    },
    range: fixed([5, 16], [5, 22]),
  },
  SUMMER: {
    theme: 'SUMMER',
    icon: '🏖️',
    name: { fr: 'Début de l’été', en: 'Start of summer' },
    reason: { fr: 'Du 21 juin au 5 juillet', en: 'June 21 to July 5' },
    range: fixed([6, 21], [7, 5]),
  },
  PIRATES: {
    theme: 'PIRATES',
    icon: '🏴‍☠️',
    name: { fr: 'Semaine des pirates', en: 'Pirate week' },
    reason: {
      fr: 'Du 13 au 19 septembre (journée « parler comme un pirate », 19 septembre)',
      en: 'September 13 to 19 (Talk Like a Pirate Day, September 19)',
    },
    range: fixed([9, 13], [9, 19]),
  },
  HALLOWEEN: {
    theme: 'HALLOWEEN',
    icon: '🎃',
    name: { fr: 'Halloween', en: 'Halloween' },
    reason: { fr: 'Du 25 octobre au 1er novembre', en: 'October 25 to November 1' },
    range: fixed([10, 25], [11, 1]),
  },
  CYBERPUNK: {
    theme: 'CYBERPUNK',
    icon: '🌃',
    name: { fr: 'Cyber Monday', en: 'Cyber Monday' },
    reason: {
      fr: 'Du lundi avant le Black Friday au Cyber Monday',
      en: 'From the Monday before Black Friday to Cyber Monday',
    },
    range: (year) => {
      const thanksgiving = nthWeekday(year, 11, 4, 4);
      return [thanksgiving - 3, thanksgiving + 4];
    },
  },
  CHRISTMAS: {
    theme: 'CHRISTMAS',
    icon: '🎄',
    name: { fr: 'Noël', en: 'Christmas' },
    reason: { fr: 'Du 15 au 26 décembre', en: 'December 15 to 26' },
    range: fixed([12, 15], [12, 26]),
  },
};

/** Thèmes dont la période couvre ce jour (en jours depuis 1970), dans l'ordre de `DECOR_THEMES`. */
export function seasonsAt(days: number): DecorTheme[] {
  const { year } = civilFromDays(days);
  return DECOR_THEMES.filter((theme) =>
    // L'année précédente compte aussi : le Nouvel An commence en décembre.
    [year - 1, year].some((y) => {
      const [from, to] = SEASONS[theme].range(y);
      return days >= from && days <= to;
    }),
  );
}

/** Thèmes de saison actifs un jour de partie donné. */
export function seasonsOnGameDay(seed: string, gameDay: number): DecorTheme[] {
  return seasonsAt(calendarStartDays(seed) + gameDay);
}

/** Thèmes décorés compte tenu des réglages du back-office (thème absent = `SEASON`). */
export function decoratedThemes(
  seasons: readonly DecorTheme[],
  modes: Partial<Record<DecorTheme, DecorMode>>,
): DecorTheme[] {
  return DECOR_THEMES.filter((theme) => {
    const mode = modes[theme] ?? 'SEASON';
    return mode === 'ALWAYS' || (mode === 'SEASON' && seasons.includes(theme));
  });
}

/** Anniversaire d'un dev : mois et jour (jamais un 29 février, pour fêter chaque année). */
export const BirthdaySchema = z.object({
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});
export type Birthday = z.infer<typeof BirthdaySchema>;

/** Anniversaire tiré d'une clé (graine + identifiant du candidat), sans toucher au RNG. */
export function birthdayFromKey(key: string): Birthday {
  // 2025 n'est pas bissextile : 365 jours possibles, du 1er janvier au 31 décembre.
  const date = civilFromDays(
    daysFromCivil({ year: 2025, month: 1, day: 1 }) + (hashString(key) % 365),
  );
  return { month: date.month, day: date.day };
}

/** Le jour (en jours depuis 1970) est-il l'anniversaire ? */
export function isBirthday(birthday: Birthday, days: number): boolean {
  const date = civilFromDays(days);
  return date.month === birthday.month && date.day === birthday.day;
}

/**
 * Jour de fête : l'anniversaire lui-même un jour de semaine ; s'il tombe un week-end, la fête
 * est rattrapée le lundi suivant (personne n'est au bureau le samedi).
 */
export function isBirthdayParty(birthday: Birthday, days: number): boolean {
  const weekday = isoWeekday(days);
  if (weekday >= 6) return false;
  if (isBirthday(birthday, days)) return true;
  return weekday === 1 && (isBirthday(birthday, days - 1) || isBirthday(birthday, days - 2));
}
