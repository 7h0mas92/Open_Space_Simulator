import type { GameMode } from '@oss/shared';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameView } from '../../view/types';
import { useGame } from '../store/game';
import { useGuide } from '../store/guide';
import { useSettings } from '../store/settings';
import {
  CORE_LESSONS,
  LESSON_GROUPS,
  LESSON_IDS,
  getLesson,
  isGoalMet,
  nextLesson,
  stepsOf,
  type GuideBaseline,
  type LessonId,
} from './lessons';

/** Délai avant de passer à l'étape suivante une fois l'action faite (le temps de voir le ✓). */
const ADVANCE_DELAY_MS = 900;

function baselineOf(view: GameView): GuideBaseline {
  return { speed: view.time.speed, items: view.items.length };
}

/** Termine le chapitre ouvert ; relance le temps si c'est le tutoriel qui l'avait arrêté. */
function finishLesson(): void {
  const state = useGuide.getState();
  const game = useGame.getState();
  if (state.pausedByGuide) {
    state.setPausedByGuide(false);
    const view = game.view;
    if (view?.step === 'EXECUTION' && view.time.speed === 0 && !view.event) {
      void game.dispatch({ type: 'setSpeed', speed: 1 });
    }
  }
  state.finish();
  // Les chapitres essentiels sont lus : les prochaines parties ne montreront plus que les
  // règles de leur mode.
  const { seen } = useGuide.getState();
  if (CORE_LESSONS.every((id) => seen.includes(id)))
    useSettings.getState().update({ tutorialDone: true });
}

/** Le joueur arrête le tutoriel : il ne se relancera plus tout seul. */
function stopGuide(): void {
  useGuide.getState().stop();
  useSettings.getState().update({ tutorialDone: true });
}

/** Étape suivante, ou fin du chapitre après la dernière. */
function advance(): void {
  const state = useGuide.getState();
  const view = useGame.getState().view;
  if (!state.active || !view) return;
  const steps = stepsOf(getLesson(state.active.lesson), view.mode);
  if (state.active.step + 1 >= steps.length) finishLesson();
  else state.goTo(state.active.step + 1, baselineOf(view));
}

/** Un paragraphe dont toutes les lignes commencent par « • » ou « 1. » devient une liste. */
function Body({ text }: { text: string }) {
  return (
    <div className="guide-body">
      {text.split('\n\n').map((paragraph, index) => {
        const lines = paragraph.split('\n');
        const bullets = lines.every((line) => /^(• |\d+\. )/.test(line));
        if (!bullets) return <p key={index}>{paragraph}</p>;
        const ordered = lines[0]?.startsWith('1.') ?? false;
        const items = lines.map((line) => <li key={line}>{line.replace(/^(• |\d+\. )/, '')}</li>);
        return ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>;
      })}
    </div>
  );
}

/** Ce que l'étape demande au joueur, puis « Bien joué ! » une fois l'action faite. */
function Task({ done, text }: { done: boolean; text: string }) {
  const { t } = useTranslation();
  return (
    <p className={done ? 'guide-task done' : 'guide-task'} role="status">
      {done ? `✓ ${t('guide.doneTitle')}` : `👉 ${t('guide.yourTurn')} : ${text}`}
    </p>
  );
}

/**
 * Traduction d'une clé construite à l'exécution (les clés sont vérifiées par les tests).
 * `field` cherche d'abord le texte propre au mode (`<clé>.<MODE>.<champ>`), puis le texte commun.
 */
function useText(mode: GameMode | undefined) {
  const { t, i18n } = useTranslation();
  const params = mode ? { mode: String(t(`modes.${mode}.name`)) } : {};
  const text = (key: string): string => String(t(key as never, params as never));
  return {
    text,
    field: (key: string, name: 'title' | 'body' | 'do'): string | null => {
      if (mode && i18n.exists(`${key}.${mode}.${name}`)) return text(`${key}.${mode}.${name}`);
      return i18n.exists(`${key}.${name}`) ? text(`${key}.${name}`) : null;
    },
  };
}

/**
 * Tutoriel complet. En mode Facile, chaque chapitre s'ouvre tout seul au bon moment et met
 * la partie en pause le temps de l'explication. Dans tous les modes, un chapitre peut être
 * rouvert depuis le Guide du jeu (Options).
 */
export function Guide({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const { text, field } = useText(view.mode);
  const guide = useGuide();
  const panel = useGame((s) => s.panel);
  const building = useGame((s) => s.build !== null);
  const selected = useGame((s) => s.selected);
  const dispatch = useGame((s) => s.dispatch);
  const { active } = guide;
  const lesson = active ? getLesson(active.lesson) : null;
  const steps = lesson ? stepsOf(lesson, view.mode) : [];
  const step = active ? steps[active.step] : undefined;
  const running = view.step === 'EXECUTION' && view.time.speed !== 0;

  // Suit la partie en cours : une nouvelle graine, c'est une nouvelle partie.
  useEffect(() => {
    if (useGuide.getState().seed !== view.seed) {
      // Tout le tutoriel en Facile ou pour un nouveau joueur ; sinon, les règles du mode.
      const full = view.mode === 'EASY' || !useSettings.getState().tutorialDone;
      useGuide.getState().follow(view.seed, full ? 'full' : 'mode');
    }
  }, [view.seed, view.mode]);

  // Ouvre le prochain chapitre quand son moment arrive.
  useEffect(() => {
    const state = useGuide.getState();
    if (state.seed !== view.seed || !state.autoplay || state.active) return;
    const id = nextLesson(view, new Set(state.seen), state.scope);
    if (id) state.open(id, baselineOf(view), false);
  });

  // La partie se met en pause à l'ouverture d'un chapitre (sauf en Hardcore : jamais de pause).
  const lessonId = active?.lesson ?? null;
  useEffect(() => {
    if (!lessonId || view.mode === 'HARDCORE' || !running) return;
    useGuide.getState().setPausedByGuide(true);
    void dispatch({ type: 'setSpeed', speed: 0 });
    // Seule l'ouverture du chapitre compte : le joueur reste libre de relancer le temps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  const previous = () => {
    if (active && active.step > 0) guide.goTo(active.step - 1, baselineOf(view));
  };

  const accomplished =
    step !== undefined &&
    active !== null &&
    isGoalMet(step, {
      view,
      panel,
      building,
      selectedDev: selected?.type === 'dev',
      baseline: active.baseline,
    });

  // L'écran se redessine sans cesse (horloge, fps) : le minuteur ne dépend que de l'étape.
  const stepIndex = active?.step ?? -1;
  useEffect(() => {
    if (!accomplished) return undefined;
    const timer = window.setTimeout(advance, ADVANCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [accomplished, lessonId, stepIndex]);

  // Met en évidence l'élément dont parle l'étape.
  const target = guide.minimized ? undefined : step?.target;
  useEffect(() => {
    if (!target) return undefined;
    const element = document.querySelector(`[data-tutorial="${target}"]`);
    element?.classList.add('guide-target');
    return () => element?.classList.remove('guide-target');
  }, [target, panel, view.step, view.event]);

  if (!active || !lesson || !step) return null;

  const base = `guide.lessons.${lesson.id}`;
  const stepKey = `${base}.steps.${step.id}`;
  if (guide.minimized) {
    return (
      <button type="button" className="guide-pill" onClick={() => guide.setMinimized(false)}>
        📖 {t('guide.resume')}
      </button>
    );
  }

  const last = active.step + 1 >= steps.length;
  const task = step.goal ? field(stepKey, 'do') : null;
  const chapter = LESSON_IDS.indexOf(lesson.id) + 1;

  return (
    <aside className="guide" aria-labelledby="guide-step-title" data-testid="guide">
      <header className="guide-header">
        <p className="guide-kicker">
          📖 {t('guide.chapter', { n: chapter, total: LESSON_IDS.length })} ·{' '}
          {text(`${base}.title`)}
        </p>
        <button
          type="button"
          className="guide-minimize"
          onClick={() => guide.setMinimized(true)}
          aria-label={t('guide.minimize')}
          title={t('guide.minimize')}
        >
          –
        </button>
      </header>
      <h2 id="guide-step-title">{field(stepKey, 'title')}</h2>
      <p className="guide-progress">
        {t('guide.step', { n: active.step + 1, total: steps.length })}
      </p>
      <Body text={field(stepKey, 'body') ?? ''} />
      {task !== null && <Task done={accomplished} text={task} />}
      {guide.pausedByGuide && view.time.speed === 0 && (
        <p className="guide-paused">❚❚ {t('guide.paused')}</p>
      )}
      <div className="guide-actions">
        {!active.manual && guide.autoplay && (
          <button type="button" className="guide-stop" onClick={stopGuide}>
            {t('guide.stop')}
          </button>
        )}
        <button type="button" onClick={previous} disabled={active.step === 0}>
          {t('guide.prev')}
        </button>
        <button type="button" className="primary" onClick={advance}>
          {last ? t('guide.finish') : t('guide.next')}
        </button>
      </div>
    </aside>
  );
}

/**
 * Sommaire du tutoriel, dans les Options : les chapitres sont rangés en trois parties
 * repliables pour ne pas allonger le panneau, et chacun peut être relu à tout moment.
 */
export function GuideIndex() {
  const { t } = useTranslation();
  const seen = useGuide((s) => s.seen);
  const open = useGuide((s) => s.open);
  const view = useGame((s) => s.view);
  const { text } = useText(view?.mode);
  const openPanel = useGame((s) => s.openPanel);
  const read = (id: LessonId) => {
    if (!view) return;
    open(id, baselineOf(view), true);
    openPanel(null);
  };
  const restart = () => {
    useSettings.getState().update({ tutorialDone: false });
    useGuide.getState().restart();
    openPanel(null);
  };
  const count = (ids: readonly LessonId[]) => ids.filter((id) => seen.includes(id)).length;
  return (
    <section className="guide-index" aria-labelledby="guide-index-title">
      <header>
        <h3 id="guide-index-title">
          📖 {t('guide.index')}
          <small className="muted">
            {t('guide.progress', { seen: count(LESSON_IDS), total: LESSON_IDS.length })}
          </small>
        </h3>
        <button type="button" onClick={restart}>
          {t('settings.tutorial')}
        </button>
      </header>
      {LESSON_GROUPS.map((group) => (
        <details key={group.id} className="guide-group">
          <summary>
            <span>{t(`guide.groups.${group.id}`)}</span>
            <small className="muted">
              {count(group.lessons)}/{group.lessons.length}
            </small>
          </summary>
          <ul>
            {group.lessons.map((id) => {
              const done = seen.includes(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={done ? 'seen' : undefined}
                    onClick={() => read(id)}
                    disabled={!view}
                  >
                    {text(`guide.lessons.${id}.title`)}
                    {done && (
                      <span className="guide-seen" aria-label={t('guide.seen')}>
                        ✓
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </section>
  );
}
