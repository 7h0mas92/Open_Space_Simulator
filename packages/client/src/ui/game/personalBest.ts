/**
 * Meilleure partie du joueur dans chaque mode, gardée dans ce navigateur : l'écran de fin compare
 * la partie qui se termine à ce record (sans compte ni serveur).
 */
import type { GameMode } from '@oss/shared';

const STORAGE_KEY = 'oss.personalBest';

export interface PersonalBest {
  readonly valuation: number;
  readonly sprint: number;
  /** Graine de la partie du record : la recharger ne la compare pas à elle-même. */
  readonly seed: string;
}

type Records = Partial<Record<GameMode, PersonalBest>>;

function read(): Records {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Records;
  } catch {
    return {};
  }
}

/**
 * Compare une partie terminée au record du mode et l'enregistre si elle le bat. Renvoie le record
 * d'avant (null s'il n'y en avait pas, ou si le record est déjà cette partie).
 */
export function recordGame(mode: GameMode, game: PersonalBest): PersonalBest | null {
  const records = read();
  const previous = records[mode] ?? null;
  if (previous?.seed === game.seed) return null;
  if (!previous || game.valuation > previous.valuation) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...records, [mode]: game }));
    } catch {
      // Stockage indisponible (navigation privée) : pas de record gardé.
    }
  }
  return previous;
}
