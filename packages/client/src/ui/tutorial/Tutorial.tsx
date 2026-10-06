import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameView } from '../../view/types';
import { useGame } from '../store/game';
import { useSettings } from '../store/settings';

/**
 * Tutoriel interactif du premier sprint. Chaque étape se valide toute seule quand le joueur
 * fait l'action demandée (ou avec « Suivant »).
 */
export const TUTORIAL_STEPS = [
  'welcome',
  'gauges',
  'kanban',
  'assign',
  'start',
  'speed',
  'select',
  'build',
] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];

interface Snapshot {
  readonly view: GameView;
  readonly panel: string | null;
  readonly selectedDev: boolean;
  readonly initialSpeed: number;
  readonly initialItems: number;
}

/** L'étape est-elle accomplie ? (fonction pure, testée) */
export function isStepDone(step: TutorialStep, s: Snapshot): boolean {
  switch (step) {
    case 'kanban':
      return s.view.tasks.some((task) => task.column !== 'BACKLOG');
    case 'assign':
      return s.view.tasks.some((task) => task.column === 'DOING' && task.assigneeId !== null);
    case 'start':
      return s.view.step === 'EXECUTION';
    case 'speed':
      return s.view.time.speed !== s.initialSpeed;
    case 'select':
      return s.selectedDev;
    case 'build':
      return s.view.items.length > s.initialItems;
    default:
      return false;
  }
}

export function Tutorial({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const done = useSettings((s) => s.tutorialDone);
  const update = useSettings((s) => s.update);
  const panel = useGame((s) => s.panel);
  const selected = useGame((s) => s.selected);
  const [index, setIndex] = useState(0);
  const [initial, setInitial] = useState({ speed: view.time.speed, items: view.items.length });
  const step = TUTORIAL_STEPS[index];

  const next = () => {
    if (index + 1 >= TUTORIAL_STEPS.length) update({ tutorialDone: true });
    else {
      setIndex(index + 1);
      setInitial({ speed: view.time.speed, items: view.items.length });
    }
  };

  const accomplished =
    step !== undefined &&
    isStepDone(step, {
      view,
      panel,
      selectedDev: selected?.type === 'dev',
      initialSpeed: initial.speed,
      initialItems: initial.items,
    });

  useEffect(() => {
    if (accomplished) {
      const timer = window.setTimeout(next, 600);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  });

  if (done || !step) return null;
  return (
    <aside
      className="tutorial"
      role="dialog"
      aria-live="polite"
      aria-label={t('tutorial.progress', { step: index + 1, total: TUTORIAL_STEPS.length })}
    >
      <p className="tutorial-progress">
        {t('tutorial.progress', { step: index + 1, total: TUTORIAL_STEPS.length })}
      </p>
      <p className={accomplished ? 'tutorial-text done' : 'tutorial-text'}>
        {accomplished ? '✓ ' : ''}
        {t(`tutorial.steps.${step}`)}
      </p>
      <div className="tutorial-actions">
        <button type="button" onClick={() => update({ tutorialDone: true })}>
          {t('tutorial.skip')}
        </button>
        <button type="button" className="primary" onClick={next}>
          {index + 1 >= TUTORIAL_STEPS.length ? t('tutorial.done') : t('tutorial.next')}
        </button>
      </div>
    </aside>
  );
}
