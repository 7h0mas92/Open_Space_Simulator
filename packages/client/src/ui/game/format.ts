import type { Birthday, CalendarDate, LocalizedText } from '@oss/shared';
import type { GameTime, GameView, GaugeName } from '../../view/types';

/**
 * Locale Intl à partir de la langue i18next. Le navigateur peut annoncer des variantes exotiques
 * (« en-US@posix ») qu'Intl refuse : on se ramène aux deux langues du jeu.
 */
export function intlLocale(language: string): string {
  return language.toLowerCase().startsWith('en') ? 'en-US' : 'fr-FR';
}

/** Formate la valeur d'une jauge pour l'affichage (euros compacts, pourcentages, nombres). */
export function formatGauge(name: GaugeName, value: number, locale: string): string {
  if (name === 'treasury') {
    return new Intl.NumberFormat(intlLocale(locale), {
      style: 'currency',
      currency: 'EUR',
      notation: 'compact',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value);
  }
  if (name === 'users') {
    return new Intl.NumberFormat(intlLocale(locale), {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
  return `${Math.round(value)}`;
}

/** Une jauge en alerte : trésorerie basse, café vide, dette haute… */
export function isGaugeCritical(name: GaugeName, value: number): boolean {
  switch (name) {
    case 'treasury':
      return value < 200_000;
    case 'debt':
      return value > 70;
    case 'users':
      return false;
    default:
      return value < 25;
  }
}

/** Valeur normalisée entre 0 et 1 pour la barre d'une jauge. */
export function gaugeRatio(name: GaugeName, value: number): number {
  if (name === 'treasury') return Math.min(1, Math.max(0, value / 2_000_000));
  if (name === 'users') return Math.min(1, Math.log10(Math.max(1, value)) / 7);
  return Math.min(1, Math.max(0, value / 100));
}

export function formatClock(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatMoney(value: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }).format(value);
}

/** Texte bilingue de la simulation (cartes, bios, notifications) dans la langue courante. */
export function localized(text: LocalizedText, language: string): string {
  return language.toLowerCase().startsWith('en') ? text.en : text.fr;
}

/**
 * Tendance d'une jauge : signe de l'écart avec l'avant-dernier point quotidien (environ un jour
 * plus tôt). 0 quand l'écart est négligeable ou qu'il n'y a pas encore d'historique.
 */
export function gaugeTrend(view: Pick<GameView, 'gauges' | 'history'>, name: GaugeName): number {
  const past = view.history.at(-2) ?? view.history.at(-1);
  if (!past) return 0;
  const delta = view.gauges[name] - past[name];
  const threshold = name === 'treasury' ? 1_000 : name === 'users' ? 1 : 0.5;
  return Math.abs(delta) < threshold ? 0 : Math.sign(delta);
}

/** Avancement du sprint en cours, de 0 à 1 (14 jours simulés). */
export function sprintProgress(time: Pick<GameTime, 'day' | 'minute'>): number {
  return Math.min(1, Math.max(0, (time.day * 1440 + time.minute) / (14 * 1440)));
}

/** Date du calendrier de la partie : « 29 oct. 2026 » / « Oct 29, 2026 ». */
export function formatGameDate(date: CalendarDate, language: string): string {
  return new Intl.DateTimeFormat(intlLocale(language), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(date.year, date.month - 1, date.day));
}

/** Jour et mois d'un anniversaire : « 12 mars » / « March 12 ». */
export function formatBirthday(birthday: Birthday, language: string): string {
  return new Intl.DateTimeFormat(intlLocale(language), {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(Date.UTC(2025, birthday.month - 1, birthday.day));
}
