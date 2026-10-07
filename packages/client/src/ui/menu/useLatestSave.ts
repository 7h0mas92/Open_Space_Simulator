import type { SaveSummary } from '@oss/shared';
import { useEffect, useState } from 'react';
import { saves } from '../../save/saves';

/**
 * La sauvegarde la plus récente (automatique ou manuelle), pour le bouton « Continuer »
 * du menu. `null` tant qu'elle n'est pas lue ou s'il n'y en a aucune.
 */
export function useLatestSave(online: boolean, enabled: boolean): SaveSummary | null {
  const [latest, setLatest] = useState<SaveSummary | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void saves
      .list(online)
      .catch(() => [])
      .then((summaries) => {
        if (cancelled) return;
        const newest = summaries.reduce<SaveSummary | null>(
          (best, summary) => (!best || summary.updatedAt > best.updatedAt ? summary : best),
          null,
        );
        setLatest(newest);
      });
    return () => {
      cancelled = true;
    };
  }, [online, enabled]);
  return latest;
}
