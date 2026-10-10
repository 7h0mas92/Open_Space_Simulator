/**
 * Vignettes 3D des objets du catalogue. Le moteur de rendu les dessine hors écran (même modèle
 * Kenney que dans la scène) ; l'interface les garde en cache. Sans WebGL (tests, vieux
 * navigateurs), le catalogue affiche une icône à la place.
 */
import { useEffect } from 'react';
import { create } from 'zustand';

export type ThumbnailSource = (kind: string) => Promise<string | null>;

interface ThumbnailStore {
  source: ThumbnailSource | null;
  /** `null` : le rendu a échoué, on garde l'icône. */
  images: Record<string, string | null>;
}

const useThumbnails = create<ThumbnailStore>(() => ({ source: null, images: {} }));
const pending = new Set<string>();
/** Vignettes demandées, rendues une par une. */
const queue: string[] = [];
let drawing = false;

/** Branché par la scène quand le moteur de rendu est prêt (`null` quand il disparaît). */
export function setThumbnailSource(source: ThumbnailSource | null): void {
  pending.clear();
  queue.length = 0;
  useThumbnails.setState({ source });
}

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Rend les vignettes en attente une à une, en rendant la main au navigateur entre deux : un
 * rayon entier qui change d'aspect (taille ou fixation d'écran) ne fige pas l'interface, les
 * clics passent entre deux rendus.
 */
async function drain(): Promise<void> {
  if (drawing) return;
  drawing = true;
  try {
    for (let kind = queue.shift(); kind !== undefined; kind = queue.shift()) {
      const source = useThumbnails.getState().source;
      if (!source) break;
      let url: string | null = null;
      try {
        url = await source(kind);
      } catch {
        url = null;
      }
      pending.delete(kind);
      useThumbnails.setState((s) => ({ images: { ...s.images, [kind]: url } }));
      await nextTask();
    }
  } finally {
    drawing = false;
  }
}

/** Vignette d'un objet, ou `null` tant qu'elle n'est pas prête. */
export function useThumbnail(kind: string): string | null {
  const source = useThumbnails((s) => s.source);
  const image = useThumbnails((s) => s.images[kind]);
  useEffect(() => {
    if (!source || image !== undefined || pending.has(kind)) return;
    pending.add(kind);
    queue.push(kind);
    void drain();
  }, [source, kind, image]);
  return image ?? null;
}
