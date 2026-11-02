import { getRival } from '@oss/shared';
import { useTranslation } from 'react-i18next';
import type { MarketView } from '../../view/types';
import { formatGauge, localized } from '../game/format';

const YOU_COLOR = 'var(--accent)';

interface Line {
  readonly key: string;
  readonly color: string;
  readonly values: readonly number[];
}

/** Courbes d'utilisateurs comparées, alignées sur la dernière démo. */
function MarketChart({ lines, label }: { lines: readonly Line[]; label: string }) {
  const length = Math.max(...lines.map((line) => line.values.length), 0);
  if (length < 2) return null;
  const max = Math.max(1, ...lines.flatMap((line) => line.values));
  const path = (values: readonly number[]) =>
    values
      .map((value, index) => {
        const x = ((length - values.length + index) / (length - 1)) * 100;
        const y = 58 - (value / max) * 54;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  return (
    <svg className="market-chart" viewBox="0 0 100 60" preserveAspectRatio="none" role="img">
      <title>{label}</title>
      {lines
        .filter((line) => line.values.length > 1)
        .map((line) => (
          <polyline
            key={line.key}
            points={path(line.values)}
            fill="none"
            stroke={line.color}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
    </svg>
  );
}

/**
 * Panneau « Marché » de l'histoire : ta part du marché face aux startups rivales, les courbes
 * d'utilisateurs comparées et la dernière action de chaque rival.
 */
export function MarketPanel({ market, users }: { market: MarketView; users: number }) {
  const { t, i18n } = useTranslation();
  const lines: Line[] = [
    { key: 'you', color: YOU_COLOR, values: market.usersHistory },
    ...market.rivals
      .filter((rival) => rival.alive)
      .map((rival) => ({ key: rival.id, color: rival.color, values: rival.history })),
  ];
  const share = (value: number) => `${Math.round(value * 100)} %`;
  return (
    <div className="market-panel" data-testid="market-panel">
      <p className="market-share" role="status" data-testid="market-share">
        {t('story.market.yourShare', { share: share(market.share) })}
      </p>
      <MarketChart lines={lines} label={t('story.market.chart')} />
      <ul className="market-list">
        <li className="market-row" style={{ ['--rival-color' as string]: YOU_COLOR }}>
          <p className="market-row-head">
            <span aria-hidden="true">🚀 </span>
            <strong>{t('story.market.you')}</strong>
            <span className="market-users">{formatGauge('users', users, i18n.language)}</span>
          </p>
          <div className="market-bar" aria-hidden="true">
            <span style={{ width: `${Math.round(market.share * 100)}%` }} />
          </div>
        </li>
        {market.rivals.map((rival) => (
          <li
            key={rival.id}
            className={`market-row ${rival.alive ? '' : 'gone'}`}
            style={{ ['--rival-color' as string]: rival.color }}
            data-testid={`rival-${rival.id}`}
          >
            <p className="market-row-head">
              <span aria-hidden="true">{rival.icon} </span>
              <strong>{rival.name}</strong>
              <span className="market-users">
                {rival.alive
                  ? formatGauge('users', rival.users, i18n.language)
                  : rival.boughtBy
                    ? t('story.market.boughtBy', { name: getRival(rival.boughtBy).name })
                    : t('story.market.bankrupt')}
              </span>
            </p>
            {rival.alive && (
              <div className="market-bar" aria-hidden="true">
                <span style={{ width: `${Math.round(rival.share * 100)}%` }} />
              </div>
            )}
            <p className="hint">{localized(rival.tagline, i18n.language)}</p>
            {rival.alive && (
              <p className="market-meta">
                {t('story.market.rivalLine', {
                  share: share(rival.share),
                  valuation: formatGauge('treasury', rival.valuation, i18n.language),
                })}
              </p>
            )}
            {rival.lastAction && rival.lastActionSprint !== null && (
              <p className="market-action">
                {t('story.market.lastAction', {
                  sprint: rival.lastActionSprint,
                  action: t(`story.market.actions.${rival.lastAction}`),
                })}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
