import { UNLOCK_MODES } from '@oss/shared';
import type { TFunction } from 'i18next';
import type { GameView } from '../../view/types';
import { researchNeed } from '../../view/research';
import type { ResearchKey } from '@oss/shared';

/**
 * Pourquoi une récompense du mode Histoire n'est pas en vente : pas encore gagnée, mode où les
 * récompenses ne servent pas (Daily, missions de la campagne), ou, dans la longue partie, objectif
 * de l'histoire pas encore rempli (branche Prestige de l'arbre R&D).
 */
export function storyLockedReason(t: TFunction, view: Pick<GameView, 'mode' | 'research'>): string {
  if (view.research) return t('build.storyLockedPrestige');
  return UNLOCK_MODES.includes(view.mode) ? t('build.storyLocked') : t('build.storyLockedMode');
}

/**
 * Arbre R&D : le niveau à prendre pour ce contenu, en une phrase (« 🔬 R&D : Tech, niveau 3 »),
 * ou null s'il est déjà débloqué.
 */
export function researchLockedReason(
  t: TFunction,
  view: Pick<GameView, 'research'>,
  key: ResearchKey,
): string | null {
  const node = researchNeed(view, key);
  return node
    ? t('research.needed', { branch: t(`research.branches.${node.branch}`), level: node.level })
    : null;
}
