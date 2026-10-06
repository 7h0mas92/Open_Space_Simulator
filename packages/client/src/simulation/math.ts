/**
 * Fonctions mathématiques déterministes.
 *
 * `Math.log`, `Math.exp` ou `Math.pow` peuvent donner des résultats différents au
 * dernier chiffre près selon le moteur JavaScript (Chrome, Firefox, Safari, Node).
 * Or le serveur rejoue les parties pour vérifier les scores : un écart minuscule
 * suffirait à faire diverger le rejeu. La simulation n'utilise donc que les quatre
 * opérations et `Math.sqrt`, garanties identiques partout par la norme IEEE 754.
 */

/** Approximation de log10(x) pour x ≥ 0 (interpolation linéaire entre puissances de 10). */
export function log10Approx(x: number): number {
  if (x < 1) return 0;
  let magnitude = 0;
  let power = 1;
  while (power * 10 <= x) {
    power *= 10;
    magnitude += 1;
  }
  return magnitude + (x - power) / (power * 9);
}

/** Courbe en S de ]-∞, +∞[ vers ]0, 1[ (0.5 en 0), sans exponentielle. */
export function softSigmoid(x: number): number {
  return 0.5 + x / (2 * (1 + Math.abs(x)));
}

/** Arrondi à `digits` décimales, pour garder des valeurs lisibles dans l'état. */
export function round(value: number, digits = 2): number {
  const factor = digits === 0 ? 1 : digits === 1 ? 10 : digits === 2 ? 100 : 1000;
  return Math.round(value * factor) / factor;
}
