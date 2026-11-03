import {
  COMPUTERS,
  getFloorMaterial,
  getFurniture,
  getMeetingFormat,
  getMonitor,
  getWallFinish,
  type LocalizedText,
  type ResearchKey,
} from '@oss/shared';
import type { GameView, ResearchNodeView } from './types';

/*
 * Arbre R&D des objets, côté interface : quel niveau débloque un contenu, et son nom. Lecture
 * seule de la GameView (la simulation reste seule juge, voir `simulation/research.ts`).
 */

/** Niveau de l'arbre à prendre pour ce contenu (null : déjà débloqué, ou pas d'arbre). */
export function researchNeed(
  view: Pick<GameView, 'research'>,
  key: ResearchKey,
): ResearchNodeView | null {
  return (
    view.research?.nodes.find((node) => node.status !== 'owned' && node.keys.includes(key)) ?? null
  );
}

const ARM: LocalizedText = { fr: 'Bras articulé pour écran', en: 'Monitor arm' };

/** Nom d'un contenu débloqué par l'arbre (objet, ordinateur, écran, mur, sol, salle). */
export function researchKeyName(key: ResearchKey): LocalizedText {
  const [kind, id = ''] = key.split(':') as [string, string | undefined];
  const fallback = { fr: id, en: id };
  switch (kind) {
    case 'item':
      return getFurniture(id)?.name ?? fallback;
    case 'computer':
      return COMPUTERS.find((computer) => computer.id === id)?.name ?? fallback;
    case 'monitor':
      return id === 'arm' ? ARM : (getMonitor(id)?.name ?? fallback);
    case 'wall':
      return getWallFinish(id)?.name ?? fallback;
    case 'floor':
      return getFloorMaterial(id)?.name ?? fallback;
    case 'meeting':
      return getMeetingFormat(id)?.name ?? fallback;
    default:
      return fallback;
  }
}
