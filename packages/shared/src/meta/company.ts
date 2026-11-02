/**
 * Nom de l'entreprise d'une partie, tiré de sa graine par un hachage : il ne consomme aucun
 * tirage du générateur de la partie (replays, Daily et scores inchangés) et le serveur le
 * retrouve à partir de la seule graine. Deux parties de même graine (le Daily du jour) ont le
 * même nom. Les noms sont inventés, à la manière des startups, sans marque existante.
 */
const PREFIXES = [
  'Synerg',
  'Pivot',
  'Cloud',
  'Hyper',
  'Nimbus',
  'Byte',
  'Quantum',
  'Agil',
  'Data',
  'Pixel',
  'Turbo',
  'Neo',
  'Lambda',
  'Kanb',
  'Stack',
  'Disrupt',
  'Blue',
  'Mega',
  'Flux',
  'Octo',
  'Scal',
  'Deploy',
  'Zen',
  'Rocket',
] as const;

const SUFFIXES = [
  'ify',
  'ly',
  'io',
  'Hub',
  'Lab',
  'Base',
  'Works',
  'Flow',
  'Loop',
  'Mind',
  'ster',
  'Nest',
  'Bit',
  'Wave',
  'Box',
  'Corp',
] as const;

/** Hachage FNV-1a 32 bits (sans dépendance, identique côté client et serveur). */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Nom de l'entreprise de la partie jouée sur cette graine (« Synergify », « CloudLab »…). */
export function companyName(seed: string): string {
  const h = hash(`${seed}#company`);
  const prefix = PREFIXES[h % PREFIXES.length] ?? PREFIXES[0];
  const suffix = SUFFIXES[Math.floor(h / PREFIXES.length) % SUFFIXES.length] ?? SUFFIXES[0];
  return `${prefix}${suffix}`;
}
