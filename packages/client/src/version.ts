/**
 * Version du jeu affichée au menu principal, pour savoir quelle version tourne (après une mise à
 * jour, ou pour comparer deux appareils). Valeurs écrites par Vite au build (`vite.config.ts`).
 */
declare const __APP_BUILD__: { version: string; commit: string; date: string };

export interface AppBuild {
  /** Numéro du paquet client, ex. « 0.1.0 ». */
  readonly version: string;
  /** Commit court du build, ex. « a35875d » (« dev » hors dépôt git). */
  readonly commit: string;
  /** Date du build, ISO 8601. */
  readonly date: string;
}

export const APP_BUILD: AppBuild = __APP_BUILD__;

/** « 0.1.0 · a35875d · 10/10/2026 14:05 » : date et heure du build dans la langue du joueur. */
export function formatBuild(build: AppBuild, locale: string): string {
  const date = new Date(build.date);
  const when = Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date);
  return [build.version, build.commit, when].filter(Boolean).join(' · ');
}
