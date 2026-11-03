import { MusicTrack as ElementTrack, type MusicHowl } from './musicTrack';
import type { SprintStep } from '../view/types';

/**
 * Musique du jeu : les morceaux du propriétaire du projet, déposés dans
 * `public/assets/music/` (voir le README du dossier). Chaque moment du jeu a sa playlist :
 * le menu, la gestion (planification et démo), le sprint dans l'open space, et les moments
 * à enjeu (levée de fonds, fin de partie). Changer de moment fait un fondu enchaîné ; en y
 * revenant, le morceau reprend là où il s'était arrêté.
 */
export const MUSIC_BASE = `${import.meta.env.BASE_URL}assets/music`;

/** Fichiers de `public/assets/music/` (noms d'origine sans espace ni accent). */
export const MUSIC_TRACKS = {
  tycoon: 'tycoon.mp3',
  tycoon1: 'tycoon-1.mp3',
  detente: 'detente.mp3',
  detente1: 'detente-1.mp3',
  detente2: 'detente-2.mp3',
  detente3: 'detente-3.mp3',
  ariaMath: 'aria-math.mp3',
} as const;
export type MusicTrack = keyof typeof MUSIC_TRACKS;

export const MUSIC_MOODS = ['menu', 'management', 'office', 'stakes'] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];

/** Playlist de chaque moment, jouée dans l'ordre puis en boucle. */
export const MUSIC_PLAYLISTS: Record<MusicMood, readonly MusicTrack[]> = {
  menu: ['tycoon'],
  management: ['tycoon1'],
  office: ['detente', 'detente1', 'detente2', 'detente3'],
  stakes: ['ariaMath'],
};

/** Moment musical selon l'étape du sprint (`null` : hors partie, donc le menu). */
export function musicMoodOf(step: SprintStep | null): MusicMood {
  switch (step) {
    case null:
      return 'menu';
    case 'PLANNING':
    case 'DEMO':
      return 'management';
    case 'EXECUTION':
      return 'office';
    case 'PITCH':
    case 'ENDED':
      return 'stakes';
  }
}

/** Durée du fondu enchaîné entre deux moments, en millisecondes. */
export const MUSIC_FADE_MS = 1500;

export type { MusicHowl };
/** Fabrique d'un morceau, remplaçable dans les tests. */
export type CreateHowl = (src: string) => MusicHowl;

/** Lecture en flux, volume réglé par Web Audio (voir `musicTrack.ts`, valable aussi sur iPhone). */
const createHowl: CreateHowl = (src) => new ElementTrack(src);

export class MusicPlayer {
  private mood: MusicMood | null = null;
  private current: MusicHowl | null = null;
  private readonly howls = new Map<MusicTrack, MusicHowl>();
  /** Morceau en cours dans la playlist de chaque moment. */
  private readonly positions = new Map<MusicMood, number>();

  constructor(
    private volume: number,
    private readonly playlists: Record<MusicMood, readonly MusicTrack[]> = MUSIC_PLAYLISTS,
    private readonly create: CreateHowl = createHowl,
  ) {}

  /** Change de moment : fondu de sortie du morceau en cours, fondu d'entrée du suivant. */
  setMood(mood: MusicMood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    this.fadeOut(this.current);
    this.current = this.trackHowl(mood);
    this.start();
  }

  setVolume(volume: number): void {
    this.volume = volume;
    const howl = this.current;
    if (!howl) return;
    if (volume === 0) howl.pause();
    else if (howl.playing()) howl.volume(volume);
    else this.start();
  }

  stop(): void {
    for (const howl of this.howls.values()) howl.stop();
    this.mood = null;
    this.current = null;
  }

  private trackHowl(mood: MusicMood): MusicHowl | null {
    const playlist = this.playlists[mood];
    const track = playlist[(this.positions.get(mood) ?? 0) % playlist.length];
    if (!track) return null;
    let howl = this.howls.get(track);
    if (!howl) {
      const created = this.create(`${MUSIC_BASE}/${MUSIC_TRACKS[track]}`);
      created.on('play', () => this.fadeIn(created));
      created.on('end', () => this.next(created));
      // Le navigateur bloque le son avant le premier clic ou la première touche : le morceau
      // prévient quand il est débloqué, on relance alors le morceau s'il est toujours d'actualité.
      created.on('playerror', () =>
        created.once('unlock', () => {
          if (created === this.current) this.start();
        }),
      );
      this.howls.set(track, created);
      howl = created;
    }
    return howl;
  }

  /**
   * Lance (ou reprend) le morceau courant ; le fondu d'entrée part à l'événement `play`, quand
   * le son démarre vraiment. S'il était encore en train de s'éteindre (aller-retour rapide entre
   * deux moments), il remonte depuis son volume actuel.
   */
  private start(): void {
    const howl = this.current;
    if (!howl || this.volume === 0) return;
    if (howl.playing()) {
      this.fadeIn(howl);
      return;
    }
    howl.volume(0);
    howl.play();
  }

  private fadeIn(howl: MusicHowl): void {
    if (howl === this.current) howl.fade(howl.volume(), this.volume, MUSIC_FADE_MS);
  }

  private fadeOut(howl: MusicHowl | null): void {
    if (!howl?.playing()) return;
    howl.fade(howl.volume(), 0, MUSIC_FADE_MS);
    howl.once('fade', () => {
      // Revenu entre-temps au même morceau : on le laisse jouer.
      if (howl !== this.current) howl.pause();
    });
  }

  /** Fin d'un morceau : on passe au suivant de la playlist du moment. */
  private next(ended: MusicHowl): void {
    if (ended !== this.current || !this.mood) return;
    this.positions.set(this.mood, (this.positions.get(this.mood) ?? 0) + 1);
    this.current = this.trackHowl(this.mood);
    this.start();
  }
}
