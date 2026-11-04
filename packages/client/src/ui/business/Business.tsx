import {
  CLIENT_NEED_INFO,
  PRICE_TIERS,
  PRICING_MODEL_INFO,
  PRICING_MODELS,
  SUPPORT_DUTIES,
  type PriceTier,
  type PricingModel,
} from '@oss/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ClientContractView,
  ClientDealView,
  ClientOfferView,
  GameView,
  PricingChoiceView,
} from '../../view/types';
import { intlLocale, localized } from '../game/format';
import { useGame } from '../store/game';

/*
 * Panneau « Business » (bouton 💶 de la barre du haut) : le modèle économique du produit. Le
 * joueur choisit un modèle (gratuit avec pub, freemium, abonnement, achat unique) et un niveau de
 * prix, voit ce que le changement coûterait (utilisateurs perdus, hype) et ce qu'il rapporterait,
 * puis l'applique (une fois par sprint). En dessous, le support client (tickets, agents, devs de
 * garde, satisfaction) et les clients B2B : les offres de la
 * planification et les contrats signés, avec leur avancement, leur échéance et leurs pannes.
 */

/** Montant en euros, avec les centimes quand il est petit (revenu par utilisateur). */
function euros(value: number, language: string): string {
  return new Intl.NumberFormat(intlLocale(language), {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0,
  }).format(value);
}

/** Écart à l'économie d'origine, en pourcentage signé : « +40 % », « −25 % ». */
function delta(factor: number, language: string): string {
  const percent = Math.round((factor - 1) * 100);
  if (percent === 0) return '=';
  return new Intl.NumberFormat(intlLocale(language), {
    style: 'percent',
    signDisplay: 'always',
  }).format(percent / 100);
}

export function Business({ view }: { view: GameView }) {
  const { t } = useTranslation();
  return (
    <div className="business-panel">
      <p className="hint">{t('business.intro')}</p>
      <Pricing view={view} />
      <Support view={view} />
      <Clients view={view} />
    </div>
  );
}

function Pricing({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const replay = useGame((s) => s.replayOf !== null);
  const { current, choices, blocker } = view.pricing;
  const [model, setModel] = useState<PricingModel>(current.model);
  const [tier, setTier] = useState<PriceTier>(current.tier);
  const choice = choices.find((c) => c.model === model && c.tier === tier) ?? current;
  const unchanged = model === current.model && tier === current.tier;
  const language = i18n.language;
  return (
    <section className="pricing" aria-labelledby="pricing-title">
      <h3 id="pricing-title" className="group-heading">
        {t('business.pricing.title')}
      </h3>
      <p className="pricing-current" data-testid="pricing-current">
        <span aria-hidden="true">{PRICING_MODEL_INFO[current.model].icon} </span>
        <strong>
          {t('business.pricing.current', {
            model: localized(PRICING_MODEL_INFO[current.model].name, language),
            tier: t(`business.pricing.tiers.${current.tier}`),
          })}
        </strong>
        <span className="hint">
          {t('business.pricing.revenue', { price: euros(current.monthlyRevenue, language) })}
        </span>
      </p>

      <fieldset className="pricing-models">
        <legend>{t('business.pricing.model')}</legend>
        {PRICING_MODELS.map((id) => {
          const info = PRICING_MODEL_INFO[id];
          return (
            <button
              key={id}
              type="button"
              className={`pricing-model${model === id ? ' selected' : ''}`}
              aria-pressed={model === id}
              onClick={() => setModel(id)}
              data-testid={`pricing-model-${id}`}
            >
              <strong>
                <span aria-hidden="true">{info.icon} </span>
                {localized(info.name, language)}
                {current.model === id && (
                  <span className="pricing-badge">{t('business.pricing.inUse')}</span>
                )}
              </strong>
              <span className="hint">{localized(info.description, language)}</span>
            </button>
          );
        })}
      </fieldset>

      <fieldset className="pricing-tiers">
        <legend>{t('business.pricing.tier')}</legend>
        <div className="pricing-tier-row">
          {PRICE_TIERS.map((id) => (
            <button
              key={id}
              type="button"
              className={tier === id ? 'selected' : ''}
              aria-pressed={tier === id}
              onClick={() => setTier(id)}
              data-testid={`pricing-tier-${id}`}
            >
              {t(`business.pricing.tiers.${id}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <Preview choice={choice} />

      {unchanged ? (
        <p className="hint">{t('business.pricing.unchanged')}</p>
      ) : (
        <>
          <button
            type="button"
            className="primary"
            disabled={replay || blocker !== null}
            onClick={() => void dispatch({ type: 'setPricing', model, tier })}
            data-testid="pricing-apply"
          >
            {t('business.pricing.apply')}
          </button>
          {blocker && <p className="hint">{t(`business.pricing.blockers.${blocker}`)}</p>}
        </>
      )}
    </section>
  );
}

/** Ce que donnerait le réglage choisi, comparé à freemium au prix standard. */
function Preview({ choice }: { choice: PricingChoiceView }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const users = Math.round(choice.usersLost).toLocaleString(intlLocale(language));
  const rows: [string, string, 'good' | 'bad' | null][] = [
    [t('business.pricing.arpu'), euros(choice.arpu, language), null],
    ...(choice.oneTime > 0
      ? [
          [t('business.pricing.oneTime'), euros(choice.oneTime, language), 'good'] as [
            string,
            string,
            'good',
          ],
        ]
      : []),
    [
      t('business.pricing.acquisition'),
      delta(choice.acquisition, language),
      choice.acquisition === 1 ? null : choice.acquisition > 1 ? 'good' : 'bad',
    ],
    [
      t('business.pricing.churn'),
      delta(choice.churn, language),
      choice.churn === 1 ? null : choice.churn < 1 ? 'good' : 'bad',
    ],
    [
      t('business.pricing.userValue'),
      delta(choice.userValue, language),
      choice.userValue === 1 ? null : choice.userValue > 1 ? 'good' : 'bad',
    ],
    [t('business.pricing.monthly'), euros(choice.monthlyRevenue, language), null],
  ];
  return (
    <div className="pricing-preview" data-testid="pricing-preview">
      <dl>
        {rows.map(([label, value, tone]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={tone ?? undefined}>{value}</dd>
          </div>
        ))}
      </dl>
      {choice.usersLost >= 1 && (
        <p className="pricing-warning" data-testid="pricing-loss">
          {t('business.pricing.loss', { users, hype: Math.abs(choice.hype) })}
        </p>
      )}
      {choice.usersLost < 1 && choice.hype > 0 && (
        <p className="hint">{t('business.pricing.cut', { hype: choice.hype })}</p>
      )}
    </div>
  );
}

/** Clients B2B : contrats en cours, puis offres à signer. */
function Clients({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const { clients } = view;
  const language = i18n.language;
  return (
    <section className="clients" aria-labelledby="clients-title">
      <h3 id="clients-title" className="group-heading">
        {t('business.clients.title')}
      </h3>
      <p className="hint">{t('business.clients.intro')}</p>
      <p className="clients-summary" data-testid="clients-summary">
        {t('business.clients.slots', {
          used: clients.slots - clients.freeSlots,
          max: clients.slots,
        })}
        {clients.monthlyTotal > 0 &&
          ` · ${t('business.clients.monthly', { price: euros(clients.monthlyTotal, language) })}`}
        {clients.signed > 0 &&
          ` · ${t('business.clients.record', {
            delivered: clients.delivered,
            lost: clients.lost,
          })}`}
      </p>
      {clients.contracts.length > 0 && (
        <ul className="client-list" aria-label={t('business.clients.contracts')}>
          {clients.contracts.map((contract) => (
            <li key={contract.id}>
              <ContractCard contract={contract} />
            </li>
          ))}
        </ul>
      )}
      <h4 className="clients-subtitle">{t('business.clients.offers')}</h4>
      {clients.offers.length === 0 ? (
        <p className="hint">{t('business.clients.noOffers')}</p>
      ) : (
        <ul className="client-list" aria-label={t('business.clients.offers')}>
          {clients.offers.map((offer) => (
            <li key={offer.id}>
              <OfferCard offer={offer} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** En-tête commun d'une offre et d'un contrat : client, taille, ce qu'il demande. */
function DealHeader({ deal }: { deal: ClientDealView }) {
  const { t, i18n } = useTranslation();
  return (
    <>
      <h4>
        <span aria-hidden="true">{deal.icon} </span>
        {deal.company}
        <span className="sub-detail">
          {localized(deal.sector, i18n.language)} · {t(`business.clients.sizes.${deal.size}`)}
        </span>
      </h4>
      <p className="client-need" title={localized(CLIENT_NEED_INFO[deal.need].ask, i18n.language)}>
        <span aria-hidden="true">{CLIENT_NEED_INFO[deal.need].icon} </span>
        {t('business.clients.need', {
          count: deal.points,
          type: t(`business.clients.needs.${deal.need}`),
          sprints: deal.sprints,
        })}
        <span className="hint">
          {deal.company} {localized(CLIENT_NEED_INFO[deal.need].ask, i18n.language)}
        </span>
      </p>
    </>
  );
}

function OfferCard({ offer }: { offer: ClientOfferView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const replay = useGame((s) => s.replayOf !== null);
  const money = (value: number) => euros(value, i18n.language);
  return (
    <article className="client-card" data-testid={`client-offer-${offer.id}`}>
      <DealHeader deal={offer} />
      <dl className="client-terms">
        <div>
          <dt>{t('business.clients.fee')}</dt>
          <dd>{money(offer.monthlyFee)}</dd>
        </div>
        <div>
          <dt>{t('business.clients.signing')}</dt>
          <dd className="good">+{money(offer.signingBonus)}</dd>
        </div>
        <div>
          <dt>{t('business.clients.delivery')}</dt>
          <dd className="good">
            +{money(offer.deliveryBonus)} ·{' '}
            {t('business.clients.users', {
              count: Math.round(offer.users),
              users: Math.round(offer.users).toLocaleString(intlLocale(i18n.language)),
            })}
          </dd>
        </div>
        <div>
          <dt>{t('business.clients.risks')}</dt>
          <dd className="bad">
            {t('business.clients.riskText', {
              penalty: money(offer.penalty),
              sla: money(offer.slaPenalty),
            })}
          </dd>
        </div>
      </dl>
      <button
        type="button"
        className="primary"
        disabled={replay || offer.blocker !== null}
        onClick={() => void dispatch({ type: 'signClient', offerId: offer.id })}
        data-testid={`client-sign-${offer.id}`}
      >
        {t('business.clients.sign')}
      </button>
      {offer.blocker && <p className="hint">{t(`business.clients.blockers.${offer.blocker}`)}</p>}
    </article>
  );
}

function ContractCard({ contract }: { contract: ClientContractView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const replay = useGame((s) => s.replayOf !== null);
  const [confirming, setConfirming] = useState(false);
  const money = (value: number) => euros(value, i18n.language);
  const active = contract.status === 'ACTIVE';
  const percent = Math.round((contract.progress / contract.points) * 100);
  return (
    <article
      className={`client-card contract ${active ? 'active' : 'delivered'}`}
      data-testid={`client-contract-${contract.id}`}
    >
      <DealHeader deal={contract} />
      {active ? (
        <>
          <span
            className="client-progress"
            role="progressbar"
            aria-label={t('business.clients.progress', {
              done: contract.progress,
              total: contract.points,
            })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <span style={{ width: `${percent}%` }} />
          </span>
          <p className={contract.sprintsLeft <= 1 ? 'client-due soon' : 'client-due'}>
            {t('business.clients.progress', { done: contract.progress, total: contract.points })} ·{' '}
            {t('business.clients.left', { count: contract.sprintsLeft })}
          </p>
        </>
      ) : (
        <p className="server-state up">
          {t('business.clients.maintenance', { count: contract.maintenanceLeft })}
        </p>
      )}
      <p className="hint">
        {t('business.clients.paying', { price: money(contract.monthly) })} ·{' '}
        {t('business.clients.breaches', { count: contract.breaches, max: contract.maxBreaches })}
      </p>
      {confirming ? (
        <div className="sub-actions">
          <p className="hint">
            {active
              ? t('business.clients.dropWarning', { penalty: money(contract.penalty) })
              : t('business.clients.endWarning')}
          </p>
          <button
            type="button"
            className="danger"
            onClick={() => {
              setConfirming(false);
              void dispatch({ type: 'dropClient', contractId: contract.id });
            }}
            data-testid={`client-drop-confirm-${contract.id}`}
          >
            {t('business.clients.dropConfirm')}
          </button>
          <button type="button" onClick={() => setConfirming(false)}>
            {t('group.cancel')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={replay}
          onClick={() => setConfirming(true)}
          data-testid={`client-drop-${contract.id}`}
        >
          ✂️ {t(active ? 'business.clients.drop' : 'business.clients.end')}
        </button>
      )}
    </article>
  );
}

/** Support client : satisfaction, tickets, agents et devs de garde. */
function Support({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const replay = useGame((s) => s.replayOf !== null);
  const support = view.support;
  const language = i18n.language;
  const satisfaction = Math.round(support.satisfaction);
  const level =
    support.satisfaction >= support.happyThreshold
      ? 'happy'
      : support.satisfaction >= support.churnThreshold
        ? 'ok'
        : 'angry';
  const disabled = replay || support.blocker !== null;
  const count = (value: number) => Math.round(value).toLocaleString(intlLocale(language));
  const set = (agents: number, duty = support.duty) =>
    void dispatch({ type: 'setSupport', agents, duty });
  return (
    <section className="support" aria-labelledby="support-title">
      <h3 id="support-title" className="group-heading">
        {t('business.support.title')}
      </h3>
      <p className="hint">{t('business.support.intro')}</p>
      <div className={`support-card support-${level}`}>
        <p className="support-value" data-testid="support-satisfaction">
          <strong>{t('business.support.satisfaction', { value: satisfaction })}</strong>
          <span>{t(`business.support.levels.${level}`)}</span>
        </p>
        <span
          className="support-bar"
          role="meter"
          aria-label={t('business.support.satisfactionLabel')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={satisfaction}
        >
          <span style={{ width: `${satisfaction}%` }} />
        </span>
        <p className="hint">
          {level === 'angry'
            ? t('business.support.churn', {
                percent: Math.round((support.churnFactor - 1) * 100),
              })
            : level === 'happy'
              ? t('business.support.happy', {
                  percent: Math.round((support.growthFactor - 1) * 100),
                })
              : t('business.support.ok', { threshold: support.happyThreshold })}
        </p>
        <p data-testid="support-tickets">
          {t('business.support.tickets', {
            backlog: count(support.backlog),
            perDay: count(support.ticketsPerDay),
            capacity: count(support.capacity),
          })}
        </p>
      </div>

      <div className="support-agents">
        <p>
          <strong>{t('business.support.agents', { count: support.agents })}</strong>{' '}
          <span className="hint">
            {t('business.support.agentInfo', {
              salary: euros(support.agentSalary, language),
              capacity: support.agentCapacity,
              max: support.maxAgents,
            })}
          </span>
        </p>
        <div className="support-stepper">
          <button
            type="button"
            aria-label={t('business.support.fire')}
            disabled={disabled || support.agents === 0}
            onClick={() => set(support.agents - 1)}
            data-testid="support-fire"
          >
            −
          </button>
          <span aria-live="polite">{support.agents}</span>
          <button
            type="button"
            aria-label={t('business.support.hire')}
            disabled={disabled || support.agents >= support.maxAgents}
            onClick={() => set(support.agents + 1)}
            data-testid="support-hire"
          >
            +
          </button>
        </div>
        {support.monthly > 0 && (
          <p className="hint">
            {t('business.support.monthly', { price: euros(support.monthly, language) })}
          </p>
        )}
      </div>

      <fieldset className="pricing-tiers support-duties">
        <legend>{t('business.support.duty')}</legend>
        <div className="pricing-tier-row">
          {SUPPORT_DUTIES.map((duty) => (
            <button
              key={duty}
              type="button"
              className={support.duty === duty ? 'selected' : ''}
              aria-pressed={support.duty === duty}
              disabled={disabled}
              onClick={() => support.duty !== duty && set(support.agents, duty)}
              data-testid={`support-duty-${duty}`}
            >
              {t(`business.support.duties.${duty}`, {
                percent: Math.round(support.dutyShare[duty] * 100),
              })}
            </button>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
