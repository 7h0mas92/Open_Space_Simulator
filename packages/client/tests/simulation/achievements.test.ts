import {
  ACHIEVEMENT_DIFFICULTIES,
  ACHIEVEMENTS,
  getAchievement,
  type GameState,
} from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { stateWithTeam } from './fixtures';

/** Vérifie la condition d'un succès sur un état donné. */
function passes(id: string, state: GameState): boolean {
  const achievement = getAchievement(id);
  if (!achievement?.check) throw new Error(`${id} n'a pas de condition`);
  return achievement.check(state);
}

describe('catalogue des succès', () => {
  it('a des identifiants uniques, chaque difficulté et des succès secrets', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const difficulty of ACHIEVEMENT_DIFFICULTIES)
      expect(ACHIEVEMENTS.some((a) => a.difficulty === difficulty)).toBe(true);
    expect(ACHIEVEMENTS.filter((a) => a.secret).length).toBeGreaterThanOrEqual(10);
    expect(ACHIEVEMENTS.filter((a) => !a.secret).length).toBeGreaterThanOrEqual(25);
  });
});

describe('conditions des nouveaux succès', () => {
  it('compte les profils présents dans l’équipe', () => {
    expect(passes('skynet', stateWithTeam(['AI_AGENT', 'AI_AGENT']).state)).toBe(false);
    expect(passes('skynet', stateWithTeam(['AI_AGENT', 'AI_AGENT', 'AI_AGENT']).state)).toBe(true);
    expect(passes('ghost-company', stateWithTeam(['GHOST', 'GHOST', 'GHOST']).state)).toBe(true);
    expect(passes('ghost-company', stateWithTeam(['GHOST', 'GHOST', 'INTERN']).state)).toBe(false);
    const all = stateWithTeam([
      'SENIOR_BEARD',
      'TEN_X',
      'INTERN',
      'RUSTACEAN',
      'DESIGNER',
      'PRODUCT_OWNER',
      'AI_AGENT',
      'GHOST',
    ]).state;
    expect(passes('gotta-catch', all)).toBe(true);
  });

  it('demande une affinité réciproque', () => {
    const { state, ids } = stateWithTeam(['INTERN', 'DESIGNER']);
    const [a = '', b = ''] = ids;
    const relations = state.components.relations;
    relations[a] = { ...relations[a], [b]: 100 };
    relations[b] = { ...relations[b], [a]: 40 };
    expect(passes('office-romance', state)).toBe(false);
    relations[b] = { ...relations[b], [a]: 100 };
    expect(passes('office-romance', state)).toBe(true);
  });

  it('lit les objets du bureau', () => {
    const { state } = stateWithTeam(['INTERN']);
    const place = (itemId: string, x: number) => {
      state.components.furniture[`e${900 + x}`] = {
        itemId,
        x,
        y: 0,
        rotation: 0,
        purchasePrice: 0,
      };
    };
    place('slide', 1);
    place('nap-pod', 2);
    expect(passes('google-campus', state)).toBe(false);
    place('canteen-table', 3);
    expect(passes('google-campus', state)).toBe(true);
  });

  it('ne valide les succès de fin de partie qu’une fois la partie finie', () => {
    const { state } = stateWithTeam(['INTERN']);
    state.stats.maxTeamSize = 2;
    expect(passes('lone-wolf', state)).toBe(false);
    state.result = {
      outcome: 'ZOMBIE',
      phaseReached: 'GARAGE',
      sprint: 39,
      valuation: 1,
      ownership: 1,
      headline: { fr: '', en: '' },
    };
    expect(passes('lone-wolf', state)).toBe(true);
    expect(passes('garage-bankrupt', state)).toBe(false);
    state.result.outcome = 'BANKRUPTCY';
    expect(passes('garage-bankrupt', state)).toBe(true);
  });
});
