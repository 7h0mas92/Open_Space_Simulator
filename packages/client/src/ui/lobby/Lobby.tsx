import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameView, SecurityPlanView } from '../../view/types';
import { formatMoney, localized } from '../game/format';
import { useGame } from '../store/game';

/*
 * Panneau « Hall d'entrée » (ouvert depuis le rayon Accueil du mode construction, ou en
 * sélectionnant le comptoir) : les travaux du hall au rez-de-chaussée, les secrétaires de
 * l'accueil, puis le service de sécurité payé chaque semaine. Les cartes de sécurité
 * reprennent la présentation des offres fibre.
 */

export function Lobby({ view }: { view: GameView }) {
  const { t } = useTranslation();
  return (
    <div className="servers-panel lobby-panel">
      <p className="hint">{t('lobby.intro')}</p>
      {view.lobby.built ? <Reception view={view} /> : <Build view={view} />}
      <Security view={view} />
    </div>
  );
}

function Build({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const replay = useGame((s) => s.replayOf !== null);
  const { lobby } = view;
  const price = formatMoney(lobby.price, i18n.language);
  const reason =
    lobby.buildBlocker === 'LOCKED'
      ? t('build.locked', { phase: t(`phases.${lobby.minPhase}`) })
      : lobby.buildBlocker
        ? t(`results.${lobby.buildBlocker}`)
        : null;
  return (
    <section aria-labelledby="lobby-build-title">
      <h3 id="lobby-build-title" className="group-heading">
        {t('lobby.buildTitle')}
      </h3>
      <ul className="lobby-features">
        <li>🚪 {t('lobby.features.gates')}</li>
        <li>🛎️ {t('lobby.features.desk')}</li>
        <li>🛋️ {t('lobby.features.waiting')}</li>
      </ul>
      <button
        type="button"
        className="primary"
        disabled={replay || lobby.buildBlocker !== null}
        onClick={() => void dispatch({ type: 'buildLobby' })}
        data-testid="lobby-build"
      >
        🏗️ {t('lobby.build', { price })}
      </button>
      {reason && <p className="hint">{reason}</p>}
    </section>
  );
}

function Reception({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const replay = useGame((s) => s.replayOf !== null);
  const { lobby } = view;
  const salary = formatMoney(lobby.receptionistMonthly, i18n.language);
  const locked = replay || view.step === 'PITCH';
  const set = (count: number) => void dispatch({ type: 'setReceptionists', count });
  return (
    <section aria-labelledby="lobby-reception-title">
      <h3 id="lobby-reception-title" className="group-heading">
        {t('lobby.receptionTitle')}
      </h3>
      <p className="server-state up" data-testid="lobby-built">
        ✅ {t('lobby.built')}
      </p>
      <p className="hint">{t('lobby.receptionHint', { salary })}</p>
      <div className="lobby-reception" data-testid="lobby-receptionists">
        <button
          type="button"
          disabled={locked || lobby.receptionists === 0}
          onClick={() => set(lobby.receptionists - 1)}
          aria-label={t('lobby.dismiss')}
          data-testid="lobby-dismiss"
        >
          −
        </button>
        <span aria-live="polite">
          {t('lobby.receptionists', {
            count: lobby.receptionists,
            max: lobby.maxReceptionists,
          })}
        </span>
        <button
          type="button"
          className="primary"
          disabled={locked || lobby.receptionists >= lobby.maxReceptionists}
          onClick={() => set(lobby.receptionists + 1)}
          aria-label={t('lobby.hire', { salary })}
          data-testid="lobby-hire"
        >
          +
        </button>
      </div>
      <p className="hint">
        {t('lobby.payroll', {
          price: formatMoney(lobby.receptionists * lobby.receptionistMonthly, i18n.language),
        })}
      </p>
    </section>
  );
}

function Security({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const replay = useGame((s) => s.replayOf !== null);
  const [confirming, setConfirming] = useState(false);
  const { security, plans, built } = view.lobby;
  const current = security ? plans.find((plan) => plan.id === security.plan) : undefined;
  const money = (amount: number) => formatMoney(amount, i18n.language);

  return (
    <section className="fibre" aria-labelledby="security-title">
      <h3 id="security-title" className="group-heading">
        {t('lobby.security.title')}
      </h3>
      <p className="hint">{t('lobby.security.intro')}</p>
      {security && current ? (
        <div className="fibre-current" data-testid="security-current">
          <p>
            <strong>🛡️ {localized(current.name, i18n.language)}</strong>
          </p>
          <p className="hint">{localized(current.coverage, i18n.language)}</p>
          <p className="hint">
            {t('lobby.security.nextBill', {
              price: money(security.weeklyPrice),
              count: Math.max(1, Math.ceil(security.nextBillDays)),
            })}{' '}
            · {t('lobby.security.totalPaid', { price: money(security.totalPaid) })}
          </p>
          {confirming ? (
            <div className="fibre-actions">
              <p className="hint">{t('lobby.security.cancelWarning')}</p>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setConfirming(false);
                  void dispatch({ type: 'cancelSecurity' });
                }}
                data-testid="security-cancel-confirm"
              >
                {t('lobby.security.cancelConfirm')}
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
              data-testid="security-cancel"
            >
              ✂️ {t('lobby.security.cancel')}
            </button>
          )}
        </div>
      ) : (
        <p className="hint" data-testid="security-none">
          {built ? t('lobby.security.noneHint') : t('lobby.security.needLobby')}
        </p>
      )}
      <ul className="fibre-plans">
        {plans.map((plan) => (
          <li key={plan.id}>
            <PlanCard plan={plan} subscribed={security !== null} disabled={replay} />
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
  plan: SecurityPlanView;
  subscribed: boolean;
  disabled: boolean;
}) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const price = formatMoney(plan.weeklyPrice, i18n.language);
  const reason =
    plan.blocker === null || plan.blocker === 'CURRENT'
      ? null
      : plan.blocker === 'LOCKED'
        ? t('build.locked', { phase: t(`phases.${plan.minPhase}`) })
        : plan.blocker === 'NO_LOBBY'
          ? t('lobby.security.needLobbyShort')
          : t(`results.${plan.blocker}`);
  const current = plan.blocker === 'CURRENT';
  return (
    <article
      className={`fibre-plan${current ? ' current' : ''}${plan.blocker === 'LOCKED' ? ' locked' : ''}`}
      data-testid={`security-plan-${plan.id}`}
    >
      <h4>{localized(plan.name, i18n.language)}</h4>
      <p className="fibre-price">
        {t('lobby.security.perWeek', { price })}{' '}
        <span className="fibre-speed">
          {t('lobby.security.perMonth', { price: formatMoney(plan.monthlyPrice, i18n.language) })}
        </span>
      </p>
      <p className="fibre-speed">{localized(plan.coverage, i18n.language)}</p>
      <p className="hint">{localized(plan.description, i18n.language)}</p>
      {current ? (
        <p className="server-state up">{t('lobby.security.currentPlan')}</p>
      ) : (
        <button
          type="button"
          className="primary"
          disabled={disabled || plan.blocker !== null}
          onClick={() => void dispatch({ type: 'subscribeSecurity', plan: plan.id })}
          data-testid={`security-subscribe-${plan.id}`}
        >
          {subscribed
            ? t('lobby.security.switch', { price })
            : t('lobby.security.subscribe', { price })}
        </button>
      )}
      {reason && <p className="hint">{reason}</p>}
    </article>
  );
}
