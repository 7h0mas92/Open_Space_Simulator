import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CandidateView, GameView } from '../../view/types';
import { formatBirthday, formatMoney, localized } from '../game/format';
import { offerAcceptance } from '../../view/hiring';
import { useGame } from '../store/game';
import { GradeBadge, Strengths } from './Performance';
import { StatBars } from './StatBars';

/** Recrutement : 3 candidats par sprint, offre de salaire négociée, risque de refus. */
export function Hiring({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const max = view.teamMax;
  return (
    <div className="hiring">
      <p className="hint">{t('hiring.intro')}</p>
      {view.devs.length >= max && <p className="warning">{t('hiring.teamFull', { max })}</p>}
      {view.candidates.length === 0 ? (
        <p>{t('hiring.none')}</p>
      ) : (
        <ul className="candidates">
          {view.candidates.map((candidate) => (
            <li key={candidate.id}>
              <CandidateCard candidate={candidate} disabled={view.devs.length >= max} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CandidateCard({ candidate, disabled }: { candidate: CandidateView; disabled: boolean }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const [offer, setOffer] = useState(candidate.askingSalary);
  const { dev } = candidate;
  const min = Math.round(candidate.askingSalary * 0.6);
  const max = Math.round(candidate.askingSalary * 1.3);
  const { performance } = dev;
  const acceptance = Math.round(offerAcceptance(candidate, offer) * 100);
  const market = Math.round((candidate.askingSalary / candidate.marketSalary - 1) * 100);
  return (
    <article className="candidate">
      <header className="candidate-head">
        <div>
          <h3>
            {dev.name}, {t('team.age', { age: dev.age })}
          </h3>
          <p className="role">
            {t(`roles.${dev.role}`)} · {t(`traits.${dev.trait}` as never)}
          </p>
        </div>
        <GradeBadge grade={performance.grade} score={performance.score} estimated />
      </header>
      <p className="birthday">
        {t('team.birthday', { date: formatBirthday(dev.birthday, i18n.language) })}
      </p>
      <p className="bio">{localized(dev.bio, i18n.language)}</p>
      <p className="hint">{t(`roleDescriptions.${dev.role}`)}</p>
      <p className="hint">{t(`traitDescriptions.${dev.trait}`)}</p>
      <dl className="facts">
        <div>
          <dt>{t('perf.estimatedTitle')}</dt>
          <dd>
            {performance.score}/100 · {t(`perf.grades.${performance.grade}`)}
          </dd>
        </div>
        <div>
          <dt>{t('perf.expectedProductivity')}</dt>
          <dd>{Math.round(performance.expectedProductivity)} %</dd>
        </div>
        <div>
          <dt>{t('perf.expectedQuality')}</dt>
          <dd>{Math.round(performance.expectedQuality * 100)} %</dd>
        </div>
        <div>
          <dt>{t('hiring.market')}</dt>
          <dd>
            {t('team.salary', { salary: formatMoney(candidate.marketSalary, i18n.language) })}{' '}
            <span className={market > 0 ? 'danger-text' : 'good-text'}>
              ({market > 0 ? '+' : ''}
              {market} %)
            </span>
          </dd>
        </div>
      </dl>
      <StatBars stats={dev.stats} />
      <Strengths stats={dev.stats} />
      <p>{t('hiring.asking', { salary: formatMoney(candidate.askingSalary, i18n.language) })}</p>
      <label className="offer">
        {t('hiring.offer', { salary: formatMoney(offer, i18n.language) })}
        <input
          type="range"
          min={min}
          max={max}
          step={50}
          value={offer}
          onChange={(event) => setOffer(Number(event.target.value))}
        />
      </label>
      <p
        className={`acceptance ${acceptance >= 70 ? 'good-text' : acceptance < 30 ? 'danger-text' : ''}`}
      >
        {t('hiring.acceptance', { chance: acceptance })}
      </p>
      <button
        type="button"
        className="primary"
        disabled={disabled}
        onClick={() => void dispatch({ type: 'hire', candidateId: candidate.id, offer })}
      >
        {t('hiring.hire')}
      </button>
    </article>
  );
}
