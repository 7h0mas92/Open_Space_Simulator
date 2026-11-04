import { useEffect, useRef, type ReactNode } from 'react';
import {
  STORY_MISSION_IDS,
  companyName,
  getStoryMission,
  getStoryReward,
  isEndless,
  type SprintObjective,
  STORY_ACT_IDS,
  getStoryAct,
  type CampaignResult,
  RETRO,
  type RetroAction,
  modeRules,
} from '@oss/shared';
import { MissionGoals } from '../story/MissionGoals';
import { useActLabel } from '../story/CampaignPanel';
import { resumeAct } from '../store/lifecycle';
import { useTranslation } from 'react-i18next';
import type {
  RetroView,
  DevView,
  EventView,
  GameView,
  GaugeName,
  PitchView,
  RaiseRequestView,
} from '../../view/types';
import { useObjectiveGoal } from '../kanban/Objective';
import { useGame } from '../store/game';
import { formatGauge, formatMoney, localized } from './format';
import { GAUGE_ICONS } from './Hud';
import { moodEmoji, StatBars } from '../team/StatBars';
import { CareerMilestones } from '../career/CareerPanel';
import { starsText } from '../career/records';
import { MarketShares } from '../story/MarketPanel';
import { SceneTranscript } from '../story/StoryScene';

/**
 * Écrans qui interrompent la partie : carte d'événement, levée de fonds, démo de fin de
 * sprint et fin de partie. Ils dépendent seulement de l'étape de la simulation.
 */
export function StageScreens({ view }: { view: GameView }) {
  switch (stageScreen(view)) {
    case 'end':
      return <EndScreen view={view} />;
    case 'pitch':
      return view.pitch && <PitchScreen pitch={view.pitch} />;
    case 'demo':
      return <DemoScreen view={view} />;
    case 'event':
      return (
        view.event && (
          <EventCardScreen event={view.event} hardcore={!modeRules(view.mode).cardsPauseTime} />
        )
      );
    case 'raise': {
      const request = view.raiseRequest;
      const dev = request && view.devs.find((candidate) => candidate.id === request.devId);
      return request && dev ? <RaiseScreen request={request} dev={dev} /> : null;
    }
    case 'retro':
      return view.retro && <RetroScreen retro={view.retro} devs={view.devs} />;
    default:
      return null;
  }
}

/** Écran d'étape affiché pour cet instantané, ou `null` quand la partie est jouable. */
export function stageScreen(
  view: GameView,
): 'end' | 'pitch' | 'demo' | 'event' | 'raise' | 'retro' | null {
  if (view.step === 'ENDED') return 'end';
  if (view.step === 'PITCH' && view.pitch) return 'pitch';
  if (view.step === 'DEMO') return 'demo';
  if (view.event) return 'event';
  if (view.step === 'PLANNING' && view.raiseRequest) return 'raise';
  if (view.step === 'PLANNING' && view.retro) return 'retro';
  return null;
}

/** Boîte de dialogue modale : le focus va sur le premier bouton pour jouer au clavier. */
function Dialog({
  title,
  className,
  tutorial,
  focusDialog = false,
  children,
}: {
  title: string;
  className: string;
  /** Repère pour le tutoriel (attribut `data-tutorial`). */
  tutorial?: string;
  /**
   * Focus sur la boîte elle-même plutôt que sur son premier bouton : une carte qui surgit ne
   * doit pas être tranchée par la touche Espace ou Entrée que le joueur tapait déjà.
   */
  focusDialog?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusDialog) ref.current?.focus({ preventScroll: true });
    else
      ref.current
        ?.querySelector<HTMLButtonElement>('button:not([disabled])')
        ?.focus({ preventScroll: true });
  }, [title, focusDialog]);
  return (
    <div className="stage-backdrop">
      <div
        ref={ref}
        className={`stage-screen ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-tutorial={tutorial}
        tabIndex={focusDialog ? -1 : undefined}
      >
        {children}
      </div>
    </div>
  );
}

const EFFECT_ORDER: readonly (GaugeName | 'moral')[] = [
  'treasury',
  'users',
  'hype',
  'stability',
  'debt',
  'coffee',
  'moral',
];

function EffectChips({ effects }: { effects: EventView['choices'][number]['effects'] }) {
  const { t, i18n } = useTranslation();
  const keys = EFFECT_ORDER.filter((key) => effects[key] !== undefined);
  if (keys.length === 0) return null;
  return (
    <ul className="effects">
      {keys.map((key) => {
        const value = effects[key] ?? 0;
        const good = key === 'debt' ? value < 0 : value > 0;
        const sign = value > 0 ? '+' : '−';
        const amount =
          key === 'treasury'
            ? formatGauge('treasury', Math.abs(value), i18n.language)
            : key === 'users'
              ? `${Math.abs(value)} %`
              : String(Math.abs(value));
        const label = key === 'moral' ? t('event.moral') : t(`gauges.${key}.name`);
        return (
          <li key={key} className={good ? 'up' : 'down'}>
            <span aria-hidden="true">{key === 'moral' ? '🙂' : GAUGE_ICONS[key]} </span>
            {label} {sign}
            {amount}
          </li>
        );
      })}
    </ul>
  );
}

function EventCardScreen({ event, hardcore }: { event: EventView; hardcore: boolean }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const title = localized(event.title, i18n.language);
  const count = event.choices.length;

  // Touches 1, 2, 3… : choisir sans quitter le clavier.
  useEffect(() => {
    const onKey = (keyEvent: KeyboardEvent) => {
      const index = Number(keyEvent.key) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= count) return;
      keyEvent.preventDefault();
      void dispatch({ type: 'resolveEvent', choiceIndex: index });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, dispatch]);

  return (
    <Dialog title={title} className="event-card" tutorial="event" focusDialog>
      <p className="eyebrow">
        <span aria-hidden="true">⚡ </span>
        {t('event.kicker')}
        {event.level > 0 && (
          <span className="badge"> {t('event.worse', { level: event.level })}</span>
        )}
      </p>
      <h2>{title}</h2>
      <p>{localized(event.description, i18n.language)}</p>
      <ul className="choices">
        {event.choices.map((choice, index) => (
          <li key={index}>
            <button
              type="button"
              className="choice"
              aria-keyshortcuts={String(index + 1)}
              onClick={() => void dispatch({ type: 'resolveEvent', choiceIndex: index })}
            >
              <span className="choice-key" aria-hidden="true">
                {index + 1}
              </span>
              <span className="choice-body">
                <strong>{localized(choice.label, i18n.language)}</strong>
                <EffectChips effects={choice.effects} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {/* Hors Hardcore, le temps est arrêté le temps de choisir (engine/host.ts). */}
      <p className={`event-clock ${hardcore ? 'is-running' : ''}`} data-testid="event-clock">
        <span aria-hidden="true">{hardcore ? '⏱ ' : '❚❚ '}</span>
        {t(hardcore ? 'event.hardcore' : 'event.paused')}
      </p>
    </Dialog>
  );
}

/** Un dev demande une augmentation : accepter ou refuser, avec les conséquences annoncées. */
function RaiseScreen({ request, dev }: { request: RaiseRequestView; dev: DevView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const money = (value: number) => `${formatMoney(value, i18n.language)} €`;
  const raise = request.requestedSalary - request.currentSalary;
  const percent = Math.round((raise / Math.max(1, request.currentSalary)) * 100);
  const title = t('raise.title', { name: dev.name });
  const answer = (accept: boolean) => void dispatch({ type: 'answerRaise', accept });

  // Touches 1 et 2 : répondre sans quitter le clavier, comme pour les cartes.
  useEffect(() => {
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== '1' && keyEvent.key !== '2') return;
      keyEvent.preventDefault();
      void dispatch({ type: 'answerRaise', accept: keyEvent.key === '1' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  return (
    <Dialog title={title} className="raise-screen">
      <p className="eyebrow">
        <span aria-hidden="true">💰 </span>
        {t('raise.kicker')}
      </p>
      <h2>{title}</h2>
      <p className="role">
        <span aria-hidden="true">{moodEmoji(dev.morale)} </span>
        {t(`roles.${dev.role}`)} · {t('team.level', { level: dev.level })}
      </p>
      <blockquote>{t(`raise.quotes.${dev.role}`)}</blockquote>
      <dl className="raise-salary">
        <dt>{t('raise.current')}</dt>
        <dd>{money(request.currentSalary)}</dd>
        <dt>{t('raise.requested')}</dt>
        <dd className="down">
          {money(request.requestedSalary)} (+{percent} %)
        </dd>
      </dl>
      <StatBars stats={dev.stats} />
      <ul className="choices">
        <li>
          <button
            type="button"
            className="choice"
            aria-keyshortcuts="1"
            onClick={() => answer(true)}
          >
            <span className="choice-key" aria-hidden="true">
              1
            </span>
            <span className="choice-body">
              <strong>{t('raise.accept')}</strong>
              <ul className="effects">
                <li className="down">{t('raise.cost', { amount: money(raise) })}</li>
                <li className="up">{t('raise.moral', { value: request.acceptMoral })}</li>
                <li className="up">{t('raise.skillsUp', { count: request.skillsGained })}</li>
              </ul>
            </span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className="choice"
            aria-keyshortcuts="2"
            onClick={() => answer(false)}
          >
            <span className="choice-key" aria-hidden="true">
              2
            </span>
            <span className="choice-body">
              <strong>{t('raise.refuse')}</strong>
              <ul className="effects">
                <li className="down">
                  {t('raise.resignRisk', {
                    percent: Math.round(request.resignChance * 100),
                    count: request.noticeSprints,
                  })}
                </li>
                <li className="down">{t('raise.skillsDown', { count: request.skillsLost })}</li>
              </ul>
            </span>
          </button>
        </li>
      </ul>
    </Dialog>
  );
}

/**
 * Rétrospective : 3 actions d'amélioration, les votes de l'équipe, et le choix du joueur
 * (suivre le vote, imposer une autre action, ou passer).
 */
function RetroScreen({ retro, devs }: { retro: RetroView; devs: readonly DevView[] }) {
  const { t } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const title = t('retro.title');
  const hold = (action: RetroAction | null) => void dispatch({ type: 'holdRetro', action });
  const names = (ids: readonly string[]) =>
    ids.map((id) => devs.find((dev) => dev.id === id)?.name ?? '?').join(', ');

  // Touches 1 à 3 : choisir une action ; 0 : passer.
  useEffect(() => {
    const onKey = (keyEvent: KeyboardEvent) => {
      const index = Number(keyEvent.key);
      if (!Number.isInteger(index) || index > retro.options.length) return;
      keyEvent.preventDefault();
      void dispatch({
        type: 'holdRetro',
        action: index === 0 ? null : (retro.options[index - 1]?.action ?? null),
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, retro]);

  return (
    <Dialog title={title} className="retro-screen">
      <p className="eyebrow">
        <span aria-hidden="true">🔁 </span>
        {t('retro.kicker')}
      </p>
      <h2>{title}</h2>
      <p>{t('retro.intro', { follow: RETRO.followMoral, impose: RETRO.imposeMoral })}</p>
      <ul className="choices">
        {retro.options.map(({ action, voters }, index) => (
          <li key={action}>
            <button
              type="button"
              className={`choice ${action === retro.winner ? 'is-winner' : ''}`}
              aria-keyshortcuts={String(index + 1)}
              onClick={() => hold(action)}
            >
              <span className="choice-key" aria-hidden="true">
                {index + 1}
              </span>
              <span className="choice-body">
                <strong>
                  {t(`retro.actions.${action}.name`)}
                  {action === retro.winner && (
                    <span className="retro-winner"> · {t('retro.teamChoice')}</span>
                  )}
                </strong>
                <span className="retro-problem">{t(`retro.actions.${action}.problem`)}</span>
                <ul className="effects">
                  <li className="up">{t(`retro.actions.${action}.effect`)}</li>
                </ul>
                <span className="retro-votes">
                  {voters.length > 0
                    ? t('retro.votes', { count: voters.length, names: names(voters) })
                    : t('retro.noVote')}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="stage-actions">
        <button type="button" aria-keyshortcuts="0" onClick={() => hold(null)}>
          {t('retro.skip')}
        </button>
      </div>
    </Dialog>
  );
}

/** Pastilles de difficulté d'un tour de table (●●●○○○). */
export function DifficultyDots({ tier, tiers }: { tier: number; tiers: number }) {
  const { t } = useTranslation();
  return (
    <span
      className="difficulty"
      role="img"
      aria-label={t('pitch.difficulty', { level: tier + 1, total: tiers })}
    >
      {Array.from({ length: tiers }, (_, index) => (
        <span key={index} className={index <= tier ? 'on' : 'off'} aria-hidden="true" />
      ))}
    </span>
  );
}

/** Pictogramme de la force d'un argument (fort, moyen, faible). */
export const RATING_ICONS = { strong: '▲', fair: '●', weak: '▼' } as const;

const REACTION_ICONS = { good: '👍', neutral: '😐', bad: '👎' } as const;

function PitchScreen({ pitch }: { pitch: PitchView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const name = localized(pitch.investor.name, i18n.language);
  const result = pitch.result;
  const round = localized(pitch.roundName, i18n.language);
  return (
    <Dialog title={t('pitch.title')} className="pitch-screen">
      <p className="eyebrow pitch-eyebrow">
        <span>{t('pitch.roundTitle', { round })}</span>
        <DifficultyDots tier={pitch.tier} tiers={pitch.tiers} />
      </p>
      <h2>{name}</h2>
      <blockquote>{localized(pitch.investor.intro, i18n.language)}</blockquote>
      <div className="pitch-interest">
        <span>{t('pitch.interest')}</span>
        <meter min={0} max={1} low={0.35} high={0.65} optimum={1} value={pitch.interest} />
        <strong>{Math.round(pitch.interest * 100)} %</strong>
      </div>
      {pitch.chosen.length > 0 && (
        <ol className="pitch-chosen">
          {pitch.chosen.map((answer, index) => (
            <li key={index} className={`reaction-${answer.reaction}`}>
              <span aria-label={t(`pitch.reactions.${answer.reaction}`)} role="img">
                {REACTION_ICONS[answer.reaction]}
              </span>{' '}
              {localized(answer.label, i18n.language)}
              {answer.offTopic && <span className="tag tag-warning">{t('pitch.offTopic')}</span>}
              {answer.bluffCaught && (
                <span className="tag tag-warning">{t('pitch.bluffCaught')}</span>
              )}
            </li>
          ))}
        </ol>
      )}
      {result ? (
        <>
          <p className={`pitch-result ${result.success ? 'up' : 'down'}`} role="status">
            {result.success
              ? t('pitch.success', {
                  amount: formatMoney(result.amount, i18n.language),
                  share: Math.round(result.dilution * 1000) / 10,
                })
              : pitch.walkedOut
                ? t('pitch.walkedOut')
                : t('pitch.failure')}
          </p>
          <button
            type="button"
            className="primary"
            onClick={() => void dispatch({ type: 'closePitch' })}
          >
            {t('pitch.close')}
          </button>
        </>
      ) : (
        <>
          <p className="pitch-round">
            {t('pitch.round', { round: pitch.round + 1, total: pitch.rounds })}
          </p>
          {pitch.question && (
            <p className="pitch-question">
              <span className={`tag category-${pitch.question.category}`}>
                {t(`pitch.categories.${pitch.question.category}`)}
              </span>
              {localized(pitch.question.text, i18n.language)}
            </p>
          )}
          <ul className="choices">
            {pitch.options.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className={`choice${option.bluff ? ' choice-bluff' : ''}`}
                  onClick={() => void dispatch({ type: 'pitchArgument', argumentId: option.id })}
                >
                  <span className="choice-body">
                    <strong>{localized(option.label, i18n.language)}</strong>
                    <span className="choice-tags">
                      <span className={`tag category-${option.category}`}>
                        {t(`pitch.categories.${option.category}`)}
                      </span>
                      <span
                        className={`tag pitch-rating rating-${option.rating}`}
                        title={t('pitch.ratingTitle', {
                          rating: t(`pitch.ratings.${option.rating}`),
                          basis: t(`pitch.basis.${option.basis}`),
                        })}
                      >
                        {RATING_ICONS[option.rating]} {t(`pitch.ratings.${option.rating}`)} ·{' '}
                        {t(`pitch.basis.${option.basis}`)}
                      </span>
                      {option.random && !option.bluff && (
                        <span className="tag">🎲 {t('pitch.random')}</span>
                      )}
                      {option.bluff && (
                        <span className="tag tag-warning">⚠ {t('pitch.bluffTag')}</span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}

/** Dev du sprint : le plus de points de tâches terminées pendant le sprint (null si personne). */
export function sprintMvp(
  devs: readonly DevView[],
  sprint: number,
): { name: string; points: number; tasks: number } | null {
  let best: { name: string; points: number; tasks: number } | null = null;
  for (const dev of devs) {
    const done = dev.performance.lastSprints.find((entry) => entry.sprint === sprint);
    if (!done || done.lost || done.points <= 0) continue;
    if (!best || done.points > best.points)
      best = { name: dev.name, points: done.points, tasks: done.tasks };
  }
  return best;
}

function DemoScreen({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const report = view.lastReport;
  const money = (value: number) => `${formatMoney(Math.round(value), i18n.language)} €`;
  const offer = view.acquisitionOffer;
  const mvp = report ? sprintMvp(view.devs, report.sprint) : null;
  return (
    <Dialog
      title={t('demo.title', { sprint: view.time.sprint })}
      className="demo-screen"
      tutorial="demo"
    >
      <p className="eyebrow">{t('steps.DEMO')}</p>
      <h2>{t('demo.title', { sprint: report?.sprint ?? view.time.sprint })}</h2>
      {report && (
        <>
          {report.lost && <p className="down">{t('demo.lost')}</p>}
          <dl className="demo-stats">
            <dt>{t('demo.users')}</dt>
            <dd>
              <span className="up">+{formatGauge('users', report.usersGained, i18n.language)}</span>{' '}
              <span className="down">−{formatGauge('users', report.usersLost, i18n.language)}</span>
            </dd>
            <dt>{t('demo.revenue')}</dt>
            <dd>{money(report.revenue)}</dd>
            <dt>{t('demo.expenses')}</dt>
            <dd>{money(report.expenses)}</dd>
            <dt>{t('demo.net')}</dt>
            <dd className={report.revenue >= report.expenses ? 'up' : 'down'}>
              {report.revenue >= report.expenses ? '+' : '−'}
              {money(Math.abs(report.revenue - report.expenses))}
            </dd>
            <dt>{t('gauges.hype.name')}</dt>
            <dd className={report.hypeDelta >= 0 ? 'up' : 'down'}>
              {report.hypeDelta >= 0 ? '+' : ''}
              {Math.round(report.hypeDelta)}
            </dd>
            <dt>{t('demo.features')}</dt>
            <dd>{report.featuresShipped}</dd>
            <dt>{t('demo.incidents')}</dt>
            <dd>{report.incidents}</dd>
            {(report.specialDone ?? 0) + (report.specialMissed ?? 0) > 0 && (
              <>
                <dt>{t('demo.special')}</dt>
                <dd>
                  {t('demo.specialValue', {
                    done: report.specialDone ?? 0,
                    missed: report.specialMissed ?? 0,
                  })}
                </dd>
              </>
            )}
            <dt>{t('demo.valuation')}</dt>
            <dd>{formatGauge('treasury', report.valuation, i18n.language)}</dd>
          </dl>
          {mvp && (
            <p className="demo-mvp">
              <span aria-hidden="true">🏆 </span>
              {t('demo.mvp', { name: mvp.name, count: mvp.tasks, points: mvp.points })}
            </p>
          )}
          {report.objective && <ObjectiveResult objective={report.objective} />}
          {report.feedback.length > 0 && (
            <>
              <h3>{t('demo.feedback')}</h3>
              <ul className="feedback">
                {/* Deux tirages peuvent tomber sur la même phrase : on ne l'affiche qu'une fois
                    (affichage seul, pour ne rien changer aux tirages de la partie). */}
                {[...new Set(report.feedback.map((line) => localized(line, i18n.language)))].map(
                  (line) => (
                    <li key={line}>{line}</li>
                  ),
                )}
              </ul>
            </>
          )}
        </>
      )}
      <div className="stage-actions">
        <button
          type="button"
          className="primary"
          onClick={() => void dispatch({ type: 'endDemo' })}
        >
          {t('demo.next')}
        </button>
        {view.canIpo && (
          <button type="button" onClick={() => void dispatch({ type: 'launchIpo' })}>
            🔔 {t('demo.ipo')}
          </button>
        )}
      </div>
      {offer && (
        <section className="acquisition" aria-label={t('demo.offerTitle')}>
          <h3>{t('demo.offerTitle')}</h3>
          <p>
            {t('demo.offer', {
              buyer: localized(offer.buyer, i18n.language),
              amount: formatGauge('treasury', offer.amount, i18n.language),
            })}
          </p>
          <div className="stage-actions">
            <button
              type="button"
              onClick={() => void dispatch({ type: 'answerAcquisition', accept: true })}
            >
              {t('demo.accept')}
            </button>
            <button
              type="button"
              onClick={() => void dispatch({ type: 'answerAcquisition', accept: false })}
            >
              {t('demo.refuse')}
            </button>
          </div>
        </section>
      )}
    </Dialog>
  );
}

/** Objectif du sprint à la démo : réussi (bonus encaissé) ou raté. */
function ObjectiveResult({ objective }: { objective: SprintObjective }) {
  const { t, i18n } = useTranslation();
  const goal = useObjectiveGoal()(objective);
  const success = objective.status === 'SUCCESS';
  const value = objective.value ?? 0;
  return (
    <p className={`demo-objective ${success ? 'up' : 'down'}`} data-testid="demo-objective">
      <span aria-hidden="true">🎯 </span>
      {success
        ? t('kanban.objective.success', {
            goal,
            money: formatGauge('treasury', objective.reward.treasury, i18n.language),
          })
        : objective.kind === 'ZERO_INCIDENT'
          ? t('kanban.objective.failedOutage', { goal, count: value })
          : t('kanban.objective.failed', { goal, value, target: objective.target })}
    </p>
  );
}

/** Où en est la publication du score (le serveur rejoue la partie pour la vérifier). */
function SubmissionStatus() {
  const { t } = useTranslation();
  const submission = useGame((s) => s.submission);
  switch (submission.status) {
    case 'idle':
    case 'replay':
      return null;
    case 'pending':
      return <p aria-live="polite">{t('end.submitting')}</p>;
    case 'guest':
      return <p className="hint">{t('end.guest')}</p>;
    case 'done':
      return (
        <p className="up" role="status">
          {t('end.rank', { rank: submission.rank })}
        </p>
      );
    case 'error':
      return (
        <p className="down" role="alert">
          {t('end.submitFailed')} ({t(`errors.${submission.code}` as never)})
        </p>
      );
  }
}

function EndScreen({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const start = useGame((s) => s.start);
  const quit = useGame((s) => s.quit);
  const notify = useGame((s) => s.notify);
  const replayOf = useGame((s) => s.replayOf);
  const result = view.result;
  if (!result) return null;
  const headline = localized(result.headline, i18n.language);
  const valuation = formatGauge('treasury', result.valuation, i18n.language);
  const endless = isEndless(view.mode);
  const company = companyName(view.seed);
  const sprints = endless ? String(result.sprint) : `${result.sprint}/${view.time.totalSprints}`;
  const sprintsLabel = endless ? t('end.sprintsEndless') : t('end.sprints');

  async function share() {
    if (!result) return;
    try {
      const { renderShareImage, shareImage } = await import('./shareImage');
      const blob = await renderShareImage({
        title: t('app.title'),
        headline,
        lines: [
          result.mission
            ? t(result.mission.success ? 'story.end.success' : 'story.end.failure')
            : result.campaign
              ? t(
                  result.campaign.success
                    ? `story.campaign.endings.${result.campaign.ending ?? 'IPO'}.title`
                    : 'story.campaign.end.failure',
                )
              : `${t(`end.outcomes.${result.outcome}`)} · ${valuation}`,
          ...(view.career && result.career
            ? [`${localized(view.career.name, i18n.language)} · ${starsText(result.career.stars)}`]
            : []),
          `${company} · ${t(`modes.${view.mode}.name`)} · ${sprintsLabel} ${sprints}`,
          t('end.shareAchievements', { count: view.achievements.length }),
        ],
        footer: window.location.host,
      });
      const how = await shareImage(blob, `${headline} — ${t('app.title')}`);
      if (how === 'downloaded') notify('end.downloaded', 'success');
    } catch {
      notify('end.shareFailed', 'error');
    }
  }

  if (result.mission) return <MissionEnd view={view} onShare={() => void share()} />;
  if (result.campaign)
    return <CampaignEnd view={view} result={result.campaign} onShare={() => void share()} />;

  return (
    <Dialog title={t(`end.outcomes.${result.outcome}`)} className="end-screen">
      <p className="eyebrow">
        {replayOf ? t('replay.endOf', { pseudo: replayOf }) : t('end.title')}
      </p>
      <h2>{t(`end.outcomes.${result.outcome}`)}</h2>
      <p className="headline">{headline}</p>
      <dl className="demo-stats">
        <dt>{t('leaderboard.company')}</dt>
        <dd>{company}</dd>
        <dt>{t('demo.valuation')}</dt>
        <dd>{valuation}</dd>
        <dt>{t('end.ownership')}</dt>
        <dd>{Math.round(result.ownership * 100)} %</dd>
        <dt>{sprintsLabel}</dt>
        <dd>{sprints}</dd>
        <dt>{t('achievements.title')}</dt>
        <dd>{view.achievements.length}</dd>
      </dl>
      {view.career && result.career && (
        <section className="career-end" aria-labelledby="career-end-title">
          <h3 id="career-end-title">
            <span aria-hidden="true">{view.career.icon} </span>
            {t('career.endTitle', { name: localized(view.career.name, i18n.language) })}
          </h3>
          <p className="career-end-stars">
            <span aria-hidden="true">{starsText(result.career.stars)} </span>
            {t(`career.stars.${result.career.stars}` as 'career.stars.0')}
          </p>
          <CareerMilestones career={view.career} />
        </section>
      )}
      <SubmissionStatus />
      <div className="stage-actions">
        {!replayOf && (
          <button type="button" className="primary" onClick={() => void share()}>
            📤 {t('end.share')}
          </button>
        )}
        {!replayOf && view.mode !== 'DAILY' && (
          <button
            type="button"
            onClick={() => void start({ mode: view.mode, legend: view.career?.legend })}
          >
            {t('end.again')}
          </button>
        )}
        <button type="button" onClick={quit}>
          {t('end.menu')}
        </button>
      </div>
    </Dialog>
  );
}

/**
 * Fin de la longue partie du mode Histoire : une des deux fins écrites, ou l'histoire arrêtée
 * (date limite dépassée, faillite, startup vendue trop tôt), avec la reprise de l'acte.
 */
function CampaignEnd({
  view,
  result,
  onShare,
}: {
  view: GameView;
  result: CampaignResult;
  onShare: () => void;
}) {
  const { t, i18n } = useTranslation();
  const start = useGame((s) => s.start);
  const quit = useGame((s) => s.quit);
  const notify = useGame((s) => s.notify);
  const replayOf = useGame((s) => s.replayOf);
  const label = useActLabel();
  const actIndex = STORY_ACT_IDS.indexOf(result.act);
  const act = getStoryAct(actIndex);
  const done = view.campaign?.done ?? [];
  const title = result.success
    ? t(`story.campaign.endings.${result.ending ?? 'IPO'}.title`)
    : t('story.campaign.end.failure');
  async function retry() {
    if (!(await resumeAct(actIndex))) notify('story.campaign.noCheckpoint', 'error');
  }
  return (
    <Dialog title={title} className="end-screen mission-end campaign-end">
      <p className="eyebrow">
        {act.icon} {label(actIndex)} · {localized(act.title, i18n.language)}
      </p>
      <h2 data-testid="campaign-outcome">{title}</h2>
      <p className="headline">{localized(view.result?.headline ?? act.title, i18n.language)}</p>
      {result.success && result.ending && (
        <p>{t(`story.campaign.endings.${result.ending}.text`)}</p>
      )}
      {result.freeSeasonSprints !== undefined && (
        <p className="mission-reward" data-testid="campaign-free-season-end">
          {t('story.campaign.end.freeSeason', { count: result.freeSeasonSprints })}
        </p>
      )}
      {result.success && result.ending && (
        <details className="campaign-end-scene">
          <summary>{t('story.campaign.end.replayScene')}</summary>
          <SceneTranscript scene={result.ending === 'IPO' ? 'ending-ipo' : 'ending-acquisition'} />
        </details>
      )}
      {view.campaign && view.campaign.market.rivals.length > 0 && (
        <section className="campaign-end-market" aria-label={t('story.campaign.end.rivals')}>
          <h3>{t('story.campaign.end.rivals')}</h3>
          <MarketShares market={view.campaign.market} />
        </section>
      )}
      {result.failure && (
        <p className="down">{t(`story.campaign.end.failures.${result.failure}`)}</p>
      )}
      <p className="mission-reward" data-testid="campaign-goals-done">
        {t('story.campaign.end.goals', { count: done.length, total: STORY_MISSION_IDS.length })}
      </p>
      <div className="stage-actions">
        {!replayOf && !result.success && (
          <button
            type="button"
            className="primary"
            onClick={() => void retry()}
            data-testid="campaign-retry"
          >
            ↻ {t('story.campaign.end.retry', { act: label(actIndex) })}
          </button>
        )}
        {!replayOf && (
          <button type="button" onClick={() => void start({ mode: 'STORY', mission: 'campaign' })}>
            ▶ {t('story.campaign.end.restart')}
          </button>
        )}
        {!replayOf && (
          <button type="button" onClick={onShare}>
            📤 {t('end.share')}
          </button>
        )}
        <button type="button" onClick={quit}>
          {t('end.menu')}
        </button>
      </div>
    </Dialog>
  );
}

/** Fin d'une mission du mode Histoire : réussie (récompense débloquée) ou ratée, et la suite. */
function MissionEnd({ view, onShare }: { view: GameView; onShare: () => void }) {
  const { t, i18n } = useTranslation();
  const start = useGame((s) => s.start);
  const quit = useGame((s) => s.quit);
  const replayOf = useGame((s) => s.replayOf);
  const outcome = view.result?.mission;
  const mission = outcome ? getStoryMission(outcome.id) : undefined;
  if (!view.result || !outcome || !mission) return null;
  const reward = getStoryReward(mission.reward);
  const index = STORY_MISSION_IDS.indexOf(mission.id);
  const next = outcome.success ? STORY_MISSION_IDS[index + 1] : undefined;
  const nextMission = next ? getStoryMission(next) : undefined;
  const title = t(outcome.success ? 'story.end.success' : 'story.end.failure');
  return (
    <Dialog title={title} className="end-screen mission-end">
      <p className="eyebrow">
        {mission.icon} {localized(mission.title, i18n.language)}
      </p>
      <h2 data-testid="mission-outcome">{title}</h2>
      <p className="headline">{localized(view.result.headline, i18n.language)}</p>
      {outcome.failure && <p className="down">{t(`story.end.failures.${outcome.failure}`)}</p>}
      {view.story && <MissionGoals goals={view.story.goals} constraints={view.story.constraints} />}
      {outcome.success && reward && (
        <p className="mission-reward up" role="status" data-testid="mission-reward">
          <span aria-hidden="true">{reward.icon} </span>
          {t('story.end.unlocked', { reward: localized(reward.name, i18n.language) })}
        </p>
      )}
      <div className="stage-actions">
        {!replayOf && nextMission && (
          <button
            type="button"
            className="primary"
            onClick={() => void start({ mode: 'STORY', mission: nextMission.id })}
            data-testid="mission-next"
          >
            ▶ {t('story.end.next', { mission: localized(nextMission.title, i18n.language) })}
          </button>
        )}
        {!replayOf && (
          <button type="button" onClick={() => void start({ mode: 'STORY', mission: mission.id })}>
            ↻ {t('story.end.retry')}
          </button>
        )}
        {!replayOf && (
          <button type="button" onClick={onShare}>
            📤 {t('end.share')}
          </button>
        )}
        <button type="button" onClick={quit}>
          {t('story.end.chapters')}
        </button>
      </div>
    </Dialog>
  );
}
