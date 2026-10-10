/**
 * Les lumières de New York : quelle part des fenêtres est allumée à chaque heure du jeu.
 *
 * Fonction pure, testable sans WebGL. Le shader des façades (`skylineShaders.ts`) donne à
 * chaque fenêtre un seuil tiré d'un hachage de sa position : elle est allumée quand ce seuil
 * passe sous la part du moment. Quand la part baisse le soir, les fenêtres s'éteignent donc
 * une à une, dans un ordre propre à chaque immeuble, au lieu de toutes en même temps.
 *
 * Deux rythmes de vie :
 * - les bureaux (tours de verre, immeubles à bandeaux) s'allument plateau par plateau le matin
 *   et se vident entre 18h et 22h ; quelques étages restent éclairés toute la nuit (ménage,
 *   salles serveurs) ;
 * - les logements (briques, brownstones) s'éveillent vers 7h, se remplissent le soir et
 *   s'éteignent peu à peu après 23h.
 */

/** Usage d'un immeuble : il fixe le rythme de ses fenêtres. */
export type BuildingUse = 'office' | 'home';

type Schedule = readonly (readonly [hour: number, share: number])[];

const OFFICE: Schedule = [
  [0, 0.07],
  [6, 0.08],
  [7.5, 0.45],
  [9, 0.82],
  [17, 0.82],
  [18.5, 0.62],
  [20, 0.34],
  [22, 0.15],
  [24, 0.07],
];

const HOME: Schedule = [
  [0, 0.3],
  [1.5, 0.13],
  [4, 0.05],
  [6, 0.12],
  [7, 0.4],
  [8.5, 0.22],
  [11, 0.12],
  [16, 0.16],
  [18, 0.45],
  [20, 0.74],
  [22, 0.62],
  [23.5, 0.38],
  [24, 0.3],
];

/** Part des fenêtres allumées (0 à 1) à `hour` (0 à 24, décimales comprises). */
export function litShare(hour: number, use: BuildingUse): number {
  const schedule = use === 'office' ? OFFICE : HOME;
  const h = ((hour % 24) + 24) % 24;
  for (let index = 1; index < schedule.length; index++) {
    const [toHour, toShare] = schedule[index] ?? [24, 0];
    if (h > toHour) continue;
    const [fromHour, fromShare] = schedule[index - 1] ?? [0, 0];
    const t = toHour === fromHour ? 0 : (h - fromHour) / (toHour - fromHour);
    return fromShare + (toShare - fromShare) * t;
  }
  return schedule[0]?.[1] ?? 0;
}
