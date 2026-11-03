import { describe, expect, it } from 'vitest';
import { GAME } from '../game.js';
import {
  ENDLESS,
  endlessCostMultiplier,
  endlessExtraChurn,
  endlessPressure,
  endlessRaiseShare,
} from '../sim/endless.js';
import { companyName } from './company.js';
import { compareGames, GLOBAL_EXCLUDED_MODES } from './leaderboard.js';

const game = (valuation: number, sprintsPlayed: number, createdAt = '2026-10-17T10:00:00Z') => ({
  valuation,
  sprintsPlayed,
  createdAt,
});

describe('companyName', () => {
  it('donne toujours le même nom pour une graine, et des noms variés', () => {
    expect(companyName('daily-2026-10-17')).toBe(companyName('daily-2026-10-17'));
    const names = new Set(Array.from({ length: 200 }, (_, i) => companyName(`seed-${i}`)));
    expect(names.size).toBeGreaterThan(100);
    for (const name of names) expect(name).toMatch(/^[A-Z][A-Za-z]+$/);
  });
});

describe('compareGames', () => {
  it('classe à la valorisation, puis à la date', () => {
    const sorted = [game(1, 39), game(5, 3), game(5, 39, '2026-10-16T10:00:00Z')].sort(
      compareGames('NORMAL'),
    );
    expect(sorted.map((g) => [g.valuation, g.sprintsPlayed])).toEqual([
      [5, 39],
      [5, 3],
      [1, 39],
    ]);
  });

  it('classe le mode illimité aux sprints tenus, puis à la valorisation', () => {
    const sorted = [game(9e9, 60), game(0, 120), game(5e8, 120)].sort(compareGames('ENDLESS'));
    expect(sorted.map((g) => [g.sprintsPlayed, g.valuation])).toEqual([
      [120, 5e8],
      [120, 0],
      [60, 9e9],
    ]);
  });

  it('laisse le Facile, l’Illimité et la Carrière hors du classement global', () => {
    expect(GLOBAL_EXCLUDED_MODES).toEqual(['EASY', 'ENDLESS', 'CAREER']);
  });
});

describe('pression du mode illimité', () => {
  it('ne commence qu’après les 18 mois, et seulement en mode illimité', () => {
    expect(endlessPressure('ENDLESS', GAME.totalSprints)).toBe(0);
    expect(endlessPressure('ENDLESS', GAME.totalSprints + 10)).toBe(10);
    expect(endlessPressure('NORMAL', 100)).toBe(0);
    expect(endlessCostMultiplier('ENDLESS', GAME.totalSprints + 25)).toBeCloseTo(
      1 + 25 * ENDLESS.fixedCostGrowthPerSprint + 625 * ENDLESS.fixedCostGrowthSquared,
    );
    expect(endlessRaiseShare('ENDLESS', GAME.totalSprints)).toBe(1);
    expect(endlessRaiseShare('ENDLESS', GAME.totalSprints + 20)).toBeCloseTo(
      1 / (1 + 20 * ENDLESS.raiseFatiguePerSprint),
    );
    expect(endlessRaiseShare('NORMAL', 200)).toBe(1);
    expect(endlessExtraChurn('HARDCORE', 80)).toBe(0);
    expect(endlessExtraChurn('ENDLESS', GAME.totalSprints + 2)).toBeCloseTo(
      2 * ENDLESS.churnPerSprint,
    );
  });
});
