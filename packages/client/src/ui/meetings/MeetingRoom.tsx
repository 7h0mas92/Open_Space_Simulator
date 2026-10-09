import { MEETINGS } from '@oss/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameView, MeetingFormatView } from '../../view/types';
import { formatGauge, localized } from '../game/format';
import { useGame } from '../store/game';

/*
 * Panneau « Réunions » : le joueur choisit comment aménager la salle de réunion du bureau.
 * Chaque formule a un bonus et un malus permanents, et décide si la réunion d'équipe du matin
 * a des chances d'être utile... ou d'avoir pu être un mail.
 */

function useMoney() {
  const { i18n } = useTranslation();
  return (value: number) => formatGauge('treasury', value, i18n.language);
}

export function MeetingRoom({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const dispatch = useGame((s) => s.dispatch);
  const replay = useGame((s) => s.replayOf !== null);
  const [confirming, setConfirming] = useState(false);
  const room = view.meetingRoom;
  const current = room.formats.find((format) => format.id === room.format) ?? null;
  const hour = `${Math.floor(MEETINGS.dailyHour)}h${String((MEETINGS.dailyHour % 1) * 60).padStart(2, '0')}`;
  return (
    <div className="meeting-panel">
      <p className="hint">{t('meetings.intro', { hour })}</p>
      {!room.unlocked ? (
        <p className="warning" data-testid="meetings-locked">
          🔒 {t('meetings.locked')}
        </p>
      ) : (
        <>
          <section className="meeting-current" aria-labelledby="meeting-current-title">
            <h3 id="meeting-current-title" className="group-heading">
              {t('meetings.current')}
            </h3>
            {current ? (
              <>
                <p className="meeting-current-name">
                  <span aria-hidden="true">{current.icon} </span>
                  <strong>{localized(current.name, i18n.language)}</strong>
                </p>
                <dl className="facts group-facts">
                  <div>
                    <dt>{t('meetings.useful')}</dt>
                    <dd className="up">{room.useful}</dd>
                  </div>
                  <div>
                    <dt>{t('meetings.useless')}</dt>
                    <dd className="down">{room.useless}</dd>
                  </div>
                </dl>
                {room.recent.length > 0 && (
                  <ul className="meeting-log" aria-label={t('meetings.recent')}>
                    {room.recent.map((meeting) => (
                      <li key={meeting.tick} className={meeting.useful ? 'up' : 'down'}>
                        <span aria-hidden="true">{meeting.useful ? '✅ ' : '😩 '}</span>
                        <span className="visually-hidden">
                          {meeting.useful ? t('meetings.useful') : t('meetings.useless')} :{' '}
                        </span>
                        {localized(meeting.text, i18n.language)}
                      </li>
                    ))}
                  </ul>
                )}
                {confirming ? (
                  <div className="venture-actions">
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        setConfirming(false);
                        void dispatch({ type: 'clearMeetingRoom' });
                      }}
                    >
                      {t('meetings.confirmClear', { refund: money(room.refund) })}
                    </button>
                    <button type="button" onClick={() => setConfirming(false)}>
                      {t('group.cancel')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={replay || view.step === 'PITCH'}
                    onClick={() => setConfirming(true)}
                  >
                    {t('meetings.clear', { refund: money(room.refund) })}
                  </button>
                )}
              </>
            ) : (
              <p className="hint">{t('meetings.empty')}</p>
            )}
          </section>

          <h3 className="group-heading">{t('meetings.formats')}</h3>
          <ul className="meeting-formats">
            {room.formats.map((format) => (
              <li key={format.id}>
                <FormatCard
                  format={format}
                  current={format.id === room.format}
                  refund={room.format ? room.refund : 0}
                  disabled={replay}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function FormatCard({
  format,
  current,
  refund,
  disabled,
}: {
  format: MeetingFormatView;
  current: boolean;
  refund: number;
  disabled: boolean;
}) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const dispatch = useGame((s) => s.dispatch);
  const blocker = current ? null : format.blocker;
  return (
    <article
      className={`meeting-format${current ? ' current' : ''}${format.blocker === 'LOCKED' ? ' locked' : ''}`}
      data-testid={`meeting-format-${format.id}`}
    >
      <h4>
        <span aria-hidden="true">{format.icon} </span>
        {localized(format.name, i18n.language)}
        {current && <span className="venture-status">{t('meetings.installed')}</span>}
      </h4>
      <p className="meeting-effect up">
        <span aria-hidden="true">＋ </span>
        <span className="visually-hidden">{t('meetings.bonus')} : </span>
        {localized(format.bonus, i18n.language)}
      </p>
      <p className="meeting-effect down">
        <span aria-hidden="true">－ </span>
        <span className="visually-hidden">{t('meetings.malus')} : </span>
        {localized(format.malus, i18n.language)}
      </p>
      <p className="venture-risk">
        {t('meetings.odds', { percent: Math.round(format.usefulOdds * 100) })}
      </p>
      {!current && (
        <>
          <button
            type="button"
            className="primary"
            disabled={disabled || blocker !== null}
            onClick={() => void dispatch({ type: 'fitMeetingRoom', format: format.id })}
          >
            {refund > 0
              ? t('meetings.switch', { price: money(format.price), refund: money(refund) })
              : t('meetings.fit', { price: money(format.price) })}
          </button>
          {blocker && blocker !== 'NOT_ELIGIBLE' && (
            <p className="hint">
              {t(`meetings.blockers.${blocker}`, { phase: t(`phases.${format.minPhase}`) })}
            </p>
          )}
        </>
      )}
    </article>
  );
}
