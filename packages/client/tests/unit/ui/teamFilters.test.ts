import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  conflictsOf,
  DEFAULT_TEAM_FILTERS,
  filterTeam,
  toggle,
  type TeamFilters,
} from '../../../src/ui/team/filters';
import type { DevView } from '../../../src/view/types';
import { officeSimulation, SEED_OFFICE, viewOf } from '../fixtures/game';

/** L'équipe de la phase Seed (4 devs), avec des valeurs choisies pour chaque test. */
function team(overrides: readonly Partial<DevView>[]): DevView[] {
  const devs = viewOf(officeSimulation(SEED_OFFICE)).devs;
  return devs.map((dev, index) => ({ ...dev, ...overrides[index] }));
}

const withGrade = (dev: DevView, grade: 'S' | 'A' | 'B' | 'C' | 'D', score: number): DevView => ({
  ...dev,
  performance: { ...dev.performance, grade, score },
});

const filters = (patch: Partial<TeamFilters>): TeamFilters => ({
  ...DEFAULT_TEAM_FILTERS,
  ...patch,
});

describe('filtres de l’équipe', () => {
  it('sans filtre, garde tout le monde, du plus performant au moins performant', () => {
    const base = team([]);
    const devs = base.map((dev, index) => withGrade(dev, 'B', 50 + index * 10));
    const shown = filterTeam(devs, DEFAULT_TEAM_FILTERS);
    expect(shown).toHaveLength(devs.length);
    expect(shown.map((dev) => dev.performance.score)).toEqual([80, 70, 60, 50]);
    expect(filterTeam(devs, filters({ sort: 'PERF_ASC' }))[0]!.performance.score).toBe(50);
  });

  it('filtre par note de performance (plusieurs notes à la fois)', () => {
    const base = team([]);
    const devs = [
      withGrade(base[0]!, 'S', 95),
      withGrade(base[1]!, 'A', 80),
      withGrade(base[2]!, 'C', 40),
      withGrade(base[3]!, 'D', 10),
    ];
    const shown = filterTeam(devs, filters({ grades: ['S', 'D'] }));
    expect(shown.map((dev) => dev.performance.grade)).toEqual(['S', 'D']);
  });

  it('filtre par métier', () => {
    const devs = team([]);
    const shown = filterTeam(devs, filters({ role: 'INTERN' }));
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((dev) => dev.role === 'INTERN')).toBe(true);
  });

  it('repère les conflits entre collègues encore dans l’équipe', () => {
    const base = team([]);
    const [a, b, c] = base;
    const devs = team([
      { relations: { [b!.id]: -70, [c!.id]: -30, departed: -90 } },
      { relations: { [a!.id]: -70 } },
      { relations: { [a!.id]: 10 } },
    ]);
    expect(conflictsOf(devs[0]!, devs).map((dev) => dev.id)).toEqual([b!.id, c!.id]);
    const shown = filterTeam(devs, filters({ flags: ['CONFLICT'], sort: 'CONFLICTS_DESC' }));
    expect(shown.map((dev) => dev.id)).toEqual([a!.id, b!.id]);
  });

  it('cumule les situations : fatigué ET moral bas', () => {
    const devs = team([
      { energy: 20, morale: 20 },
      { energy: 20, morale: 90 },
      { energy: 90, morale: 20 },
      { energy: 90, morale: 90 },
    ]);
    expect(filterTeam(devs, filters({ flags: ['TIRED'] }))).toHaveLength(2);
    const both = filterTeam(devs, filters({ flags: ['TIRED', 'LOW_MORALE'] }));
    expect(both.map((dev) => dev.id)).toEqual([devs[0]!.id]);
  });

  it('sépare télétravail et bureau', () => {
    const devs = team([{ remoteReason: 'FATIGUE' }, { remoteReason: null }]);
    const remote = filterTeam(devs, filters({ flags: ['REMOTE'] }));
    const office = filterTeam(devs, filters({ flags: ['OFFICE'] }));
    expect(remote.every((dev) => dev.remoteReason !== null)).toBe(true);
    expect(office.every((dev) => dev.remoteReason === null)).toBe(true);
    expect(remote.length + office.length).toBe(devs.length);
  });

  it('trie par moral, énergie, salaire, ancienneté et nom', () => {
    const devs = team([
      { morale: 60, energy: 10, salary: 3000, name: 'Zoé' },
      { morale: 10, energy: 60, salary: 9000, name: 'Ali' },
      { morale: 30, energy: 30, salary: 5000, name: 'Max' },
      { morale: 90, energy: 90, salary: 1000, name: 'Bea' },
    ]);
    const first = (sort: TeamFilters['sort']) => filterTeam(devs, filters({ sort }))[0]!.name;
    expect(first('MORALE_ASC')).toBe('Ali');
    expect(first('ENERGY_ASC')).toBe('Zoé');
    expect(first('SALARY_DESC')).toBe('Ali');
    expect(filterTeam(devs, filters({ sort: 'NAME' })).map((dev) => dev.name)).toEqual([
      'Ali',
      'Bea',
      'Max',
      'Zoé',
    ]);
    expect(filterTeam(devs, filters({ sort: 'SENIORITY_DESC' }))).toHaveLength(4);
  });

  it('compte les filtres actifs, sans le tri', () => {
    expect(activeFilterCount(DEFAULT_TEAM_FILTERS)).toBe(0);
    expect(
      activeFilterCount(filters({ grades: ['A', 'B'], role: 'INTERN', flags: ['TIRED'] })),
    ).toBe(4);
    expect(toggle(['A'], 'B')).toEqual(['A', 'B']);
    expect(toggle(['A', 'B'], 'A')).toEqual(['B']);
  });
});
