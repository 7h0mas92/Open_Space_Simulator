/**
 * Préréglages de qualité graphique (bas, moyen, haut).
 * Le cahier des charges impose : devicePixelRatio plafonné à 2, ombres coupées sur mobile,
 * 60 fps visés sur ordinateur et 30 fps minimum sur un mobile milieu de gamme.
 */
export const QUALITY_LEVELS = ['low', 'medium', 'high'] as const;
export type QualityLevel = (typeof QUALITY_LEVELS)[number];

export interface QualityPreset {
  /** Plafond du devicePixelRatio. */
  readonly pixelRatioCap: number;
  readonly antialias: boolean;
  readonly shadows: boolean;
  readonly shadowMapSize: number;
  /** Contour de sélection (post-processing). */
  readonly outline: boolean;
  /** Léger bloom sur les écrans et les lampes. */
  readonly bloom: boolean;
  /** Distance de zoom au-delà de laquelle les petits objets décoratifs sont masqués (LOD). */
  readonly decorLodZoom: number;
  /** Nombre maximal de particules pour la fumée et les confettis. */
  readonly maxParticles: number;
  /** Vraies lampes ponctuelles au plafond (les autres lumières sont des textures). */
  readonly roomLights: number;
}

export const QUALITY_PRESETS: Readonly<Record<QualityLevel, QualityPreset>> = {
  low: {
    pixelRatioCap: 1,
    antialias: false,
    shadows: false,
    shadowMapSize: 0,
    outline: false,
    bloom: false,
    decorLodZoom: 0.8,
    maxParticles: 60,
    roomLights: 0,
  },
  medium: {
    pixelRatioCap: 1.5,
    antialias: true,
    shadows: true,
    shadowMapSize: 1024,
    outline: true,
    bloom: false,
    decorLodZoom: 0.6,
    maxParticles: 150,
    roomLights: 3,
  },
  high: {
    pixelRatioCap: 2,
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    outline: true,
    bloom: true,
    decorLodZoom: 0,
    maxParticles: 300,
    roomLights: 6,
  },
};

/** Plafond absolu du cahier des charges, quel que soit le préréglage. */
export const MAX_PIXEL_RATIO = 2;

export function pixelRatioFor(level: QualityLevel, devicePixelRatio: number): number {
  return Math.min(devicePixelRatio || 1, QUALITY_PRESETS[level].pixelRatioCap, MAX_PIXEL_RATIO);
}

export interface DeviceHints {
  readonly coarsePointer: boolean;
  readonly screenWidth: number;
  readonly hardwareConcurrency?: number;
  /** Nom du moteur WebGL (« SwiftShader », « llvmpipe »…) quand le navigateur le donne. */
  readonly gpuRenderer?: string;
}

/**
 * Rendu WebGL fait par le processeur, sans carte graphique (machines virtuelles, serveurs de
 * test, pilotes absents) : chaque pixel coûte cher, la vue sur la ville comprise.
 */
export function isSoftwareRenderer(renderer: string | undefined): boolean {
  return /swiftshader|llvmpipe|softpipe|software|basic render driver/i.test(renderer ?? '');
}

/**
 * Qualité par défaut selon l'appareil : mobile ou rendu logiciel = bas (sans ombres ni
 * post-processing), tablette = moyen.
 */
export function defaultQuality(device: DeviceHints): QualityLevel {
  if (isSoftwareRenderer(device.gpuRenderer)) return 'low';
  if (device.coarsePointer && device.screenWidth < 600) return 'low';
  if (device.coarsePointer || (device.hardwareConcurrency ?? 8) <= 4) return 'medium';
  return 'high';
}
