import { useTranslation } from 'react-i18next';
import type { CleaningView, GameView } from '../../view/types';
import { formatMoney } from '../game/format';
import { useGame } from '../store/game';

/*
 * Panneau « Ménage » (bouton 🧹 en haut de l'écran) : la saleté du bureau et ce qu'elle coûte en
 * travail, l'entreprise de nettoyage (appel pour ce soir ou en express), puis l'abonnement
 * « Ménage » de la rubrique Abonnements, repris ici.
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
