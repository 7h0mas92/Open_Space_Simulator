import { useTranslation } from 'react-i18next';
import type { FinancingOfferView, GameView } from '../../view/types';
import { formatGauge, intlLocale, localized } from '../game/format';
import { DifficultyDots } from '../game/StageScreens';
import { useGame } from '../store/game';

/*
 * Panneau « Lever des fonds » : le prochain tour de table (le pitch, de plus en plus dur à
 * chaque tour) et les autres façons de trouver de l'argent (business angels, prêt bancaire,
 * financement participatif, subvention), chacune avec ses conditions et sa contrepartie.
 */

const FINANCING_ICONS = { BRIDGE: '😇', LOAN: '🏦', CROWDFUNDING: '🙌', GRANT: '📑' } as const;

function useMoney() {
  const { i18n } = useTranslation();
  return (value: number) => formatGauge('treasury', value, i18n.language);
}

export function Funding({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const dispatch = useGame((s) => s.dispatch);
  const openPanel = useGame((s) => s.openPanel);
  const replay = useGame((s) => s.replayOf !== null);
  const { funding } = view;
  const next = funding.nextRound;
  const blocker = view.pitchBlocker;
  return (
    <div className="funding-panel">
      <dl className="facts funding-facts">
        <div>
          <dt>{t('funding.rounds')}</dt>
          <dd>{funding.rounds}</dd>
        </div>
        <div>
          <dt>{t('funding.raised')}</dt>
          <dd>{money(funding.totalRaised)}</dd>
        </div>
        <div>
          <dt>{t('funding.ownership')}</dt>
          <dd>
            {(view.ownership * 100).toLocaleString(intlLocale(i18n.language), {
              maximumFractionDigits: 1,
            })}{' '}
            %
          </dd>
        </div>
        <div>
          <dt>{t('funding.annexes')}</dt>
          <dd>
            {funding.annexes}/{funding.maxAnnexes}
          </dd>
        </div>
      </dl>

      <section className="funding-round" aria-labelledby="funding-round-title">
        <h3 id="funding-round-title">
          <span aria-hidden="true">💼</span>{' '}
          {t('funding.nextRound', { round: localized(next.name, i18n.language) })}
        </h3>
        <p className="funding-difficulty">
          <span>{t('funding.difficulty')}</span>
          <DifficultyDots tier={next.tier} tiers={funding.tiers} />
        </p>
        <p className="hint">
          {t('funding.roundHint', { manches: next.manches, options: next.options })}
        </p>
        {funding.annexes < funding.maxAnnexes && (
          <p className="hint">
            {next.tier >= 2
              ? t('funding.annexNext')
              : t('funding.annexLater', { round: t('funding.seriesB') })}
          </p>
        )}
        {blocker && (
          <p className="warning">
            {blocker === 'COOLDOWN'
              ? t('funding.pitchCooldown', { sprint: funding.nextPitchSprint ?? '' })
              : t(`results.${blocker}`)}
          </p>
        )}
        <button
          type="button"
          className="primary"
          disabled={blocker !== null || replay}
          onClick={() => {
            openPanel(null);
            void dispatch({ type: 'startPitch' });
          }}
        >
          {t('funding.pitch')}
        </button>
      </section>

      <h3 className="group-heading">{t('funding.others')}</h3>
      <p className="hint">{t('funding.othersHint')}</p>
      {funding.loan && (
        <p className="hint" data-testid="loan">
          🏦{' '}
          {t('funding.loanActive', {
            remaining: money(funding.loan.remaining),
            monthly: money(funding.loan.monthly),
          })}
        </p>
      )}
      <ul className="financing-offers">
        {funding.offers.map((offer) => (
          <li key={offer.kind}>
            <FinancingCard offer={offer} disabled={replay} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FinancingCard({ offer, disabled }: { offer: FinancingOfferView; disabled: boolean }) {
  const { t } = useTranslation();
  const money = useMoney();
  const dispatch = useGame((s) => s.dispatch);
  const available = offer.blocker === null;
  return (
    <article
      className={`financing-offer financing-${offer.kind}`}
      data-testid={`financing-${offer.kind}`}
    >
      <h4>
        <span aria-hidden="true">{FINANCING_ICONS[offer.kind]}</span>{' '}
        {t(`funding.kinds.${offer.kind}.name`)}
      </h4>
      <p className="item-description">{t(`funding.kinds.${offer.kind}.description`)}</p>
      {offer.amount > 0 && (
        <p className="financing-amount">
          <strong>{money(offer.amount)}</strong>
        </p>
      )}
      <p className="financing-terms">
        {t(`funding.kinds.${offer.kind}.terms`, {
          share: Math.round(offer.dilution * 100),
          monthly: money(offer.monthly),
          months: offer.months,
        })}
      </p>
      {offer.blocker && offer.blocker !== 'WRONG_STAGE' && (
        <p className="warning">
          {t(`funding.blockers.${offer.blocker}`, { sprint: offer.nextSprint ?? '' })}
        </p>
      )}
      <button
        type="button"
        disabled={!available || disabled}
        onClick={() => void dispatch({ type: 'takeFinancing', kind: offer.kind })}
      >
        {t('funding.accept')}
      </button>
    </article>
  );
}
