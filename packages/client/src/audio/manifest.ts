import type { NotificationKind } from '@oss/shared';

/**
 * Effets sonores et ambiance. Les fichiers viendront de packs sons, à déposer dans `public/assets/`
 * comme les modèles 3D. Comme le cahier des charges interdit d'inventer un nom de fichier, ce
 * manifeste reste vide tant qu'ils ne sont pas là (voir « assets manquants » dans les crédits) :
 * ces sons sont alors simplement absents. La musique a son propre lecteur (`music.ts`).
 */
export const SOUND_CATEGORIES = ['music', 'sfx', 'ambience'] as const;
export type SoundCategory = (typeof SOUND_CATEGORIES)[number];

export const SOUND_KEYS = {
  /** Bruit de fond de l'open space (clavier mécanique, ventilation). */
  keyboard: 'ambience',
  click: 'sfx',
  success: 'sfx',
  error: 'sfx',
  alarm: 'sfx',
  cash: 'sfx',
  levelUp: 'sfx',
} as const satisfies Record<string, SoundCategory>;
export type SoundKey = keyof typeof SOUND_KEYS;

/** Chemins des fichiers sons (relatifs à `public/`). Vide tant que les packs manquent. */
export const SOUND_FILES: Partial<Record<SoundKey, readonly string[]>> = {};

/** Son joué pour une notification de la simulation. */
export const NOTIFICATION_SOUNDS: Partial<Record<NotificationKind, SoundKey>> = {
  PROD_DOWN: 'alarm',
  FEATURE_DONE: 'success',
  FUNDS_RAISED: 'cash',
  VENTURE_SOLD: 'cash',
  VENTURE_DIED: 'error',
  PITCH_FAILED: 'error',
  DEV_LEVEL_UP: 'levelUp',
  DEV_BIRTHDAY: 'levelUp',
  SEASON_STARTED: 'success',
  ACHIEVEMENT_UNLOCKED: 'levelUp',
  DEV_RESIGNED: 'error',
  DEV_NOTICE: 'error',
  RAISE_GRANTED: 'cash',
  HALLUCINATION: 'error',
};
