import {
  DECOR_THEMES,
  GameStateSchema,
  RECENT_TASK_TITLES_MAX,
  TASK_TYPES,
  URGENT_TEMPLATES,
  WEEKLY_TEMPLATES,
} from '@oss/shared';
import { describe, expect, it } from 'vitest';
import {
  DESIGN_EXTRA_TITLES,
  GROWTH_TASK_TITLES,
  PRODUCT_EXTRA_TITLES,
  SEASON_TASK_TITLES,
  TASK_TITLES,
} from '../../src/simulation/data/tasks';
import { Rng } from '../../src/simulation/rng';
import { createTask, refillBacklog, removeTask, tasksInColumn } from '../../src/simulation/tasks';
import { titlePool } from '../../src/simulation/taskTitles';
import { makeContext, newSimulation, stateWithTeam } from './fixtures';

/** Générateur qui compte ses tirages, pour vérifier que les titres n'en ajoutent aucun. */
class CountingRng extends Rng {
  draws = 0;

  constructor() {
    super([7, 8, 9, 10]);
  }

  override next(): number {
    this.draws += 1;
    return super.next();
  }
}

function boardTitles(state: ReturnType<typeof stateWithTeam>['state']): string[] {
  return Object.values(state.components.task).map((task) => task!.title.fr);
}

describe('Variété des tâches du Kanban', () => {
  it('le catalogue est large, bilingue et sans doublon', () => {
    const all = [
      ...TASK_TYPES.flatMap((type) => TASK_TITLES[type]),
      ...Object.values(GROWTH_TASK_TITLES).flatMap((byType) => Object.values(byType).flat()),
      ...DECOR_THEMES.flatMap((theme) => Object.values(SEASON_TASK_TITLES[theme])),
      ...[DESIGN_EXTRA_TITLES, PRODUCT_EXTRA_TITLES].flatMap((extra) =>
        Object.values(extra).flat(),
      ),
    ];
    for (const type of TASK_TYPES) expect(TASK_TITLES[type].length).toBeGreaterThanOrEqual(24);
    expect(all.length).toBeGreaterThanOrEqual(200);
    for (const [fr, en] of all) {
      expect(fr.trim()).not.toBe('');
      expect(en.trim()).not.toBe('');
    }
    // Le titre français sert de clé contre les répétitions : il doit être unique.
    expect(new Set(all.map(([fr]) => fr)).size).toBe(all.length);
  });

  it('plus de tâches urgentes et hebdomadaires, identifiants uniques', () => {
    expect(URGENT_TEMPLATES.length).toBeGreaterThanOrEqual(11);
    expect(WEEKLY_TEMPLATES.length).toBeGreaterThanOrEqual(12);
    const ids = [...URGENT_TEMPLATES, ...WEEKLY_TEMPLATES].map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('le catalogue grandit avec la phase', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD']);
    state.phase = 'GARAGE';
    const garage = titlePool(state, 'DEV', 'INFRA').map(([fr]) => fr);
    state.phase = 'UNICORN';
    const unicorn = titlePool(state, 'DEV', 'INFRA').map(([fr]) => fr);
    const sso = GROWTH_TASK_TITLES.UNICORN.INFRA[0]![0];
    expect(garage).not.toContain(sso);
    expect(unicorn).toContain(sso);
    expect(unicorn).toContain(GROWTH_TASK_TITLES.SEED.INFRA[0]![0]);
    expect(unicorn.length).toBeGreaterThan(garage.length);
  });

  it('jamais deux fois la même tâche sur le tableau', () => {
    const { state } = stateWithTeam([
      'SENIOR_BEARD',
      'TEN_X',
      'INTERN',
      'RUSTACEAN',
      'AI_AGENT',
      'DESIGNER',
      'PRODUCT_OWNER',
    ]);
    const ctx = makeContext(state);
    for (let i = 0; i < 6; i++) refillBacklog(state, ctx.rng);
    const titles = boardTitles(state);
    expect(titles.length).toBeGreaterThan(10);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('pas de répétition d’un sprint à l’autre tant qu’il reste des idées neuves', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD']);
    const rng = makeContext(state).rng;
    const seen: string[] = [];
    // Une tâche créée puis livrée (retirée) à chaque fois : le tableau ne la retient pas.
    for (let i = 0; i < 30; i++) {
      const id = createTask(state, rng, 'FEATURE');
      seen.push(state.components.task[id]!.title.fr);
      removeTask(state, id);
    }
    expect(new Set(seen).size).toBe(30);
    expect(state.recentTaskTitles.length).toBeLessThanOrEqual(RECENT_TASK_TITLES_MAX);
  });

  it('la designeuse et le PO ont aussi de nouveaux titres', () => {
    const { state } = stateWithTeam(['DESIGNER']);
    const rng = makeContext(state).rng;
    const titles = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const id = createTask(state, rng, undefined, 'DESIGN');
      titles.add(state.components.task[id]!.title.fr);
      removeTask(state, id);
    }
    expect(titles.size).toBeGreaterThan(11);
  });

  it('le titre ne consomme aucun tirage de plus dans le générateur de la partie', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD', 'DESIGNER']);
    const rng = new CountingRng();
    // Code : taille + titre (comme l'ancien `rng.pick`). Design : modèle + taille.
    createTask(state, rng, 'BUGFIX', 'DEV');
    expect(rng.draws).toBe(2);
    rng.draws = 0;
    createTask(state, rng, undefined, 'DESIGN');
    expect(rng.draws).toBe(2);
  });

  it('en période de Noël, des tâches de saison apparaissent', () => {
    const simulation = newSimulation('noel-2026-12-21');
    const { state } = simulation;
    const rng = makeContext(state).rng;
    const christmas = new Set(Object.values(SEASON_TASK_TITLES.CHRISTMAS).map(([fr]) => fr));
    let seasonal = 0;
    for (let i = 0; i < 40; i++) {
      const id = createTask(state, rng);
      if (christmas.has(state.components.task[id]!.title.fr)) seasonal += 1;
      removeTask(state, id);
    }
    expect(seasonal).toBeGreaterThan(0);
    // Hors saison, aucune.
    const summer = newSimulation('ete-2026-07-06').state;
    for (const id of tasksInColumn(summer, 'BACKLOG'))
      expect(christmas.has(summer.components.task[id]!.title.fr)).toBe(false);
  });

  it('une sauvegarde d’avant la mémoire des titres se recharge', () => {
    const { state } = newSimulation('old-save');
    const old = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    delete old.recentTaskTitles;
    expect(GameStateSchema.parse(old).recentTaskTitles).toEqual([]);
  });
});
