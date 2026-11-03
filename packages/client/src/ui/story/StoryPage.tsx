import {
  STORY_ACTS,
  STORY_SYNOPSIS,
  STORY_TITLE,
  STORY_TOTAL_SPRINTS,
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
import { useEffect, useState } from 'react';
import { storyCheckpoints, type ActCheckpoint } from '../../save/story';
import { resumeAct } from '../store/lifecycle';
import { ActTimeline, useActLabel } from './CampaignPanel';
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
 * La longue partie « Ctrl+Alt+Fonder » : le synopsis, les 5 actes, et les boutons pour la
 * commencer ou reprendre un acte depuis son point de sauvegarde (gardé sur l'appareil).
 */
function CampaignSection({ completed }: { completed: readonly StoryMissionId[] }) {
  const { t, i18n } = useTranslation();
  const start = useGame((s) => s.start);
  const loading = useGame((s) => s.loading);
  const label = useActLabel();
  const [checkpoints, setCheckpoints] = useState<readonly ActCheckpoint[]>([]);
  useEffect(() => {
    let alive = true;
    void storyCheckpoints
      .list()
      .then((saved) => alive && setCheckpoints(saved?.acts ?? []))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const reached = checkpoints.at(-1)?.act ?? -1;
  return (
    <section className="story-campaign" aria-labelledby="story-campaign-title">
      <p className="eyebrow">{t('story.campaign.eyebrow')}</p>
      <h2 id="story-campaign-title">{localized(STORY_TITLE, i18n.language)}</h2>
      <p>{localized(STORY_SYNOPSIS, i18n.language)}</p>
      <p className="hint">
        {t('story.campaign.meta', {
          sprints: STORY_TOTAL_SPRINTS,
          done: completed.length,
          total: STORY_MISSIONS.length,
        })}
      </p>
      <ActTimeline current={reached} />
      <ol className="act-list">
        {STORY_ACTS.map((act, index) => {
          const checkpoint = checkpoints.find((c) => c.act === index);
          return (
            <li key={act.id} className="act-card" data-testid={`act-${act.id}`}>
              <p className="eyebrow">
                {label(index)} · {t(`phases.${act.phase}`)}
              </p>
              <h3>
                <span aria-hidden="true">{act.icon} </span>
                {localized(act.title, i18n.language)}
              </h3>
              <p>{localized(act.intro, i18n.language)}</p>
              <p className="mission-meta">
                <span>
                  ⏱️{' '}
                  {act.goals.length > 0
                    ? t('story.campaign.deadlineShort', { sprint: act.deadline })
                    : t('story.campaign.exitShort')}
                </span>
                <span>🎯 {t('story.campaign.sideCount', { count: act.side.length })}</span>
              </p>
              {checkpoint && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void resumeAct(index)}
                  data-testid={`resume-${act.id}`}
                >
                  ↻ {t('story.campaign.resume', { act: label(index) })}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        className="primary cta"
        disabled={loading}
        onClick={() => void start({ mode: 'STORY', mission: 'campaign' })}
        data-testid="campaign-start"
      >
        ▶ {t(reached >= 0 ? 'story.campaign.restart' : 'story.campaign.start')}
      </button>
      {reached >= 0 && <p className="hint">{t('story.campaign.continueHint')}</p>}
    </section>
  );
}

type StoryTab = 'campaign' | 'missions';

/**
 * Écran du mode Histoire : la longue partie en 5 actes (onglet « Histoire ») et la campagne
 * courte en 4 chapitres et 10 missions, la progression, le titre
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
  const [tab, setTab] = useState<StoryTab>('campaign');

  return (
    <div className="story-page" data-testid="story-page">
      <div className="tabs story-tabs" role="tablist" aria-label={t('story.tabs.label')}>
        {(['campaign', 'missions'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`story-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`story-panel-${id}`}
            className={tab === id ? 'active' : undefined}
            onClick={() => setTab(id)}
            data-testid={`story-tab-${id}`}
          >
            {t(`story.tabs.${id}`)}
          </button>
        ))}
      </div>
      {tab === 'campaign' && (
        <div role="tabpanel" id="story-panel-campaign" aria-labelledby="story-tab-campaign">
          <CampaignSection completed={completed} />
          <Rewards completed={completed} />
        </div>
      )}
      {tab === 'missions' && (
        <div role="tabpanel" id="story-panel-missions" aria-labelledby="story-tab-missions">
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
                    {t('story.chapterDone', {
                      title: localized(chapter.founderTitle, i18n.language),
                    })}
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
      )}
    </div>
  );
}
