import type { SprintObjective } from '@oss/shared';
import { useTranslation } from 'react-i18next';
import type { ObjectiveView } from '../../view/types';
import { formatGauge } from '../game/format';

/** Libellé d'un objectif : « Livrer 4 features ». */
export function useObjectiveGoal(): (
  objective: Pick<SprintObjective, 'kind' | 'target'>,
) => string {
  const { t } = useTranslation();
  return (objective) => t(`kanban.objective.kinds.${objective.kind}`, { target: objective.target });
}

/** Récompense lisible : argent, hype et moral. */
export function useObjectiveReward(): (reward: SprintObjective['reward']) => string {
  const { t, i18n } = useTranslation();
  return (reward) =>
    t(reward.moral > 0 ? 'kanban.objective.rewardMoral' : 'kanban.objective.reward', {
      money: formatGauge('treasury', reward.treasury, i18n.language),
      hype: reward.hype,
      moral: reward.moral,
    });
}

/** Objectif du sprint en cours (en haut du Kanban) : cible, avancement et récompense. */
export function ObjectiveBanner({ objective }: { objective: ObjectiveView }) {
  const { t } = useTranslation();
  const goal = useObjectiveGoal()(objective);
  const reward = useObjectiveReward()(objective.reward);
  const outage = objective.kind === 'ZERO_INCIDENT';
  const ratio = outage
    ? objective.value === 0
      ? 1
      : 0
    : Math.min(1, objective.value / Math.max(1, objective.target));
  const progress = outage
    ? objective.value === 0
      ? t('kanban.objective.noOutageYet')
      : t('kanban.objective.outages', { count: objective.value })
    : t('kanban.objective.progress', { value: objective.value, target: objective.target });
  return (
    <section
      className={`objective objective-${objective.difficulty.toLowerCase()} ${objective.reached ? 'objective-reached' : ''}`}
      aria-label={t('kanban.objective.title')}
      data-testid="sprint-objective"
    >
      <p className="objective-head">
        <span className="objective-icon" aria-hidden="true">
          🎯
        </span>
        <strong>{t('kanban.objective.title')}</strong>
        <span className="tag objective-difficulty">
          {t(`kanban.objective.difficulty.${objective.difficulty}`)}
        </span>
        {objective.reached && !outage && (
          <span className="tag objective-done">✓ {t('kanban.objective.reached')}</span>
        )}
      </p>
      <p className="objective-goal">{goal}</p>
      <div
        className="progress"
        role="progressbar"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={goal}
      >
        <span style={{ width: `${ratio * 100}%` }} />
      </div>
      <p className="objective-meta">
        <span>{progress}</span>
        <span>{reward}</span>
      </p>
      {objective.kind === 'GAIN_USERS' && (
        <p className="objective-hint">{t('kanban.objective.usersHint')}</p>
      )}
    </section>
  );
}
