import { describe, expect, it } from 'vitest';
import {
  closeness,
  DESK_SOUND,
  deskMix,
  synthKeystroke,
  sliceKeystrokes,
  synthMouseClick,
  TypingRhythm,
  type DeskActivity,
} from '../../../src/audio/deskSounds';

/** Vue d'ensemble (bureau entier) et vue zoomée sur une zone. */
const WIDE = { halfWidth: 12, halfHeight: 7 };
const ZOOMED = { halfWidth: 4.5, halfHeight: 2.5 };

const activity = (
  view: { halfWidth: number; halfHeight: number },
  typists: DeskActivity['typists'],
  running = true,
): DeskActivity => ({ running, ...view, typists });

describe('bruits de bureau : mixage', () => {
  it('on entend les claviers seulement quand on a assez zoomé', () => {
    expect(closeness(WIDE.halfWidth, WIDE.halfHeight)).toBe(0);
    expect(closeness(ZOOMED.halfWidth, ZOOMED.halfHeight)).toBe(1);
    const middle = closeness(3.5, 3.5);
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(1);
  });

  it('de loin : clics de souris très faibles, aucun clavier', () => {
    const voices = deskMix(activity(WIDE, [{ id: 'a', x: 0, y: 0 }]), 1);
    expect(voices).toEqual([{ id: 'a', mouse: DESK_SOUND.faintMouse, keys: 0, pan: 0 }]);
  });

  it('zoomé : clavier et souris plus forts au centre, plus doux en s’éloignant', () => {
    const [center, side] = deskMix(
      activity(ZOOMED, [
        { id: 'side', x: 2, y: 0 },
        { id: 'center', x: 0, y: 0 },
      ]),
      1,
    );
    expect(center?.id).toBe('center');
    expect(center?.keys).toBeCloseTo(DESK_SOUND.nearKeys);
    expect(center?.mouse).toBeCloseTo(DESK_SOUND.nearMouse);
    expect(side?.keys).toBeGreaterThan(0);
    expect(side?.keys).toBeLessThan(center?.keys ?? 0);
    expect(side?.pan).toBeGreaterThan(0); // à droite de l'écran
  });

  it('rien quand le jeu est en pause, le volume à 0 ou le dev hors de l’écran', () => {
    const typist = [{ id: 'a', x: 0, y: 0 }];
    expect(deskMix(activity(ZOOMED, typist, false), 1)).toEqual([]);
    expect(deskMix(activity(ZOOMED, typist), 0)).toEqual([]);
    expect(deskMix(activity(ZOOMED, [{ id: 'a', x: 6, y: 0 }]), 1)).toEqual([]);
  });

  it('le volume « Ambiance » règle tout, et le nombre de devs entendus est plafonné', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `d${i}`, x: i * 0.2, y: 0 }));
    const voices = deskMix(activity(ZOOMED, many), 0.5);
    expect(voices).toHaveLength(DESK_SOUND.maxFaint);
    expect(voices.filter((voice) => voice.keys > 0).length).toBeLessThanOrEqual(DESK_SOUND.maxNear);
    expect(voices[0]?.keys).toBeCloseTo(DESK_SOUND.nearKeys * 0.5);
  });
});

describe('bruits de bureau : rythme de frappe', () => {
  const random = () => {
    let state = 42;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  };

  it('tape par rafales et clique de temps en temps', () => {
    const rhythm = new TypingRhythm(random(), 0);
    const hits = rhythm.take(0, 60);
    const keys = hits.filter((hit) => hit.kind !== 'mouse');
    const clicks = hits.filter((hit) => hit.kind === 'mouse');
    // Environ 2 à 6 frappes par seconde en moyenne, avec des pauses.
    expect(keys.length).toBeGreaterThan(60);
    expect(keys.length).toBeLessThan(400);
    expect(clicks.length).toBeGreaterThan(4);
    expect(clicks.length).toBeLessThan(40);
    expect(hits.every((hit) => hit.at >= 0 && hit.at < 60.3)).toBe(true);
  });

  it('chaque son n’est programmé qu’une fois, et un long arrêt ne rattrape rien', () => {
    const rhythm = new TypingRhythm(random(), 0);
    const first = rhythm.take(0, 1);
    const second = rhythm.take(1, 2);
    expect(second.every((hit) => hit.at >= 1)).toBe(true);
    expect(first.every((hit) => hit.at < 1.2)).toBe(true);
    // Onglet en arrière-plan pendant une minute : pas de rafale de rattrapage.
    const after = rhythm.take(62, 62.12);
    expect(after.every((hit) => hit.at >= 62)).toBe(true);
    expect(after.length).toBeLessThanOrEqual(3);
  });
});

describe('bruits de bureau : synthèse', () => {
  it('des sons courts, normalisés et toujours identiques', () => {
    const key = synthKeystroke(48_000, 1);
    const space = synthKeystroke(48_000, 1, true);
    const mouse = synthMouseClick(48_000, 1);
    expect(key.length).toBe(Math.round(48_000 * 0.24));
    expect(mouse.length).toBe(Math.round(48_000 * 0.12));
    for (const samples of [key, space, mouse]) {
      const peak = Math.max(...Array.from(samples, Math.abs));
      expect(peak).toBeCloseTo(1);
      expect(samples.every(Number.isFinite)).toBe(true);
    }
    expect(synthKeystroke(48_000, 1)).toEqual(key);
    expect(synthKeystroke(48_000, 2)).not.toEqual(key);
    // Le son s'éteint : la fin est bien plus faible que le début.
    const tail = Math.max(...Array.from(key.slice(-200), Math.abs));
    expect(tail).toBeLessThan(0.05);
  });
});

describe('bruits de bureau : enregistrement découpé', () => {
  it('une frappe par attaque, avec un fondu en sortie', () => {
    const rate = 8000;
    const recording = new Float32Array(rate); // 1 s
    for (const at of [0.1, 0.3, 0.65]) {
      const start = Math.round(at * rate);
      for (let i = 0; i < 200; i++) recording[start + i] = Math.sin(i) * Math.exp(-i / 40);
    }
    const slices = sliceKeystrokes(recording, rate);
    expect(slices).toHaveLength(3);
    for (const slice of slices) {
      expect(slice.length).toBeLessThanOrEqual(Math.round(rate * 0.14));
      expect(Math.max(...Array.from(slice, Math.abs))).toBeCloseTo(1);
      expect(slice[slice.length - 1]).toBe(0);
    }
  });

  it('rien à découper dans le silence', () => {
    expect(sliceKeystrokes(new Float32Array(4000), 8000)).toEqual([]);
  });
});
