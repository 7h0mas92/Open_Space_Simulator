import { useTranslation } from 'react-i18next';
import { useSlack } from '../../slack/store';
import { SlackPanel } from './SlackPanel';
import { useEffect, useState } from 'react';

const DESKTOP = '(min-width: 1024px) and (min-height: 501px)';

/** Vrai sur un écran assez large pour garder Slack ouvert à côté de la scène. */
function useDesktop(): boolean {
  const query = () => typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP).matches;
  const [desktop, setDesktop] = useState(query);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(DESKTOP);
    const onChange = () => setDesktop(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return desktop;
}

/**
 * Sur ordinateur, Slack reste ancré dans un coin de l'écran (repliable). Sur mobile et
 * tablette, il n'est pas affiché : on l'ouvre en bottom sheet depuis la barre d'actions.
 */
export function SlackDock() {
  const { t } = useTranslation();
  const desktop = useDesktop();
  const [expanded, setExpanded] = useState(false);
  const unread = useSlack((s) => s.unread.general + s.unread.random + s.unread.incidents);
  if (!desktop) return null;
  return (
    <aside className={`slack-dock ${expanded ? 'expanded' : ''}`} aria-label="Slack">
      <button
        type="button"
        className="slack-dock-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        # Slack
        {!expanded && unread > 0 && (
          <span className="unread" aria-label={t('slack.unread', { count: unread })}>
            {unread}
          </span>
        )}
      </button>
      {expanded && <SlackPanel />}
    </aside>
  );
}
