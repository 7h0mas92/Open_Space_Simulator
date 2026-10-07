/**
 * Préférences du joueur (qualité graphique, accessibilité), gardées dans le navigateur.
 */
import { create } from 'zustand';
import { ZOOM_SPEEDS, type ZoomSpeed } from '../../render/isoCamera';
import { defaultQuality, QUALITY_LEVELS, type QualityLevel } from '../../render/quality';

export const TEXT_SCALES = [0.875, 1, 1.125, 1.25] as const;

export interface Settings {
  readonly quality: QualityLevel;
  readonly reducedMotion: boolean;
  /** Vitesse du zoom caméra (molette, trackpad, pincement). */
  readonly zoomSpeed: ZoomSpeed;
  readonly textScale: number;
  readonly showFps: boolean;
  readonly tutorialDone: boolean;
  /** Slack animé par l'IA du serveur (sinon : templates). */
  readonly slackAi: boolean;
  /** Volumes séparés, de 0 à 1. */
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly ambienceVolume: number;
}

export const VOLUME_KEYS = ['musicVolume', 'sfxVolume', 'ambienceVolume'] as const;
const volume = (value: unknown, fallback: number) =>
  typeof value === 'number' && value >= 0 && value <= 1 ? value : fallback;

interface SettingsStore extends Settings {
  update(patch: Partial<Settings>): void;
}

const STORAGE_KEY = 'oss.settings';

function detectDefaults(): Settings {
  const media = (query: string) =>
    typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  return {
    quality: defaultQuality({
      coarsePointer: media('(pointer: coarse)'),
      screenWidth: window.screen?.width ?? window.innerWidth,
      hardwareConcurrency: navigator.hardwareConcurrency,
    }),
    reducedMotion: media('(prefers-reduced-motion: reduce)'),
    zoomSpeed: 'normal',
    textScale: 1,
    showFps: false,
    tutorialDone: false,
    slackAi: false,
    musicVolume: 0.5,
    sfxVolume: 0.7,
    ambienceVolume: 0.4,
  };
}

function load(): Settings {
  const defaults = detectDefaults();
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Settings>;
    return {
      quality: QUALITY_LEVELS.includes(raw.quality as QualityLevel)
        ? (raw.quality as QualityLevel)
        : defaults.quality,
      reducedMotion:
        typeof raw.reducedMotion === 'boolean' ? raw.reducedMotion : defaults.reducedMotion,
      zoomSpeed: ZOOM_SPEEDS.includes(raw.zoomSpeed as ZoomSpeed)
        ? (raw.zoomSpeed as ZoomSpeed)
        : defaults.zoomSpeed,
      textScale: TEXT_SCALES.includes(raw.textScale as (typeof TEXT_SCALES)[number])
        ? (raw.textScale as number)
        : 1,
      showFps: raw.showFps === true,
      tutorialDone: raw.tutorialDone === true,
      slackAi: raw.slackAi === true,
      musicVolume: volume(raw.musicVolume, defaults.musicVolume),
      sfxVolume: volume(raw.sfxVolume, defaults.sfxVolume),
      ambienceVolume: volume(raw.ambienceVolume, defaults.ambienceVolume),
    };
  } catch {
    return defaults;
  }
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...load(),
  update(patch) {
    set(patch);
    try {
      // JSON.stringify ignore la fonction `update` : seuls les réglages sont gardés.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(get()));
    } catch {
      // Stockage indisponible (navigation privée) : les réglages restent pour la session.
    }
  },
}));
