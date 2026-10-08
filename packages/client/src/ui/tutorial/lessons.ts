import type { GameMode } from '@oss/shared';
import type { GameView } from '../../view/types';
import type { PanelId } from '../store/game';

/**
 * Tutoriel complet du mode Facile, découpé en chapitres (« leçons »). Chaque leçon se
 * déclenche toute seule au bon moment de la partie (première carte, première démo...) et
 * se lit étape par étape. Certaines étapes attendent une action du joueur : elles se
 * valident dès qu'elle est faite. Les textes sont dans `guide.lessons.<leçon>` (i18n).
 *
 * Le tutoriel s'adapte au mode de jeu : le chapitre « Les règles du mode » change selon le
 * mode, certaines étapes n'existent que dans certains modes (`modes`), et une étape peut
 * avoir un texte propre à un mode (clé `steps.<étape>.<MODE>` dans les traductions).
 *
 * Ce fichier est pur (aucun React) : déclencheurs et objectifs sont testés directement.
 */

/** Ce qu'une étape peut observer pour savoir si le joueur a fait l'action demandée. */
export interface GuideContext {
  readonly view: GameView;
  readonly panel: PanelId | null;
  /** Le mode construction est-il ouvert ? (ce n'est pas un panneau) */
  readonly building: boolean;
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
  /** Modes où l'étape existe (tous si absent). */
  readonly modes?: readonly GameMode[];
}

/**
 * Ce que le tutoriel lance tout seul : tout (`full`, en Facile ou pour un nouveau joueur),
 * ou seulement les règles du mode (`mode`, pour un joueur qui connaît déjà le jeu).
 */
export type GuideScope = 'full' | 'mode';

export interface Lesson {
  readonly id: LessonId;
  readonly steps: readonly LessonStep[];
  /** La leçon démarre-t-elle maintenant ? `seen` contient les leçons déjà lues. */
  readonly trigger: (view: GameView, seen: ReadonlySet<LessonId>) => boolean;
}

export const LESSON_IDS = [
  'basics',
  'rules',
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

/** Le défi « 3 sprints » n'attend pas le 5e sprint : la fin arrive au 3e. */
const lateSprint = (view: GameView) => (view.mode === 'SHIP_IN_3' ? 3 : 5);

const ALL_BUT = (...excluded: GameMode[]): readonly GameMode[] =>
  (['EASY', 'NORMAL', 'HARDCORE', 'INTERNS_ONLY', 'SHIP_IN_3', 'DAILY'] as const).filter(
    (mode) => !excluded.includes(mode),
  );

export const LESSONS: readonly Lesson[] = [
  {
    id: 'basics',
    trigger: () => true,
    steps: [
      { id: 'welcome' },
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
    // Le seul chapitre propre à chaque mode : ses étapes changent du tout au tout.
    id: 'rules',
    trigger: (_view, seen) => seen.has('basics'),
    steps: [
      { id: 'easy', modes: ['EASY'] },
      { id: 'normal', modes: ['NORMAL'] },
      { id: 'hardcore', modes: ['HARDCORE'] },
      { id: 'hardcoreEvents', modes: ['HARDCORE'] },
      { id: 'interns', modes: ['INTERNS_ONLY'] },
      { id: 'internsTips', modes: ['INTERNS_ONLY'] },
      { id: 'ship', modes: ['SHIP_IN_3'] },
      { id: 'shipTips', modes: ['SHIP_IN_3'] },
      { id: 'daily', modes: ['DAILY'] },
      { id: 'dailyTips', modes: ['DAILY'] },
    ],
  },
  {
    id: 'planning',
    trigger: (view, seen) => seen.has('rules') && view.step === 'PLANNING',
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
      { id: 'clock', target: 'clock' },
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
    // En Hardcore, une carte se résout seule au bout de 2 heures de jeu : le chapitre
    // s'ouvre dès le début du sprint, avant la première carte, pour avoir le temps de le lire.
    trigger: (view, seen) =>
      seen.has('basics') &&
      (view.event !== null || (view.mode === 'HARDCORE' && view.step === 'EXECUTION')),
    steps: [
      { id: 'card', target: 'event' },
      { id: 'effects' },
      { id: 'later' },
      { id: 'soft', modes: ['EASY'] },
    ],
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
      { id: 'openBuild', target: 'panel-build', goal: ({ building }) => building },
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
      (planningOfSprint(view, lateSprint(view)) || view.acquisitionOffer !== null || view.canIpo),
    steps: [{ id: 'four' }, { id: 'offer', modes: ALL_BUT('SHIP_IN_3') }, { id: 'share' }],
  },
  {
    id: 'tools',
    trigger: (view, seen) => seen.has('endings') && planningOfSprint(view, lateSprint(view)),
    steps: [
      { id: 'slack', target: 'panel-slack' },
      { id: 'saves', target: 'panel-saves' },
      { id: 'settings', target: 'panel-settings' },
      { id: 'bye' },
    ],
  },
];

const MODAL_LESSONS: ReadonlySet<LessonId> = new Set(['events', 'demo']);

/** Chapitres qui remplacent l'ancien tutoriel court : une fois lus, le jeu est connu. */
export const CORE_LESSONS: readonly LessonId[] = ['basics', 'rules', 'planning', 'execution'];

/** Le sommaire du Guide du jeu (Options), en trois parties repliables. */
export const LESSON_GROUPS = [
  { id: 'start', lessons: ['basics', 'rules', 'planning', 'execution'] },
  { id: 'crises', lessons: ['team', 'events', 'incident', 'demo'] },
  { id: 'growth', lessons: ['build', 'dashboard', 'funding', 'endings', 'tools'] },
] as const satisfies readonly { id: string; lessons: readonly LessonId[] }[];

export function getLesson(id: LessonId): Lesson {
  const lesson = LESSONS.find((candidate) => candidate.id === id);
  if (!lesson) throw new Error(`Leçon inconnue : ${id}`);
  return lesson;
}

/** Les étapes de la leçon qui existent dans ce mode. */
export function stepsOf(lesson: Lesson, mode: GameMode): readonly LessonStep[] {
  return lesson.steps.filter((step) => !step.modes || step.modes.includes(mode));
}

/** Prochaine leçon à lancer automatiquement (dans l'ordre du sommaire), ou null. */
export function nextLesson(
  view: GameView,
  seen: ReadonlySet<LessonId>,
  scope: GuideScope = 'full',
): LessonId | null {
  if (view.step === 'ENDED' || view.step === 'PITCH') return null;
  // Un joueur qui connaît le jeu ne revoit que ce qui change dans ce mode. Le mode Normal
  // n'a rien de particulier : rien ne s'ouvre.
  const modal = view.event !== null || view.step === 'DEMO';
  if (scope === 'mode')
    return view.mode === 'NORMAL' || seen.has('rules') || modal ? null : 'rules';
  // Face à une carte ou à la démo, seule la leçon qui l'explique peut s'ouvrir.
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
