import { getStoryChapter, getStoryMission, getStoryReward } from '@oss/shared';
import { useTranslation } from 'react-i18next';
import type { GameView } from '../../view/types';
import { localized } from '../game/format';
import { MissionGoals } from './MissionGoals';

/** Panneau « Mission » en jeu : le briefing, les objectifs en direct, le conseil, la récompense. */
export function MissionPanel({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const story = view.story;
  const mission = story ? getStoryMission(story.missionId) : undefined;
  if (!story || !mission) return <p className="hint">{t('story.noMission')}</p>;
  const chapter = getStoryChapter(mission.chapter);
  const reward = getStoryReward(mission.reward);
  const done = story.goals.filter((goal) => goal.met).length;
  return (
    <div className="mission-panel" data-testid="mission-panel">
      <p className="eyebrow">
        {t('story.chapterNumber', { number: chapter.number })} ·{' '}
        {localized(chapter.title, i18n.language)}
      </p>
      <h3>
        <span aria-hidden="true">{mission.icon} </span>
        {localized(mission.title, i18n.language)}
      </h3>
      <p className="mission-brief">{localized(mission.brief, i18n.language)}</p>
      <p className="mission-progress" role="status">
        {t('story.progressLine', {
          done,
          total: story.goals.length,
          sprint: Math.min(story.sprintsDone + 1, story.sprints),
          sprints: story.sprints,
        })}
      </p>
      <MissionGoals goals={story.goals} constraints={story.constraints} />
      <p className="mission-tip">
        <span aria-hidden="true">💡 </span>
        {localized(mission.tip, i18n.language)}
      </p>
      {reward && (
        <p className="mission-reward">
          <span aria-hidden="true">{reward.icon} </span>
          {t('story.rewardLine', { reward: localized(reward.name, i18n.language) })}
        </p>
      )}
    </div>
  );
}
