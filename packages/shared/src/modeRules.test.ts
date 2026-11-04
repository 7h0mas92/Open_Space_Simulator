import { describe, expect, it } from 'vitest';
import { MENU_MODES, UNLOCK_MODES, modeRules } from './game.js';
import { skillsEnabled } from './sim/skills.js';

describe('règles par mode', () => {
  it('garde les listes historiques', () => {
    expect(MENU_MODES).not.toContain('STORY');
    expect(UNLOCK_MODES).toEqual([
      'EASY',
      'NORMAL',
      'HARDCORE',
      'INTERNS_ONLY',
      'SHIP_IN_3',
      'ENDLESS',
    ]);
    expect(skillsEnabled('DAILY')).toBe(false);
    expect(skillsEnabled('STORY')).toBe(true);
  });

  it('seul le Hardcore joue en temps réel', () => {
    expect(modeRules('HARDCORE')).toMatchObject({
      canPause: false,
      cardsPauseTime: false,
      buildDuringRun: false,
      guide: false,
    });
    expect(modeRules('NORMAL').canPause).toBe(true);
  });
});
