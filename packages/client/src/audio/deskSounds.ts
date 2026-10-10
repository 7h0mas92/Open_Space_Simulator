/**
 * Bruits des postes de travail : clics de souris et frappes au clavier des devs à leur bureau.
 *
 * Aucun fichier : les sons sont synthétisés en Web Audio (petit bruit filtré et résonance du
 * boîtier), comme le cahier des charges interdit d'inventer un nom de fichier. Deux couches,
 * réglées par le volume « Ambiance » des options :
 * - des clics de souris très faibles pour les devs à leur ordinateur, à tous les zooms ;
 * - quand on zoome assez sur une zone, le clavier et la souris des devs proches du centre de la
 *   vue, plus forts au centre, placés à gauche ou à droite selon leur place à l'écran.
 *
 * Le rendu fournit l'activité (`DeskActivity`) ; ce module ne lit jamais l'état du jeu. Le hasard
 * vient de `Math.random` : c'est du son, pas la partie, le RNG du jeu n'est jamais touché.
 */

/** Un dev qui travaille à son ordinateur, vu depuis le centre de l'écran (en unités monde). */
export interface DeskTypist {
  readonly id: string;
  /** Vers la droite de l'écran. */
  readonly x: number;
  /** Vers le haut de l'écran. */
  readonly y: number;
}

export interface DeskActivity {
  /** Le temps s'écoule (pas de pause). */
  readonly running: boolean;
  /** Demi-dimensions de la vue, en unités monde (elles diminuent quand on zoome). */
  readonly halfWidth: number;
  readonly halfHeight: number;
  readonly typists: readonly DeskTypist[];
}

/** Réglages des bruits de bureau (gains avant le volume « Ambiance »). */
export const DESK_SOUND = {
  /** Plus petit côté de la vue (unités monde) où l'on commence à entendre les claviers… */
  spanFar: 8.5,
  /** …et où on les entend pleinement. */
  spanNear: 5.5,
  /** Clic de souris lointain : à peine audible. */
  faintMouse: 0.06,
  /** Clic de souris tout près, au centre de la vue zoomée. */
  nearMouse: 0.22,
  /** Frappe au clavier tout près. */
  nearKeys: 0.26,
  /** Devs entendus de loin (les plus proches du centre de l'écran). */
  maxFaint: 8,
  /** Claviers entendus en même temps quand on zoome. */
  maxNear: 6,
  /** Rayon d'écoute, en fraction du plus petit côté de la vue. */
  hearRadius: 1.2,
  /** Écart gauche-droite le plus fort (1 = tout d'un côté). */
  maxPan: 0.7,
} as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** 0 à la vue d'ensemble, 1 quand on a assez zoomé pour entendre les claviers. */
export function closeness(halfWidth: number, halfHeight: number): number {
  const span = 2 * Math.min(halfWidth, halfHeight);
  const t = clamp01((DESK_SOUND.spanFar - span) / (DESK_SOUND.spanFar - DESK_SOUND.spanNear));
  return t * t * (3 - 2 * t);
}

/** Ce que l'on entend d'un dev : gains de la souris et du clavier, position gauche-droite. */
export interface DeskVoice {
  readonly id: string;
  readonly mouse: number;
  readonly keys: number;
  readonly pan: number;
}

/** Mixage des devs à l'écran pour un volume « Ambiance » (0 à 1). */
export function deskMix(activity: DeskActivity, volume: number): DeskVoice[] {
  if (!activity.running || volume <= 0) return [];
  const { halfWidth, halfHeight } = activity;
  const near = closeness(halfWidth, halfHeight);
  const radius = Math.min(halfWidth, halfHeight) * DESK_SOUND.hearRadius;
  const onScreen = activity.typists
    .filter((typist) => Math.abs(typist.x) <= halfWidth && Math.abs(typist.y) <= halfHeight)
    .map((typist) => ({ typist, distance: Math.hypot(typist.x, typist.y) }))
    .sort((a, b) => a.distance - b.distance || (a.typist.id < b.typist.id ? -1 : 1))
    .slice(0, DESK_SOUND.maxFaint);
  return onScreen.map(({ typist, distance }, rank) => {
    const weight =
      near > 0 && rank < DESK_SOUND.maxNear ? near * clamp01(1 - distance / radius) ** 2 : 0;
    const pan = Math.max(-1, Math.min(1, typist.x / halfWidth)) * DESK_SOUND.maxPan;
    return {
      id: typist.id,
      mouse:
        volume * (DESK_SOUND.faintMouse + (DESK_SOUND.nearMouse - DESK_SOUND.faintMouse) * weight),
      keys: volume * DESK_SOUND.nearKeys * weight,
      pan,
    };
  });
}

export type DeskHitKind = 'key' | 'space' | 'mouse';
export interface DeskHit {
  readonly kind: DeskHitKind;
  /** Instant, en secondes de l'horloge audio. */
  readonly at: number;
}

/** Retard au-delà duquel on repart de maintenant (onglet en arrière-plan, pause). */
const STALE_SECONDS = 0.25;

/**
 * Rythme d'un dev : rafales de 3 à 14 touches (70 à 180 ms entre deux), petites pauses, parfois
 * une relecture de quelques secondes ; un clic de souris toutes les 2 à 8 s, parfois double.
 */
export class TypingRhythm {
  private nextKey: number;
  private nextMouse: number;
  private burst = 0;

  constructor(
    private readonly random: () => number,
    now: number,
  ) {
    this.nextKey = now + random() * 1.5;
    this.nextMouse = now + 0.5 + random() * 4;
  }

  /** Frappes et clics prévus avant `until`. */
  take(now: number, until: number): DeskHit[] {
    const random = this.random;
    if (this.nextKey < now - STALE_SECONDS) this.nextKey = now + random() * 0.5;
    if (this.nextMouse < now - STALE_SECONDS) this.nextMouse = now + random() * 2;
    const hits: DeskHit[] = [];
    while (this.nextKey < until) {
      if (this.burst <= 0) this.burst = 3 + Math.floor(random() * 12);
      hits.push({ kind: random() < 0.12 ? 'space' : 'key', at: this.nextKey });
      this.burst--;
      this.nextKey +=
        this.burst > 0
          ? 0.07 + random() * 0.11
          : random() < 0.15
            ? 2.5 + random() * 4 // il relit son code
            : 0.35 + random() * 1.6;
    }
    while (this.nextMouse < until) {
      hits.push({ kind: 'mouse', at: this.nextMouse });
      if (random() < 0.2) hits.push({ kind: 'mouse', at: this.nextMouse + 0.11 + random() * 0.05 });
      this.nextMouse += 2 + random() * 6;
    }
    return hits;
  }
}

/** Générateur pseudo-aléatoire à graine fixe : les sons sont les mêmes à chaque chargement. */
function lcg(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function normalize(samples: Float32Array): Float32Array {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak > 0) for (let i = 0; i < samples.length; i++) samples[i] = (samples[i] ?? 0) / peak;
  return samples;
}

/**
 * Frappe de clavier mécanique : claquement aigu (bruit dérivé, donc sans graves), « toc » du
 * boîtier qui s'éteint vite, puis le petit retour de la touche relâchée. Barre d'espace plus grave.
 */
export function synthKeystroke(sampleRate: number, seed: number, space = false): Float32Array {
  const random = lcg(seed);
  const out = new Float32Array(Math.round(sampleRate * 0.07));
  const thock = (space ? 110 : 180) + random() * 80;
  const body = space ? 0.02 : 0.011;
  const release = 0.03 + random() * 0.015;
  const tone = 0.35 + random() * 0.25;
  let previous = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    const noise = random() * 2 - 1;
    const click = noise - previous;
    previous = noise;
    let sample =
      click * Math.exp(-t / 0.0035) * 0.6 +
      Math.sin(2 * Math.PI * thock * t) * Math.exp(-t / body) * tone;
    if (t >= release) {
      const r = t - release;
      sample +=
        click * Math.exp(-r / 0.002) * 0.22 +
        Math.sin(2 * Math.PI * thock * 1.4 * r) * Math.exp(-r / 0.006) * 0.12;
    }
    out[i] = sample;
  }
  return normalize(out);
}

/** Clic de souris : deux petits « tic » secs et aigus, l'appui puis le relâchement. */
export function synthMouseClick(sampleRate: number, seed: number): Float32Array {
  const random = lcg(seed);
  const out = new Float32Array(Math.round(sampleRate * 0.12));
  const pitch = 2600 + random() * 900;
  const release = 0.065 + random() * 0.025;
  let previous = 0;
  const tick = (t: number, click: number, frequency: number) =>
    click * Math.exp(-t / 0.0012) * 0.7 +
    Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t / 0.0025) * 0.4;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    const noise = random() * 2 - 1;
    const click = noise - previous;
    previous = noise;
    let sample = tick(t, click, pitch);
    if (t >= release) sample += 0.6 * tick(t - release, click, pitch * 1.15);
    out[i] = sample;
  }
  return normalize(out);
}

/** Avance de programmation des sons sur l'horloge audio : pas de trou entre deux images. */
const LOOKAHEAD_SECONDS = 0.12;
/** En dessous, un son ne s'entend pas : on ne crée pas ses nœuds audio. */
const SILENT_GAIN = 0.0005;
const VARIANTS = { key: 6, space: 2, mouse: 4 } as const;

type Buffers = Record<DeskHitKind, AudioBuffer[]>;

/**
 * Joue les bruits de bureau. Le contexte audio n'est créé qu'au premier geste du joueur (clic,
 * toucher ou touche), comme l'exigent les navigateurs ; sans Web Audio, tout reste muet.
 */
export class DeskSounds {
  private context: AudioContext | null = null;
  private buffers: Buffers | null = null;
  private readonly rhythms = new Map<string, TypingRhythm>();
  private volume: number;
  private readonly start = () => this.ensureContext();

  constructor(volume: number) {
    this.volume = volume;
    if (typeof window === 'undefined') return;
    window.addEventListener('pointerdown', this.start, { passive: true });
    window.addEventListener('keydown', this.start);
  }

  setVolume(volume: number): void {
    this.volume = volume;
  }

  /** Appelé à chaque image par le rendu. */
  update(activity: DeskActivity): void {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.buffers) return;
    const voices = deskMix(activity, this.volume);
    const heard = new Set(voices.map((voice) => voice.id));
    for (const id of this.rhythms.keys()) if (!heard.has(id)) this.rhythms.delete(id);
    const now = context.currentTime;
    for (const voice of voices) {
      let rhythm = this.rhythms.get(voice.id);
      if (!rhythm) {
        rhythm = new TypingRhythm(Math.random, now);
        this.rhythms.set(voice.id, rhythm);
      }
      for (const hit of rhythm.take(now, now + LOOKAHEAD_SECONDS)) {
        const gain = hit.kind === 'mouse' ? voice.mouse : voice.keys;
        if (gain > SILENT_GAIN) this.play(context, hit, gain, voice.pan);
      }
    }
  }

  dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this.start);
      window.removeEventListener('keydown', this.start);
    }
    this.rhythms.clear();
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }

  private ensureContext(): void {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
      return;
    }
    if (typeof AudioContext === 'undefined') return;
    try {
      const context = new AudioContext();
      this.context = context;
      this.buffers = makeBuffers(context);
      if (context.state === 'suspended') void context.resume().catch(() => undefined);
    } catch {
      this.context = null; // Web Audio refusé : on reste muet
    }
  }

  private play(context: AudioContext, hit: DeskHit, gain: number, pan: number): void {
    const variants = this.buffers?.[hit.kind];
    const buffer = variants?.[Math.floor(Math.random() * variants.length)];
    if (!buffer) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 0.94 + Math.random() * 0.12;
    const level = context.createGain();
    level.gain.value = gain * (0.75 + Math.random() * 0.25);
    source.connect(level);
    if (typeof context.createStereoPanner === 'function') {
      const panner = context.createStereoPanner();
      panner.pan.value = pan;
      level.connect(panner).connect(context.destination);
    } else {
      level.connect(context.destination);
    }
    source.start(Math.max(context.currentTime, hit.at));
  }
}

function makeBuffers(context: AudioContext): Buffers {
  const rate = context.sampleRate;
  const buffer = (samples: Float32Array) => {
    const result = context.createBuffer(1, samples.length, rate);
    result.getChannelData(0).set(samples);
    return result;
  };
  const range = (count: number) => Array.from({ length: count }, (_, i) => i + 1);
  return {
    key: range(VARIANTS.key).map((i) => buffer(synthKeystroke(rate, i * 7919))),
    space: range(VARIANTS.space).map((i) => buffer(synthKeystroke(rate, i * 104729, true))),
    mouse: range(VARIANTS.mouse).map((i) => buffer(synthMouseClick(rate, i * 15485863))),
  };
}
