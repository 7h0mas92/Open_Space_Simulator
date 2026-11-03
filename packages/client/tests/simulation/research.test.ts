import { describe, expect, it } from 'vitest';
import {
  COMPUTERS,
  FLOOR_MATERIALS,
  FURNITURE_CATALOG,
  MEETING_FORMATS,
  MONITORS,
  PRESTIGE_REWARDS,
  RESEARCH,
  RESEARCH_FREE,
  RESEARCH_TREE,
  WALL_FINISHES,
  researchNodeOf,
  type GameState,
  type ResearchKey,
} from '@oss/shared';
import { defaultCardLibrary } from '../../src/events/defaultCards';
import { createBot, findFreeSpot, playWithBot } from '../../src/simulation/bots';
import { replay } from '../../src/simulation/replay';
import { beatRivalsThisSprint, researchSprint } from '../../src/simulation/research';
import { Simulation } from '../../src/simulation/simulation';
import { hasUnlock } from '../../src/simulation/unlocks';
import { toGameView } from '../../src/view/adapter';
import { shopStatus } from '../../src/view/placement';
import { catalogItem } from '../../src/view/catalog';
import { makeContext } from './fixtures';

const cards = defaultCardLibrary();
const VIEW_CONTEXT = { speed: 1, running: false, card: () => undefined } as const;

function campaign(seed = 'rd'): Simulation {
  return Simulation.create({ seed, mode: 'STORY', mission: 'campaign' }, cards);
}

function research(state: GameState) {
  const tree = state.story?.campaign?.research;
  if (!tree) throw new Error('Pas d’arbre R&D');
  return tree;
}

/** Achète un objet à la première place libre. */
function buy(simulation: Simulation, itemId: string) {
  const spot = findFreeSpot(simulation.state, itemId);
  if (!spot) throw new Error(`Pas de place pour ${itemId}`);
  return simulation.dispatch({ type: 'BUY_FURNITURE', itemId, ...spot, rotation: 0 }).result;
}

describe('Arbre R&D : catalogue', () => {
  it('chaque contenu du catalogue est au départ, dans un seul niveau, ou en Prestige', () => {
    const keys: { key: ResearchKey; unlock?: string | undefined }[] = [
      ...FURNITURE_CATALOG.map((item) => ({
        key: `item:${item.id}` as const,
        unlock: item.unlock,
      })),
      ...COMPUTERS.map((computer) => ({ key: `computer:${computer.id}` as const })),
      ...MONITORS.map((monitor) => ({ key: `monitor:${monitor.id}` as const })),
      ...WALL_FINISHES.map((finish) => ({
        key: `wall:${finish.id}` as const,
        unlock: finish.unlock,
      })),
      ...FLOOR_MATERIALS.map((m) => ({ key: `floor:${m.id}` as const, unlock: m.unlock })),
      ...MEETING_FORMATS.map((format) => ({ key: `meeting:${format.id}` as const })),
    ];
    const missing = keys.filter(
      ({ key, unlock }) =>
        unlock === undefined && !RESEARCH_FREE.includes(key) && researchNodeOf(key) === undefined,
    );
    expect(missing.map(({ key }) => key)).toEqual([]);
    const all = RESEARCH_TREE.flatMap((node) => node.keys);
    expect(new Set(all).size).toBe(all.length);
    // Aucune clé de l'arbre n'est inventée : chacune existe dans un catalogue (ou le bras).
    const known = new Set<string>([...keys.map(({ key }) => key), 'monitor:arm']);
    expect(all.filter((key) => !known.has(key))).toEqual([]);
  });

  it('5 branches de 4 niveaux, de plus en plus chers', () => {
    expect(RESEARCH_TREE).toHaveLength(20);
    expect([1, 2, 3, 4].map((level) => RESEARCH.cost[level as 1 | 2 | 3 | 4])).toEqual(
      [...Object.values(RESEARCH.cost)].sort((a, b) => a - b),
    );
  });

  it('chaque objectif de l’histoire reste faisable : salle, chats et serveurs avant leur acte', () => {
    // Salle de réunion (« Réunion utile », acte I), chats et local serveur (acte II).
    expect(researchNodeOf('meeting:standup')?.level).toBeLessThanOrEqual(2);
    expect(researchNodeOf('item:litter-open')?.level).toBeLessThanOrEqual(3);
    expect(researchNodeOf('item:cat-tree-small')?.level).toBeLessThanOrEqual(3);
    expect(researchNodeOf('item:server-closet')?.level).toBeLessThanOrEqual(3);
    expect(researchNodeOf('item:rack-server')?.level).toBeLessThanOrEqual(3);
  });
});

describe('Arbre R&D : partie', () => {
  it('seule la longue partie du mode Histoire a un arbre', () => {
    expect(campaign().state.story?.campaign?.research).toEqual({
      points: RESEARCH.start,
      earned: RESEARCH.start,
      nodes: [],
      goalsCounted: 0,
    });
    const normal = Simulation.create({ seed: 'n', mode: 'NORMAL' }, cards);
    expect(toGameView(normal.state, VIEW_CONTEXT).research).toBeNull();
    const mission = Simulation.create({ seed: 'm', mode: 'STORY', mission: 'first-commit' }, cards);
    expect(mission.state.story?.campaign).toBeUndefined();
    expect(mission.dispatch({ type: 'RESEARCH_NODE', nodeId: 'comfort-1' }).result).toEqual({
      ok: false,
      error: 'NOT_ELIGIBLE',
    });
  });

  it('hors histoire, rien n’est verrouillé par l’arbre', () => {
    const normal = Simulation.create({ seed: 'n', mode: 'NORMAL' }, cards);
    normal.state.gauges.treasury = 1_000_000;
    expect(buy(normal, 'bookcase')).toEqual({ ok: true });
  });

  it('un objet pas encore recherché est refusé, puis en vente une fois le niveau pris', () => {
    const simulation = campaign();
    const { state } = simulation;
    state.gauges.treasury = 1_000_000;
    expect(buy(simulation, 'bookcase')).toEqual({ ok: false, error: 'LOCKED' });
    expect(buy(simulation, 'plant')).toEqual({ ok: true });
    const view = toGameView(state, VIEW_CONTEXT);
    const bookcase = catalogItem('bookcase');
    expect(bookcase && shopStatus(bookcase, view).block).toBe('researchLocked');

    expect(simulation.dispatch({ type: 'RESEARCH_NODE', nodeId: 'comfort-1' }).result).toEqual({
      ok: true,
    });
    expect(research(state)).toMatchObject({ points: RESEARCH.start - RESEARCH.cost[1] });
    expect(research(state).nodes).toEqual(['comfort-1']);
    expect(buy(simulation, 'bookcase')).toEqual({ ok: true });
    expect(bookcase && shopStatus(bookcase, toGameView(state, VIEW_CONTEXT)).block).toBeNull();
  });

  it('refuse un niveau sans le précédent, avant son acte, sans assez de points, ou déjà pris', () => {
    const simulation = campaign();
    const tree = research(simulation.state);
    tree.points = 100;
    const take = (nodeId: 'kitchen-1' | 'kitchen-2' | 'kitchen-3') =>
      simulation.dispatch({ type: 'RESEARCH_NODE', nodeId }).result;
    expect(take('kitchen-2')).toEqual({ ok: false, error: 'LOCKED' });
    expect(take('kitchen-1')).toEqual({ ok: true });
    expect(take('kitchen-1')).toEqual({ ok: false, error: 'NOT_ELIGIBLE' });
    // Niveau 2 : il faut l'acte I (« La course »).
    expect(take('kitchen-2')).toEqual({ ok: false, error: 'LOCKED' });
    simulation.state.story!.campaign!.act = 1;
    tree.points = 1;
    expect(take('kitchen-2')).toEqual({ ok: false, error: 'NOT_ENOUGH_POINTS' });
    tree.points = 100;
    expect(take('kitchen-2')).toEqual({ ok: true });
    expect(take('kitchen-3')).toEqual({ ok: false, error: 'LOCKED' });
  });

  it('verrouille aussi les ordinateurs, écrans, murs, sols et formules de salle', () => {
    const simulation = campaign();
    const { state } = simulation;
    state.gauges.treasury = 1_000_000;
    state.phase = 'SEED';
    expect(
      simulation.dispatch({ type: 'COVER_WALL', zone: 'back-open', finish: 'sage' }).result,
    ).toEqual({ ok: false, error: 'LOCKED' });
    expect(simulation.dispatch({ type: 'FIT_MEETING_ROOM', format: 'standup' }).result).toEqual({
      ok: false,
      error: 'LOCKED',
    });
    research(state).points = 100;
    simulation.dispatch({ type: 'RESEARCH_NODE', nodeId: 'ambiance-1' });
    simulation.dispatch({ type: 'RESEARCH_NODE', nodeId: 'organisation-1' });
    expect(
      simulation.dispatch({ type: 'COVER_WALL', zone: 'back-open', finish: 'sage' }).result,
    ).toEqual({ ok: true });
    expect(simulation.dispatch({ type: 'FIT_MEETING_ROOM', format: 'standup' }).result).toEqual({
      ok: true,
    });
    // Ordinateur et écran d'un bureau de dev (posé sans recherche : il fait partie du départ).
    expect(buy(simulation, 'desk')).toEqual({ ok: true });
    const furnitureId = Object.keys(state.components.furniture).find(
      (id) => state.components.furniture[id]?.itemId === 'desk',
    )!;
    const setComputer = () =>
      simulation.dispatch({ type: 'SET_COMPUTER', furnitureId, computer: 'gaming-neon' }).result;
    const setMonitor = () =>
      simulation.dispatch({
        type: 'SET_MONITOR',
        furnitureId,
        model: 'gaming',
        size: 'medium',
        mount: 'stand',
      }).result;
    expect(setComputer()).toEqual({ ok: false, error: 'LOCKED' });
    expect(setMonitor()).toEqual({ ok: false, error: 'LOCKED' });
    simulation.dispatch({ type: 'RESEARCH_NODE', nodeId: 'tech-1' });
    expect(setComputer()).toEqual({ ok: true });
    expect(setMonitor()).toEqual({ ok: true });
  });
});

describe('Arbre R&D : points d’innovation', () => {
  it('features livrées et objectifs remplis rapportent des points à la démo', () => {
    const { state } = campaign();
    const ctx = makeContext(state);
    state.story!.campaign!.done.push('first-commit');
    researchSprint(state, ctx, 4);
    const expected = RESEARCH.start + 4 * RESEARCH.perFeature + RESEARCH.perGoal;
    expect(research(state)).toMatchObject({ points: expected, earned: expected, goalsCounted: 1 });
    expect(ctx.outbox.some((n) => n.kind === 'RESEARCH_POINTS')).toBe(true);
    // Le même objectif ne compte qu'une fois.
    researchSprint(state, ctx, 0);
    expect(research(state).points).toBe(expected);
  });

  it('battre tous les rivaux sur un sprint rapporte un bonus', () => {
    const { state } = campaign();
    const story = state.story!.campaign!;
    story.usersHistory = [100, 5_000];
    for (const rival of story.rivals) rival.history = [1_000, 1_200];
    expect(beatRivalsThisSprint(state)).toBe(true);
    for (const rival of story.rivals) rival.history = [1_000, 9_000];
    expect(beatRivalsThisSprint(state)).toBe(false);
    story.rivals = [];
    expect(beatRivalsThisSprint(state)).toBe(false);
  });

  it('sans arbre (vieille partie), aucun point et aucun verrou', () => {
    const simulation = campaign();
    const { state } = simulation;
    delete state.story!.campaign!.research;
    researchSprint(state, makeContext(state), 5);
    state.gauges.treasury = 1_000_000;
    expect(buy(simulation, 'bookcase')).toEqual({ ok: true });
  });
});

describe('Arbre R&D : Prestige', () => {
  it('la récompense d’un objectif rempli se débloque dans la partie', () => {
    const { state } = campaign();
    expect(PRESTIGE_REWARDS).toContain('item-unicorn-statue');
    expect(PRESTIGE_REWARDS).not.toContain('perk-espresso');
    expect(hasUnlock(state, 'wall-blueprint')).toBe(false);
    state.story!.campaign!.done.push('first-commit');
    expect(hasUnlock(state, 'wall-blueprint')).toBe(true);
    const view = toGameView(state, VIEW_CONTEXT);
    expect(view.unlocks).toContain('wall-blueprint');
    expect(view.research?.prestige.find((p) => p.reward === 'wall-blueprint')?.unlocked).toBe(true);
  });
});

describe('Arbre R&D : rejeu', () => {
  it('une histoire jouée par un bot se rejoue à l’identique, arbre compris', () => {
    const simulation = campaign('rd-bot');
    playWithBot(simulation, createBot('balanced', 'rd-bot'), cards, (s) => s.sprint >= 12);
    const tree = research(simulation.state);
    expect(tree.earned).toBeGreaterThan(RESEARCH.start);
    expect(tree.nodes.length).toBeGreaterThan(0);
    const replayed = replay({
      seed: 'rd-bot',
      mode: 'STORY',
      mission: 'campaign',
      commands: simulation.commands,
      cards,
    });
    expect(replayed.state.story?.campaign?.research).toEqual(tree);
  });
});
