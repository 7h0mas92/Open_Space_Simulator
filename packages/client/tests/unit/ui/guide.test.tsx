import { GAME_MODES } from '@oss/shared';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import en from '../../../src/i18n/en.json';
import fr from '../../../src/i18n/fr.json';
import i18n from '../../../src/i18n';
import { GameScreen } from '../../../src/ui/game/GameScreen';
import { useGame } from '../../../src/ui/store/game';
import { useGuide } from '../../../src/ui/store/guide';
import { useSettings } from '../../../src/ui/store/settings';
import {
  LESSON_IDS,
  LESSONS,
  getLesson,
  isGoalMet,
  nextLesson,
  stepsOf,
  type GuideContext,
  type LessonId,
} from '../../../src/ui/tutorial/lessons';
import type { GameView } from '../../../src/view/types';
import {
  officeSimulation,
  SEED_OFFICE,
  testSource,
  viewOf,
  type OfficeOptions,
} from '../fixtures/game';

const EASY_OFFICE = { ...SEED_OFFICE, mode: 'EASY' as const };

async function startGame(options: OfficeOptions = EASY_OFFICE) {
  const simulation = officeSimulation(options);
  const { source, worker } = await testSource(simulation);
  await act(() => useGame.getState().start({ source }));
  render(<GameScreen />);
  return { simulation, worker };
}

function context(view: GameView, patch: Partial<GuideContext> = {}): GuideContext {
  return {
    view,
    panel: null,
    building: false,
    selectedDev: false,
    baseline: { speed: view.time.speed, items: view.items.length },
    ...patch,
  };
}

const seen = (...ids: LessonId[]) => new Set<LessonId>(ids);

beforeEach(async () => {
  await i18n.changeLanguage('fr');
  localStorage.clear();
  useSettings.setState({ tutorialDone: true, reducedMotion: false, quality: 'low' });
  useGuide.setState({
    seed: null,
    autoplay: false,
    scope: 'full',
    seen: [],
    active: null,
    minimized: false,
  });
  useGame.getState().quit();
});

describe('Contenu du tutoriel', () => {
  it('chaque chapitre et chaque étape ont un titre et un texte en français et en anglais', () => {
    expect(LESSONS.map((lesson) => lesson.id)).toEqual([...LESSON_IDS]);
    for (const translations of [fr.guide.lessons, en.guide.lessons]) {
      for (const lesson of LESSONS) {
        const text = translations[lesson.id] as {
          title: string;
          steps: Record<string, Record<string, unknown> & { title: string; body: string }>;
        };
        expect(text.title, lesson.id).toBeTruthy();
        expect(Object.keys(text.steps)).toEqual(lesson.steps.map((step) => step.id));
        for (const step of lesson.steps) {
          const entry = text.steps[step.id]!;
          // Les autres clés sont des textes propres à un mode où l'étape existe.
          for (const [key, variant] of Object.entries(entry)) {
            if (['title', 'body', 'do'].includes(key)) continue;
            const where = `${lesson.id}.${step.id}.${key}`;
            expect(GAME_MODES as readonly string[], where).toContain(key);
            expect(!step.modes || step.modes.some((mode) => mode === key), where).toBe(true);
            const fields = variant as Record<string, string>;
            expect(
              Object.keys(fields).every((f) => ['title', 'body', 'do'].includes(f)),
              where,
            ).toBe(true);
            expect(fields.do === undefined || step.goal !== undefined, where).toBe(true);
            expect(fields.body === undefined || fields.body.length > 30, where).toBe(true);
          }
          expect(entry.title.length, `${lesson.id}.${step.id}`).toBeGreaterThan(3);
          expect(entry.body.length, `${lesson.id}.${step.id}`).toBeGreaterThan(30);
          // Une étape qui attend une action dit exactement laquelle.
          expect(entry.do !== undefined, `${lesson.id}.${step.id}.do`).toBe(
            step.goal !== undefined,
          );
        }
      }
    }
  });
});

describe('Déclenchement des chapitres', () => {
  const planning = viewOf(officeSimulation(EASY_OFFICE));

  it('commence par les bases, les règles du mode, puis la planification', () => {
    expect(nextLesson(planning, seen())).toBe('basics');
    expect(nextLesson(planning, seen('basics'))).toBe('rules');
    expect(nextLesson(planning, seen('basics', 'rules'))).toBe('planning');
    expect(nextLesson(planning, seen('basics', 'rules', 'planning'))).toBeNull();
  });

  it('ne montre que les règles du mode à un joueur qui connaît le jeu', () => {
    const hardcore = { ...planning, mode: 'HARDCORE' as const };
    expect(nextLesson(hardcore, seen(), 'mode')).toBe('rules');
    expect(nextLesson(hardcore, seen('rules'), 'mode')).toBeNull();
    expect(nextLesson({ ...planning, mode: 'NORMAL' as const }, seen(), 'mode')).toBeNull();
  });

  it('adapte les chapitres au mode', () => {
    // Chaque mode a ses propres règles.
    for (const mode of GAME_MODES)
      expect(stepsOf(getLesson('rules'), mode).length, mode).toBeGreaterThan(0);
    expect(stepsOf(getLesson('rules'), 'HARDCORE').map((step) => step.id)).toEqual([
      'hardcore',
      'hardcoreEvents',
    ]);
    expect(stepsOf(getLesson('events'), 'EASY').map((step) => step.id)).toContain('soft');
    expect(stepsOf(getLesson('events'), 'NORMAL').map((step) => step.id)).not.toContain('soft');
    // En Hardcore, les crises s'expliquent dès le début du sprint, avant la première carte.
    const simulation = officeSimulation({ ...SEED_OFFICE, mode: 'HARDCORE' });
    simulation.dispatch({ type: 'START_SPRINT' });
    const learned = seen('basics', 'rules', 'planning', 'execution', 'team');
    expect(nextLesson(viewOf(simulation), learned)).toBe('events');
    // Le défi « 3 sprints » explique les fins au 3e sprint, pas au 5e.
    const ship = { ...planning, mode: 'SHIP_IN_3' as const, time: { ...planning.time, sprint: 3 } };
    const before = seen(...LESSON_IDS.filter((id) => !['endings', 'tools'].includes(id)));
    expect(nextLesson(ship, before)).toBe('endings');
    expect(nextLesson({ ...ship, mode: 'NORMAL' }, before)).toBeNull();
  });

  it('suit le sprint : exécution, équipe, crises, démo', () => {
    const simulation = officeSimulation(EASY_OFFICE);
    simulation.dispatch({ type: 'START_SPRINT' });
    const execution = viewOf(simulation);
    const before = seen('basics', 'rules', 'planning');
    expect(nextLesson(execution, before)).toBe('execution');
    expect(nextLesson(execution, seen(...before, 'execution'))).toBe('team');

    simulation.state.events.pending = { cardId: 'coffee-machine-broken', level: 0, drawnAtTick: 0 };
    // Face à une carte, seul le chapitre des crises peut s'ouvrir.
    expect(nextLesson(viewOf(simulation), before)).toBe('events');

    const demo = { ...execution, step: 'DEMO' as const };
    expect(nextLesson(demo, seen(...before, 'execution', 'team'))).toBe('demo');
  });

  it('garde la suite pour les sprints suivants', () => {
    const learned = seen('basics', 'rules', 'planning', 'execution', 'team', 'events', 'demo');
    const sprint = (n: number) => ({ ...planning, time: { ...planning.time, sprint: n } });
    expect(nextLesson(sprint(1), learned)).toBeNull();
    expect(nextLesson(sprint(2), learned)).toBe('build');
    expect(nextLesson(sprint(2), seen(...learned, 'build'))).toBe('dashboard');
    expect(nextLesson(sprint(2), seen(...learned, 'build', 'dashboard'))).toBeNull();
    expect(nextLesson(sprint(3), seen(...learned, 'build', 'dashboard'))).toBe('funding');
    const almost = seen(...learned, 'build', 'dashboard', 'funding');
    expect(nextLesson(sprint(5), almost)).toBe('endings');
    expect(nextLesson(sprint(5), seen(...almost, 'endings'))).toBe('tools');
    expect(nextLesson({ ...planning, incident: true }, seen('basics', 'rules', 'planning'))).toBe(
      'incident',
    );
    expect(nextLesson({ ...planning, step: 'ENDED' }, seen())).toBeNull();
  });
});

describe('Actions attendues', () => {
  const step = (lesson: LessonId, id: string) =>
    getLesson(lesson).steps.find((candidate) => candidate.id === id)!;

  it('se valident quand le joueur fait l’action', () => {
    const simulation = officeSimulation(EASY_OFFICE);
    const before = viewOf(simulation);
    expect(isGoalMet(step('planning', 'openKanban'), context(before))).toBe(false);
    expect(isGoalMet(step('planning', 'openKanban'), context(before, { panel: 'kanban' }))).toBe(
      true,
    );
    expect(isGoalMet(step('planning', 'move'), context(before))).toBe(false);
    expect(isGoalMet(step('build', 'openBuild'), context(before))).toBe(false);
    expect(isGoalMet(step('build', 'openBuild'), context(before, { building: true }))).toBe(true);
    expect(isGoalMet(step('execution', 'select'), context(before, { selectedDev: true }))).toBe(
      true,
    );
    // Une étape sans action attendue ne se valide jamais toute seule.
    expect(isGoalMet(step('basics', 'welcome'), context(before, { panel: 'kanban' }))).toBe(false);

    const taskId = before.tasks[0]!.id;
    simulation.dispatch({ type: 'MOVE_TASK', taskId, column: 'TODO' });
    simulation.dispatch({ type: 'ASSIGN_TASK', taskId, devId: before.devs[0]!.id });
    simulation.dispatch({ type: 'START_SPRINT' });
    simulation.dispatch({ type: 'BUY_FURNITURE', itemId: 'plant', x: 5, y: 8, rotation: 0 });
    const after = viewOf(simulation);
    const ctx = context(after, { baseline: { speed: 0, items: before.items.length } });
    for (const [lesson, id] of [
      ['planning', 'move'],
      ['planning', 'assign'],
      ['planning', 'start'],
      ['execution', 'speed'],
      ['build', 'place'],
    ] as const) {
      expect(isGoalMet(step(lesson, id), ctx), `${lesson}.${id}`).toBe(true);
    }
  });
});

describe('Tutoriel en jeu', () => {
  it('s’ouvre tout seul en mode Facile et se lit étape par étape', async () => {
    await startGame();
    const guide = await screen.findByTestId('guide');
    expect(within(guide).getByRole('heading', { name: 'Bienvenue, fondateur' })).toBeVisible();
    expect(within(guide).getByText(/Chapitre 1 sur 13/)).toBeVisible();
    await userEvent.click(within(guide).getByRole('button', { name: 'Suivant' }));
    expect(within(guide).getByRole('heading', { name: 'Comment gagner ?' })).toBeVisible();
    await userEvent.click(within(guide).getByRole('button', { name: 'Précédent' }));
    expect(within(guide).getByRole('heading', { name: 'Bienvenue, fondateur' })).toBeVisible();
    await act(() => useGuide.getState().finish());
    const rules = await screen.findByTestId('guide');
    expect(within(rules).getByText(/Les règles du mode Facile/)).toBeVisible();
    expect(within(rules).getByRole('heading', { name: 'Le mode Facile' })).toBeVisible();
  });

  it('valide une action et passe à l’étape suivante', async () => {
    await startGame();
    useGuide.setState({ seen: ['basics', 'rules'] });
    await act(() => useGuide.getState().open('planning', { speed: 0, items: 0 }, false));
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByRole('heading', { name: 'Le Kanban' })).toBeVisible();
    expect(screen.getByText(/À toi/)).toHaveTextContent('Ouvre le Kanban');
    await userEvent.click(screen.getByRole('button', { name: /^Kanban/ }));
    expect(await screen.findByText(/Bien joué/)).toBeVisible();
    expect(
      await screen.findByRole('heading', { name: 'Les colonnes' }, { timeout: 3000 }),
    ).toBeVisible();
  });

  it('met la partie en pause quand un chapitre s’ouvre pendant le sprint', async () => {
    await startGame();
    await act(() => useGuide.getState().stop());
    await userEvent.click(screen.getByRole('button', { name: /Lancer le sprint/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Vitesse x2' }));
    expect(useGame.getState().view?.time.speed).toBe(2);
    await act(() => useGuide.getState().open('execution', { speed: 2, items: 0 }, true));
    await waitFor(() => expect(useGame.getState().view?.time.speed).toBe(0));
    expect(screen.getByText(/Partie en pause/)).toBeVisible();
    // Fin du chapitre : le temps repart.
    for (let i = 0; i < 7; i++) {
      await userEvent.click(
        screen.getByRole('button', { name: /^(Suivant|Terminer le chapitre)$/ }),
      );
    }
    await waitFor(() => expect(useGame.getState().view?.time.speed).toBe(1));
    expect(screen.queryByTestId('guide')).not.toBeInTheDocument();
  });

  it('peut être arrêté, et relu depuis le Guide du jeu', async () => {
    await startGame();
    await userEvent.click(await screen.findByRole('button', { name: 'Arrêter le tutoriel' }));
    expect(screen.queryByTestId('guide')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    const index = screen.getByRole('region', { name: /Guide du jeu/ });
    await userEvent.click(within(index).getAllByRole('button', { name: 'Lire' })[7]!);
    expect(screen.getByRole('heading', { name: 'La fin du sprint' })).toBeVisible();
  });

  it('accompagne un nouveau joueur dans tous les modes, puis le laisse jouer', async () => {
    useSettings.setState({ tutorialDone: false });
    await startGame(SEED_OFFICE);
    const guide = await screen.findByTestId('guide');
    expect(within(guide).getByRole('heading', { name: 'Bienvenue, fondateur' })).toBeVisible();
    await act(() => useGuide.setState({ seen: ['basics', 'rules', 'planning', 'execution'] }));
    await act(() => useGuide.getState().open('team', { speed: 0, items: 0 }, false));
    for (let i = 0; i < 4; i++)
      await userEvent.click(
        screen.getByRole('button', { name: /^(Suivant|Terminer le chapitre)$/ }),
      );
    // Les chapitres essentiels sont lus : la prochaine partie ne montrera que les règles.
    expect(useSettings.getState().tutorialDone).toBe(true);
  });

  it('ne montre à un joueur qui connaît le jeu que les règles de son mode', async () => {
    await startGame(SEED_OFFICE);
    expect(screen.queryByTestId('guide')).not.toBeInTheDocument();
    cleanup();
    useGame.getState().quit();
    await startGame({ ...SEED_OFFICE, mode: 'HARDCORE', seed: 'hardcore' });
    const guide = await screen.findByTestId('guide');
    expect(within(guide).getByRole('heading', { name: 'Le mode Hardcore' })).toBeVisible();
    expect(
      within(guide).getByText(/Chapitre 2 sur 13 · Les règles du mode Hardcore/),
    ).toBeVisible();
    await userEvent.click(within(guide).getByRole('button', { name: 'Suivant' }));
    expect(
      within(guide).getByRole('heading', { name: 'Les crises n’attendent pas' }),
    ).toBeVisible();
  });

  it('ne met jamais la partie en pause en Hardcore', async () => {
    await startGame({ ...SEED_OFFICE, mode: 'HARDCORE', seed: 'hardcore' });
    await act(() => useGuide.getState().stop());
    await userEvent.click(screen.getByRole('button', { name: /Lancer le sprint/ }));
    await act(() => useGuide.getState().open('execution', { speed: 1, items: 0 }, true));
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByText(/Le temps continue de passer/)).toBeVisible();
    expect(screen.getByText(/À toi/)).toHaveTextContent('Change de vitesse');
    expect(useGame.getState().view?.time.speed).toBe(1);
    expect(screen.queryByText(/Partie en pause/)).not.toBeInTheDocument();
  });

  it('adapte ses textes au mode', async () => {
    useSettings.setState({ tutorialDone: false });
    await startGame({ ...SEED_OFFICE, mode: 'SHIP_IN_3', seed: 'ship' });
    const guide = await screen.findByTestId('guide');
    expect(within(guide).getByText(/que 3 sprints/)).toBeVisible();
    await userEvent.click(within(guide).getByRole('button', { name: 'Suivant' }));
    expect(within(guide).getByText(/au moins 5 features/)).toBeVisible();
  });

  it('se relance depuis les Options', async () => {
    await startGame(SEED_OFFICE);
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    await userEvent.click(screen.getByRole('button', { name: /Revoir le tutoriel/ }));
    expect(
      within(await screen.findByTestId('guide')).getByRole('heading', {
        name: 'Bienvenue, fondateur',
      }),
    ).toBeVisible();
  });
});
