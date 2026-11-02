import type { MissionGoal } from '@oss/shared';
import { useTranslation } from 'react-i18next';
import { goalText, goalValue } from './goals';

/** Un objectif ou une contrainte, avec son avancement quand la mission est en cours. */
export interface GoalLine {
  readonly goal: MissionGoal;
  readonly value?: number;
  readonly met?: boolean;
}

/**
 * Liste des objectifs (✓ remplis, ○ à faire) et des contraintes (🛡️ respectées, ✕ enfreintes).
 * Sans avancement (écran des chapitres), seule la phrase de chaque objectif est affichée.
 */
export function MissionGoals({
  goals,
  constraints,
}: {
  goals: readonly GoalLine[];
  constraints: readonly GoalLine[];
}) {
  const { t, i18n } = useTranslation();
  const line = (item: GoalLine, constraint: boolean, index: number) => {
    const live = item.met !== undefined;
    const value =
      live && item.value !== undefined ? goalValue(item.goal, item.value, i18n.language) : null;
    const icon = constraint ? (item.met === false ? '✕' : '🛡️') : item.met ? '✓' : '○';
    const state = !live ? '' : item.met ? 'met' : constraint ? 'broken' : 'todo';
    return (
      <li key={`${constraint ? 'c' : 'g'}${index}`} className={`mission-goal ${state}`}>
        <span className="mission-goal-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="mission-goal-text">
          {goalText(item.goal, t, i18n.language)}
          {live && (
            <span className="visually-hidden">
              {' '}
              {t(
                item.met
                  ? 'story.goalMet'
                  : constraint
                    ? 'story.constraintBroken'
                    : 'story.goalTodo',
              )}
            </span>
          )}
        </span>
        {value !== null && <span className="mission-goal-value">{value}</span>}
      </li>
    );
  };
  return (
    <div className="mission-goals">
      <p className="mission-goals-title">{t('story.goalsTitle')}</p>
      <ul>{goals.map((goal, index) => line(goal, false, index))}</ul>
      {constraints.length > 0 && (
        <>
          <p className="mission-goals-title">{t('story.constraintsTitle')}</p>
          <ul>{constraints.map((goal, index) => line(goal, true, index))}</ul>
        </>
      )}
    </div>
  );
}
