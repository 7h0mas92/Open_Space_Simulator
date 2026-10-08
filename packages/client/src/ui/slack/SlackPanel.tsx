import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SLACK_CHANNELS } from '../../slack/templates';
import { useSlack } from '../../slack/store';
import { formatClock, localized } from '../game/format';
import { useSettings } from '../store/settings';

/** Le Slack simulé : trois canaux, messages des templates ou de l'IA. */
export function SlackPanel() {
  const { t, i18n } = useTranslation();
  const { channel, messages, unread, ai, setChannel, setOpen } = useSlack();
  const aiWanted = useSettings((s) => s.slackAi);
  const list = useRef<HTMLOListElement>(null);
  const shown = messages[channel];

  useEffect(() => {
    setOpen(true);
    return () => setOpen(false);
  }, [setOpen]);

  // Toujours afficher le dernier message, comme dans Slack.
  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView?.({ block: 'end' });
  }, [shown.length, channel]);

  return (
    <div className="slack" data-testid="slack">
      <div className="tabs" role="tablist" aria-label={t('slack.channels')}>
        {SLACK_CHANNELS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={channel === id}
            onClick={() => setChannel(id)}
          >
            #{id}
            {unread[id] > 0 && (
              <span className="unread" aria-label={t('slack.unread', { count: unread[id] })}>
                {unread[id]}
              </span>
            )}
          </button>
        ))}
      </div>
      {aiWanted && (ai === 'unavailable' || ai === 'quota') && (
        <p className="hint">{t(`slack.ai.${ai}`)}</p>
      )}
      {shown.length === 0 ? (
        <p className="hint">{t('slack.empty')}</p>
      ) : (
        <ol ref={list} className="slack-messages" aria-live="polite">
          {shown.map((message) => (
            <li key={message.id} className={message.bot ? 'bot' : undefined}>
              <span className="slack-avatar" aria-hidden="true">
                {message.bot ? '🤖' : message.author.slice(0, 1)}
              </span>
              <div>
                <p className="slack-meta">
                  <strong>{message.author}</strong>
                  <time>{formatClock(message.minute)}</time>
                  {message.ai && <span className="badge">{t('slack.aiBadge')}</span>}
                </p>
                <p>{localized(message.text, i18n.language)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
