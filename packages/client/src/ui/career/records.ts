import { CareerLegendIdSchema, type CareerLegendId, type CareerResult } from '@oss/shared';

/*
 * Meilleur résultat de chaque légende du mode Carrière, gardé sur l'appareil. C'est un confort
 * d'affichage (« Meilleur résultat : ★★☆ ») : le score officiel reste celui du classement, vérifié
 * par le serveur. Le stockage peut être indisponible (navigation privée) : on fait sans.
 */

const KEY = 'oss.career.best';

export type CareerRecords = Partial<Record<CareerLegendId, number>>;

export function careerRecords(): CareerRecords {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (typeof raw !== 'object' || raw === null) return {};
    const records: CareerRecords = {};
    for (const [id, stars] of Object.entries(raw)) {
      const legend = CareerLegendIdSchema.safeParse(id);
      if (legend.success && typeof stars === 'number') records[legend.data] = stars;
    }
    return records;
  } catch {
    return {};
  }
}

/** Garde le résultat s'il bat le précédent pour cette légende. */
export function recordCareer(result: CareerResult): void {
  try {
    const records = careerRecords();
    if ((records[result.legend] ?? -1) >= result.stars) return;
    records[result.legend] = result.stars;
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    // Stockage indisponible : le résultat n'est simplement pas gardé.
  }
}

/** « ★★☆ » */
export function starsText(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
}
