import type { SubscriptionService } from '@oss/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CurrentSubscriptionView,
  GameView,
  SubscriptionOfferView,
  SubscriptionServiceView,
} from '../../view/types';
import { formatMoney, localized } from '../game/format';
import { useGame } from '../store/game';

/*
 * Rubrique « Abonnements » (bouton 🧾 de la barre du haut) : tous les services payés à intervalle
 * régulier, service par service. Pour chacun, l'abonnement en cours (état, prochaine échéance,
 * total payé, résiliation) puis les offres auxquelles souscrire ou passer. La salle des serveurs
 * reprend la partie « Internet » (`ServiceSubscription`).
 */

export function SubscriptionsPanel({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const { count, monthlyTotal, services } = view.subscriptions;
  return (
    <div className="subscriptions-panel">
      <p className="hint">{t('subscriptions.intro')}</p>
      <p className="subscriptions-summary" data-testid="subscriptions-summary">
        {count === 0
          ? t('subscriptions.summaryNone')
          : t('subscriptions.summary', {
              count,
              price: formatMoney(monthlyTotal, i18n.language),
            })}
      </p>
      {services.map((service) => (
        <ServiceSubscription key={service.id} view={view} service={service.id} />
      ))}
    </div>
  );
}

/** Un service : son abonnement en cours et ses offres. */
export function ServiceSubscription({
  view,
  service: id,
}: {
  view: GameView;
  service: SubscriptionService;
}) {
  const { t } = useTranslation();
  const replay = useGame((s) => s.replayOf !== null);
  const service = view.subscriptions.services.find((s) => s.id === id);
  if (!service) return null;
  const titleId = `subscription-${service.id}-title`;
  return (
    <section
      className="subscription-service"
      aria-labelledby={titleId}
      data-testid={`subscription-${service.id}`}
    >
      <h3 id={titleId} className="group-heading">
        <span aria-hidden="true">{service.icon} </span>
        {t(`subscriptions.services.${service.id}.name`)}
      </h3>
      <p className="hint">{t(`subscriptions.services.${service.id}.intro`)}</p>
      {service.current ? (
        <CurrentCard current={service.current} service={service} view={view} />
      ) : (
        <NoSubscription service={service} />
      )}
      <ul className="sub-offers">
        {service.offers.map((offer) => (
          <li key={offer.id}>
            <OfferCard offer={offer} subscribed={service.current !== null} disabled={replay} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function NoSubscription({ service }: { service: SubscriptionServiceView }) {
  const { t } = useTranslation();
  // L'installation demandée par toutes les offres du service, s'il en manque une.
  const missing = service.offers.find((offer) => offer.blocker === 'REQUIREMENT')?.requires;
  return (
    <p className="hint" data-testid={`subscription-${service.id}-none`}>
      {missing ? t(`subscriptions.requires.${missing}.long`) : t('subscriptions.none')}
    </p>
  );
}

/** Prix d'une offre avec sa période : « 900 € / semaine ». */
function usePrice(price: number, periodDays: number): string {
  const { t, i18n } = useTranslation();
  const amount = formatMoney(price, i18n.language);
  if (periodDays === 7) return t('subscriptions.perWeek', { price: amount });
  if (periodDays === 30) return t('subscriptions.perMonth', { price: amount });
  return t('subscriptions.perDays', { price: amount, count: periodDays });
}

function CurrentCard({
  current,
  service,
  view,
}: {
  current: CurrentSubscriptionView;
  service: SubscriptionServiceView;
  view: GameView;
}) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const replay = useGame((s) => s.replayOf !== null);
  const [confirming, setConfirming] = useState(false);
  const { offer } = current;
  const name = localized(offer.name, i18n.language);
  const money = (amount: number) => formatMoney(amount, i18n.language);
  const price = usePrice(offer.price, offer.periodDays);
  return (
    <div className="sub-current" data-testid={`subscription-${service.id}-current`}>
      <p>
        <strong>
          {service.icon} {name}
          {offer.detail && ` · ${localized(offer.detail, i18n.language)}`}
        </strong>{' '}
        <span className="sub-detail">{price}</span>
      </p>
      <p className={current.active ? 'server-state up' : 'server-state down'}>
        {current.active || !offer.requires
          ? t('subscriptions.active')
          : t(`subscriptions.requires.${offer.requires}.inactive`)}
      </p>
      <p className="hint">
        {t('subscriptions.nextBill', {
          price: money(offer.price),
          count: Math.max(1, Math.ceil(current.nextBillDays)),
        })}{' '}
        · {t('subscriptions.totalPaid', { price: money(current.totalPaid) })} ·{' '}
        {t('subscriptions.since', { sprint: current.since })}
      </p>
      {confirming ? (
        <div className="sub-actions">
          <p className="hint">{t('subscriptions.cancelWarning')}</p>
          <button
            type="button"
            className="danger"
            onClick={() => {
              setConfirming(false);
              void dispatch({ type: 'cancelSubscription', service: service.id });
            }}
            data-testid={`subscription-${service.id}-cancel-confirm`}
          >
            {t('subscriptions.cancelConfirm', { offer: name })}
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
          data-testid={`subscription-${service.id}-cancel`}
        >
          ✂️ {t('subscriptions.cancel')}
        </button>
      )}
    </div>
  );
}

function OfferCard({
  offer,
  subscribed,
  disabled,
}: {
  offer: SubscriptionOfferView;
  subscribed: boolean;
  disabled: boolean;
}) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const amount = formatMoney(offer.price, i18n.language);
  const price = usePrice(offer.price, offer.periodDays);
  const current = offer.blocker === 'CURRENT';
  const reason =
    offer.blocker === null || current
      ? null
      : offer.blocker === 'LOCKED'
        ? t('build.locked', { phase: t(`phases.${offer.minPhase}`) })
        : offer.blocker === 'REQUIREMENT' && offer.requires
          ? t(`subscriptions.requires.${offer.requires}.short`)
          : t(`results.${offer.blocker === 'REQUIREMENT' ? 'NOT_ELIGIBLE' : offer.blocker}`);
  return (
    <article
      className={`sub-offer${current ? ' current' : ''}${offer.blocker === 'LOCKED' ? ' locked' : ''}`}
      data-testid={`subscription-offer-${offer.id}`}
    >
      <h4>
        {localized(offer.name, i18n.language)}{' '}
        {offer.detail && (
          <span className="sub-detail">{localized(offer.detail, i18n.language)}</span>
        )}
      </h4>
      <p className="sub-price">{price}</p>
      <p className="hint">{localized(offer.description, i18n.language)}</p>
      {current ? (
        <p className="server-state up">{t('subscriptions.currentOffer')}</p>
      ) : (
        <button
          type="button"
          className="primary"
          disabled={disabled || offer.blocker !== null}
          onClick={() => void dispatch({ type: 'subscribe', offer: offer.id })}
          data-testid={`subscription-subscribe-${offer.id}`}
        >
          {subscribed
            ? t('subscriptions.switch', { price: amount })
            : t('subscriptions.subscribe', { price: amount })}
        </button>
      )}
      {reason && <p className="hint">{reason}</p>}
    </article>
  );
}
