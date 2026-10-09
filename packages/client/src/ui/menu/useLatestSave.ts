import type { SaveSummary } from '@oss/shared';
import { useEffect, useState } from 'react';
import { saves } from '../../save/saves';

/**
 * La sauvegarde la plus récente (automatique ou manuelle) d'une partie pas encore terminée,
 * pour le bouton « Continuer » du menu. `null` tant qu'elle n'est pas lue ou s'il n'y en a
 * aucune.
 */
export function useLatestSave(online: boolean, enabled: boolean): SaveSummary | null {
  const [latest, setLatest] = useState<SaveSummary | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void saves
      .latestResumable(online)
      .catch(() => null)
      .then((newest) => {
        if (!cancelled) setLatest(newest);
      });
    return () => {
      cancelled = true;
    };
  }, [online, enabled]);
  return latest;
}
