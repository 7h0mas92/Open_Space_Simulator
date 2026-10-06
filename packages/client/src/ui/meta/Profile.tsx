import { ACHIEVEMENTS, OUTCOMES, type AchievementDto, type ProfileResponse } from '@oss/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { metaApi } from '../../api/meta';
import { pendingAchievements } from '../../save/achievements';
import { formatGauge } from '../game/format';
import { useSession } from '../store/session';
import { AchievementGrid } from './Achievements';

/** Catalogue des succès pour un invité : ceux débloqués sur cet appareil sont marqués. */
async function guestAchievements(): Promise<AchievementDto[]> {
  const local = new Set(await pendingAchievements.all().catch(() => []));
  const catalog = await metaApi.achievements().catch(() =>
    ACHIEVEMENTS.map(({ id, title, description, icon }) => ({
      id,
      title,
      description,
      icon,
      unlockedAt: null,
    })),
  );
  const now = new Date().toISOString();
  return catalog.map((a) => (local.has(a.id) && !a.unlockedAt ? { ...a, unlockedAt: now } : a));
}

/** Profil : statistiques cumulées, meilleures parties et succès. Invité : succès locaux. */
export function Profile() {
  const { t, i18n } = useTranslation();
  const online = useSession((s) => s.status === 'authenticated');
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [guest, setGuest] = useState<AchievementDto[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (online) metaApi.profile().then(setProfile, () => setError(true));
    else void guestAchievements().then(setGuest);
  }, [online]);

  if (error)
    return (
      <p className="error" role="alert">
        {t('leaderboard.error')}
      </p>
    );
  if (!online)
    return (
      <>
        <p className="hint">{t('profile.guestHint')}</p>
        {guest && <AchievementGrid achievements={guest} />}
      </>
    );
  if (!profile) return <p aria-live="polite">{t('auth.loading')}</p>;
  const { totals } = profile;
  return (
    <div className="profile">
      <h2>{profile.user.pseudo}</h2>
      <dl className="profile-stats">
        <div>
          <dt>{t('profile.games')}</dt>
          <dd>{totals.gamesPlayed}</dd>
        </div>
        <div>
          <dt>{t('profile.best')}</dt>
          <dd>{formatGauge('treasury', totals.bestValuation, i18n.language)}</dd>
        </div>
        {OUTCOMES.map((outcome) => (
          <div key={outcome}>
            <dt>{t(`end.outcomes.${outcome}`)}</dt>
            <dd>{totals.outcomes[outcome] ?? 0}</dd>
          </div>
        ))}
        {(Object.keys(totals.stats) as (keyof typeof totals.stats)[]).map((key) => (
          <div key={key}>
            <dt>{t(`profile.stats.${key}`)}</dt>
            <dd>{totals.stats[key]}</dd>
          </div>
        ))}
      </dl>
      <h2>{t('profile.bestGames')}</h2>
      {profile.bestGames.length === 0 ? (
        <p>{t('profile.noGames')}</p>
      ) : (
        <ol className="best-games">
          {profile.bestGames.map((game) => (
            <li key={game.id}>
              {t(`modes.${game.mode}.name`)} · {t(`end.outcomes.${game.outcome}`)} ·{' '}
              {formatGauge('treasury', game.valuation, i18n.language)} ·{' '}
              {new Date(game.createdAt).toLocaleDateString(i18n.language)}
            </li>
          ))}
        </ol>
      )}
      <h2>{t('achievements.title')}</h2>
      <AchievementGrid achievements={profile.achievements} />
    </div>
  );
}
