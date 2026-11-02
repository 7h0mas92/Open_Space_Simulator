import type { MissionGoal } from '@oss/shared';
import type { TFunction } from 'i18next';
import { formatGauge } from '../game/format';

/** Phrase d'un objectif ou d'une contrainte de mission (« Livrer 3 features »). */
export function goalText(goal: MissionGoal, t: TFunction, language: string): string {
  switch (goal.kind) {
    case 'phase':
      return t('story.goals.phase', { phase: t(`phases.${goal.atLeast}`) });
    case 'gauge': {
      const gauge = t(`gauges.${goal.gauge}.name`);
      return goal.max !== undefined
        ? t('story.goals.gaugeMax', { gauge, value: goal.max })
        : t('story.goals.gaugeMin', { gauge, value: goal.min ?? 0 });
    }
    case 'stat':
      // Contrainte « au plus 0 » : jamais ; sinon, un minimum ou un maximum.
      if (goal.max === 0) return t(`story.goals.stat.${goal.stat}.none`);
      return goal.max !== undefined
        ? t(`story.goals.stat.${goal.stat}.max`, { count: goal.max })
        : t(`story.goals.stat.${goal.stat}.min`, { count: goal.min ?? 0 });
    case 'team':
      return t('story.goals.team', { count: goal.min });
    case 'moral':
      return t('story.goals.moral', { value: goal.min });
    case 'valuation':
      return t('story.goals.valuation', { value: formatGauge('treasury', goal.min, language) });
    case 'serverRoom':
      return t('story.goals.serverRoom');
    case 'meetingRoom':
      return t('story.goals.meetingRoom');
    case 'pets':
      return t('story.goals.pets', { count: goal.min });
    case 'sprints':
      return t('story.goals.sprints', { count: goal.min });
  }
}

/**
 * Où en est l'objectif, en clair : « 2/3 », « 45 % », « 1,2 Md€ » ; rien pour un objectif à
 * cocher (salle aménagée) ni pour une phase.
 */
export function goalValue(goal: MissionGoal, value: number, language: string): string | null {
  switch (goal.kind) {
    case 'stat':
      return goal.max === undefined ? `${value}/${goal.min ?? 0}` : `${value}`;
    case 'team':
    case 'pets':
    case 'sprints':
      return `${value}/${goal.min}`;
    case 'gauge':
      return formatGauge(goal.gauge, value, language);
    case 'moral':
      return `${Math.round(value)}`;
    case 'valuation':
      return formatGauge('treasury', value, language);
    case 'phase':
    case 'serverRoom':
    case 'meetingRoom':
      return null;
  }
}
