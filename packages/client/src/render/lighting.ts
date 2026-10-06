/**
 * Cycle jour/nuit : l'éclairage de la scène suit l'heure simulée.
 * Fonction pure (heure → réglages), testable sans Three.js.
 */
export interface LightingState {
  /** Intensité du « soleil » (lumière directionnelle). */
  readonly sun: number;
  readonly sunColor: number;
  /** Lumière d'ambiance (hémisphérique). */
  readonly ambient: number;
  readonly skyColor: number;
  /** Couleur de fond de la scène. */
  readonly background: number;
  /** Angle du soleil autour de la scène, en radians. */
  readonly sunAzimuth: number;
  /** Les lampes et écrans s'allument le soir. */
  readonly lampsOn: boolean;
}

interface Keyframe {
  readonly hour: number;
  readonly sun: number;
  readonly sunColor: number;
  readonly ambient: number;
  readonly skyColor: number;
  readonly background: number;
}

// Le soir, les lumières du bureau prennent le relais : l'ambiance reste lisible, en plus chaud.
const KEYFRAMES: readonly Keyframe[] = [
  {
    hour: 0,
    sun: 0.15,
    sunColor: 0x6b7bd6,
    ambient: 0.6,
    skyColor: 0x8a96d8,
    background: 0x10131f,
  },
  {
    hour: 6,
    sun: 0.45,
    sunColor: 0xffb47a,
    ambient: 0.7,
    skyColor: 0xb3a6d8,
    background: 0x2b2f4a,
  },
  { hour: 9, sun: 1.6, sunColor: 0xfff1dc, ambient: 0.9, skyColor: 0xd6e6ff, background: 0x3a4466 },
  {
    hour: 15,
    sun: 1.7,
    sunColor: 0xfff6e8,
    ambient: 0.95,
    skyColor: 0xe0ecff,
    background: 0x3d4870,
  },
  {
    hour: 18,
    sun: 1.0,
    sunColor: 0xff9b5c,
    ambient: 0.85,
    skyColor: 0xf0b48a,
    background: 0x34304f,
  },
  {
    hour: 20,
    sun: 0.3,
    sunColor: 0x7a6bd6,
    ambient: 0.8,
    skyColor: 0xffd9a8,
    background: 0x1a1830,
  },
  {
    hour: 24,
    sun: 0.15,
    sunColor: 0x6b7bd6,
    ambient: 0.6,
    skyColor: 0x8a96d8,
    background: 0x10131f,
  },
];

const FALLBACK: Keyframe = {
  hour: 0,
  sun: 0.1,
  sunColor: 0xffffff,
  ambient: 0.4,
  skyColor: 0xffffff,
  background: 0,
};

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function mixColor(a: number, b: number, t: number): number {
  const r = Math.round(mix((a >> 16) & 0xff, (b >> 16) & 0xff, t));
  const g = Math.round(mix((a >> 8) & 0xff, (b >> 8) & 0xff, t));
  const bl = Math.round(mix(a & 0xff, b & 0xff, t));
  return (r << 16) | (g << 8) | bl;
}

/** Réglages d'éclairage pour une minute de la journée (0 à 1439). */
export function lightingAt(minute: number): LightingState {
  const hour = (((minute % 1440) + 1440) % 1440) / 60;
  let index = 0;
  while (index < KEYFRAMES.length - 2 && (KEYFRAMES[index + 1]?.hour ?? 24) <= hour) index++;
  const from = KEYFRAMES[index] ?? FALLBACK;
  const to = KEYFRAMES[index + 1] ?? FALLBACK;
  const t = (hour - from.hour) / (to.hour - from.hour);
  return {
    sun: mix(from.sun, to.sun, t),
    sunColor: mixColor(from.sunColor, to.sunColor, t),
    ambient: mix(from.ambient, to.ambient, t),
    skyColor: mixColor(from.skyColor, to.skyColor, t),
    background: mixColor(from.background, to.background, t),
    // Le soleil fait le tour de la scène entre 6h et 20h.
    sunAzimuth: ((hour - 6) / 14) * Math.PI,
    lampsOn: hour >= 18.5 || hour < 7,
  };
}
