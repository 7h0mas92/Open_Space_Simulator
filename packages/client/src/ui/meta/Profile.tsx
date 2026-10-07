import { OUTCOMES, type AchievementDto, type ProfileResponse } from '@oss/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { metaApi } from '../../api/meta';
import { formatGauge } from '../game/format';
import { useSession } from '../store/session';
import { AchievementProgress, loadAchievements } from './Achievements';

/** Résumé des succès, avec un lien vers l'écran complet. */
function AchievementSummary({
  achievements,
  onOpen,
}: {
  achievements: readonly AchievementDto[];
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <AchievementProgress achievements={achievements} />
      <button type="button" onClick={onOpen}>
        🏅 {t('achievements.open')}
      </button>
    </>
  );
}

/** Profil : statistiques cumulées, meilleures parties et résumé des succès. */
export function Profile({ onOpenAchievements }: { onOpenAchievements: () => void }) {
  const { t, i18n } = useTranslation();
  const online = useSession((s) => s.status === 'authenticated');
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [guest, setGuest] = useState<AchievementDto[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (online) metaApi.profile().then(setProfile, () => setError(true));
    else void loadAchievements().then(setGuest);
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
        {guest && <AchievementSummary achievements={guest} onOpen={onOpenAchievements} />}
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
      <AchievementSummary achievements={profile.achievements} onOpen={onOpenAchievements} />
    </div>
  );
}
