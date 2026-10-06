import type { NotificationKind } from '@oss/shared';

/**
 * Sons du jeu. Les fichiers viendront des packs sons de Kenney (CC0), à déposer dans
 * `public/assets/kenney/<pack>/` comme les modèles 3D. Comme le cahier des charges interdit
 * d'inventer un nom de fichier, ce manifeste reste vide tant que les packs ne sont pas là
 * (voir « assets manquants » dans les crédits) : le jeu est alors simplement silencieux.
 */
export const SOUND_CATEGORIES = ['music', 'sfx', 'ambience'] as const;
export type SoundCategory = (typeof SOUND_CATEGORIES)[number];

export const SOUND_KEYS = {
  /** Musique lo-fi en boucle. */
  music: 'music',
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
  PITCH_FAILED: 'error',
  DEV_LEVEL_UP: 'levelUp',
  ACHIEVEMENT_UNLOCKED: 'levelUp',
  DEV_RESIGNED: 'error',
  HALLUCINATION: 'error',
};
