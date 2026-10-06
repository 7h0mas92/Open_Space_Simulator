import { useTranslation } from 'react-i18next';
import { GAUGES, type GameView, type GaugeName } from '../../view/types';
import { formatGauge } from '../game/format';

const WIDTH = 300;
const HEIGHT = 90;

/** Points d'une courbe SVG, normalisée dans le cadre du graphique. */
export function sparklinePoints(values: readonly number[], width = WIDTH, height = HEIGHT): string {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map(
      (value, i) =>
        `${(i * step).toFixed(1)},${(height - ((value - min) / range) * (height - 8) - 4).toFixed(1)}`,
    )
    .join(' ');
}

/** Historique de chaque jauge sous forme de graphique. */
export function Dashboard({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  if (view.history.length < 2) return <p>{t('dashboard.noData')}</p>;
  return (
    <div className="dashboard">
      <p className="hint">{t('dashboard.intro')}</p>
      <ul className="charts">
        {GAUGES.map((name: GaugeName) => {
          const values = view.history.map((entry) => entry[name]);
          const last = values.at(-1) ?? 0;
          return (
            <li key={name} className={`chart chart-${name}`}>
              <h3>
                {t(`gauges.${name}.name`)} <span>{formatGauge(name, last, i18n.language)}</span>
              </h3>
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                role="img"
                aria-label={`${t(`gauges.${name}.name`)} : ${values.map((v) => formatGauge(name, v, i18n.language)).join(', ')}`}
              >
                <polyline
                  points={sparklinePoints(values)}
                  fill="none"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
              </svg>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
