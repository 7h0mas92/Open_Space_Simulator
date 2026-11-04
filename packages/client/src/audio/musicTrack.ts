/**
 * Un morceau de musique lu en flux par une balise `<audio>`, dont le volume passe par Web Audio.
 *
 * Pourquoi pas Howler en mode HTML5 : sur iPhone et iPad, Safari ignore le volume d'une balise
 * `<audio>` (il reste toujours à 100 %), donc le curseur « Musique » des options ne changeait
 * rien. Ici, la balise est branchée sur un nœud de gain Web Audio (`MediaElementAudioSourceNode`)
 * qui, lui, règle le volume partout. Le morceau reste lu au fil du téléchargement : un morceau de
 * 4 minutes décodé en mémoire pèserait près de 90 Mo.
 *
 * Sans Web Audio (vieux navigateur), le volume de la balise sert de repli.
 */

import { clamp01 } from '../engine/interpolation';

export type MusicEvent = 'play' | 'end' | 'fade' | 'playerror' | 'unlock';

/** Ce que le lecteur de musique utilise d'un morceau (le même sous-ensemble que Howler). */
export interface MusicHowl {
  play(): void;
  pause(): void;
  stop(): void;
  volume(): number;
  volume(level: number): void;
  /** Fondu linéaire ; prévient par `fade` à la fin. Un `volume(niveau)` l'interrompt. */
  fade(from: number, to: number, ms: number): void;
  playing(): boolean;
  on(event: MusicEvent, listener: () => void): void;
  once(event: MusicEvent, listener: () => void): void;
}

/** Contexte audio partagé par la musique, créé au premier morceau. */
let sharedContext: AudioContext | null | undefined;
/** Morceaux à prévenir quand le navigateur autorise enfin le son (premier clic ou touche). */
const waitingForUnlock = new Set<() => void>();

function musicContext(): AudioContext | null {
  if (sharedContext !== undefined) return sharedContext;
  sharedContext = null;
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;
  try {
    sharedContext = new AudioContext();
  } catch {
    return null; // Web Audio refusé : on garde le volume de la balise
  }
  // Safari sur iPhone : la musique suit le volume du média, même téléphone en silencieux.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'playback';
  return sharedContext;
}

/** Au premier geste du joueur : on réveille le contexte audio et on relance ce qui attendait. */
function unlock(): void {
  const context = sharedContext;
  if (context && context.state !== 'running') void context.resume().catch(() => undefined);
  // Pendant le geste lui-même : Safari n'accepte de lancer une balise audio qu'à ce moment-là.
  const listeners = [...waitingForUnlock];
  waitingForUnlock.clear();
  for (const listener of listeners) listener();
}
if (typeof window !== 'undefined') {
  for (const event of ['pointerdown', 'keydown', 'touchend'] as const)
    window.addEventListener(event, unlock, { passive: true, capture: true });
}

/** Pas du fondu, en millisecondes. */
const FADE_STEP_MS = 30;

export class MusicTrack implements MusicHowl {
  private readonly element: HTMLAudioElement;
  private readonly gain: GainNode | null = null;
  private level = 1;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private wanted = false;
  private readonly listeners = new Map<MusicEvent, Set<() => void>>();

  constructor(src: string) {
    const element = new Audio();
    element.preload = 'none';
    element.src = src;
    this.element = element;
    const context = musicContext();
    if (context) {
      try {
        const gain = context.createGain();
        context.createMediaElementSource(element).connect(gain).connect(context.destination);
        this.gain = gain;
      } catch {
        this.gain = null;
      }
    }
    element.addEventListener('playing', () => this.emit('play'));
    element.addEventListener('ended', () => {
      this.wanted = false;
      this.emit('end');
    });
    this.apply();
  }

  play(): void {
    this.wanted = true;
    // Contexte encore endormi (pas de clic) : on le réveille ; la balise démarre tout de suite,
    // dans le geste du joueur quand il y en a un (Safari l'exige), et s'entend dès le réveil.
    const context = this.gain?.context as AudioContext | undefined;
    if (context && context.state !== 'running') void context.resume().catch(() => undefined);
    this.startElement();
  }

  pause(): void {
    this.wanted = false;
    this.stopFade();
    this.element.pause();
  }

  stop(): void {
    this.pause();
    try {
      this.element.currentTime = 0;
    } catch {
      // Morceau pas encore chargé : rien à rembobiner.
    }
  }

  volume(): number;
  volume(level: number): void;
  volume(level?: number): number | void {
    if (level === undefined) return this.level;
    this.stopFade();
    this.setLevel(level);
  }

  fade(from: number, to: number, ms: number): void {
    this.stopFade();
    this.setLevel(from);
    const start = Date.now();
    const target = clamp01(to);
    const origin = this.level;
    this.fadeTimer = setInterval(() => {
      const t = ms > 0 ? Math.min(1, (Date.now() - start) / ms) : 1;
      this.setLevel(origin + (target - origin) * t);
      if (t >= 1) {
        this.stopFade();
        this.emit('fade');
      }
    }, FADE_STEP_MS);
  }

  playing(): boolean {
    return this.wanted && !this.element.paused;
  }

  on(event: MusicEvent, listener: () => void): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
  }

  once(event: MusicEvent, listener: () => void): void {
    const wrapped = () => {
      this.listeners.get(event)?.delete(wrapped);
      listener();
    };
    this.on(event, wrapped);
  }

  private startElement(): void {
    if (!this.wanted) return;
    this.element.play().catch(() => this.blocked());
  }

  /** Lecture refusée avant le premier geste : on prévient, puis on attend le déblocage. */
  private blocked(): void {
    if (!this.wanted) return;
    this.wanted = false;
    this.emit('playerror');
    waitingForUnlock.add(() => this.emit('unlock'));
  }

  private setLevel(level: number): void {
    this.level = clamp01(level);
    this.apply();
  }

  private apply(): void {
    if (this.gain) this.gain.gain.value = this.level;
    else this.element.volume = this.level;
  }

  private stopFade(): void {
    if (this.fadeTimer !== null) clearInterval(this.fadeTimer);
    this.fadeTimer = null;
  }

  private emit(event: MusicEvent): void {
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener();
  }
}
