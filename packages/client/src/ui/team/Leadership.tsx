import { SPECIALTY_FOCUS } from '@oss/shared';
import { useTranslation } from 'react-i18next';
import type { DevView, LeadershipView } from '../../view/types';

/** « Spécialité : React (+20 % sur les features) » et le côté de la stack d'un dev. */
export function SpecialtyLine({ dev }: { dev: DevView }) {
  const { t } = useTranslation();
  if (dev.specialty) {
    return (
      <p className="hint specialty">
        {t('team.specialty', {
          specialty: t(`specialties.${dev.specialty}`),
          focus: t(`specialtyFocus.${SPECIALTY_FOCUS[dev.specialty]}`),
        })}
      </p>
    );
  }
  if (dev.stack) {
    return <p className="hint specialty">{t('team.stack', { stack: t(`stacks.${dev.stack}`) })}</p>;
  }
  return null;
}

/**
 * Ce que l'encadrement apporte à l'équipe (directeur, managers, scrum master, tech lead,
 * testeurs, DevOps), et les postes encore ouverts. Replié par défaut : le résumé tient sur
 * une ligne, le détail s'ouvre au clic.
 */
export function LeadershipSummary({ leadership }: { leadership: LeadershipView }) {
  const { t, i18n } = useTranslation();
  const decimal = (value: number) =>
    value.toLocaleString(i18n.language, { maximumFractionDigits: 1 });
  const lines = [
    leadership.productivity > 0 && t('leadership.productivity', { value: leadership.productivity }),
    leadership.coverage > 0 && t('leadership.coverage', { value: leadership.coverage }),
    leadership.lighterMeetings && t('leadership.meetings'),
    leadership.featureDebtCut > 0 && t('leadership.debt', { value: leadership.featureDebtCut }),
    leadership.dailyStability > 0 &&
      t('leadership.stability', { value: decimal(leadership.dailyStability) }),
    leadership.dailyMoral > 0 && t('leadership.moral', { value: decimal(leadership.dailyMoral) }),
  ].filter((line): line is string => typeof line === 'string');
  return (
    <details className="leadership">
      <summary>
        {t('leadership.title')}
        {leadership.productivity > 0 &&
          ` · ${t('leadership.short', { value: leadership.productivity })}`}
      </summary>
      {lines.length === 0 ? (
        <p className="hint">{t('leadership.none')}</p>
      ) : (
        <ul>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <p className="hint">
        {leadership.openings.length > 0
          ? t('leadership.openings', {
              roles: leadership.openings.map((role) => t(`roles.${role}`)).join(', '),
            })
          : t('leadership.noOpenings')}
      </p>
    </details>
  );
}
