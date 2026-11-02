import { UNLOCK_MODES, type GameMode } from '@oss/shared';
import type { TFunction } from 'i18next';

/**
 * Pourquoi une récompense du mode Histoire n'est pas en vente : pas encore gagnée, ou mode où
 * les récompenses ne servent pas (Daily, missions de la campagne).
 */
export function storyLockedReason(t: TFunction, mode: GameMode): string {
  return UNLOCK_MODES.includes(mode) ? t('build.storyLocked') : t('build.storyLockedMode');
}
