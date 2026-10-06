import type { GameView } from '../../view/types';
import type { PanelId } from '../store/game';

/**
 * Tutoriel complet du mode Facile, découpé en chapitres (« leçons »). Chaque leçon se
 * déclenche toute seule au bon moment de la partie (première carte, première démo...) et
 * se lit étape par étape. Certaines étapes attendent une action du joueur : elles se
 * valident dès qu'elle est faite. Les textes sont dans `guide.lessons.<leçon>` (i18n).
 *
 * Ce fichier est pur (aucun React) : déclencheurs et objectifs sont testés directement.
 */

/** Ce qu'une étape peut observer pour savoir si le joueur a fait l'action demandée. */
export interface GuideContext {
  readonly view: GameView;
  readonly panel: PanelId | null;
  readonly selectedDev: boolean;
  /** Valeurs relevées au début de l'étape (pour détecter un changement). */
  readonly baseline: GuideBaseline;
}

export interface GuideBaseline {
  readonly speed: number;
  readonly items: number;
}

export interface LessonStep {
  readonly id: string;
  /** Élément à mettre en évidence (attribut `data-tutorial`). */
  readonly target?: string;
  /** Action attendue : l'étape se valide quand elle renvoie vrai. */
  readonly goal?: (context: GuideContext) => boolean;
}

export interface Lesson {
  readonly id: LessonId;
  readonly steps: readonly LessonStep[];
  /** La leçon démarre-t-elle maintenant ? `seen` contient les leçons déjà lues. */
  readonly trigger: (view: GameView, seen: ReadonlySet<LessonId>) => boolean;
}

export const LESSON_IDS = [
  'basics',
  'planning',
  'execution',
  'team',
  'events',
  'incident',
  'demo',
  'build',
  'dashboard',
  'funding',
  'endings',
  'tools',
] as const;
export type LessonId = (typeof LESSON_IDS)[number];

const panelOpen =
  (panel: PanelId) =>
  ({ panel: open }: GuideContext): boolean =>
    open === panel;

const planningOfSprint = (view: GameView, sprint: number) =>
  view.step === 'PLANNING' && view.time.sprint >= sprint;

export const LESSONS: readonly Lesson[] = [
  {
    id: 'basics',
    trigger: () => true,
    steps: [
      { id: 'welcome' },
      { id: 'easy' },
      { id: 'goal' },
      { id: 'gauges', target: 'gauges' },
      { id: 'treasury', target: 'gauges' },
      { id: 'coffee', target: 'gauges' },
      { id: 'debt', target: 'gauges' },
      { id: 'hype', target: 'gauges' },
      { id: 'dilemma' },
    ],
  },
  {
    id: 'planning',
    trigger: (view, seen) => seen.has('basics') && view.step === 'PLANNING',
    steps: [
      { id: 'sprint' },
      { id: 'openKanban', target: 'panel-kanban', goal: panelOpen('kanban') },
      { id: 'columns' },
      { id: 'types' },
      {
        id: 'move',
        goal: ({ view }) => view.tasks.some((task) => task.column !== 'BACKLOG'),
      },
      { id: 'capacity' },
      {
        id: 'assign',
        goal: ({ view }) => view.tasks.some((task) => task.assigneeId !== null),
      },
      { id: 'start', target: 'start', goal: ({ view }) => view.step !== 'PLANNING' },
    ],
  },
  {
    id: 'execution',
    trigger: (view, seen) => seen.has('planning') && view.step === 'EXECUTION',
    steps: [
      { id: 'office' },
      {
        id: 'speed',
        target: 'speed',
        goal: ({ view, baseline }) => view.time.speed !== baseline.speed,
      },
      { id: 'camera' },
      { id: 'select', goal: ({ selectedDev }) => selectedDev },
      { id: 'sheet' },
      { id: 'roles' },
      { id: 'clock', target: 'speed' },
    ],
  },
  {
    id: 'team',
    trigger: (view, seen) => seen.has('execution') && view.step === 'EXECUTION',
    steps: [
      { id: 'openTeam', target: 'panel-team', goal: panelOpen('team') },
      { id: 'morale' },
      { id: 'openHiring', target: 'panel-hiring', goal: panelOpen('hiring') },
      { id: 'hiring' },
    ],
  },
  {
    id: 'events',
    trigger: (view, seen) => seen.has('basics') && view.event !== null,
    steps: [{ id: 'card', target: 'event' }, { id: 'effects' }, { id: 'later' }, { id: 'soft' }],
  },
  {
    id: 'incident',
    trigger: (view, seen) => seen.has('basics') && view.incident,
    steps: [{ id: 'outage' }, { id: 'fix' }],
  },
  {
    id: 'demo',
    trigger: (view, seen) => seen.has('basics') && view.step === 'DEMO',
    steps: [{ id: 'report', target: 'demo' }, { id: 'read' }, { id: 'next' }],
  },
  {
    id: 'build',
    trigger: (view, seen) => seen.has('demo') && planningOfSprint(view, 2),
    steps: [
      { id: 'openBuild', target: 'panel-build', goal: panelOpen('build') },
      {
        id: 'place',
        goal: ({ view, baseline }) => view.items.length > baseline.items,
      },
      { id: 'manage' },
      { id: 'items' },
    ],
  },
  {
    id: 'dashboard',
    trigger: (view, seen) => seen.has('build') && planningOfSprint(view, 2),
    steps: [
      { id: 'open', target: 'panel-dashboard', goal: panelOpen('dashboard') },
      { id: 'read' },
    ],
  },
  {
    id: 'funding',
    trigger: (view, seen) => seen.has('dashboard') && planningOfSprint(view, 3),
    steps: [
      { id: 'why', target: 'pitch' },
      { id: 'when', target: 'pitch' },
      { id: 'pitch' },
      { id: 'dilution' },
      { id: 'phases' },
    ],
  },
  {
    id: 'endings',
    trigger: (view, seen) =>
      seen.has('funding') &&
      (planningOfSprint(view, 5) || view.acquisitionOffer !== null || view.canIpo),
    steps: [{ id: 'four' }, { id: 'offer' }, { id: 'share' }],
  },
  {
    id: 'tools',
    trigger: (view, seen) => seen.has('endings') && planningOfSprint(view, 5),
    steps: [
      { id: 'slack', target: 'panel-slack' },
      { id: 'saves', target: 'panel-saves' },
      { id: 'settings', target: 'panel-settings' },
      { id: 'bye' },
    ],
  },
];

const MODAL_LESSONS: ReadonlySet<LessonId> = new Set(['events', 'demo']);

export function getLesson(id: LessonId): Lesson {
  const lesson = LESSONS.find((candidate) => candidate.id === id);
  if (!lesson) throw new Error(`Leçon inconnue : ${id}`);
  return lesson;
}

/** Prochaine leçon à lancer automatiquement (dans l'ordre du sommaire), ou null. */
export function nextLesson(view: GameView, seen: ReadonlySet<LessonId>): LessonId | null {
  if (view.step === 'ENDED' || view.step === 'PITCH') return null;
  // Face à une carte ou à la démo, seule la leçon qui l'explique peut s'ouvrir.
  const modal = view.event !== null || view.step === 'DEMO';
  const lesson = LESSONS.find(
    (candidate) =>
      !seen.has(candidate.id) &&
      (!modal || MODAL_LESSONS.has(candidate.id)) &&
      candidate.trigger(view, seen),
  );
  return lesson?.id ?? null;
}

/** L'étape attend-elle encore une action du joueur ? */
export function isGoalMet(step: LessonStep, context: GuideContext): boolean {
  return step.goal ? step.goal(context) : false;
}
