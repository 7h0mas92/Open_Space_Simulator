/**
 * État du tutoriel complet (mode Facile) : leçon ouverte, étape en cours, leçons déjà lues.
 * Les leçons lues sont gardées par partie (graine) dans le navigateur, pour qu'une partie
 * rechargée ne rejoue pas les chapitres déjà vus.
 */
import { create } from 'zustand';
import { LESSON_IDS, type GuideBaseline, type LessonId } from '../tutorial/lessons';

export interface ActiveLesson {
  readonly lesson: LessonId;
  readonly step: number;
  readonly baseline: GuideBaseline;
  /** Ouverte depuis le Guide du jeu (et non déclenchée par la partie). */
  readonly manual: boolean;
}

interface GuideStore {
  /** Graine de la partie suivie. */
  readonly seed: string | null;
  /** Les leçons s'ouvrent-elles toutes seules ? (vrai en mode Facile) */
  readonly autoplay: boolean;
  readonly seen: readonly LessonId[];
  readonly active: ActiveLesson | null;
  readonly minimized: boolean;
  /** Vrai si c'est le tutoriel qui a mis la partie en pause. */
  readonly pausedByGuide: boolean;
  /** Nouvelle partie (ou partie rechargée) : reprend les leçons déjà lues pour cette graine. */
  follow(seed: string, autoplay: boolean): void;
  open(lesson: LessonId, baseline: GuideBaseline, manual: boolean): void;
  goTo(step: number, baseline: GuideBaseline): void;
  /** Termine la leçon ouverte et la marque comme lue. */
  finish(): void;
  /** Coupe le tutoriel pour cette partie. */
  stop(): void;
  setMinimized(minimized: boolean): void;
  setPausedByGuide(paused: boolean): void;
}

const STORAGE_KEY = 'oss.guide';

interface Stored {
  seed: string;
  seen: LessonId[];
  autoplay: boolean;
}

function readStored(): Stored | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Stored> | null;
    if (!raw || typeof raw.seed !== 'string' || !Array.isArray(raw.seen)) return null;
    return {
      seed: raw.seed,
      seen: raw.seen.filter((id): id is LessonId => LESSON_IDS.includes(id)),
      autoplay: raw.autoplay !== false,
    };
  } catch {
    return null;
  }
}

function writeStored(stored: Stored): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Stockage indisponible (navigation privée) : le tutoriel marche quand même.
  }
}

export const useGuide = create<GuideStore>((set, get) => {
  const persist = () => {
    const { seed, seen, autoplay } = get();
    if (seed) writeStored({ seed, seen: [...seen], autoplay });
  };
  return {
    seed: null,
    autoplay: false,
    seen: [],
    active: null,
    minimized: false,
    pausedByGuide: false,
    follow(seed, autoplay) {
      const stored = readStored();
      const resumed = stored?.seed === seed ? stored : null;
      set({
        seed,
        autoplay: autoplay && (resumed?.autoplay ?? true),
        seen: resumed?.seen ?? [],
        active: null,
        minimized: false,
        pausedByGuide: false,
      });
      persist();
    },
    open(lesson, baseline, manual) {
      set({ active: { lesson, step: 0, baseline, manual }, minimized: false });
    },
    goTo(step, baseline) {
      const { active } = get();
      if (active) set({ active: { ...active, step, baseline } });
    },
    finish() {
      const { active, seen } = get();
      if (!active) return;
      set({
        active: null,
        seen: seen.includes(active.lesson) ? seen : [...seen, active.lesson],
      });
      persist();
    },
    stop() {
      set({ active: null, autoplay: false });
      persist();
    },
    setMinimized(minimized) {
      set({ minimized });
    },
    setPausedByGuide(pausedByGuide) {
      set({ pausedByGuide });
    },
  };
});
