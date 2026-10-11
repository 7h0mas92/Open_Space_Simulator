/**
 * Bruits des postes de travail : clics de souris et frappes au clavier des devs à leur bureau.
 *
 * Les frappes viennent d'un vrai enregistrement de clavier fourni par l'équipe
 * (`public/assets/sounds/clavier-1-mrboubou13al.mp3`), découpé en touches séparées au chargement
 * (`sliceKeystrokes`). Les clics de souris sont synthétisés en Web Audio, comme les frappes tant
 * que l'enregistrement n'est pas chargé (ou s'il manque). Deux couches, réglées par le volume
 * « Ambiance » des options :
 * - des clics de souris très faibles pour les devs à leur ordinateur, à tous les zooms ;
 * - quand on zoome assez sur une zone, le clavier et la souris des devs proches du centre de la
 *   vue, plus forts au centre, placés à gauche ou à droite selon leur place à l'écran.
 *
 * Le rendu fournit l'activité (`DeskActivity`) ; ce module ne lit jamais l'état du jeu. Le hasard
 * vient de `Math.random` : c'est du son, pas la partie, le RNG du jeu n'est jamais touché.
 */

/** Enregistrement de frappe au clavier (relatif à la racine du site). */
export const KEYBOARD_RECORDING = `${import.meta.env.BASE_URL}assets/sounds/clavier-1-mrboubou13al.mp3`;

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
  /** Frappe au clavier tout près (l'enregistrement est fort : on le joue bas). */
  nearKeys: 0.14,
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
 * Rythme d'un dev : rafales de 3 à 14 touches (55 à 295 ms entre deux, souvent vite), petites pauses, parfois
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
          ? 0.055 + random() * random() * 0.24 // les doigts vont plus vite sur les mots connus
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

/** Filtre passe-bande (biquad RBJ, gain 0 dB au centre) appliqué à un signal. */
function bandpass(
  input: Float32Array,
  sampleRate: number,
  frequency: number,
  q: number,
): Float32Array {
  const w = (2 * Math.PI * frequency) / sampleRate;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const a1 = (-2 * Math.cos(w)) / a0;
  const a2 = (1 - alpha) / a0;
  const out = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i] ?? 0;
    const y = b0 * x - b0 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return out;
}

/**
 * Réverbération de bureau très courte : quelques échos du bureau, des murs et du plafond, de
 * plus en plus sourds, puis une petite traîne. Le son paraît joué dans une pièce, pas collé à l'oreille.
 */
function room(dry: Float32Array, sampleRate: number, random: () => number): Float32Array {
  const out = Float32Array.from(dry);
  const reflections = [
    { delay: 0.0042, gain: 0.32 },
    { delay: 0.0093, gain: 0.2 },
    { delay: 0.0151, gain: 0.13 },
    { delay: 0.0237, gain: 0.08 },
    { delay: 0.0341, gain: 0.05 },
  ];
  for (const { delay, gain } of reflections) {
    const offset = Math.round(delay * sampleRate);
    // Chaque rebond perd ses aigus (passe-bas à un pôle).
    const smooth = Math.exp((-2 * Math.PI * 3500) / sampleRate);
    let low = 0;
    for (let i = 0; i + offset < out.length; i++) {
      low = (1 - smooth) * (dry[i] ?? 0) + smooth * low;
      out[i + offset] = (out[i + offset] ?? 0) + gain * low;
    }
  }
  // Traîne diffuse : bruit sourd modulé par l'énergie du son, qui s'éteint en 40 ms environ.
  let energy = 0;
  let hiss = 0;
  const follow = Math.exp(-1 / (0.03 * sampleRate));
  const dull = Math.exp((-2 * Math.PI * 2500) / sampleRate);
  for (let i = 0; i < out.length; i++) {
    energy = Math.max(Math.abs(dry[i] ?? 0), energy * follow);
    hiss = (1 - dull) * (random() * 2 - 1) + dull * hiss;
    out[i] = (out[i] ?? 0) + energy * hiss * 0.08;
  }
  return out;
}

/** Passe-bas à un pôle : adoucit les aigus d'un son. */
function lowpass(input: Float32Array, sampleRate: number, frequency: number): Float32Array {
  const smooth = Math.exp((-2 * Math.PI * frequency) / sampleRate);
  const out = new Float32Array(input.length);
  let low = 0;
  for (let i = 0; i < input.length; i++) {
    low = (1 - smooth) * (input[i] ?? 0) + smooth * low;
    out[i] = low;
  }
  return out;
}

/** Passe-haut à un pôle : garde le claquement, enlève le souffle grave. */
function highpass(input: Float32Array, sampleRate: number, frequency: number): Float32Array {
  const low = lowpass(input, sampleRate, frequency);
  return input.map((sample, i) => sample - (low[i] ?? 0));
}

/** Additionne `source × gain` à `out` à partir de l'échantillon `start`. */
function mixInto(out: Float32Array, source: Float32Array, start: number, gain: number): void {
  for (let i = 0; i < source.length && start + i < out.length; i++)
    out[start + i] = (out[start + i] ?? 0) + (source[i] ?? 0) * gain;
}

/** Résonateur : bruit d'impact filtré en bande étroite, ramené à un pic de 1. */
function resonance(
  impact: Float32Array,
  sampleRate: number,
  frequency: number,
  q: number,
): Float32Array {
  return normalize(bandpass(impact, sampleRate, frequency, q));
}

/** Où sonne une touche : boîtier, plaque, capuchon, ressort, bureau (Hz). */
interface KeyVoice {
  readonly thud: number;
  readonly hollow: number;
  readonly plate: number;
  readonly cap: number;
  readonly spring: number;
}

/**
 * Un choc (la touche qui tape le fond ou qui remonte). Comme sur un vrai clavier, ce n'est pas une
 * note mais du bruit : deux ou trois micro-impacts à 1 ou 2 ms d'écart (la tige dans le boîtier,
 * le capuchon sur la plaque) font résonner le boîtier creux, la plaque, le capuchon, un peu le
 * bureau, et le ressort qui « chante » à peine.
 */
function impactSound(
  sampleRate: number,
  random: () => number,
  voice: KeyVoice,
  hollowness: number,
): Float32Array {
  const impact = new Float32Array(Math.round(sampleRate * 0.12));
  const hits = 2 + Math.floor(random() * 2);
  let at = 0;
  for (let h = 0; h < hits; h++) {
    const length = Math.round(sampleRate * (0.0003 + random() * 0.0005));
    const strength = h === 0 ? 1 : 0.35 + random() * 0.5;
    const start = Math.round(at * sampleRate);
    for (let i = 0; i < length && start + i < impact.length; i++)
      impact[start + i] =
        (impact[start + i] ?? 0) + strength * (random() * 2 - 1) * (1 - i / length);
    at += 0.0008 + random() * 0.0016;
  }
  const out = new Float32Array(impact.length);
  mixInto(out, normalize(highpass(impact, sampleRate, 2500)), 0, 0.1); // claquement, à peine
  mixInto(out, resonance(impact, sampleRate, voice.cap, 10), 0, 0.22);
  mixInto(out, resonance(impact, sampleRate, voice.plate, 16), 0, 0.4);
  mixInto(out, resonance(impact, sampleRate, voice.hollow, 12), 0, 1 * hollowness);
  mixInto(out, resonance(impact, sampleRate, voice.thud, 2.5), 0, 0.7 * hollowness);
  mixInto(out, resonance(impact, sampleRate, voice.spring, 90), 0, 0.03);
  return out;
}

/**
 * Frappe grave et sourde d'un clavier mécanique de bureau : la touche descend et tape le fond (choc,
 * boîtier creux, plaque et capuchon qui résonnent), puis remonte 45 à 120 ms plus tard (choc plus
 * léger). Chaque touche a sa place sur la plaque, donc ses résonances. La
 * barre d'espace sonne plus grave et plus creuse, avec le cliquetis de son stabilisateur. Le tout
 * capté dans un bureau.
 */
export function synthKeystroke(sampleRate: number, seed: number, space = false): Float32Array {
  const random = lcg(seed);
  const out = new Float32Array(Math.round(sampleRate * 0.24));
  const spread = () => 0.9 + random() * 0.2;
  const low = space ? 0.62 : 1;
  const voice: KeyVoice = {
    // Accordé grave : boîtier épais et capuchons épais, le « thock » sourd des claviers lubrifiés.
    thud: 120 * low * spread(),
    hollow: 380 * low * spread(),
    plate: 1350 * spread(),
    cap: 2500 * (space ? 0.8 : 1) * spread(),
    spring: 5200 * spread(),
  };
  mixInto(out, impactSound(sampleRate, random, voice, space ? 1.3 : 1), 0, 1);
  if (space) {
    for (const delay of [0.005 + random() * 0.003, 0.011 + random() * 0.004]) {
      const rattle = impactSound(sampleRate, random, { ...voice, cap: 5200, plate: 3100 }, 0.2);
      mixInto(out, rattle, Math.round(delay * sampleRate), 0.18);
    }
  }
  // Remontée : la tige revient en butée en haut, un choc plus clair, sans le creux du fond.
  const upVoice = { ...voice, plate: voice.plate * 1.12, cap: voice.cap * 1.08 };
  const release = Math.round((0.045 + random() * 0.075) * sampleRate);
  mixInto(out, impactSound(sampleRate, random, upVoice, 0.5), release, 0.45 + random() * 0.15);
  // Entendu à un mètre, à travers le bureau : écho de la pièce, aigus étouffés.
  const muffled = lowpass(
    lowpass(room(out, sampleRate, random), sampleRate, 3200),
    sampleRate,
    4500,
  );
  return normalize(muffled);
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

/**
 * Découpe un enregistrement de frappe en touches séparées : on repère chaque attaque (enveloppe
 * qui dépasse 15 % du maximum, au moins 60 ms après la précédente), puis on garde le son jusqu'à
 * l'attaque suivante (140 ms au plus, 50 ms au moins), avec un fondu en sortie. Chaque frappe est
 * ramenée à un pic de 1 ; le volume se règle au mixage.
 */
export function sliceKeystrokes(samples: Float32Array, sampleRate: number): Float32Array[] {
  const step = Math.max(1, Math.round(sampleRate * 0.002));
  const envelope: number[] = [];
  for (let i = 0; i < samples.length; i += step) {
    let peak = 0;
    for (let j = i; j < Math.min(samples.length, i + step); j++)
      peak = Math.max(peak, Math.abs(samples[j] ?? 0));
    envelope.push(peak);
  }
  const threshold = Math.max(...envelope, 0) * 0.15;
  if (threshold <= 0) return [];
  const onsets: number[] = [];
  const minGap = Math.round(sampleRate * 0.06);
  envelope.forEach((peak, index) => {
    const at = index * step;
    const previous = onsets[onsets.length - 1];
    if (peak > threshold && (previous === undefined || at - previous >= minGap)) onsets.push(at);
  });
  const preRoll = Math.round(sampleRate * 0.002);
  const fade = Math.round(sampleRate * 0.012);
  const slices: Float32Array[] = [];
  onsets.forEach((onset, index) => {
    const start = Math.max(0, onset - preRoll);
    const next = onsets[index + 1] ?? samples.length;
    const end = Math.min(next - preRoll, start + Math.round(sampleRate * 0.14), samples.length);
    if (end - start < sampleRate * 0.05) return;
    const slice = samples.slice(start, end);
    for (let i = 0; i < fade; i++) {
      const k = slice.length - 1 - i;
      slice[k] = (slice[k] ?? 0) * (i / fade);
    }
    slices.push(normalize(slice));
  });
  return slices;
}

/** Avance de programmation des sons sur l'horloge audio : pas de trou entre deux images. */
const LOOKAHEAD_SECONDS = 0.12;
/** En dessous, un son ne s'entend pas : on ne crée pas ses nœuds audio. */
const SILENT_GAIN = 0.0005;
const VARIANTS = { key: 10, space: 3, mouse: 4 } as const;

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
      void this.loadRecording(context);
      if (context.state === 'suspended') void context.resume().catch(() => undefined);
    } catch {
      this.context = null; // Web Audio refusé : on reste muet
    }
  }

  /** Remplace les frappes synthétisées par celles du vrai enregistrement, une fois chargé. */
  private async loadRecording(context: AudioContext): Promise<void> {
    try {
      const response = await fetch(KEYBOARD_RECORDING);
      if (!response.ok) return;
      const decoded = await context.decodeAudioData(await response.arrayBuffer());
      const slices = sliceKeystrokes(decoded.getChannelData(0), decoded.sampleRate);
      if (slices.length === 0 || this.context !== context || !this.buffers) return;
      const keys = slices.map((samples) => {
        const buffer = context.createBuffer(1, samples.length, decoded.sampleRate);
        buffer.getChannelData(0).set(samples);
        return buffer;
      });
      this.buffers = { ...this.buffers, key: keys, space: keys };
    } catch {
      // Fichier absent ou illisible (hors ligne sans cache) : on garde les frappes synthétisées.
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
