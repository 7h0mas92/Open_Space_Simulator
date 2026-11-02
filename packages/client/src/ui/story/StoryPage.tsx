import {
  STORY_CHAPTERS,
  STORY_MISSIONS,
  STORY_REWARDS,
  chapterComplete,
  chapterMissions,
  founderTitle,
  getStoryMission,
  getStoryReward,
  missionAvailable,
  storyUnlocks,
  type StoryMission,
  type StoryMissionId,
} from '@oss/shared';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { localized } from '../game/format';
import { useGame } from '../store/game';
import { useSession } from '../store/session';
import { useStory } from '../store/story';
import { MissionGoals } from './MissionGoals';

/** Mission précédente de la campagne (celle qu'il faut réussir avant). */
function previousMission(id: StoryMissionId): StoryMission | undefined {
  const index = STORY_MISSIONS.findIndex((mission) => mission.id === id);
  return index > 0 ? STORY_MISSIONS[index - 1] : undefined;
}

function MissionCard({
  mission,
  completed,
}: {
  mission: StoryMission;
  completed: readonly StoryMissionId[];
}) {
  const { t, i18n } = useTranslation();
  const start = useGame((s) => s.start);
  const loading = useGame((s) => s.loading);
  const done = completed.includes(mission.id);
  const available = missionAvailable(mission.id, completed);
  const reward = getStoryReward(mission.reward);
  const before = previousMission(mission.id);
  const status = done ? 'done' : available ? 'available' : 'locked';
  return (
    <li className={`mission-card mission-${status}`} data-testid={`mission-${mission.id}`}>
      <header className="mission-card-head">
        <span className="mission-icon" aria-hidden="true">
          {available ? mission.icon : '🔒'}
        </span>
        <h4>{localized(mission.title, i18n.language)}</h4>
        <span className={`tag mission-status-${status}`}>{t(`story.status.${status}`)}</span>
      </header>
      <p className="mission-brief">{localized(mission.brief, i18n.language)}</p>
      <MissionGoals
        goals={mission.goals.map((goal) => ({ goal }))}
        constraints={mission.constraints.map((goal) => ({ goal }))}
      />
      <p className="mission-meta">
        <span>⏱️ {t('story.sprints', { count: mission.sprints })}</span>
        <span>🏁 {t(`phases.${mission.setup.phase}`)}</span>
      </p>
      {reward && (
        <p className="mission-reward">
          <span aria-hidden="true">{reward.icon} </span>
          {t('story.rewardLine', { reward: localized(reward.name, i18n.language) })}
        </p>
      )}
      {available ? (
        <button
          type="button"
          className={done ? undefined : 'primary'}
          disabled={loading}
          onClick={() => void start({ mode: 'STORY', mission: mission.id })}
          data-testid={`play-${mission.id}`}
        >
          {done ? `↻ ${t('story.replay')}` : `▶ ${t('story.play')}`}
        </button>
      ) : (
        <p className="hint">
          {t('story.lockedHint', {
            mission: before ? localized(before.title, i18n.language) : '',
          })}
        </p>
      )}
    </li>
  );
}

/** Les récompenses de la campagne : gagnées ou encore à gagner. */
function Rewards({ completed }: { completed: readonly StoryMissionId[] }) {
  const { t, i18n } = useTranslation();
  const unlocked = new Set(storyUnlocks(completed));
  return (
    <section className="story-rewards" aria-labelledby="story-rewards-title">
      <h2 id="story-rewards-title">{t('story.rewardsTitle')}</h2>
      <p className="hint">{t('story.rewardsHint')}</p>
      <ul className="reward-grid">
        {STORY_REWARDS.map((reward) => {
          const owned = unlocked.has(reward.id);
          const mission = STORY_MISSIONS.find((m) => m.reward === reward.id);
          return (
            <li
              key={reward.id}
              className={`reward-card ${owned ? 'owned' : 'locked'}`}
              data-testid={`reward-${reward.id}`}
            >
              <span className="reward-icon" aria-hidden="true">
                {owned ? reward.icon : '🔒'}
              </span>
              <span className="reward-text">
                <strong>{localized(reward.name, i18n.language)}</strong>
                <small>
                  {owned
                    ? localized(reward.description, i18n.language)
                    : t('story.rewardFrom', {
                        mission: mission ? localized(mission.title, i18n.language) : '',
                      })}
                </small>
              </span>
              <span className="tag">{t(`story.rewardKinds.${reward.kind}`)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Écran du mode Histoire : la campagne en 4 chapitres et 10 missions, la progression, le titre
 * de fondateur et les récompenses. La progression vient de l'appareil, puis du compte.
 */
export function StoryPage() {
  const { t, i18n } = useTranslation();
  const online = useSession((s) => s.status === 'authenticated');
  const { completed, loaded, load, sync } = useStory();

  useEffect(() => {
    void (online ? sync() : load());
  }, [online, load, sync]);

  const title = founderTitle(completed);
  const label = t('story.progress', { done: completed.length, total: STORY_MISSIONS.length });
  // La prochaine mission à jouer, pour le bouton du haut.
  const next = STORY_MISSIONS.find(
    (m) => !completed.includes(m.id) && missionAvailable(m.id, completed),
  );
  const start = useGame((s) => s.start);
  const loading = useGame((s) => s.loading);
  const nextMission = next ? getStoryMission(next.id) : undefined;

  return (
    <div className="story-page" data-testid="story-page">
      <section className="story-intro">
        <p>{t('story.intro')}</p>
        <div className="achievement-progress">
          <p>
            {label}
            {title && (
              <>
                {' · '}
                <strong data-testid="founder-title">{localized(title, i18n.language)}</strong>
              </>
            )}
          </p>
          <progress value={completed.length} max={STORY_MISSIONS.length} aria-label={label} />
        </div>
        <p className="hint">{t(online ? 'story.savedAccount' : 'story.savedDevice')}</p>
        {loaded && nextMission && (
          <button
            type="button"
            className="primary cta"
            disabled={loading}
            onClick={() => void start({ mode: 'STORY', mission: nextMission.id })}
          >
            ▶ {t('story.continue', { mission: localized(nextMission.title, i18n.language) })}
          </button>
        )}
        {loaded && !nextMission && <p className="up">{t('story.allDone')}</p>}
      </section>

      {STORY_CHAPTERS.map((chapter) => (
        <section
          key={chapter.id}
          className={`story-chapter ${chapterComplete(chapter.id, completed) ? 'complete' : ''}`}
          aria-labelledby={`chapter-${chapter.id}`}
        >
          <header>
            <p className="eyebrow">{t('story.chapterNumber', { number: chapter.number })}</p>
            <h2 id={`chapter-${chapter.id}`}>
              <span aria-hidden="true">{chapter.icon} </span>
              {localized(chapter.title, i18n.language)}
            </h2>
            <p>{localized(chapter.intro, i18n.language)}</p>
            {chapterComplete(chapter.id, completed) && (
              <p className="up">
                🏅{' '}
                {t('story.chapterDone', { title: localized(chapter.founderTitle, i18n.language) })}
              </p>
            )}
          </header>
          <ul className="mission-list">
            {chapterMissions(chapter.id).map((mission) => (
              <MissionCard key={mission.id} mission={mission} completed={completed} />
            ))}
          </ul>
        </section>
      ))}

      <Rewards completed={completed} />
    </div>
  );
}
