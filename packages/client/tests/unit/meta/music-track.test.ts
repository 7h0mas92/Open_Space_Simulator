import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Le volume de la musique passe par un nœud de gain Web Audio, pas par la balise `<audio>` :
 * Safari sur iPhone et iPad ignore le volume d'une balise, le curseur « Musique » n'y faisait rien.
 */
class FakeGain {
  readonly gain = { value: 1 };
  constructor(readonly context: FakeContext) {}
  connect<T>(node: T): T {
    return node;
  }
}
class FakeContext {
  static last: FakeContext | null = null;
  state: AudioContextState = 'running';
  readonly destination = {};
  readonly gains: FakeGain[] = [];
  readonly resume = vi.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });
  constructor() {
    FakeContext.last = this;
  }
  createGain(): FakeGain {
    const gain = new FakeGain(this);
    this.gains.push(gain);
    return gain;
  }
  createMediaElementSource() {
    return { connect: <T>(node: T) => node };
  }
}

async function load() {
  vi.resetModules();
  return import('../../../src/audio/musicTrack');
}

let playSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('AudioContext', FakeContext);
  playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('morceau de musique', () => {
  it('règle le volume sur le gain Web Audio, la balise reste à 100 %', async () => {
    const { MusicTrack } = await load();
    const track = new MusicTrack('/assets/music/tycoon.mp3');
    const gain = FakeContext.last?.gains[0];
    track.volume(0.3);
    expect(gain?.gain.value).toBeCloseTo(0.3);
    expect(track.volume()).toBeCloseTo(0.3);
    track.volume(0);
    expect(gain?.gain.value).toBe(0);
  });

  it('fait un fondu jusqu’au volume visé, puis prévient', async () => {
    const { MusicTrack } = await load();
    const track = new MusicTrack('/a.mp3');
    const done = vi.fn();
    track.once('fade', done);
    track.fade(0, 0.8, 300);
    vi.advanceTimersByTime(150);
    expect(track.volume()).toBeGreaterThan(0.2);
    expect(track.volume()).toBeLessThan(0.6);
    vi.advanceTimersByTime(200);
    expect(track.volume()).toBeCloseTo(0.8);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('un réglage du joueur interrompt le fondu en cours', async () => {
    const { MusicTrack } = await load();
    const track = new MusicTrack('/a.mp3');
    track.fade(0, 1, 1000);
    vi.advanceTimersByTime(300);
    track.volume(0.2);
    vi.advanceTimersByTime(1000);
    expect(track.volume()).toBeCloseTo(0.2);
  });

  it('réveille le contexte audio endormi en lançant la lecture', async () => {
    const { MusicTrack } = await load();
    const track = new MusicTrack('/a.mp3');
    const context = FakeContext.last;
    if (!context) throw new Error('contexte absent');
    context.state = 'suspended';
    track.play();
    expect(context.resume).toHaveBeenCalled();
    expect(playSpy).toHaveBeenCalled();
  });

  it('lecture refusée avant le premier clic : prévient, puis relance au premier geste', async () => {
    playSpy.mockRejectedValue(new Error('NotAllowedError'));
    const { MusicTrack } = await load();
    const track = new MusicTrack('/a.mp3');
    const unlocked = vi.fn();
    track.on('playerror', () => track.once('unlock', unlocked));
    track.play();
    await vi.runAllTimersAsync();
    expect(track.playing()).toBe(false);
    window.dispatchEvent(new Event('pointerdown'));
    expect(unlocked).toHaveBeenCalledTimes(1);
  });

  it('sans Web Audio, règle le volume de la balise', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { MusicTrack } = await load();
    const track = new MusicTrack('/a.mp3');
    track.volume(0.4);
    expect(track.volume()).toBeCloseTo(0.4);
  });
});
