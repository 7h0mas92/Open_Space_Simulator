/**
 * Petit générateur pseudo-aléatoire seedable (mulberry32) pour l'IA visuelle des personnages.
 * Même graine ⇒ mêmes déplacements et mêmes bulles : un replay se rejoue à l'identique.
 * (La simulation a son propre RNG ; celui-ci ne sert qu'à l'animation.)
 */
export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Nombre dans [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entier dans [0, max). */
  int(max: number): number {
    return Math.floor(this.next() * max);
  }

  pick<T>(items: readonly T[]): T {
    const item = items[this.int(items.length)];
    if (item === undefined) throw new Error('pick() sur une liste vide');
    return item;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

/** Hache une chaîne en entier 32 bits (FNV-1a), pour dériver une graine par personnage. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
