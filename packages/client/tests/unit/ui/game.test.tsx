import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../../src/i18n';
import { sparklinePoints } from '../../../src/ui/dashboard/Dashboard';
import {
  formatClock,
  formatGauge,
  gaugeRatio,
  intlLocale,
  isGaugeCritical,
} from '../../../src/ui/game/format';
import { GameScreen } from '../../../src/ui/game/GameScreen';
import { useGame } from '../../../src/ui/store/game';
import { useSettings } from '../../../src/ui/store/settings';
import { isStepDone } from '../../../src/ui/tutorial/Tutorial';
import { MockGame } from '../../../src/view/mock';

function startGame() {
  act(() => useGame.getState().start(42, 'SEED'));
  return render(<GameScreen />);
}

beforeEach(async () => {
  await i18n.changeLanguage('fr');
  useSettings.setState({
    tutorialDone: true,
    reducedMotion: false,
    textScale: 1,
    quality: 'low',
    showFps: false,
  });
  useGame.getState().quit();
});

describe('HUD', () => {
  it('affiche les six jauges avec leur infobulle', async () => {
    startGame();
    expect(screen.getByTestId('gauge-treasury')).toHaveTextContent('2');
    const coffee = screen.getByRole('button', { name: /Café/ });
    await userEvent.click(coffee);
    expect(screen.getByRole('tooltip', { hidden: false })).toHaveTextContent(
      'productivité divisée par 3',
    );
  });

  it('lance le sprint puis change la vitesse', async () => {
    startGame();
    await userEvent.click(screen.getByRole('button', { name: /Lancer le sprint/ }));
    expect(useGame.getState().view?.step).toBe('EXECUTION');
    await userEvent.click(screen.getByRole('button', { name: 'Vitesse x4' }));
    expect(useGame.getState().view?.time.speed).toBe(4);
    expect(screen.getByRole('button', { name: 'Vitesse x4' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(useGame.getState().view?.time.speed).toBe(0);
  });

  it('ouvre et ferme un panneau au clavier (Échap)', async () => {
    startGame();
    await userEvent.click(screen.getByRole('button', { name: /Équipe/ }));
    expect(screen.getByRole('dialog', { name: 'Équipe' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Équipe' })).not.toBeInTheDocument();
  });
});

describe('Kanban', () => {
  it('déplace une carte avec les flèches et l’assigne à un dev', async () => {
    startGame();
    await userEvent.click(screen.getByRole('button', { name: /Kanban/ }));
    const backlog = screen.getByRole('region', { name: /Backlog/ });
    const first = within(backlog).getAllByRole('article')[0]!;
    const title = first.getAttribute('aria-label')!;
    await userEvent.click(within(first).getByRole('button', { name: 'Déplacer vers À faire' }));

    const todo = screen.getByRole('region', { name: /À faire/ });
    const moved = within(todo).getByRole('article', { name: title });
    const dev = useGame.getState().view!.devs[0]!;
    await userEvent.selectOptions(within(moved).getByRole('combobox'), dev.id);
    const task = useGame.getState().view!.tasks.find((t) => t.column === 'TODO')!;
    expect(task.assigneeId).toBe(dev.id);
    expect(screen.getByText(/déplacée vers À faire/)).toBeInTheDocument();
  });
});

describe('Équipe et recrutement', () => {
  it('affiche la fiche d’un dev puis le licencie après confirmation', async () => {
    startGame();
    const dev = useGame.getState().view!.devs[0]!;
    await userEvent.click(screen.getByRole('button', { name: /Équipe/ }));
    await userEvent.click(screen.getByRole('button', { name: new RegExp(dev.name) }));
    expect(
      screen.getByRole('heading', { name: new RegExp(`${dev.name}, \\d+ ans`) }),
    ).toBeInTheDocument();
    expect(screen.getByText('Relations')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Licencier' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(useGame.getState().view!.devs.some((d) => d.id === dev.id)).toBe(false);
  });

  it('fait une offre à un candidat', async () => {
    startGame();
    await userEvent.click(screen.getByRole('button', { name: /Recrutement/ }));
    const offers = screen.getAllByRole('button', { name: "Faire l'offre" });
    expect(offers).toHaveLength(3);
    const before = useGame.getState().view!.candidates.length;
    await userEvent.click(offers[0]!);
    expect(useGame.getState().view!.candidates.length).toBe(before - 1);
  });
});

describe('Construction', () => {
  it('choisir un objet active l’aperçu, R le tourne, Échap quitte', async () => {
    startGame();
    await userEvent.click(screen.getByRole('button', { name: /Construction/ }));
    await userEvent.click(screen.getByRole('tab', { name: 'Déco' }));
    await userEvent.click(screen.getByRole('button', { name: /^Plante/ }));
    expect(useGame.getState().build).toMatchObject({ kind: 'plant', rotation: 0 });
    await userEvent.keyboard('r');
    expect(useGame.getState().build?.rotation).toBe(1);
    // Premier Échap : ferme le panneau ; second : quitte le mode construction.
    await userEvent.keyboard('{Escape}');
    expect(useGame.getState().panel).toBeNull();
    await userEvent.keyboard('{Escape}');
    expect(useGame.getState().build).toBeNull();
  });

  it('affiche les actions d’un objet sélectionné et le revend', async () => {
    startGame();
    const item = useGame.getState().view!.items[0]!;
    act(() => useGame.getState().select({ type: 'item', id: item.id }));
    await userEvent.click(screen.getByRole('button', { name: /Revendre/ }));
    expect(useGame.getState().view!.items.some((i) => i.id === item.id)).toBe(false);
  });

  it('les objets verrouillés ne sont pas achetables', async () => {
    startGame();
    await userEvent.click(screen.getByRole('button', { name: /Construction/ }));
    await userEvent.click(screen.getByRole('tab', { name: 'Détente' }));
    expect(screen.getByRole('button', { name: /Toboggan/ })).toBeDisabled();
  });
});

describe('Options et accessibilité', () => {
  it('change la qualité, la taille du texte et la réduction des animations', async () => {
    startGame();
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Haute' }));
    expect(useSettings.getState().quality).toBe('high');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Réduire les animations' }));
    expect(useSettings.getState().reducedMotion).toBe(true);
    await userEvent.click(screen.getAllByRole('button', { name: 'A' })[3]!);
    expect(useSettings.getState().textScale).toBe(1.25);
    expect(JSON.parse(localStorage.getItem('oss.settings')!)).toMatchObject({
      quality: 'high',
      textScale: 1.25,
    });
  });

  it('change la phase de démo (le bureau s’agrandit)', async () => {
    startGame();
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /Phase de démo/ }),
      'UNICORN',
    );
    expect(useGame.getState().view!.phase).toBe('UNICORN');
  });

  it('affiche les crédits Kenney et les assets manquants', async () => {
    startGame();
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Crédits' }));
    expect(screen.getByText(/licence CC0/)).toBeInTheDocument();
    expect(screen.getByText('Babyfoot')).toBeInTheDocument();
  });
});

describe('Tutoriel', () => {
  it('s’affiche au premier lancement et se passe', async () => {
    useSettings.setState({ tutorialDone: false });
    startGame();
    expect(screen.getByText(/Bienvenue, fondateur/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByText(/tes jauges/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Passer le tutoriel' }));
    expect(useSettings.getState().tutorialDone).toBe(true);
  });

  it('valide chaque étape quand l’action est faite', () => {
    const game = new MockGame(1);
    const base = {
      view: game.view,
      panel: null,
      selectedDev: false,
      initialSpeed: 1,
      initialItems: game.view.items.length,
    };
    expect(isStepDone('kanban', base)).toBe(false);
    const taskId = game.view.tasks[0]!.id;
    game.dispatch({ type: 'moveTask', taskId, column: 'DOING', index: 0 });
    game.dispatch({ type: 'assignTask', taskId, devId: game.view.devs[0]!.id });
    game.dispatch({ type: 'startSprint' });
    game.dispatch({ type: 'setSpeed', speed: 2 });
    game.dispatch({ type: 'placeItem', kind: 'plant', x: 5, z: 8, rotation: 0 });
    const after = { ...base, view: game.view, selectedDev: true };
    for (const step of ['kanban', 'assign', 'start', 'speed', 'select', 'build'] as const) {
      expect(isStepDone(step, after), step).toBe(true);
    }
    expect(isStepDone('welcome', after)).toBe(false);
  });
});

describe('formatage', () => {
  it('formate les jauges selon la langue', () => {
    expect(formatGauge('treasury', 2_000_000, 'fr')).toMatch(/2\s?M\s?€/);
    expect(formatGauge('treasury', 2_000_000, 'en-US@posix')).toBe('€2M');
    expect(formatGauge('users', 1500, 'en')).toBe('1.5K');
    expect(formatGauge('coffee', 79.6, 'fr')).toBe('80');
    expect(intlLocale('EN')).toBe('en-US');
    expect(formatClock(17 * 60 + 4)).toBe('17:04');
  });

  it('signale les jauges critiques', () => {
    expect(isGaugeCritical('debt', 80)).toBe(true);
    expect(isGaugeCritical('coffee', 10)).toBe(true);
    expect(isGaugeCritical('treasury', 100_000)).toBe(true);
    expect(isGaugeCritical('users', 0)).toBe(false);
    expect(gaugeRatio('treasury', 4_000_000)).toBe(1);
    expect(gaugeRatio('users', 1)).toBe(0);
  });

  it('trace les courbes du dashboard', () => {
    expect(sparklinePoints([])).toBe('');
    expect(sparklinePoints([1, 1], 100, 10)).toBe('0.0,6.0 100.0,6.0');
    expect(sparklinePoints([0, 10], 100, 10)).toBe('0.0,6.0 100.0,4.0');
  });
});
