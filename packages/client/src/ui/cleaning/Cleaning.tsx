import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CleaningPlanView, CleaningView, GameView } from '../../view/types';
import { formatMoney, localized } from '../game/format';
import { useGame } from '../store/game';

/*
 * Panneau « Ménage » (bouton 🧹 en haut de l'écran) : la saleté du bureau et ce qu'elle coûte en
 * travail, l'entreprise de nettoyage (appel pour ce soir ou en express), puis l'abonnement payé
 * chaque semaine.
 */

const TOOL_ICONS = { cart: '🛒', vacuum: '🌀', mop: '🧽' } as const;

/** Niveau de saleté affiché : propre, à surveiller, sale. */
export function dirtLevel(
  cleaning: Pick<CleaningView, 'dirt' | 'alert'>,
): 'clean' | 'warn' | 'dirty' {
  if (cleaning.dirt >= cleaning.alert) return 'dirty';
  return cleaning.dirt >= cleaning.alert / 2 ? 'warn' : 'clean';
}

export function Cleaning({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const cleaning = view.cleaning;
  const level = dirtLevel(cleaning);
  const dirt = Math.round(cleaning.dirt);
  const loss = Math.round((1 - cleaning.productivity) * 100);
  return (
    <div className="cleaning-panel">
      <p className="hint">{t('cleaning.intro')}</p>

      <section className={`dirt-card dirt-${level}`} aria-labelledby="dirt-title">
        <h3 id="dirt-title" className="group-heading">
          {t('cleaning.dirtTitle')}
        </h3>
        <p className="dirt-value" data-testid="dirt-value">
          <strong>{t('cleaning.dirt', { percent: dirt })}</strong>
          <span>{t(`cleaning.levels.${level}`)}</span>
        </p>
        <span
          className="dirt-bar"
          role="meter"
          aria-label={t('cleaning.dirtTitle')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={dirt}
        >
          <span style={{ width: `${dirt}%` }} />
          <span className="dirt-alert" style={{ left: `${cleaning.alert}%` }} aria-hidden="true" />
        </span>
        <p className="hint" data-testid="dirt-loss">
          {loss > 0 ? t('cleaning.loss', { percent: loss }) : t('cleaning.noLoss')}
          {cleaning.daysSinceClean > 0 &&
            ` · ${t('cleaning.days', { count: cleaning.daysSinceClean })}`}
        </p>
      </section>

      <Crew view={view} />
      <Subscription view={view} />
    </div>
  );
}

function Crew({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const replay = useGame((s) => s.replayOf !== null);
  const cleaning = view.cleaning;
  const money = (amount: number) => formatMoney(amount, i18n.language);
  const status = cleaning.visit
    ? t('cleaning.status.visit', { percent: Math.round(cleaning.visit.progress * 100) })
    : cleaning.booking
      ? cleaning.booking.express
        ? t('cleaning.status.express')
        : t('cleaning.status.booked', { count: Math.max(1, Math.ceil(cleaning.booking.inHours)) })
      : null;
  const reason =
    cleaning.callBlocker === null || cleaning.callBlocker === 'BUSY'
      ? null
      : t(`results.${cleaning.callBlocker}`);
  const disabled = replay || cleaning.callBlocker !== null;
  return (
    <section className="cleaning-crew" aria-labelledby="crew-title">
      <h3 id="crew-title" className="group-heading">
        {t('cleaning.crewTitle')}
      </h3>
      <ul className="crew-list">
        {cleaning.crew.map((member) => (
          <li key={member.id}>
            <span aria-hidden="true">{TOOL_ICONS[member.tool]} </span>
            <strong>{member.name}</strong> · {t(`cleaning.tools.${member.tool}`)}
          </li>
        ))}
      </ul>
      {status && (
        <p className="server-state up" data-testid="cleaning-status">
          🧹 {status}
        </p>
      )}
      <div className="cleaning-calls">
        <button
          type="button"
          className="primary"
          disabled={disabled}
          onClick={() => void dispatch({ type: 'callCleaning', express: false })}
          data-testid="cleaning-call"
        >
          🌙 {t('cleaning.call', { price: money(cleaning.callPrice) })}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void dispatch({ type: 'callCleaning', express: true })}
          data-testid="cleaning-express"
        >
          ⚡ {t('cleaning.express', { price: money(cleaning.expressPrice) })}
        </button>
      </div>
      <p className="hint">
        {reason ?? t('cleaning.callHint')}
        {cleaning.visits > 0 &&
          ` · ${t('cleaning.history', { count: cleaning.visits, price: money(cleaning.spent) })}`}
      </p>
    </section>
  );
}

function Subscription({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const replay = useGame((s) => s.replayOf !== null);
  const [confirming, setConfirming] = useState(false);
  const { plan, plans } = view.cleaning;
  const current = plan ? plans.find((option) => option.id === plan.plan) : undefined;
  const money = (amount: number) => formatMoney(amount, i18n.language);
  return (
    <section className="subscription-service" aria-labelledby="cleaning-plan-title">
      <h3 id="cleaning-plan-title" className="group-heading">
        {t('cleaning.planTitle')}
      </h3>
      {plan && current ? (
        <div className="sub-current" data-testid="cleaning-current">
          <p>
            <strong>🗓️ {localized(current.name, i18n.language)}</strong>
          </p>
          <p className="hint">
            {t('cleaning.nextBill', {
              price: money(plan.weeklyPrice),
              count: Math.max(1, Math.ceil(plan.nextBillDays)),
            })}{' '}
            · {t('cleaning.totalPaid', { price: money(plan.totalPaid) })}
          </p>
          {confirming ? (
            <div className="sub-actions">
              <p className="hint">{t('cleaning.cancelWarning')}</p>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setConfirming(false);
                  void dispatch({ type: 'cancelCleaning' });
                }}
                data-testid="cleaning-cancel-confirm"
              >
                {t('cleaning.cancelConfirm')}
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
              data-testid="cleaning-cancel"
            >
              ✂️ {t('cleaning.cancel')}
            </button>
          )}
        </div>
      ) : (
        <p className="hint" data-testid="cleaning-none">
          {t('cleaning.none')}
        </p>
      )}
      <ul className="sub-offers">
        {plans.map((option) => (
          <li key={option.id}>
            <PlanCard plan={option} subscribed={plan !== null} disabled={replay} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlanCard({
  plan,
  subscribed,
  disabled,
}: {
  plan: CleaningPlanView;
  subscribed: boolean;
  disabled: boolean;
}) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const days = t('time.days', { returnObjects: true }) as unknown as string[];
  const price = formatMoney(plan.weeklyPrice, i18n.language);
  const current = plan.blocker === 'CURRENT';
  const reason = plan.blocker === null || current ? null : t(`results.${plan.blocker}`);
  return (
    <article
      className={`sub-offer${current ? ' current' : ''}`}
      data-testid={`cleaning-plan-${plan.id}`}
    >
      <h4>
        {localized(plan.name, i18n.language)}{' '}
        <span className="sub-detail">{plan.days.map((day) => days[day - 1] ?? '').join(', ')}</span>
      </h4>
      <p className="sub-price">
        {t('subscriptions.perWeek', { price })}{' '}
        <span className="sub-detail">
          {t('cleaning.discount', { percent: Math.round(plan.discount * 100) })}
        </span>
      </p>
      <p className="hint">{localized(plan.description, i18n.language)}</p>
      {current ? (
        <p className="server-state up">{t('subscriptions.currentOffer')}</p>
      ) : (
        <button
          type="button"
          className="primary"
          disabled={disabled || plan.blocker !== null}
          onClick={() => void dispatch({ type: 'subscribeCleaning', plan: plan.id })}
          data-testid={`cleaning-subscribe-${plan.id}`}
        >
          {subscribed
            ? t('subscriptions.switch', { price })
            : t('subscriptions.subscribe', { price })}
        </button>
      )}
      {reason && <p className="hint">{reason}</p>}
    </article>
  );
}
