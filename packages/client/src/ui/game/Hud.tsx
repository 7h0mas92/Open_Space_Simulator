import { SPEEDS, type Speed } from '@oss/shared';
import { useTranslation } from 'react-i18next';
import { GAUGES, isFridayFive, weekday, type GameView } from '../../view/types';
import { useSlack } from '../../slack/store';
import { PANELS, useGame, type PanelId } from '../store/game';
import { formatClock, formatGauge, gaugeRatio, isGaugeCritical } from './format';
import { Tooltip } from './Tooltip';

const PANEL_ICONS: Record<PanelId, string> = {
  kanban: '▦',
  team: '☺',
  hiring: '✚',
  build: '⚒',
  dashboard: '📈',
  slack: '#',
  saves: '💾',
  settings: '⚙',
  credits: '©',
};

/** Les six jauges, avec infobulle. Compactes en haut sur mobile, en colonne sur ordinateur. */
export function Gauges({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  return (
    <ul className="gauges" aria-label={t('game.gauges')} data-tutorial="gauges">
      {GAUGES.map((name) => {
        const value = view.gauges[name];
        const critical = isGaugeCritical(name, value);
        return (
          <li key={name} className={`gauge gauge-${name} ${critical ? 'critical' : ''}`}>
            <Tooltip text={t(`gauges.${name}.help`)}>
              <span className="gauge-label">{t(`gauges.${name}.name`)}</span>
              <span className="gauge-value" data-testid={`gauge-${name}`}>
                {formatGauge(name, value, i18n.language)}
              </span>
              <span className="gauge-bar" aria-hidden="true">
                <span style={{ width: `${gaugeRatio(name, value) * 100}%` }} />
              </span>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

/** Horloge, sprint et vitesses (pause, x1, x2, x4). */
export function TimeControls({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const days = t('time.days', { returnObjects: true }) as unknown as string[];
  const { time } = view;
  const setSpeed = (speed: Speed) => void dispatch({ type: 'setSpeed', speed });
  return (
    <div className="time-controls" data-tutorial="speed">
      <p className="clock" aria-live="off">
        <strong>{t('time.sprint', { sprint: time.sprint, total: time.totalSprints })}</strong>
        <span>
          {t('time.day', { day: days[weekday(time.day)] ?? '', time: formatClock(time.minute) })}
        </span>
        <span className="step">{t(`steps.${view.step}`)}</span>
      </p>
      {view.step === 'PLANNING' ? (
        <div className="planning-actions">
          <button
            type="button"
            className="primary"
            onClick={() => void dispatch({ type: 'startSprint' })}
            data-tutorial="start"
          >
            ▶ {t('time.startSprint')}
          </button>
          <button
            type="button"
            disabled={view.pitchBlocker !== null}
            title={view.pitchBlocker ? t(`results.${view.pitchBlocker}`) : undefined}
            onClick={() => void dispatch({ type: 'startPitch' })}
            data-tutorial="pitch"
          >
            💼 {t('pitch.open')}
          </button>
        </div>
      ) : (
        <div className="speeds" role="group" aria-label={t('time.speeds')}>
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              aria-pressed={time.speed === speed}
              aria-label={speed === 0 ? t('time.pause') : t('time.speed', { speed })}
              disabled={speed === 0 && view.mode === 'HARDCORE'}
              onClick={() => setSpeed(speed)}
            >
              {speed === 0 ? '❚❚' : `x${speed}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Barre d'actions : en bas sur mobile, dans la colonne latérale sur ordinateur. */
export function ActionBar() {
  const { t } = useTranslation();
  const panel = useGame((s) => s.panel);
  const replay = useGame((s) => s.replayOf !== null);
  const unread = useSlack((s) => s.unread.general + s.unread.random + s.unread.incidents);
  // En replay, seuls les panneaux de consultation restent utiles.
  const hidden = new Set<PanelId>(replay ? ['credits', 'hiring', 'build', 'saves'] : ['credits']);
  const openPanel = useGame((s) => s.openPanel);
  const setBuild = useGame((s) => s.setBuild);
  return (
    <nav className="action-bar" aria-label={t('panels.actions')}>
      {PANELS.filter((id) => !hidden.has(id)).map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={panel === id}
          data-tutorial={`panel-${id}`}
          onClick={() => {
            if (id !== 'build') setBuild(null);
            openPanel(panel === id ? null : id);
          }}
        >
          <span className="icon" aria-hidden="true">
            {PANEL_ICONS[id]}
          </span>
          <span className="label">{t(`panels.${id}`)}</span>
          {id === 'slack' && unread > 0 && (
            <span className="unread" aria-label={t('slack.unread', { count: unread })}>
              {unread}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

/** Bandeaux d'ambiance : vendredi 17h et incident en production (écran rouge clignotant). */
export function Alerts({ view }: { view: GameView }) {
  const { t } = useTranslation();
  return (
    <>
      {view.incident && <div className="incident-flash" aria-hidden="true" />}
      <div className="alerts" role="status" aria-live="polite">
        {view.incident && <p className="alert alert-incident">🔥 {t('time.incident')}</p>}
        {!view.incident && isFridayFive(view.time) && (
          <p className="alert alert-friday">⚠ {t('time.friday')}</p>
        )}
      </div>
    </>
  );
}
