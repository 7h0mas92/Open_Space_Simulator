import { useTranslation } from 'react-i18next';
import type {
  DevStats,
  PerformanceGrade,
  PerformanceView,
  SprintPerformanceView,
} from '../../view/types';

/** Pastille de note (S, A, B, C, D). */
export function GradeBadge({
  grade,
  score,
  estimated,
}: {
  grade: PerformanceGrade;
  score: number;
  estimated: boolean;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={`grade grade-${grade}`}
      title={t('perf.badgeTitle', { score, label: t(`perf.grades.${grade}`) })}
    >
      <span aria-hidden="true">{grade}</span>
      <span className="visually-hidden">
        {t('perf.badgeTitle', { score, label: t(`perf.grades.${grade}`) })}
        {estimated ? ` (${t('perf.estimatedShort')})` : ''}
      </span>
    </span>
  );
}

const percent = (value: number) => `${Math.round(value)} %`;

/** Performance globale : note, productivité et qualité retenues. */
export function PerformancePanel({ performance }: { performance: PerformanceView }) {
  const { t } = useTranslation();
  const { grade, score, estimated } = performance;
  return (
    <section className="perf-panel" aria-labelledby="perf-title">
      <div className="perf-score">
        <GradeBadge grade={grade} score={score} estimated={estimated} />
        <div>
          <h4 id="perf-title">{t('perf.title')}</h4>
          <p className="perf-value">
            <strong>{score}</strong>/100 · {t(`perf.grades.${grade}`)}
          </p>
          <p className="hint">{estimated ? t('perf.estimated') : t('perf.measured')}</p>
        </div>
      </div>
      <span className="bar perf-bar" aria-hidden="true">
        <span className={`grade-fill-${grade}`} style={{ width: `${score}%` }} />
      </span>
      <dl className="facts">
        <div>
          <dt>{t('perf.productivity')}</dt>
          <dd>{percent(performance.productivity)}</dd>
        </div>
        <div>
          <dt>{t('perf.quality')}</dt>
          <dd>{percent(performance.quality * 100)}</dd>
        </div>
        <div>
          <dt>{t('perf.expected')}</dt>
          <dd>
            {percent(performance.expectedProductivity)} ·{' '}
            {percent(performance.expectedQuality * 100)}
          </dd>
        </div>
        {performance.incidents > 0 && (
          <div>
            <dt>{t('perf.incidents')}</dt>
            <dd className="danger-text">{performance.incidents}</dd>
          </div>
        )}
      </dl>
      <p className="hint">{t('perf.help')}</p>
    </section>
  );
}

function SprintCard({ sprint, label }: { sprint: SprintPerformanceView; label: string }) {
  const { t } = useTranslation();
  const hours = Math.round(sprint.hours);
  return (
    <article className="sprint-perf">
      <h5>
        {label} <span className="tag">{t('team.sprint', { sprint: sprint.sprint })}</span>
      </h5>
      {sprint.lost ? (
        <p className="hint">{t('perf.lostSprint')}</p>
      ) : sprint.productivity === null ? (
        <p className="hint">{t('perf.noTask')}</p>
      ) : (
        <>
          <p className="sprint-perf-value">{percent(sprint.productivity)}</p>
          <dl>
            <div>
              <dt>{t('perf.points')}</dt>
              <dd>{t('perf.pointsValue', { count: sprint.points, tasks: sprint.tasks })}</dd>
            </div>
            <div>
              <dt>{t('perf.hours')}</dt>
              <dd>{t('perf.hoursValue', { count: hours })}</dd>
            </div>
            {sprint.quality !== null && (
              <div>
                <dt>{t('perf.quality')}</dt>
                <dd>{percent(sprint.quality * 100)}</dd>
              </div>
            )}
          </dl>
        </>
      )}
      {sprint.incidents > 0 && (
        <p className="danger-text">{t('perf.incidentsValue', { count: sprint.incidents })}</p>
      )}
    </article>
  );
}

/** Productivité des 2 derniers sprints, côte à côte, puis le sprint en cours. */
export function SprintProductivity({ performance }: { performance: PerformanceView }) {
  const { t } = useTranslation();
  const [last, previous] = performance.lastSprints;
  const current = performance.current;
  return (
    <section aria-labelledby="sprint-perf-title">
      <h4 id="sprint-perf-title">{t('perf.sprintsTitle')}</h4>
      {last ? (
        <div className="sprint-perf-grid">
          <SprintCard sprint={last} label={t('perf.lastSprint')} />
          {previous ? (
            <SprintCard sprint={previous} label={t('perf.previousSprint')} />
          ) : (
            <article className="sprint-perf empty">
              <h5>{t('perf.previousSprint')}</h5>
              <p className="hint">{t('perf.notInTeam')}</p>
            </article>
          )}
        </div>
      ) : (
        <p className="hint">{t('perf.noSprintYet')}</p>
      )}
      {current && (
        <p className="sprint-perf-current">
          {current.productivity === null
            ? t('perf.currentIdle')
            : t('perf.current', {
                productivity: Math.round(current.productivity),
                hours: Math.round(current.hours),
                points: current.points,
              })}
        </p>
      )}
    </section>
  );
}

type StatName = keyof DevStats;

/** Points forts et points faibles, déduits des stats. */
export function strengthsOf(stats: DevStats): {
  strengths: StatName[];
  weaknesses: StatName[];
} {
  const strengths: StatName[] = [];
  const weaknesses: StatName[] = [];
  for (const stat of ['speed', 'quality', 'endurance'] as const) {
    if (stats[stat] >= 8) strengths.push(stat);
    if (stats[stat] <= 3) weaknesses.push(stat);
  }
  // L'ego est à l'envers : bas, c'est facile à vivre ; haut, ça négocie et ça se dispute.
  if (stats.ego <= 3) strengths.push('ego');
  if (stats.ego >= 8) weaknesses.push('ego');
  return { strengths, weaknesses };
}

export function Strengths({ stats }: { stats: DevStats }) {
  const { t } = useTranslation();
  const { strengths, weaknesses } = strengthsOf(stats);
  if (strengths.length === 0 && weaknesses.length === 0) return null;
  return (
    <ul className="chips" aria-label={t('perf.strengthsLabel')}>
      {strengths.map((stat) => (
        <li key={`s-${stat}`} className="chip good">
          + {t(`perf.strengths.${stat}`)}
        </li>
      ))}
      {weaknesses.map((stat) => (
        <li key={`w-${stat}`} className="chip bad">
          − {t(`perf.weaknesses.${stat}`)}
        </li>
      ))}
    </ul>
  );
}
