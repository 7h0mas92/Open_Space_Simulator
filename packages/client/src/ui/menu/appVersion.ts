/**
 * Version du jeu réellement chargée, figée au build (voir `define` dans vite.config.ts) :
 * numéro du package, hash court du commit et date de ce commit. Affichée en bas du menu
 * pour savoir, après une mise à jour, quelle version tourne sur l'appareil.
 */
export interface AppVersion {
  /** Numéro du package client, par exemple « 0.1.0 ». */
  version: string;
  /** Hash court du commit (7 caractères), « dev » hors dépôt git. */
  commit: string;
  /** Date du commit au format ISO 8601. */
  date: string;
}

export const APP_VERSION: AppVersion = {
  version: __APP_VERSION__,
  commit: __APP_COMMIT__,
  date: __APP_COMMIT_DATE__,
};

/** Date du commit dans la langue du joueur : « 10 oct. 2026 », « Oct 10, 2026 ». */
export function formatVersionDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
  } catch {
    // Langue au format inattendu (« en-US@posix ») : la date ISO plutôt qu'un menu cassé.
    return iso.slice(0, 10);
  }
}
