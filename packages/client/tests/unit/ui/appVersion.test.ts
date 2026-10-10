import { describe, expect, it } from 'vitest';
import { APP_VERSION, formatVersionDate } from '../../../src/ui/menu/appVersion';
import pkg from '../../../package.json';

describe('version du jeu affichée au menu', () => {
  it('reprend le numéro du package, un hash court et une date valide', () => {
    expect(APP_VERSION.version).toBe(pkg.version);
    expect(APP_VERSION.commit).toMatch(/^([0-9a-f]{7}|dev)$/);
    expect(Number.isNaN(new Date(APP_VERSION.date).getTime())).toBe(false);
  });

  it('écrit la date dans la langue du joueur', () => {
    const iso = '2026-10-10T12:00:00+02:00';
    expect(formatVersionDate(iso, 'fr')).toBe('10 oct. 2026');
    expect(formatVersionDate(iso, 'en')).toBe('Oct 10, 2026');
  });

  it('retombe sur la date ISO pour une langue mal formée', () => {
    expect(formatVersionDate('2026-10-10T12:00:00+02:00', 'en-US@posix')).toBe('2026-10-10');
  });

  it("n'affiche rien pour une date illisible", () => {
    expect(formatVersionDate('pas une date', 'fr')).toBe('');
  });
});
