/**
 * Générateur pseudo-aléatoire seedable (algorithme sfc32).
 *
 * Pourquoi ne pas utiliser `Math.random()` ? Parce qu'on ne peut pas le rejouer. Ici,
 * la même graine produit toujours la même suite de nombres : la partie Daily est
 * identique pour tout le monde et un replay se rejoue à l'identique.
 *
 * L'état du générateur (4 entiers 32 bits) est stocké DANS l'état de jeu : une partie
 * rechargée reprend exactement là où elle s'était arrêtée.
 */

export type RngState = [number, number, number, number];

/** Hachage cyrb128 : transforme une chaîne (la graine) en 4 entiers 32 bits. */
export function seedToState(seed: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/**
 * Générateur qui lit et écrit son état dans un tableau partagé (celui de l'état de
 * jeu). Toutes les fonctions de tirage passent par lui.
 */
export class Rng {
  constructor(private readonly state: RngState) {}

  static fromSeed(seed: string): Rng {
    return new Rng(seedToState(seed));
  }

  /** Nombre flottant dans [0, 1). */
  next(): number {
    const s = this.state;
    let [a, b, c, d] = s;
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    s[0] = a >>> 0;
    s[1] = b >>> 0;
    s[2] = c >>> 0;
    s[3] = d >>> 0;
    return (t >>> 0) / 4294967296;
  }

  /** Vrai avec la probabilité `p` (entre 0 et 1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Entier dans [min, max] (bornes incluses). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Flottant dans [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Élément au hasard d'une liste non vide. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick : liste vide');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** Élément tiré selon des poids positifs ; `undefined` si tous les poids sont nuls. */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T | undefined {
    let total = 0;
    for (const item of items) total += Math.max(0, weightOf(item));
    if (total <= 0) return undefined;
    let roll = this.next() * total;
    for (const item of items) {
      roll -= Math.max(0, weightOf(item));
      if (roll < 0) return item;
    }
    return items[items.length - 1];
  }

  /** Mélange de Fisher-Yates (renvoie une nouvelle liste). */
  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
    }
    return copy;
  }
}

/**
 * Flux aléatoires « annexes » : chacun dérive sa propre graine de celle de la partie, pour ne
 * jamais consommer le générateur principal (règle du projet, voir docs/dev/conventions.md).
 * Ajouter ici le nom d'un nouveau flux plutôt qu'écrire la graine à la main.
 */
export const SIDE_STREAMS = [
  'web-roles',
  'tasks',
  'raise',
  'teambuilding',
  'leave',
  'rival',
  'pitch',
  'retro',
  'clients',
  'meeting',
  'duplicate',
  'venture',
] as const;
export type SideStream = (typeof SIDE_STREAMS)[number];

/**
 * Générateur annexe : graine `${seed}#${stream}#${parts…}`. Le format ne doit jamais changer
 * (les replays et les scores déjà enregistrés en dépendent).
 */
export function sideRng(seed: string, stream: SideStream, ...parts: (string | number)[]): Rng {
  return Rng.fromSeed([seed, stream, ...parts].join('#'));
}
