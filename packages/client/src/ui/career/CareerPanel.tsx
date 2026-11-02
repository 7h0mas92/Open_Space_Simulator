import { useTranslation } from 'react-i18next';
import type { CareerMilestoneView, LegendRunView, GameView } from '../../view/types';
import { localized } from '../game/format';

const STATUS_ICONS: Record<CareerMilestoneView['status'], string> = {
  PENDING: '⏳',
  DONE: '✅',
  FAILED: '❌',
};

/** Les jalons de la légende, avec leur état et la progression vers la cible. */
export function CareerMilestones({ career }: { career: LegendRunView }) {
  const { t, i18n } = useTranslation();
  return (
    <ol className="career-milestones">
      {career.milestones.map((milestone) => (
        <li key={milestone.id} className={`career-milestone ${milestone.status.toLowerCase()}`}>
          <span className="career-milestone-icon" aria-hidden="true">
            {STATUS_ICONS[milestone.status]}
          </span>
          <span className="career-milestone-text">
            <span>{localized(milestone.label, i18n.language)}</span>
            <small>
              {milestone.status === 'PENDING'
                ? milestone.bySprint === null
                  ? t('career.atEnd')
                  : t('career.deadline', { sprint: milestone.bySprint })
                : t(`career.status.${milestone.status}`, { sprint: milestone.sprint ?? 0 })}
            </small>
            {milestone.status === 'PENDING' && milestone.progress !== null && (
              <span
                className="career-progress"
                role="progressbar"
                aria-label={localized(milestone.label, i18n.language)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(milestone.progress * 100)}
              >
                <span style={{ width: `${milestone.progress * 100}%` }} />
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Panneau « Carrière » de la partie : l'histoire de la légende et ses jalons. */
export function CareerPanel({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const career = view.career;
  if (!career) return null;
  return (
    <div className="career-panel">
      <p className="career-panel-name">
        <span aria-hidden="true">{career.icon} </span>
        <strong>{localized(career.name, i18n.language)}</strong>{' '}
        <small>{t('career.year', { year: career.year })}</small>
      </p>
      <p className="career-story">{localized(career.story, i18n.language)}</p>
      <p className="career-twist">
        <strong>{t('career.start')} : </strong>
        {localized(career.twist, i18n.language)}
      </p>
      <h3 className="group-heading">
        {t('career.milestones')} ·{' '}
        {t('career.progress', { done: career.done, total: career.total })}
      </h3>
      <CareerMilestones career={career} />
      <p className="hint">{t('career.starsRule')}</p>
    </div>
  );
}
