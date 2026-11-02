import {
  PRICE_TIERS,
  PRICING_MODEL_INFO,
  PRICING_MODELS,
  type PriceTier,
  type PricingModel,
} from '@oss/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameView, PricingChoiceView } from '../../view/types';
import { intlLocale, localized } from '../game/format';
import { useGame } from '../store/game';

/*
 * Panneau « Business » (bouton 💶 de la barre du haut) : le modèle économique du produit. Le
 * joueur choisit un modèle (gratuit avec pub, freemium, abonnement, achat unique) et un niveau de
 * prix, voit ce que le changement coûterait (utilisateurs perdus, hype) et ce qu'il rapporterait,
 * puis l'applique (une fois par sprint).
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
