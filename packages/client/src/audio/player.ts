import { Howl } from 'howler';
import type { GameNotification } from '../view/types';
import {
  NOTIFICATION_SOUNDS,
  SOUND_FILES,
  SOUND_KEYS,
  type SoundCategory,
  type SoundKey,
} from './manifest';

export type Volumes = Record<SoundCategory, number>;

/**
 * Lecteur audio (Howler.js). Trois volumes indépendants : musique, effets, ambiance.
 * Les sons sont chargés à la première lecture ; un son absent du manifeste est ignoré.
 */
export class AudioPlayer {
  private readonly howls = new Map<SoundKey, Howl>();
  private volumes: Volumes;

  constructor(
    volumes: Volumes,
    private readonly files: Partial<Record<SoundKey, readonly string[]>> = SOUND_FILES,
  ) {
    this.volumes = volumes;
  }

  /** Nombre de sons disponibles (0 tant que les packs sons Kenney ne sont pas déposés). */
  get available(): number {
    return Object.keys(this.files).length;
  }

  private howl(key: SoundKey): Howl | null {
    const src = this.files[key];
    if (!src || src.length === 0) return null;
    let howl = this.howls.get(key);
    if (!howl) {
      const category = SOUND_KEYS[key];
      howl = new Howl({
        src: [...src],
        loop: category !== 'sfx',
        volume: this.volumes[category],
      });
      this.howls.set(key, howl);
    }
    return howl;
  }

  play(key: SoundKey): void {
    const howl = this.howl(key);
    if (!howl || this.volumes[SOUND_KEYS[key]] === 0) return;
    if (SOUND_KEYS[key] !== 'sfx' && howl.playing()) return;
    howl.play();
  }

  /** Sons associés aux notifications de la simulation (un seul par lot, le plus récent). */
  onNotifications(notifications: readonly GameNotification[]): void {
    const kind = notifications.findLast((n) => NOTIFICATION_SOUNDS[n.kind])?.kind;
    const key = kind ? NOTIFICATION_SOUNDS[kind] : undefined;
    if (key) this.play(key);
  }

  setVolumes(volumes: Volumes): void {
    this.volumes = volumes;
    for (const [key, howl] of this.howls) howl.volume(volumes[SOUND_KEYS[key]]);
  }

  stopAll(): void {
    for (const howl of this.howls.values()) howl.stop();
  }
}
