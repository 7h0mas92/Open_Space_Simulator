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
import type { Simulation } from '../../../src/simulation/simulation';
import { officeLayout } from '../../../src/view/layout';
import { nearestValidCell } from '../../../src/view/placement';
import { officeSimulation, SEED_OFFICE, testSource } from '../fixtures/game';

/** Lance l'écran de jeu sur une vraie simulation (moteur sans thread, temps arrêté). */
async function startGame(simulation: Simulation = officeSimulation(SEED_OFFICE)) {
  const { source, worker } = await testSource(simulation);
  await act(() => useGame.getState().start({ source }));
  render(<GameScreen />);
  return { worker };
}

/** Joue un sprint entier en prenant le premier choix de chaque carte. */
function playSprint(simulation: Simulation) {
  simulation.dispatch({ type: 'START_SPRINT' });
  while (simulation.state.stage === 'EXECUTION') {
    simulation.runUntilBlocked();
    if (simulation.state.events.pending)
      simulation.dispatch({ type: 'RESOLVE_EVENT', choiceIndex: 0 });
  }
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
    await startGame();
    expect(screen.getByTestId('gauge-treasury')).toHaveTextContent(/2/);
    const coffee = screen.getByRole('button', { name: /Café/ });
    await userEvent.click(coffee);
    expect(screen.getByRole('tooltip', { hidden: false })).toHaveTextContent(
      'productivité divisée par 3',
    );
  });

  it('lance le sprint puis change la vitesse', async () => {
    await startGame();
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
    await startGame();
    await userEvent.click(screen.getByRole('button', { name: /Équipe/ }));
    expect(screen.getByRole('dialog', { name: 'Équipe' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Équipe' })).not.toBeInTheDocument();
  });
});

describe('Kanban', () => {
  it('déplace une carte avec les flèches et l’assigne à un dev', async () => {
    await startGame();
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
    await startGame();
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
    await startGame();
    await userEvent.click(screen.getByRole('button', { name: /Recrutement/ }));
    const offers = screen.getAllByRole('button', { name: "Faire l'offre" });
    expect(offers).toHaveLength(3);
    const before = useGame.getState().view!.candidates.length;
    await userEvent.click(offers[0]!);
    expect(useGame.getState().view!.candidates.length).toBe(before - 1);
  });
});

describe('Construction', () => {
  /** Case libre pour une plante, calculée avec les mêmes règles que l'aperçu. */
  function freeCell(kind = 'plant') {
    const view = useGame.getState().view!;
    const cell = nearestValidCell(
      officeLayout(view.phase),
      view.items,
      { kind, rotation: 0 },
      { x: 2, z: 2 },
    );
    expect(cell).not.toBeNull();
    return cell!;
  }

  it('le HUD s’efface, et le catalogue se replie dès qu’on prend un objet', async () => {
    await startGame();
    await userEvent.click(screen.getByRole('button', { name: /Construction/ }));
    expect(screen.getByTestId('build-mode')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Actions du jeu' })).toBeNull();
    expect(screen.getByTestId('catalog')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /Déco/ }));
    await userEvent.click(screen.getByTestId('catalog-plant'));
    expect(useGame.getState().build).toMatchObject({ kind: 'plant', rotation: 0 });
    expect(screen.queryByTestId('catalog')).toBeNull();
    expect(screen.getByTestId('placement-bar')).toHaveTextContent('Plante verte');

    await userEvent.keyboard('r');
    expect(useGame.getState().build?.rotation).toBe(1);
    // Échap recule d'un cran : objet en main → catalogue → jeu.
    await userEvent.keyboard('{Escape}');
    expect(useGame.getState().build).toMatchObject({ kind: null });
    expect(screen.getByTestId('catalog')).toBeInTheDocument();
    // Le rayon choisi est conservé.
    expect(screen.getByRole('tab', { name: /Déco/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Escape}');
    expect(useGame.getState().build).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Actions du jeu' })).toBeInTheDocument();
  });

  it('pose un objet au clavier : flèches pour viser, Entrée pour poser', async () => {
    await startGame();
    await userEvent.keyboard('b');
    await userEvent.click(screen.getByRole('tab', { name: /Déco/ }));
    await userEvent.click(screen.getByTestId('catalog-plant'));
    const cell = freeCell();
    act(() => useGame.getState().setBuildCell({ x: cell.x + 1, z: cell.z }));
    await userEvent.keyboard('{ArrowLeft}');
    expect(useGame.getState().build?.cell).toEqual(cell);

    const before = useGame.getState().view!;
    await userEvent.keyboard('{Enter}');
    const after = useGame.getState().view!;
    expect(after.items).toHaveLength(before.items.length + 1);
    expect(after.items.at(-1)).toMatchObject({ kind: 'plant', x: cell.x, z: cell.z });
    expect(after.gauges.treasury).toBeLessThan(before.gauges.treasury);
    // Retour au catalogue pour l'objet suivant.
    expect(useGame.getState().build).toMatchObject({ kind: null });
    expect(screen.getByText('Plante verte : posé !')).toHaveClass('toast-success');
  });

  it('refuse une case occupée et explique pourquoi', async () => {
    await startGame();
    const occupied = useGame.getState().view!.items[0]!;
    act(() => useGame.getState().enterBuild());
    act(() => useGame.getState().pickItem('plant'));
    act(() => useGame.getState().setBuildCell({ x: occupied.x, z: occupied.z }));
    expect(screen.getByTestId('place')).toBeDisabled();
    expect(screen.getByTestId('placement-bar')).toHaveTextContent('La place est déjà prise.');

    const cell = freeCell();
    act(() => useGame.getState().setBuildCell(cell));
    expect(screen.getByTestId('place')).toBeEnabled();
    await userEvent.click(screen.getByTestId('place'));
    expect(useGame.getState().view!.items.some((i) => i.x === cell.x && i.z === cell.z)).toBe(true);
  });

  it('déplace un objet posé depuis le mode construction', async () => {
    await startGame();
    act(() => useGame.getState().enterBuild());
    const item = useGame.getState().view!.items.find((i) => i.kind === 'premium-coffee-machine')!;
    act(() => useGame.getState().select({ type: 'item', id: item.id }));
    await userEvent.click(screen.getByRole('button', { name: /Déplacer/ }));
    expect(useGame.getState().build).toMatchObject({
      kind: 'premium-coffee-machine',
      movingItemId: item.id,
      cell: { x: item.x, z: item.z },
    });
    expect(screen.queryByTestId('catalog')).toBeNull();

    const cell = freeCell('premium-coffee-machine');
    act(() => useGame.getState().setBuildCell(cell));
    await userEvent.click(screen.getByRole('button', { name: /Déplacer ici/ }));
    expect(useGame.getState().view!.items.find((i) => i.id === item.id)).toMatchObject(cell);
  });

  it('affiche les actions d’un objet sélectionné et le revend', async () => {
    await startGame();
    const item = useGame.getState().view!.items[0]!;
    act(() => useGame.getState().select({ type: 'item', id: item.id }));
    await userEvent.click(screen.getByRole('button', { name: /Revendre/ }));
    expect(useGame.getState().view!.items.some((i) => i.id === item.id)).toBe(false);
  });

  it('les objets verrouillés ne sont pas achetables', async () => {
    await startGame();
    await userEvent.click(screen.getByRole('button', { name: /Construction/ }));
    await userEvent.click(screen.getByRole('tab', { name: /Détente/ }));
    expect(screen.getByTestId('catalog-slide')).toBeDisabled();
    expect(screen.getByTestId('catalog-slide')).toHaveTextContent('Débloqué en');
  });
});

describe('Options et accessibilité', () => {
  it('change la qualité, la taille du texte et la réduction des animations', async () => {
    await startGame();
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

  it('affiche les crédits Kenney et les assets manquants', async () => {
    await startGame();
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Crédits' }));
    expect(screen.getByText(/licence CC0/)).toBeInTheDocument();
    expect(screen.getByText('Babyfoot')).toBeInTheDocument();
  });
});

describe('Étapes du sprint', () => {
  it('affiche une carte d’événement et applique le choix', async () => {
    const simulation = officeSimulation(SEED_OFFICE);
    simulation.dispatch({ type: 'START_SPRINT' });
    simulation.state.events.pending = { cardId: 'coffee-machine-broken', level: 0, drawnAtTick: 0 };
    await startGame(simulation);
    const card = screen.getByRole('dialog', { name: /machine à café/i });
    const choices = within(card).getAllByRole('button');
    expect(choices.length).toBeGreaterThanOrEqual(2);
    expect(choices[0]).toHaveFocus();
    await userEvent.click(choices[0]!);
    expect(useGame.getState().view!.event).toBeNull();
    expect(screen.queryByRole('dialog', { name: /machine à café/i })).not.toBeInTheDocument();
  });

  it('montre la démo de fin de sprint puis passe au sprint suivant', async () => {
    const simulation = officeSimulation(SEED_OFFICE);
    playSprint(simulation);
    await startGame(simulation);
    const demo = screen.getByRole('dialog', { name: /Démo du sprint 1/ });
    expect(within(demo).getByText('Utilisateurs')).toBeInTheDocument();
    await userEvent.click(within(demo).getByRole('button', { name: 'Sprint suivant' }));
    expect(useGame.getState().view).toMatchObject({ step: 'PLANNING', time: { sprint: 2 } });
  });

  it('joue le mini-jeu de levée de fonds jusqu’à la décision', async () => {
    await startGame();
    await userEvent.click(screen.getByRole('button', { name: /Lever des fonds/ }));
    for (let round = 0; round < 3; round++) {
      const pitch = screen.getByRole('dialog', { name: 'Levée de fonds' });
      const options = within(pitch).getAllByRole('button');
      await userEvent.click(options[0]!);
    }
    const result = useGame.getState().view!.pitch!.result!;
    const dialog = screen.getByRole('dialog', { name: 'Levée de fonds' });
    expect(
      within(dialog).getByText(result.success ? /Signé/ : /revenir vers toi/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retour au bureau' }));
    expect(useGame.getState().view!.step).toBe('PLANNING');
    // Une seule levée tous les 3 sprints.
    expect(screen.getByRole('button', { name: /Lever des fonds/ })).toBeDisabled();
  });

  it('annonce la faillite et revient au menu', async () => {
    const simulation = officeSimulation(SEED_OFFICE);
    simulation.state.gauges.treasury = 1;
    playSprint(simulation);
    await startGame(simulation);
    expect(screen.getByRole('dialog', { name: 'Faillite' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Menu principal' }));
    expect(useGame.getState().view).toBeNull();
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
