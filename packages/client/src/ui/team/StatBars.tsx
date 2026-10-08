import { useTranslation } from 'react-i18next';
import type { DevStats } from '../../view/types';

const STATS = ['speed', 'quality', 'endurance', 'ego'] as const;

/** Barres de stats d'un dev ou d'un candidat (stats de 1 à 10). */
export function StatBars({ stats }: { stats: DevStats }) {
  const { t } = useTranslation();
  return (
    <dl className="stat-bars">
      {STATS.map((stat) => (
        <div key={stat} className="stat">
          <dt>{t(`stats.${stat}`)}</dt>
          <dd>
            <span className="bar" aria-hidden="true">
              <span style={{ width: `${stats[stat] * 10}%` }} />
            </span>
            <span className="value">{stats[stat]}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function moodEmoji(morale: number): string {
  if (morale >= 75) return '😄';
  if (morale >= 50) return '🙂';
  if (morale >= 25) return '😐';
  return '😩';
}
