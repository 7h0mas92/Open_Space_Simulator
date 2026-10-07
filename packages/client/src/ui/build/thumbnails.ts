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

/** Branché par la scène quand le moteur de rendu est prêt (`null` quand il disparaît). */
export function setThumbnailSource(source: ThumbnailSource | null): void {
  pending.clear();
  useThumbnails.setState({ source });
}

/** Vignette d'un objet, ou `null` tant qu'elle n'est pas prête. */
export function useThumbnail(kind: string): string | null {
  const source = useThumbnails((s) => s.source);
  const image = useThumbnails((s) => s.images[kind]);
  useEffect(() => {
    if (!source || image !== undefined || pending.has(kind)) return;
    pending.add(kind);
    const store = (url: string | null) => {
      pending.delete(kind);
      useThumbnails.setState((s) => ({ images: { ...s.images, [kind]: url } }));
    };
    source(kind).then(store, () => store(null));
  }, [source, kind, image]);
  return image ?? null;
}
