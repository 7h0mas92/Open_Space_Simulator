import { describe, expect, it } from 'vitest';
import { APP_BUILD, formatBuild } from '../../src/version';

describe('version du jeu', () => {
  it('est écrite au build : numéro, commit court et date', () => {
    expect(APP_BUILD.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(APP_BUILD.commit.length).toBeGreaterThan(0);
    expect(APP_BUILD.commit.length).toBeLessThanOrEqual(7);
    expect(Number.isNaN(new Date(APP_BUILD.date).getTime())).toBe(false);
  });

  it('se lit « 0.1.0 · commit · date »', () => {
    const build = { version: '0.1.0', commit: 'a35875d', date: '2026-10-10T12:05:00Z' };
    const text = formatBuild(build, 'fr');
    expect(text.startsWith('0.1.0 · a35875d · ')).toBe(true);
    expect(text).toContain('2026');
  });

  it('ignore une date illisible', () => {
    expect(formatBuild({ version: '0.1.0', commit: 'dev', date: 'n/a' }, 'en')).toBe('0.1.0 · dev');
  });
});
