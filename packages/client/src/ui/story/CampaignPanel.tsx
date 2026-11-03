import { STORY_ACTS, getStoryAct, getStoryMission, getStoryReward } from '@oss/shared';
import { useTranslation } from 'react-i18next';
import type { CampaignView } from '../../view/types';
import { localized } from '../game/format';
import { useGame } from '../store/game';
import { MissionGoals } from './MissionGoals';

/** « Prologue » ou « Acte II » : le nom court d'un acte. */
export function useActLabel(): (index: number) => string {
  const { t } = useTranslation();
  return (index) =>
    index === 0
      ? t('story.campaign.prologue')
      : t('story.campaign.actNumber', { number: ROMAN[index] ?? index });
}

const ROMAN = ['', 'I', 'II', 'III', 'IV'];

/** Frise des 5 actes : passés, en cours, à venir. */
export function ActTimeline({ current }: { current: number }) {
  const { i18n } = useTranslation();
  const label = useActLabel();
  return (
    <ol className="act-timeline">
      {STORY_ACTS.map((act, index) => {
        const status = index < current ? 'past' : index === current ? 'current' : 'next';
        return (
          <li
            key={act.id}
            className={`act-step act-${status}`}
            aria-current={status === 'current' ? 'step' : undefined}
          >
            <span className="act-icon" aria-hidden="true">
              {act.icon}
            </span>
            <span className="act-name">
              <small>{label(index)}</small>
              {localized(act.title, i18n.language)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Panneau « Mission » de la longue partie : l'acte en cours, son objectif principal avec sa date
 * limite, et ses objectifs secondaires (les missions de la campagne courte et leurs récompenses).
 */
/** Saison libre : sprints tenus depuis l'entrée en Bourse, et fin de partie au choix. */
function FreeSeason({ count }: { count: number }) {
  const { t } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  return (
    <div className="campaign-free-season" data-testid="campaign-free-season">
      <h4>🌅 {t('story.campaign.freeSeason.title')}</h4>
      <p className="mission-progress" role="status">
        {t('story.campaign.freeSeason.text', { count })}
      </p>
      <button
        type="button"
        onClick={() => void dispatch({ type: 'endStory' })}
        data-testid="campaign-end-story"
      >
        {t('story.campaign.freeSeason.end')}
      </button>
    </div>
  );
}

export function CampaignPanel({ campaign, sprint }: { campaign: CampaignView; sprint: number }) {
  const { t, i18n } = useTranslation();
  const label = useActLabel();
  const act = getStoryAct(campaign.actIndex);
  const left = Math.max(0, campaign.deadline - sprint + 1);
  return (
    <div className="mission-panel campaign-panel" data-testid="campaign-panel">
      <ActTimeline current={campaign.actIndex} />
      <p className="eyebrow">{label(campaign.actIndex)}</p>
      <h3>
        <span aria-hidden="true">{act.icon} </span>
        {localized(act.title, i18n.language)}
      </h3>
      <p className="mission-brief">{localized(act.intro, i18n.language)}</p>
      {campaign.freeSeason ? (
        <FreeSeason count={campaign.freeSeasonSprints} />
      ) : campaign.goals.length > 0 ? (
        <>
          <p className="mission-progress" role="status" data-testid="campaign-deadline">
            {t('story.campaign.deadline', { sprint: campaign.deadline, count: left })}
          </p>
          <MissionGoals goals={campaign.goals} constraints={[]} />
        </>
      ) : (
        <p className="mission-progress" role="status">
          {t('story.campaign.exitGoal', { sprint: campaign.deadline })}
        </p>
      )}
      <h4 className="campaign-side-title">{t('story.campaign.sideTitle')}</h4>
      <ul className="campaign-side">
        {campaign.side.map((side) => {
          const mission = getStoryMission(side.id);
          const reward = mission ? getStoryReward(mission.reward) : undefined;
          if (!mission) return null;
          return (
            <li
              key={side.id}
              className={`campaign-side-goal side-${side.status}`}
              data-testid={`side-${side.id}`}
            >
              <p className="campaign-side-head">
                <span aria-hidden="true">{mission.icon} </span>
                <strong>{localized(mission.title, i18n.language)}</strong>{' '}
                <span className="tag">{t(`story.campaign.side.${side.status}`)}</span>
              </p>
              {side.status === 'active' && (
                <MissionGoals goals={side.goals} constraints={side.constraints} />
              )}
              {reward && (
                <p className="mission-reward">
                  <span aria-hidden="true">{reward.icon} </span>
                  {t('story.rewardLine', { reward: localized(reward.name, i18n.language) })}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
