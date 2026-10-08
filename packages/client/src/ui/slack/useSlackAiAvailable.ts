import { useEffect, useState } from 'react';
import { metaApi } from '../../api/meta';
import { useSession } from '../store/session';

/**
 * Le Slack IA est-il proposé au joueur ? Il faut être connecté et que le serveur ait une clé
 * d'API (GET /slack-ai/status). Sinon l'option est cachée : elle ne pourrait rien faire.
 */
export function useSlackAiAvailable(): boolean {
  const online = useSession((s) => s.status === 'authenticated');
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!online) return undefined;
    let cancelled = false;
    metaApi.slackAi
      .status()
      .then((status) => !cancelled && setEnabled(status.enabled))
      .catch(() => !cancelled && setEnabled(false));
    return () => {
      cancelled = true;
    };
  }, [online]);
  return online && enabled;
}
