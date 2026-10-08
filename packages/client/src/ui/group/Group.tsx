import { VENTURES } from '@oss/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameView, VentureOfferView, VentureView } from '../../view/types';
import { formatGauge, intlLocale, localized } from '../game/format';
import { useGame } from '../store/game';

/*
 * Panneau « Investir » : à partir de la Série A, la startup crée des filiales avec sa
 * trésorerie. Trois projets par sprint, au plus trois filiales ; chacune ajoute une aile au
 * bureau et des places dans l'équipe, et ses parts comptent dans la valorisation.
 */

const RISK_ICONS = { SAFE: '🛡️', BOLD: '🎯', MOONSHOT: '🌙' } as const;

function useMoney() {
  const { i18n } = useTranslation();
  return (value: number) => formatGauge('treasury', value, i18n.language);
}

export function Group({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const money = useMoney();
  const { group } = view;
  const replay = useGame((s) => s.replayOf !== null);
  const active = group.ventures.filter((venture) => venture.status === 'ACTIVE').length;
  return (
    <div className="group-panel">
      <p className="hint">{t('group.intro', { team: VENTURES.teamPerWing })}</p>
      {!group.unlocked ? (
        <p className="warning" data-testid="group-locked">
          🔒 {t('group.locked')}
        </p>
      ) : (
        <>
          <dl className="facts group-facts">
            <div>
              <dt>{t('group.founded')}</dt>
              <dd>
                {group.ventures.length}/{group.maxVentures}
              </dd>
            </div>
            <div>
              <dt>{t('group.active')}</dt>
              <dd>{active}</dd>
            </div>
            <div>
              <dt>{t('group.portfolio')}</dt>
              <dd>{money(group.portfolio)}</dd>
            </div>
            <div>
              <dt>{t('group.investable')}</dt>
              <dd>{money(group.investable)}</dd>
            </div>
          </dl>

          <h3 className="group-heading">{t('group.projects')}</h3>
          {group.blocker ? (
            <p className="warning">
              {t(`group.blockers.${group.blocker}`, { sprint: group.nextSprint ?? '' })}
            </p>
          ) : (
            <p className="hint">{t('group.projectsHint')}</p>
          )}
          {group.blocker !== 'VENTURE_LIMIT' && group.blocker !== 'TOO_LATE' && (
            <ul className="venture-offers">
              {group.offers.map((offer) => (
                <li key={offer.id}>
                  <OfferCard offer={offer} blocked={group.blocker !== null || replay} />
                </li>
              ))}
            </ul>
          )}

          {group.ventures.length > 0 && (
            <>
              <h3 className="group-heading">{t('group.ventures')}</h3>
              <ul className="ventures">
                {group.ventures.map((venture) => (
                  <li key={venture.id}>
                    <VentureCard
                      venture={venture}
                      canSell={!replay && (view.step === 'PLANNING' || view.step === 'DEMO')}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

function OfferCard({ offer, blocked }: { offer: VentureOfferView; blocked: boolean }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const dispatch = useGame((s) => s.dispatch);
  const disabled = blocked || !offer.affordable;
  return (
    <article className={`venture-offer risk-${offer.risk}`}>
      <h4>
        <span aria-hidden="true">{offer.icon} </span>
        {localized(offer.name, i18n.language)}
      </h4>
      <p className="bio">{localized(offer.pitch, i18n.language)}</p>
      <p className="venture-risk">
        <span aria-hidden="true">{RISK_ICONS[offer.risk]} </span>
        <strong>{t(`group.risks.${offer.risk}.name`)}</strong> ·{' '}
        {t(`group.risks.${offer.risk}.help`)}
      </p>
      <button
        type="button"
        className="primary"
        disabled={disabled}
        title={!offer.affordable ? t('group.tooExpensive') : undefined}
        onClick={() => void dispatch({ type: 'foundVenture', ideaId: offer.id })}
      >
        {t('group.found', { cost: money(offer.cost) })}
      </button>
      {!offer.affordable && <p className="hint">{t('group.tooExpensive')}</p>}
    </article>
  );
}

/** Mini-graphique de la valorisation d'une filiale, sprint après sprint. */
function Sparkline({ values, label }: { values: readonly number[]; label: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 28 - (value / max) * 26;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg className="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none" role="img">
      <title>{label}</title>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function VentureCard({ venture, canSell }: { venture: VentureView; canSell: boolean }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const dispatch = useGame((s) => s.dispatch);
  const [confirming, setConfirming] = useState(false);
  const name = localized(venture.name, i18n.language);
  const multiple = venture.invested > 0 ? venture.stakeValue / venture.invested : 0;
  const multipleText = multiple.toLocaleString(intlLocale(i18n.language), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return (
    <article className={`venture status-${venture.status}`}>
      <h4>
        <span aria-hidden="true">{venture.icon} </span>
        {name}
        <span className="venture-status">{t(`group.status.${venture.status}`)}</span>
      </h4>
      <p className="venture-risk">
        <span aria-hidden="true">{RISK_ICONS[venture.risk]} </span>
        {t(`group.risks.${venture.risk}.name`)} ·{' '}
        {t('group.since', { sprint: venture.foundedAtSprint })}
      </p>
      <dl className="facts">
        <div>
          <dt>{t('group.invested')}</dt>
          <dd>{money(venture.invested)}</dd>
        </div>
        {venture.status === 'ACTIVE' && (
          <div>
            <dt>{t('group.stakeValue', { percent: Math.round(venture.stake * 100) })}</dt>
            <dd className={multiple >= 1 ? 'up' : 'down'}>
              {money(venture.stakeValue)} (×{multipleText})
            </dd>
          </div>
        )}
        {venture.soldFor !== null && (
          <div>
            <dt>{t('group.soldFor')}</dt>
            <dd>{money(venture.soldFor)}</dd>
          </div>
        )}
        <div>
          <dt>{t('group.dividends')}</dt>
          <dd>{money(venture.dividends)}</dd>
        </div>
      </dl>
      <Sparkline values={venture.history} label={t('group.chart', { name })} />
      {venture.status === 'ACTIVE' &&
        (confirming ? (
          <div className="venture-actions">
            <button
              type="button"
              className="danger"
              onClick={() => {
                setConfirming(false);
                void dispatch({ type: 'sellVenture', ventureId: venture.id });
              }}
            >
              {t('group.confirmSell', { price: money(venture.salePrice) })}
            </button>
            <button type="button" onClick={() => setConfirming(false)}>
              {t('group.cancel')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!canSell}
            title={canSell ? undefined : t('group.sellWhen')}
            onClick={() => setConfirming(true)}
          >
            {t('group.sell', { price: money(venture.salePrice) })}
          </button>
        ))}
    </article>
  );
}
