import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { metaApi } from '../../../src/api/meta';
import { useSlack } from '../../../src/slack/store';
import i18n from '../../../src/i18n';
import { sparklinePoints } from '../../../src/ui/dashboard/Dashboard';
import {
  formatClock,
  formatGauge,
  gaugeRatio,
  gaugeTrend,
  intlLocale,
  isGaugeCritical,
  sprintProgress,
} from '../../../src/ui/game/format';
import { GameScreen } from '../../../src/ui/game/GameScreen';
import { useGame } from '../../../src/ui/store/game';
import { useSession } from '../../../src/ui/store/session';
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

  it('montre la phase, l’équipe et les mois de trésorerie restants', async () => {
    await startGame();
    const view = useGame.getState().view!;
    expect(view.runwayMonths).toBeGreaterThan(0);
    const facts = screen.getByText(`${view.devs.length}/${view.teamMax}`).closest('p')!;
    expect(facts).toHaveTextContent(`${Math.floor(view.runwayMonths!)} mois`);
    expect(screen.getByRole('button', { name: /^Phase : / })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /Avancement du sprint/ })).toBeInTheDocument();
  });

  it('sépare le dock d’actions des boutons système (sauvegardes, options)', async () => {
    await startGame();
    const dock = screen.getByRole('navigation', { name: 'Actions du jeu' });
    expect(within(dock).getAllByRole('button')).toHaveLength(6);
    for (const name of ['Kanban', 'Équipe', 'Recrutement', 'Construction', 'Dashboard', 'Slack'])
      expect(within(dock).getByRole('button', { name })).toBeInTheDocument();
    const system = screen.getByRole('group', { name: 'Partie' });
    await userEvent.click(within(system).getByRole('button', { name: 'Options' }));
    expect(screen.getByRole('dialog', { name: 'Options' })).toBeInTheDocument();
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

  it('montre la performance globale et la productivité des 2 derniers sprints', async () => {
    const simulation = officeSimulation(SEED_OFFICE);
    playSprint(simulation);
    simulation.dispatch({ type: 'END_DEMO' });
    playSprint(simulation);
    simulation.dispatch({ type: 'END_DEMO' });
    await startGame(simulation);
    const dev = useGame.getState().view!.devs.find((d) => d.role !== 'GHOST')!;
    const [last, previous] = dev.performance.lastSprints;
    expect(last!.sprint).toBe(previous!.sprint + 1);
    await userEvent.click(screen.getByRole('button', { name: /Équipe/ }));
    await userEvent.click(screen.getByRole('button', { name: new RegExp(dev.name) }));
    expect(screen.getByRole('heading', { name: 'Performance globale' })).toBeInTheDocument();
    expect(screen.getByText(`${dev.performance.score}`)).toBeInTheDocument();
    const sprints = screen.getByRole('region', { name: 'Productivité par sprint' });
    expect(within(sprints).getByText('Dernier sprint')).toBeInTheDocument();
    expect(within(sprints).getByText("Sprint d'avant")).toBeInTheDocument();
    expect(within(sprints).getByText(`Sprint ${last!.sprint}`)).toBeInTheDocument();
    expect(within(sprints).getByText(`Sprint ${previous!.sprint}`)).toBeInTheDocument();
    expect(screen.getByText('Ancienneté')).toBeInTheDocument();
  });

  it('détaille chaque candidat : performance estimée, marché, chances d’accepter', async () => {
    await startGame();
    await userEvent.click(screen.getByRole('button', { name: /Recrutement/ }));
    expect(screen.getAllByText('Performance estimée')).toHaveLength(3);
    expect(screen.getAllByText('Salaire du marché')).toHaveLength(3);
    // L'offre par défaut est la demande du candidat : il n'est pas sûr d'accepter.
    const chance = screen.getAllByText(/Chances qu'il ou elle accepte cette offre/)[0]!;
    const slider = screen.getAllByRole('slider')[0]!;
    fireEvent.change(slider, { target: { value: slider.getAttribute('max') } });
    expect(chance).toHaveTextContent('100 %');
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
    expect(screen.getByText('Plante verte : posé !')).toHaveClass('toast-success');
    // L'objet reste en main, l'aperçu saute sur une case libre : Entrée en pose un deuxième.
    const build = useGame.getState().build!;
    expect(build).toMatchObject({ kind: 'plant', placed: 1 });
    expect(build.cell).not.toEqual(cell);
    expect(screen.getByTestId('placed-count')).toHaveTextContent('1 posé');
    await userEvent.keyboard('{Enter}');
    expect(useGame.getState().view!.items).toHaveLength(before.items.length + 2);
    expect(useGame.getState().build).toMatchObject({ kind: 'plant', placed: 2 });
    // « Annuler » lâche l'objet et rouvre le catalogue.
    await userEvent.click(screen.getByRole('button', { name: /Annuler/ }));
    expect(useGame.getState().build).toMatchObject({ kind: null });
  });

  it('revient au catalogue quand le maximum est atteint', async () => {
    await startGame();
    act(() => useGame.getState().enterBuild());
    act(() => useGame.getState().pickItem('trashcan'));
    for (let i = 0; i < 2; i++) {
      act(() => useGame.getState().setBuildCell(freeCell('trashcan')));
      await act(() => useGame.getState().placeAt());
    }
    // 2 poubelles au maximum : la deuxième pose ramène au catalogue.
    expect(useGame.getState().build).toMatchObject({ kind: null });
    expect(screen.getByText(/maximum atteint, retour au catalogue/)).toBeInTheDocument();
  });

  it('choisit la couleur avant de poser, puis repeint un objet posé', async () => {
    await startGame();
    act(() => useGame.getState().enterBuild());
    await userEvent.click(screen.getByRole('tab', { name: /Travail/ }));
    await userEvent.click(screen.getByTestId('catalog-desk'));
    await userEvent.click(screen.getByTestId('color-button'));
    await userEvent.click(screen.getByRole('radio', { name: 'Bleu' }));
    expect(useGame.getState().build?.color).toBe('blue');
    const cell = freeCell('desk');
    act(() => useGame.getState().setBuildCell(cell));
    await userEvent.click(screen.getByTestId('place'));
    const desk = useGame.getState().view!.items.find((i) => i.x === cell.x && i.z === cell.z)!;
    expect(desk).toMatchObject({ kind: 'desk', color: 'blue' });
    // La couleur est retenue pour le prochain bureau.
    await userEvent.click(screen.getByRole('button', { name: /Annuler/ }));
    await userEvent.click(screen.getByTestId('catalog-desk'));
    expect(useGame.getState().build?.color).toBe('blue');
    await userEvent.keyboard('{Escape}');

    act(() => useGame.getState().select({ type: 'item', id: desk.id }));
    await userEvent.click(screen.getByRole('button', { name: /Couleur : Bleu/ }));
    await userEvent.click(screen.getByRole('radio', { name: 'Rose' }));
    expect(useGame.getState().view!.items.find((i) => i.id === desk.id)?.color).toBe('pink');
  });

  it('pose un accessoire sur un bureau, pas au sol', async () => {
    await startGame();
    act(() => useGame.getState().enterBuild());
    const desk = useGame.getState().view!.items.find((i) => i.kind === 'ikea-desk')!;
    await userEvent.click(screen.getByRole('tab', { name: /Accessoires/ }));
    await userEvent.click(screen.getByTestId('catalog-rubber-duck'));
    act(() => useGame.getState().setBuildCell(freeCell()));
    expect(screen.getByTestId('place')).toBeDisabled();
    expect(screen.getByTestId('placement-bar')).toHaveTextContent('meuble à plateau');

    act(() => useGame.getState().setBuildCell({ x: desk.x, z: desk.z }));
    await userEvent.click(screen.getByTestId('place'));
    const duck = useGame.getState().view!.items.find((i) => i.kind === 'rubber-duck');
    expect(duck?.host).toMatchObject({ id: desk.id });
    // Toujours en main : le deuxième canard prend l'autre emplacement du bureau.
    act(() => useGame.getState().setBuildCell({ x: desk.x, z: desk.z }));
    await userEvent.click(screen.getByTestId('place'));
    const ducks = useGame.getState().view!.items.filter((i) => i.kind === 'rubber-duck');
    expect(new Set(ducks.map((d) => d.host?.slot))).toEqual(new Set([0, 1]));
    act(() => useGame.getState().setBuildCell({ x: desk.x, z: desk.z }));
    expect(screen.getByTestId('placement-bar')).toHaveTextContent('Plus de place sur ce meuble');
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

  it('cache le Slack IA tant qu’il ne peut pas marcher (invité)', async () => {
    const status = vi.spyOn(metaApi.slackAi, 'status');
    useSession.setState({ status: 'guest' });
    await startGame();
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    expect(screen.queryByRole('checkbox', { name: /Slack/ })).not.toBeInTheDocument();
    expect(status).not.toHaveBeenCalled();
    status.mockRestore();
  });

  it('propose le Slack IA au joueur connecté quand le serveur l’active', async () => {
    const status = vi
      .spyOn(metaApi.slackAi, 'status')
      .mockResolvedValue({ enabled: true, dailyQuota: 50 });
    useSession.setState({ status: 'authenticated' });
    await startGame();
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    await userEvent.click(await screen.findByRole('checkbox', { name: /Slack/ }));
    expect(useSettings.getState().slackAi).toBe(true);
    await waitFor(() => expect(useSlack.getState().ai).toBe('on'));
    useSession.setState({ status: 'guest' });
    status.mockRestore();
  });

  it('cache le Slack IA quand le serveur n’a pas de clé', async () => {
    const status = vi
      .spyOn(metaApi.slackAi, 'status')
      .mockResolvedValue({ enabled: false, dailyQuota: 0 });
    useSession.setState({ status: 'authenticated' });
    useSettings.setState({ slackAi: true });
    await startGame();
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    await waitFor(() => expect(status).toHaveBeenCalled());
    expect(screen.queryByRole('checkbox', { name: /Slack/ })).not.toBeInTheDocument();
    // Même coché auparavant, l'option reste sans effet : aucun appel à l'IA.
    expect(useSlack.getState().ai).toBe('off');
    useSession.setState({ status: 'guest' });
    useSettings.setState({ slackAi: false });
    status.mockRestore();
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

  it('choisit une réponse à une carte avec les touches 1, 2, 3', async () => {
    const simulation = officeSimulation(SEED_OFFICE);
    simulation.dispatch({ type: 'START_SPRINT' });
    simulation.state.events.pending = { cardId: 'coffee-machine-broken', level: 0, drawnAtTick: 0 };
    await startGame(simulation);
    const card = screen.getByRole('dialog', { name: /machine à café/i });
    expect(within(card).getAllByRole('button')[1]).toHaveAttribute('aria-keyshortcuts', '2');
    await userEvent.keyboard('2');
    expect(useGame.getState().view!.event).toBeNull();
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

  it('donne la tendance des jauges et l’avancement du sprint', () => {
    const gauges = { treasury: 1_000_000, coffee: 50, debt: 20, stability: 80, hype: 30, users: 0 };
    const history = [
      { ...gauges, treasury: 1_200_000, debt: 10 },
      { ...gauges, treasury: 1_100_000 },
    ];
    expect(gaugeTrend({ gauges, history }, 'treasury')).toBe(-1);
    expect(gaugeTrend({ gauges, history }, 'debt')).toBe(1);
    expect(gaugeTrend({ gauges, history }, 'coffee')).toBe(0);
    expect(gaugeTrend({ gauges, history: [] }, 'hype')).toBe(0);
    expect(sprintProgress({ day: 0, minute: 0 })).toBe(0);
    expect(sprintProgress({ day: 7, minute: 0 })).toBe(0.5);
    expect(sprintProgress({ day: 14, minute: 600 })).toBe(1);
  });

  it('trace les courbes du dashboard', () => {
    expect(sparklinePoints([])).toBe('');
    expect(sparklinePoints([1, 1], 100, 10)).toBe('0.0,6.0 100.0,6.0');
    expect(sparklinePoints([0, 10], 100, 10)).toBe('0.0,6.0 100.0,4.0');
  });
});
