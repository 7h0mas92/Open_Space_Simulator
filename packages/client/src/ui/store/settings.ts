/**
 * Préférences du joueur (qualité graphique, accessibilité), gardées dans le navigateur.
 */
import { create } from 'zustand';
import { defaultQuality, QUALITY_LEVELS, type QualityLevel } from '../../render/quality';

export const TEXT_SCALES = [0.875, 1, 1.125, 1.25] as const;

export interface Settings {
  readonly quality: QualityLevel;
  readonly reducedMotion: boolean;
  readonly textScale: number;
  readonly showFps: boolean;
  readonly tutorialDone: boolean;
}

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
    textScale: 1,
    showFps: false,
    tutorialDone: false,
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
      textScale: TEXT_SCALES.includes(raw.textScale as (typeof TEXT_SCALES)[number])
        ? (raw.textScale as number)
        : 1,
      showFps: raw.showFps === true,
      tutorialDone: raw.tutorialDone === true,
    };
  } catch {
    return defaults;
  }
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...load(),
  update(patch) {
    set(patch);
    const { quality, reducedMotion, textScale, showFps, tutorialDone } = get();
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ quality, reducedMotion, textScale, showFps, tutorialDone }),
      );
    } catch {
      // Stockage indisponible (navigation privée) : les réglages restent pour la session.
    }
  },
}));
