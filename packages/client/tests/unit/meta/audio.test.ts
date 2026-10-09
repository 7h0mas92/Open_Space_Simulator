import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioPlayer, type Volumes } from '../../../src/audio/player';
import type { GameNotification } from '../../../src/view/types';

/** Faux Howler : aucun son réel, on garde chaque instance pour l'inspecter. */
const howler = vi.hoisted(() => {
  interface Options {
    src: string[];
    loop: boolean;
    volume: number;
  }
  class FakeHowl {
    static instances: FakeHowl[] = [];
    isPlaying = false;
    readonly play = vi.fn(() => {
      this.isPlaying = true;
    });
    readonly stop = vi.fn(() => {
      this.isPlaying = false;
    });
    readonly volume = vi.fn();
    constructor(readonly options: Options) {
      FakeHowl.instances.push(this);
    }
    playing(): boolean {
      return this.isPlaying;
    }
  }
  return { FakeHowl };
});

vi.mock('howler', () => ({ Howl: howler.FakeHowl }));

const VOLUMES: Volumes = { music: 0.5, sfx: 1, ambience: 0.3 };
const FILES = {
  keyboard: ['ambience/keyboard.ogg'],
  click: ['ui/click.ogg'],
  alarm: ['sfx/alarm.ogg'],
  success: ['sfx/success.ogg'],
};

const instances = () => howler.FakeHowl.instances;

function notification(kind: GameNotification['kind']): GameNotification {
  return { tick: 1, kind, text: { fr: kind, en: kind }, entityId: null };
}

beforeEach(() => {
  howler.FakeHowl.instances = [];
});

describe('AudioPlayer', () => {
  it('compte les sons disponibles (silencieux sans packs Kenney)', () => {
    expect(new AudioPlayer(VOLUMES, {}).available).toBe(0);
    expect(new AudioPlayer(VOLUMES, FILES).available).toBe(4);
  });

  it('charge un effet à la première lecture, sans boucle', () => {
    const player = new AudioPlayer(VOLUMES, FILES);
    player.play('click');
    player.play('click');
    expect(instances()).toHaveLength(1);
    expect(instances()[0]?.options).toEqual({ src: ['ui/click.ogg'], loop: false, volume: 1 });
    expect(instances()[0]?.play).toHaveBeenCalledTimes(2);
  });

  it("joue l'ambiance en boucle, sans la relancer si elle tourne déjà", () => {
    const player = new AudioPlayer(VOLUMES, FILES);
    player.play('keyboard');
    player.play('keyboard');
    expect(instances()[0]?.options).toMatchObject({ loop: true, volume: 0.3 });
    expect(instances()[0]?.play).toHaveBeenCalledTimes(1);
  });

  it('ignore un son absent du manifeste', () => {
    new AudioPlayer(VOLUMES, FILES).play('cash');
    expect(instances()).toEqual([]);
  });

  it('ne joue rien quand le volume de la catégorie est à 0', () => {
    const player = new AudioPlayer({ ...VOLUMES, sfx: 0 }, FILES);
    player.play('click');
    expect(instances()[0]?.play).not.toHaveBeenCalled();
  });

  it('joue le son de la notification la plus récente qui en a un', () => {
    const player = new AudioPlayer(VOLUMES, FILES);
    player.onNotifications([
      notification('FEATURE_DONE'),
      notification('PROD_DOWN'),
      notification('TASK_DONE'),
    ]);
    expect(instances()).toHaveLength(1);
    expect(instances()[0]?.options.src).toEqual(['sfx/alarm.ogg']);
    expect(instances()[0]?.play).toHaveBeenCalledTimes(1);
  });

  it('reste silencieux pour des notifications sans son', () => {
    new AudioPlayer(VOLUMES, FILES).onNotifications([notification('TASK_DONE')]);
    new AudioPlayer(VOLUMES, FILES).onNotifications([]);
    expect(instances()).toEqual([]);
  });

  it('applique les nouveaux volumes et arrête tout', () => {
    const player = new AudioPlayer(VOLUMES, FILES);
    player.play('keyboard');
    player.play('click');
    player.setVolumes({ music: 0.2, sfx: 0.7, ambience: 0.1 });
    expect(instances()[0]?.volume).toHaveBeenCalledWith(0.1);
    expect(instances()[1]?.volume).toHaveBeenCalledWith(0.7);
    player.stopAll();
    for (const howl of instances()) expect(howl.stop).toHaveBeenCalled();
  });
});
