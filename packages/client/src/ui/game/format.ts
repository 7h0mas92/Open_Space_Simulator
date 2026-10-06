import type { LocalizedText } from '@oss/shared';
import type { GaugeName } from '../../view/types';

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
