import type { AchievementDto } from '@oss/shared';
import { useTranslation } from 'react-i18next';
import { localized } from '../game/format';

/** Grille des succès : débloqués en couleur, les autres grisés avec leur condition. */
export function AchievementGrid({ achievements }: { achievements: readonly AchievementDto[] }) {
  const { t, i18n } = useTranslation();
  const unlocked = achievements.filter((a) => a.unlockedAt !== null).length;
  return (
    <>
      <p>{t('achievements.progress', { unlocked, total: achievements.length })}</p>
      <ul className="achievement-grid">
        {achievements.map((achievement) => (
          <li
            key={achievement.id}
            className={achievement.unlockedAt ? 'unlocked' : 'locked'}
            data-testid={`achievement-${achievement.id}`}
          >
            <span className="achievement-icon" aria-hidden="true">
              {achievement.icon}
            </span>
            <div>
              <strong>{localized(achievement.title, i18n.language)}</strong>
              <small>{localized(achievement.description, i18n.language)}</small>
              <small className="achievement-status">
                {achievement.unlockedAt
                  ? t('achievements.unlockedOn', {
                      date: new Date(achievement.unlockedAt).toLocaleDateString(i18n.language),
                    })
                  : t('achievements.locked')}
              </small>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
