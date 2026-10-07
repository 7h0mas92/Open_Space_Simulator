import {
  ACHIEVEMENT_DIFFICULTIES,
  ACHIEVEMENTS,
  type AchievementDifficulty,
  type AchievementDto,
} from '@oss/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { metaApi } from '../../api/meta';
import { pendingAchievements } from '../../save/achievements';
import { localized } from '../game/format';
import { useSession } from '../store/session';

/** Catalogue local (hors ligne) : le même que celui du serveur, sans date de déblocage. */
function localCatalog(): AchievementDto[] {
  return ACHIEVEMENTS.map(({ id, title, description, icon, difficulty, secret = false }) => ({
    id,
    title,
    description,
    icon,
    difficulty,
    secret,
    unlockedAt: null,
  }));
}

/**
 * Catalogue des succès avec ceux du joueur. Connecté, le serveur donne les dates de
 * déblocage ; les succès débloqués sur cet appareil et pas encore envoyés sont ajoutés.
 */
export async function loadAchievements(): Promise<AchievementDto[]> {
  const local = new Set(await pendingAchievements.all().catch(() => []));
  const catalog = await metaApi.achievements().catch(localCatalog);
  const now = new Date().toISOString();
  return catalog.map((a) => (local.has(a.id) && !a.unlockedAt ? { ...a, unlockedAt: now } : a));
}

const unlockedCount = (achievements: readonly AchievementDto[]) =>
  achievements.filter((a) => a.unlockedAt !== null).length;

/** Barre de progression « 12 succès débloqués sur 61 ». */
export function AchievementProgress({ achievements }: { achievements: readonly AchievementDto[] }) {
  const { t } = useTranslation();
  const unlocked = unlockedCount(achievements);
  const label = t('achievements.progress', { unlocked, total: achievements.length });
  return (
    <div className="achievement-progress">
      <p>{label}</p>
      <progress value={unlocked} max={Math.max(1, achievements.length)} aria-label={label} />
    </div>
  );
}

/** Une carte de succès. Un succès secret pas encore débloqué ne montre que « ??? ». */
function AchievementCard({ achievement }: { achievement: AchievementDto }) {
  const { t, i18n } = useTranslation();
  const unlocked = achievement.unlockedAt !== null;
  const hidden = achievement.secret && !unlocked;
  return (
    <li
      className={`${unlocked ? 'unlocked' : 'locked'} ${hidden ? 'secret' : ''}`}
      data-testid={`achievement-${achievement.id}`}
    >
      <span className="achievement-icon" aria-hidden="true">
        {hidden ? '❓' : achievement.icon}
      </span>
      <div>
        <strong>
          {hidden ? t('achievements.secretTitle') : localized(achievement.title, i18n.language)}
        </strong>
        <small>
          {hidden
            ? t('achievements.secretHint')
            : localized(achievement.description, i18n.language)}
        </small>
        <small className="achievement-status">
          {achievement.secret && <span className="badge">{t('achievements.secret')}</span>}
          {unlocked
            ? t('achievements.unlockedOn', {
                date: new Date(achievement.unlockedAt ?? '').toLocaleDateString(i18n.language),
              })
            : t('achievements.locked')}
        </small>
      </div>
    </li>
  );
}

/** Grille des succès : débloqués en couleur, les autres grisés, les secrets en « ??? ». */
export function AchievementGrid({ achievements }: { achievements: readonly AchievementDto[] }) {
  return (
    <ul className="achievement-grid">
      {achievements.map((achievement) => (
        <AchievementCard key={achievement.id} achievement={achievement} />
      ))}
    </ul>
  );
}

/** Ordre d'affichage : débloqués, puis à débloquer, puis secrets (« ??? ») en dernier. */
const rank = (achievement: AchievementDto) =>
  achievement.unlockedAt !== null ? 0 : achievement.secret ? 2 : 1;

const FILTERS = ['all', 'unlocked', 'locked'] as const;
type Filter = (typeof FILTERS)[number];

const matches = (filter: Filter, achievement: AchievementDto) =>
  filter === 'all' || (filter === 'unlocked') === (achievement.unlockedAt !== null);

/**
 * Écran « Succès » du menu principal : progression, filtre et succès rangés par
 * difficulté. Ouvert à tous ; seuls les joueurs connectés les gardent sur leur compte.
 */
export function AchievementsPage() {
  const { t } = useTranslation();
  const online = useSession((s) => s.status === 'authenticated');
  const [achievements, setAchievements] = useState<AchievementDto[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    void loadAchievements().then(setAchievements);
  }, [online]);

  if (!achievements) return <p aria-live="polite">{t('auth.loading')}</p>;
  const byDifficulty = (difficulty: AchievementDifficulty) =>
    achievements.filter((a) => a.difficulty === difficulty);
  return (
    <div className="achievements">
      {!online && <p className="hint">{t('achievements.guestHint')}</p>}
      <AchievementProgress achievements={achievements} />
      <div className="tabs scroll-tabs" role="tablist" aria-label={t('achievements.filter')}>
        {FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
          >
            {t(`achievements.filters.${id}`)}
          </button>
        ))}
      </div>
      {ACHIEVEMENT_DIFFICULTIES.map((difficulty) => {
        const all = byDifficulty(difficulty);
        const shown = all.filter((a) => matches(filter, a)).sort((a, b) => rank(a) - rank(b));
        if (shown.length === 0) return null;
        return (
          <section
            key={difficulty}
            className={`achievement-section difficulty-${difficulty.toLowerCase()}`}
            aria-labelledby={`achievements-${difficulty}`}
          >
            <h2 id={`achievements-${difficulty}`}>
              {t(`achievements.difficulty.${difficulty}`)}{' '}
              <small>
                {unlockedCount(all)}/{all.length}
              </small>
            </h2>
            <AchievementGrid achievements={shown} />
          </section>
        );
      })}
      {achievements.every((a) => !matches(filter, a)) && <p>{t('achievements.empty')}</p>}
    </div>
  );
}
