import { TEAM_BUILDING } from '@oss/shared';
import { useTranslation } from 'react-i18next';
import type { GameView } from '../../view/types';
import { formatMoney } from '../game/format';
import { useGame } from '../store/game';

/**
 * Bloc « Team building » du panneau Équipe : la sortie réservée pour ce sprint, ou la liste
 * des sorties à réserver pendant la planification.
 */
export function TeamBuilding({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const { booked, outings, count } = view.teamBuilding;
  const planning = view.step === 'PLANNING';
  const money = (value: number) => `${formatMoney(value, i18n.language)} €`;
  if (!planning && !booked) return null;

  return (
    <details className="team-building" open={planning}>
      <summary>
        <span aria-hidden="true">🎉</span>
        <span>{t('teamBuilding.title')}</span>
        {booked && (
          <span className="team-building-booked">
            · {t(`teamBuilding.outings.${booked.outing}.name`)}
          </span>
        )}
      </summary>
      {booked ? (
        <div className="team-building-current">
          <p>
            {t('teamBuilding.booked', {
              outing: t(`teamBuilding.outings.${booked.outing}.name`),
              when: t(`teamBuilding.outings.${booked.outing}.when`),
              cost: money(booked.cost),
            })}
          </p>
          {planning && (
            <button type="button" onClick={() => void dispatch({ type: 'cancelTeamBuilding' })}>
              {t('teamBuilding.cancel', {
                refund: Math.round(TEAM_BUILDING.cancelRefund * 100),
              })}
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="hint">{t('teamBuilding.intro', { count })}</p>
          <ul className="team-building-list">
            {outings.map((outing) => (
              <li key={outing.id}>
                <button
                  type="button"
                  className="team-building-outing"
                  disabled={outing.blocker !== null}
                  onClick={() => void dispatch({ type: 'bookTeamBuilding', outing: outing.id })}
                >
                  <span className="team-building-icon" aria-hidden="true">
                    {outing.icon}
                  </span>
                  <span className="team-building-body">
                    <strong>
                      {t(`teamBuilding.outings.${outing.id}.name`)} · {money(outing.price)}
                    </strong>
                    <span>{t(`teamBuilding.outings.${outing.id}.effect`)}</span>
                    <span className="hint">
                      {outing.hoursLost > 0
                        ? t('teamBuilding.hoursLost', {
                            count: outing.hoursLost,
                            when: t(`teamBuilding.outings.${outing.id}.when`),
                          })
                        : t('teamBuilding.noTimeLost', {
                            when: t(`teamBuilding.outings.${outing.id}.when`),
                          })}
                    </span>
                    {outing.repeat && <span className="hint">{t('teamBuilding.repeat')}</span>}
                    {outing.blocker && (
                      <span className="tag-warning">
                        {outing.blocker === 'LOCKED'
                          ? t('teamBuilding.locked', { phase: t(`phases.${outing.phase}`) })
                          : t(`teamBuilding.blockers.${outing.blocker}`)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  );
}
