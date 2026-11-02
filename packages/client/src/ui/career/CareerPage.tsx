import { CAREER_LEGENDS, careerMilestoneLabel, type CareerLegendId } from '@oss/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localized } from '../game/format';
import { useGame } from '../store/game';
import { careerRecords, starsText } from './records';

/**
 * Page « Carrière » du menu : les huit légendes, leur histoire racontée par allusions, leur
 * départ et leurs jalons. Un bouton lance la partie (la légende est écrite dans la graine).
 */
export function CareerPage() {
  const { t, i18n } = useTranslation();
  const start = useGame((s) => s.start);
  const loading = useGame((s) => s.loading);
  const [records] = useState(careerRecords);
  const play = (legend: CareerLegendId) => void start({ mode: 'CAREER', legend });
  return (
    <div className="career-page">
      <p className="hint">{t('career.intro')}</p>
      <p className="hint career-rule">{t('career.starsRule')}</p>
      <ul className="career-list">
        {CAREER_LEGENDS.map((legend) => {
          const best = records[legend.id];
          const level = t(`career.difficulty.${legend.difficulty}`);
          return (
            <li
              key={legend.id}
              className={`career-card career-level-${legend.difficulty}`}
              data-testid={`legend-${legend.id}`}
            >
              <header className="career-card-head">
                <span className="mode-icon" aria-hidden="true">
                  {legend.icon}
                </span>
                <span className="career-card-title">
                  <h2>{localized(legend.name, i18n.language)}</h2>
                  <small>{t('career.year', { year: legend.year })}</small>
                </span>
                <span className="career-difficulty" title={t('career.difficultyLabel', { level })}>
                  <span aria-hidden="true">{'⚡'.repeat(legend.difficulty)} </span>
                  {level}
                </span>
              </header>
              <p className="career-story">{localized(legend.story, i18n.language)}</p>
              <p className="career-twist">
                <strong>{t('career.start')} : </strong>
                {localized(legend.twist, i18n.language)}
              </p>
              <h3 className="career-heading">{t('career.milestones')}</h3>
              <ol className="career-goals">
                {legend.milestones.map((milestone) => (
                  <li key={milestone.id}>
                    {localized(careerMilestoneLabel(milestone), i18n.language)}
                  </li>
                ))}
              </ol>
              <footer className="career-card-foot">
                <span className={`career-best ${best === undefined ? 'muted' : ''}`}>
                  {best === undefined
                    ? t('career.never')
                    : t('career.best', { stars: starsText(best) })}
                </span>
                <button
                  type="button"
                  className="primary"
                  disabled={loading}
                  onClick={() => play(legend.id)}
                >
                  {t('career.play')}
                </button>
              </footer>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
