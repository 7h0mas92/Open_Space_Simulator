import { dirtLevel } from '../cleaning/Cleaning';
import { sprintOverloaded } from '../kanban/Kanban';
import {
  SEASONS,
  SPEEDS,
  companyName,
  isEndless,
  type Phase,
  type Speed,
  modeRules,
} from '@oss/shared';
import { useTranslation } from 'react-i18next';
import { GAUGES, isFridayFive, weekday, type GameView, type GaugeName } from '../../view/types';
import { useSlack } from '../../slack/store';
import { MODE_ICONS } from '../menu/ModePicker';
import { useGame, type PanelId } from '../store/game';
import {
  formatClock,
  formatGameDate,
  formatGauge,
  gaugeRatio,
  gaugeTrend,
  isGaugeCritical,
  localized,
  sprintProgress,
} from './format';
import { Tooltip } from './Tooltip';
import { useLiveTime } from './useLiveTime';

/*
 * HUD de la partie, en deux bandes :
 * - en haut, ce qu'on LIT : la startup (phase, équipe, autonomie), les six jauges, l'horloge
 *   et les boutons système (sauvegardes, options) ;
 * - en bas, ce qu'on FAIT : le dock d'actions (panneaux de jeu, construction) et la commande
 *   de l'étape en cours (lancer le sprint, lever des fonds, vitesses).
 * La disposition change avec la taille de l'écran (voir game.css), le contenu reste le même.
 */

/** Boutons du dock : le jeu lui-même. Sauvegardes et Options vont dans la barre du haut. */
const GAME_ACTIONS = [
  'kanban',
  'team',
  'hiring',
  'group',
  'meetings',
  'premises',
  'build',
  'slack',
] as const;
type GameAction = (typeof GAME_ACTIONS)[number];
const SYSTEM_PANELS = ['dashboard', 'business', 'saves', 'leaderboard', 'settings'] as const;

/** Icône de chaque bouton du HUD, reprise dans l'en-tête du panneau ouvert. */
export const PANEL_ICONS: Record<PanelId | 'build', string> = {
  kanban: '🗂️',
  team: '🧑‍💻',
  hiring: '🤝',
  group: '🏛️',
  meetings: '🗓️',
  premises: '🏢',
  tickets: '📽️',
  pets: '🐈',
  servers: '🗄️',
  lobby: '🛎️',
  cleaning: '🧹',
  business: '💶',
  subscriptions: '🧾',
  funding: '💼',
  career: '🧭',
  mission: '🎯',
  market: '📈',
  research: '🔬',
  build: '🛠️',
  dashboard: '📈',
  slack: '💬',
  saves: '💾',
  leaderboard: '🏆',
  settings: '⚙️',
  credits: '©️',
};

export const GAUGE_ICONS: Record<GaugeName, string> = {
  treasury: '💰',
  coffee: '☕',
  debt: '🧱',
  stability: '🛡️',
  hype: '🔥',
  users: '👥',
};

const PHASE_ICONS: Record<Phase, string> = {
  GARAGE: '🏚️',
  SEED: '🌱',
  SERIES_A: '🏢',
  UNICORN: '🦄',
  END: '🏁',
};

/** La startup : phase, mode de jeu, place dans l'équipe et mois de salaires en caisse. */
export function Company({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const months = view.runwayMonths === null ? null : Math.floor(view.runwayMonths);
  const phase = t(`phases.${view.phase}`);
  const mode = t(`modes.${view.mode}.name`);
  const valuation = formatGauge('treasury', view.valuation, i18n.language);
  const short = months !== null && months < 3;
  return (
    <div className="hud-company">
      <Tooltip
        text={[
          t('hud.company', { name: companyName(view.seed) }),
          t('hud.phase', { phase }),
          t('hud.mode', { mode }),
          t('hud.team', { count: view.devs.length, max: view.teamMax }),
          months === null ? t('hud.runwayNone') : t('hud.runwayLong', { months }),
          t('hud.valuation', { value: valuation }),
          ...(view.group.wings > 0 ? [t('hud.group', { count: view.group.ventures.length })] : []),
        ].join(' · ')}
      >
        <span className="company-phase" aria-hidden="true">
          {PHASE_ICONS[view.phase]}
        </span>
        <span className="company-text">
          <strong className="company-name" aria-hidden="true">
            {phase}
            {view.group.wings > 0 && (
              <span className="company-group" title={t('hud.groupShort')}>
                {' '}
                🏛️
              </span>
            )}
          </strong>
          <span className="visually-hidden">{t('hud.phase', { phase })}</span>
          {view.mode !== 'NORMAL' && (
            <span className="company-mode" title={t('hud.mode', { mode })}>
              {MODE_ICONS[view.mode]} <span className="company-mode-name">{mode}</span>
            </span>
          )}
        </span>
      </Tooltip>
      <p className="company-facts">
        <span
          className={`company-team ${view.devs.length >= view.teamMax ? 'full' : ''}`}
          title={t('hud.team', { count: view.devs.length, max: view.teamMax })}
        >
          <span aria-hidden="true">🧑‍💻 </span>
          <span className="visually-hidden">
            {t('hud.team', { count: view.devs.length, max: view.teamMax })}
          </span>
          <span aria-hidden="true">
            {view.devs.length}/{view.teamMax}
          </span>
        </span>
        <span
          className={`company-runway ${short ? 'critical' : ''}`}
          title={months === null ? t('hud.runwayNone') : t('hud.runwayHelp')}
        >
          <span aria-hidden="true">⏳ </span>
          {months === null ? '∞' : t('hud.runway', { months })}
        </span>
      </p>
    </div>
  );
}

/** Les six jauges : icône, valeur, tendance et barre. Le nom complet est dans l'infobulle. */
export function Gauges({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  return (
    <ul className="gauges" aria-label={t('game.gauges')} data-tutorial="gauges">
      {GAUGES.map((name) => {
        const value = view.gauges[name];
        const critical = isGaugeCritical(name, value);
        const trend = gaugeTrend(view, name);
        // La dette qui monte est une mauvaise nouvelle : la couleur suit le sens du bien.
        const good = trend === 0 ? null : name === 'debt' ? trend < 0 : trend > 0;
        return (
          <li key={name} className={`gauge gauge-${name} ${critical ? 'critical' : ''}`}>
            <Tooltip text={t(`gauges.${name}.help`)}>
              <span className="gauge-icon" aria-hidden="true">
                {GAUGE_ICONS[name]}
              </span>
              <span className="visually-hidden">{t(`gauges.${name}.name`)}</span>
              <span className="gauge-label" aria-hidden="true">
                {t(`gauges.${name}.short`)}
              </span>
              <span className="gauge-value" data-testid={`gauge-${name}`}>
                {formatGauge(name, value, i18n.language)}
              </span>
              {good !== null && (
                <span className={`gauge-trend ${good ? 'good' : 'bad'}`}>
                  <span aria-hidden="true">{trend > 0 ? '▲' : '▼'}</span>
                  <span className="visually-hidden">
                    {t(trend > 0 ? 'hud.trendUp' : 'hud.trendDown')}
                  </span>
                </span>
              )}
              <span className="gauge-bar" aria-hidden="true">
                <span style={{ width: `${gaugeRatio(name, value) * 100}%` }} />
              </span>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

/** Date du jour simulé, périodes à thème en cours (🎃, 🎄…) et anniversaires (🎂). */
function CalendarLine({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const { date, seasons, birthdays, holiday } = view.calendar;
  const names = view.devs.filter((dev) => birthdays.includes(dev.id)).map((dev) => dev.name);
  return (
    <p className="clock-line clock-calendar">
      <span>{formatGameDate(date, i18n.language)}</span>
      {holiday && (
        <span
          className="clock-season"
          title={t('leave.holiday', { name: t(`leave.holidays.${holiday}`) })}
        >
          <span aria-hidden="true">🏖️</span>
          <span className="visually-hidden">
            {t('leave.holiday', { name: t(`leave.holidays.${holiday}`) })}
          </span>
        </span>
      )}
      {seasons.map((theme) => {
        const label = localized(SEASONS[theme].name, i18n.language);
        return (
          <span key={theme} className="clock-season" title={label}>
            <span aria-hidden="true">{SEASONS[theme].icon}</span>
            <span className="visually-hidden">{label}</span>
          </span>
        );
      })}
      {view.retroAction && (
        <span
          className="clock-season"
          title={t('retro.active', { action: t(`retro.actions.${view.retroAction}.name`) })}
        >
          <span aria-hidden="true">🔁</span>
          <span className="visually-hidden">
            {t('retro.active', { action: t(`retro.actions.${view.retroAction}.name`) })}
          </span>
        </span>
      )}
      {names.length > 0 && (
        <span className="clock-season" title={t('time.birthday', { names: names.join(', ') })}>
          <span aria-hidden="true">🎂</span>
          <span className="visually-hidden">{t('time.birthday', { names: names.join(', ') })}</span>
        </span>
      )}
    </p>
  );
}

/** Horloge : sprint, jour, heure, étape et avancement du sprint. */
export function Clock({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const days = t('time.days', { returnObjects: true }) as unknown as string[];
  const { time } = view;
  // L'heure défile minute par minute entre deux pas de simulation (30 min).
  const live = useLiveTime(time);
  const percent = Math.round(sprintProgress(live) * 100);
  return (
    <div className="clock" data-tutorial="clock" aria-live="off">
      <p className="clock-line">
        <strong>
          {isEndless(view.mode) || view.campaign?.freeSeason
            ? t('time.sprintEndless', { sprint: time.sprint })
            : t('time.sprint', { sprint: time.sprint, total: time.totalSprints })}
        </strong>
        <span className={`clock-time ${isFridayFive(live) ? 'friday' : ''}`}>
          {t('time.day', { day: days[weekday(live.day)] ?? '', time: formatClock(live.minute) })}
        </span>
      </p>
      <CalendarLine view={view} />
      <p className="clock-line">
        <span className={`step step-${view.step}`}>{t(`steps.${view.step}`)}</span>
        <span
          className="sprint-progress"
          role="progressbar"
          aria-label={t('hud.sprintProgress', { percent })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span style={{ width: `${percent}%` }} />
        </span>
      </p>
    </div>
  );
}

/** Sauvegardes et options : des boutons-icônes en haut, à l'écart des actions de jeu. */
export function SystemButtons({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const panel = useGame((s) => s.panel);
  const openPanel = useGame((s) => s.openPanel);
  const replay = useGame((s) => s.replayOf !== null);
  // Mode Histoire : la mission (objectifs en direct) est à un clic, avant les sauvegardes.
  const story = useGame((s) => s.view?.mode === 'STORY');
  // Histoire en actes : le marché (rivaux) à côté de la mission.
  const campaign = useGame((s) => s.view?.campaign !== null && s.view?.campaign !== undefined);
  const system = replay ? SYSTEM_PANELS.filter((id) => id !== 'saves') : SYSTEM_PANELS;
  // Arbre R&D : dans tous les modes qui en ont un (pas les missions courtes, ni les vieilles parties).
  const research = view.research !== null;
  const panels: readonly PanelId[] = campaign
    ? ['mission', 'market', 'research', ...system]
    : story
      ? ['mission', ...system]
      : research
        ? ['research', ...system]
        : system;
  const career = view.career;
  return (
    <div className="hud-system" role="group" aria-label={t('hud.system')}>
      <CleaningButton view={view} />
      {career && (
        // Mode Carrière : les jalons de la légende, à portée de clic.
        <button
          type="button"
          className="system-button career-button"
          aria-pressed={panel === 'career'}
          aria-label={t('career.hudButton', { done: career.done, total: career.total })}
          title={t('career.hudButton', { done: career.done, total: career.total })}
          data-tutorial="panel-career"
          onClick={() => openPanel(panel === 'career' ? null : 'career')}
        >
          <span aria-hidden="true">{PANEL_ICONS.career}</span>
          <span className="career-button-count" aria-hidden="true">
            {career.done}/{career.total}
          </span>
        </button>
      )}
      {panels.map((id) => (
        <button
          key={id}
          type="button"
          className="system-button"
          aria-pressed={panel === id}
          aria-label={t(`panels.${id}`)}
          title={t(`panels.${id}`)}
          data-tutorial={`panel-${id}`}
          onClick={() => openPanel(panel === id ? null : id)}
        >
          <span aria-hidden="true">{PANEL_ICONS[id]}</span>
        </button>
      ))}
    </div>
  );
}

/** Ménage : un bouton-icône avec la saleté du bureau, qui ouvre le panneau Ménage. */
function CleaningButton({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const panel = useGame((s) => s.panel);
  const openPanel = useGame((s) => s.openPanel);
  const percent = Math.round(view.cleaning.dirt);
  const level = dirtLevel(view.cleaning);
  const label = t('cleaning.button', { percent });
  return (
    <button
      type="button"
      className={`system-button cleaning-button dirt-${level}`}
      aria-pressed={panel === 'cleaning'}
      aria-label={label}
      title={label}
      data-testid="open-cleaning"
      onClick={() => openPanel(panel === 'cleaning' ? null : 'cleaning')}
    >
      <span aria-hidden="true">{view.cleaning.visit ? '🫧' : PANEL_ICONS.cleaning}</span>
      <span className="dirt-badge" aria-hidden="true">
        {percent}
      </span>
    </button>
  );
}

/** Commande de l'étape : lancer le sprint et lever des fonds, ou les vitesses du temps. */
export function StepControls({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const panel = useGame((s) => s.panel);
  const openPanel = useGame((s) => s.openPanel);
  const { time } = view;
  const setSpeed = (speed: Speed) => void dispatch({ type: 'setSpeed', speed });
  if (view.step === 'PLANNING') {
    const overloaded = sprintOverloaded(view.sprintLoad);
    return (
      <div className="step-controls planning-actions" data-tutorial="speed">
        <button
          type="button"
          className={`primary start-sprint${overloaded ? ' overloaded' : ''}`}
          title={
            overloaded
              ? t('kanban.overload', {
                  planned: view.sprintLoad.planned,
                  capacity: view.sprintLoad.capacity,
                })
              : undefined
          }
          onClick={() => void dispatch({ type: 'startSprint' })}
          data-tutorial="start"
        >
          <span aria-hidden="true">▶</span> {t('time.startSprint')}
        </button>
        <button
          type="button"
          className="pitch-button"
          aria-pressed={panel === 'funding'}
          onClick={() => openPanel(panel === 'funding' ? null : 'funding')}
          data-tutorial="pitch"
        >
          <span aria-hidden="true">💼</span>
          <span className="pitch-label">{t('pitch.open')}</span>
          <span className="pitch-label-short" aria-hidden="true">
            {t('pitch.short')}
          </span>
        </button>
      </div>
    );
  }
  return (
    <div
      className="step-controls speeds"
      role="group"
      aria-label={t('time.speeds')}
      data-tutorial="speed"
    >
      {SPEEDS.map((speed) => (
        <button
          key={speed}
          type="button"
          aria-pressed={time.speed === speed}
          aria-label={speed === 0 ? t('time.pause') : t('time.speed', { speed })}
          disabled={speed === 0 && !modeRules(view.mode).canPause}
          onClick={() => setSpeed(speed)}
        >
          {speed === 0 ? '❚❚' : `x${speed}`}
        </button>
      ))}
    </div>
  );
}

/** Dock d'actions : les panneaux du jeu et la construction, icône et libellé court. */
export function ActionBar() {
  const { t } = useTranslation();
  const panel = useGame((s) => s.panel);
  const replay = useGame((s) => s.replayOf !== null);
  const unread = useSlack((s) => s.unread.general + s.unread.random + s.unread.incidents);
  // En replay, seuls les panneaux de consultation restent utiles.
  const hidden = new Set<GameAction>(replay ? ['hiring', 'build'] : []);
  const openPanel = useGame((s) => s.openPanel);
  const enterBuild = useGame((s) => s.enterBuild);
  return (
    <nav className="action-bar" aria-label={t('panels.actions')}>
      {GAME_ACTIONS.filter((id) => !hidden.has(id)).map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={panel === id}
          data-tutorial={`panel-${id}`}
          aria-keyshortcuts={id === 'build' ? 'B' : undefined}
          onClick={() => {
            if (id === 'build') enterBuild();
            else openPanel(panel === id ? null : (id satisfies PanelId));
          }}
        >
          <span className="icon" aria-hidden="true">
            {PANEL_ICONS[id]}
          </span>
          <span className="visually-hidden">{t(`panels.${id}`)}</span>
          <span className="label" aria-hidden="true">
            {t(`panels.short.${id}`)}
          </span>
          {id === 'slack' && unread > 0 && (
            <span className="unread" aria-label={t('slack.unread', { count: unread })}>
              {unread}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

/** Bandeaux d'ambiance : vendredi 17h et incident en production (écran rouge clignotant). */
export function Alerts({ view }: { view: GameView }) {
  const { t } = useTranslation();
  return (
    <>
      {view.incident && <div className="incident-flash" aria-hidden="true" />}
      <div className="alerts" role="status" aria-live="polite">
        {view.incident && <p className="alert alert-incident">🔥 {t('time.incident')}</p>}
        {!view.incident && isFridayFive(view.time) && (
          <p className="alert alert-friday">⚠ {t('time.friday')}</p>
        )}
      </div>
      <UrgentBanner view={view} />
    </>
  );
}

/** Tâches urgentes ouvertes : un bandeau au-dessus du dock, qui ouvre le Kanban. */
function UrgentBanner({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const openPanel = useGame((s) => s.openPanel);
  const panel = useGame((s) => s.panel);
  const urgent = view.tasks
    .filter((task) => task.kind === 'URGENT' && task.column !== 'DONE')
    .sort((a, b) => (a.hoursLeft ?? 0) - (b.hoursLeft ?? 0));
  const first = urgent[0];
  // Panneau ouvert (Kanban compris) : le bandeau s'efface pour ne rien masquer.
  if (view.step !== 'EXECUTION' || !first || panel !== null) return null;
  const due = t('kanban.hoursLeft', { hours: Math.ceil(first.hoursLeft ?? 0) });
  const task = localized(first.title, i18n.language);
  return (
    <button
      type="button"
      className="urgent-banner"
      data-testid="urgent-banner"
      onClick={() => openPanel('kanban')}
    >
      <span aria-hidden="true">🚨</span>
      <span className="urgent-text">
        {urgent.length > 1
          ? t('time.urgentMore', { task, count: urgent.length - 1, due })
          : t('time.urgent', { task, due })}
      </span>
    </button>
  );
}
