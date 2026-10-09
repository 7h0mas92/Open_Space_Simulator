import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MUSIC_BASE,
  MUSIC_FADE_MS,
  MUSIC_MOODS,
  MUSIC_PLAYLISTS,
  MUSIC_TRACKS,
  MusicPlayer,
  musicMoodOf,
  type CreateHowl,
  type MusicHowl,
  type MusicMood,
  type MusicTrack,
} from '../../../src/audio/music';
import { SPRINT_STEPS } from '../../../src/view/types';

/** Faux morceau Howler : on garde ses appels et on déclenche ses événements à la main. */
class FakeHowl {
  isPlaying = false;
  level = 1;
  readonly listeners = new Map<string, (() => void)[]>();
  /** Comme Howler, prévient quand le son démarre vraiment. */
  readonly play = vi.fn(() => {
    this.isPlaying = true;
    this.emit('play');
    return 1;
  });
  readonly pause = vi.fn(() => {
    this.isPlaying = false;
    return this;
  });
  readonly stop = vi.fn(() => {
    this.isPlaying = false;
    return this;
  });
  readonly fade = vi.fn((_from: number, to: number) => {
    this.level = to;
    return this;
  });
  constructor(readonly src: string) {}
  volume(level?: number): number | this {
    if (level === undefined) return this.level;
    this.level = level;
    return this;
  }
  playing(): boolean {
    return this.isPlaying;
  }
  on(event: string, listener: () => void): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }
  once(event: string, listener: () => void): this {
    const wrapped = () => {
      this.listeners.set(
        event,
        (this.listeners.get(event) ?? []).filter((l) => l !== wrapped),
      );
      listener();
    };
    return this.on(event, wrapped);
  }
  emit(event: string): void {
    for (const listener of this.listeners.get(event) ?? []) listener();
  }
  /** Fin naturelle du morceau. */
  end(): void {
    this.isPlaying = false;
    this.emit('end');
  }
}

let howls: FakeHowl[] = [];
const create: CreateHowl = (src) => {
  const howl = new FakeHowl(src);
  howls.push(howl);
  return howl as unknown as MusicHowl;
};
const PLAYLISTS: Record<MusicMood, readonly MusicTrack[]> = {
  menu: ['tycoon'],
  management: ['tycoon1'],
  office: ['detente', 'detente1'],
  stakes: ['ariaMath'],
};
const howlOf = (track: MusicTrack) =>
  howls.find((howl) => howl.src === `${MUSIC_BASE}/${MUSIC_TRACKS[track]}`);

beforeEach(() => {
  howls = [];
});

describe('musique', () => {
  it('chaque morceau existe dans public/assets/music et sert dans une playlist', () => {
    const files = Object.keys(import.meta.glob('/public/assets/music/*.mp3')).map((path) =>
      path.replace('/public/assets/music/', ''),
    );
    expect(files.sort()).toEqual(Object.values(MUSIC_TRACKS).sort());
    const used = MUSIC_MOODS.flatMap((mood) => MUSIC_PLAYLISTS[mood]);
    expect(new Set(used)).toEqual(new Set(Object.keys(MUSIC_TRACKS)));
  });

  it('donne un moment musical à chaque étape du sprint, et le menu hors partie', () => {
    expect(musicMoodOf(null)).toBe('menu');
    expect(SPRINT_STEPS.map(musicMoodOf)).toEqual([
      'management',
      'office',
      'management',
      'stakes',
      'stakes',
    ]);
  });

  it('lance le morceau du moment en flux, avec un fondu d’entrée', () => {
    const player = new MusicPlayer(0.5, PLAYLISTS, create);
    player.setMood('menu');
    player.setMood('menu');
    expect(howls).toHaveLength(1);
    const menu = howlOf('tycoon');
    expect(menu?.play).toHaveBeenCalledTimes(1);
    expect(menu?.fade).toHaveBeenCalledWith(0, 0.5, MUSIC_FADE_MS);
  });

  it('enchaîne deux moments en fondu et reprend le morceau là où il en était', () => {
    const player = new MusicPlayer(0.5, PLAYLISTS, create);
    player.setMood('menu');
    player.setMood('office');
    const menu = howlOf('tycoon');
    expect(menu?.fade).toHaveBeenLastCalledWith(0.5, 0, MUSIC_FADE_MS);
    expect(howlOf('detente')?.play).toHaveBeenCalledTimes(1);
    menu?.emit('fade');
    expect(menu?.pause).toHaveBeenCalled();
    player.setMood('menu');
    // Le même morceau reprend (pause puis play), sans en créer un nouveau.
    expect(menu?.play).toHaveBeenCalledTimes(2);
    expect(howls).toHaveLength(2);
  });

  it('laisse jouer un morceau quitté puis retrouvé avant la fin du fondu', () => {
    const player = new MusicPlayer(0.5, PLAYLISTS, create);
    player.setMood('menu');
    player.setMood('office');
    player.setMood('menu');
    const menu = howlOf('tycoon');
    expect(menu?.fade).toHaveBeenLastCalledWith(0, 0.5, MUSIC_FADE_MS);
    menu?.emit('fade');
    expect(menu?.pause).not.toHaveBeenCalled();
    expect(menu?.play).toHaveBeenCalledTimes(1);
  });

  it('passe au morceau suivant de la playlist, puis boucle', () => {
    const player = new MusicPlayer(0.5, PLAYLISTS, create);
    player.setMood('office');
    howlOf('detente')?.end();
    expect(howlOf('detente1')?.play).toHaveBeenCalledTimes(1);
    howlOf('detente1')?.end();
    expect(howlOf('detente')?.play).toHaveBeenCalledTimes(2);
  });

  it("ignore la fin d'un morceau qui n'est plus celui du moment", () => {
    const player = new MusicPlayer(0.5, PLAYLISTS, create);
    player.setMood('office');
    player.setMood('menu');
    howlOf('detente')?.end();
    expect(howlOf('detente1')).toBeUndefined();
  });

  it('se tait à volume nul et reprend quand on remonte le volume', () => {
    const player = new MusicPlayer(0, PLAYLISTS, create);
    player.setMood('menu');
    const menu = howlOf('tycoon');
    expect(menu?.play).not.toHaveBeenCalled();
    player.setVolume(0.4);
    expect(menu?.play).toHaveBeenCalledTimes(1);
    player.setVolume(0.8);
    expect(menu?.level).toBe(0.8);
    player.setVolume(0);
    expect(menu?.pause).toHaveBeenCalled();
  });

  it('relance la musique bloquée par le navigateur dès le premier clic', () => {
    const player = new MusicPlayer(0.5, PLAYLISTS, create);
    player.setMood('menu');
    const menu = howlOf('tycoon');
    menu?.stop();
    menu?.emit('playerror');
    menu?.emit('unlock');
    expect(menu?.play).toHaveBeenCalledTimes(2);
  });

  it('arrête tout', () => {
    const player = new MusicPlayer(0.5, PLAYLISTS, create);
    player.setMood('menu');
    player.setMood('office');
    player.stop();
    for (const howl of howls) expect(howl.stop).toHaveBeenCalled();
  });
});
