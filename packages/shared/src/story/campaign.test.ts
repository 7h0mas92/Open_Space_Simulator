import { describe, expect, it } from 'vitest';
import {
  STORY_CHAPTERS,
  STORY_MISSIONS,
  STORY_MISSION_IDS,
  chapterComplete,
  chapterMissions,
  founderTitle,
  getStoryMission,
  missionAvailable,
  storyUnlocks,
} from './campaign.js';
import { STORY_REWARDS, STORY_REWARD_IDS, getStoryReward, rewardUnlocked } from './rewards.js';

describe('Campagne du mode Histoire', () => {
  it('4 chapitres de missions, dans l’ordre de la campagne', () => {
    expect(STORY_CHAPTERS.map((c) => c.number)).toEqual([1, 2, 3, 4]);
    expect(STORY_MISSIONS.map((m) => m.id)).toEqual([...STORY_MISSION_IDS]);
    const order = STORY_MISSIONS.map((m) => STORY_CHAPTERS.findIndex((c) => c.id === m.chapter));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const chapter of STORY_CHAPTERS)
      expect(chapterMissions(chapter.id).length).toBeGreaterThanOrEqual(2);
  });

  it('chaque mission a des textes en français et en anglais, un objectif et une durée', () => {
    for (const mission of STORY_MISSIONS) {
      for (const field of [mission.title, mission.brief, mission.tip]) {
        expect(field.fr.length, mission.id).toBeGreaterThan(3);
        expect(field.en.length, mission.id).toBeGreaterThan(3);
      }
      expect(mission.goals.length, mission.id).toBeGreaterThan(0);
      expect(mission.sprints, mission.id).toBeGreaterThanOrEqual(3);
      expect(mission.setup.ownership).toBeGreaterThan(0);
      expect(mission.setup.ownership).toBeLessThanOrEqual(1);
    }
  });

  it('chaque récompense est gagnée par une seule mission', () => {
    const rewards = STORY_MISSIONS.map((m) => m.reward);
    expect(new Set(rewards).size).toBe(rewards.length);
    expect([...rewards].sort()).toEqual([...STORY_REWARD_IDS].sort());
    for (const reward of STORY_REWARDS) {
      expect(getStoryReward(reward.id)).toBe(reward);
      expect(reward.name.fr && reward.name.en && reward.description.en).toBeTruthy();
    }
  });

  it('les missions se débloquent l’une après l’autre', () => {
    expect(missionAvailable('first-commit', [])).toBe(true);
    expect(missionAvailable('coffee-first', [])).toBe(false);
    expect(missionAvailable('coffee-first', ['first-commit'])).toBe(true);
    expect(missionAvailable('opening-bell', STORY_MISSION_IDS.slice(0, -1))).toBe(true);
    expect(getStoryMission('inconnue')).toBeUndefined();
  });

  it('récompenses et titre de fondateur suivent les missions réussies', () => {
    expect(storyUnlocks([])).toEqual([]);
    expect(storyUnlocks(['coffee-first', 'first-commit'])).toEqual([
      'wall-blueprint',
      'perk-espresso',
    ]);
    expect(founderTitle(['first-commit'])).toBeNull();
    const garage = chapterMissions('garage').map((m) => m.id);
    expect(chapterComplete('garage', garage)).toBe(true);
    expect(founderTitle(garage)?.fr).toBe('Fondateur de garage');
    expect(founderTitle(STORY_MISSION_IDS)?.en).toBe('Tech legend');
  });

  it('un contenu sans récompense est toujours disponible', () => {
    expect(rewardUnlocked([], undefined)).toBe(true);
    expect(rewardUnlocked([], 'color-gold')).toBe(false);
    expect(rewardUnlocked(['color-gold'], 'color-gold')).toBe(true);
  });
});
