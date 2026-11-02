import { describe, expect, it } from 'vitest';
import { getStoryMission, STORY_MISSIONS, type StoryMissionId } from '@oss/shared';
import { defaultCardLibrary } from '../../src/events/defaultCards';
import { teamSize } from '../../src/simulation/helpers';
import { replay } from '../../src/simulation/replay';
import { Simulation } from '../../src/simulation/simulation';
import { checkMission, goalProgress, missionTimeUp } from '../../src/simulation/story';
import { toGameView } from '../../src/view/adapter';
import { makeContext } from './fixtures';

const cards = defaultCardLibrary();

function mission(id: StoryMissionId, seed = 'story'): Simulation {
  return Simulation.create({ seed, mode: 'STORY', mission: id }, cards);
}

describe('Mode Histoire : point de départ', () => {
  it.each(STORY_MISSIONS.map((m) => m.id))(
    '%s part de sa phase, de sa caisse et de son équipe',
    (id) => {
      const { state } = mission(id);
      const { setup, sprints } = getStoryMission(id)!;
      expect(state.mode).toBe('STORY');
      expect(state.story).toEqual({ missionId: id, startSprint: 1 });
      expect(state.totalSprints).toBe(sprints);
      expect(state.phase).toBe(setup.phase);
      expect(state.fundingRounds).toBe(setup.fundingRounds);
      expect(state.gauges.users).toBe(setup.users);
      expect(state.ownership).toBe(setup.ownership);
      expect(teamSize(state)).toBeGreaterThanOrEqual(setup.team.length);
      expect(state.stage).toBe('PLANNING');
      expect(state.result).toBeNull();
    },
  );

  it('la même graine donne la même mission', () => {
    expect(mission('firefighters', 'a').state).toEqual(mission('firefighters', 'a').state);
    expect(mission('firefighters', 'a').state).not.toEqual(mission('firefighters', 'b').state);
  });

  it('une mission ignore les récompenses, et le Daily aussi', () => {
    const story = Simulation.create(
      { seed: 's', mode: 'STORY', mission: 'first-commit', unlocks: ['perk-network'] },
      cards,
    );
    expect(story.state.unlocks).toEqual([]);
    const daily = Simulation.create({ seed: 'd', mode: 'DAILY', unlocks: ['perk-network'] }, cards);
    expect(daily.state.unlocks).toEqual([]);
  });
});

describe('Mode Histoire : fin de mission', () => {
  it('gagnée dès que tous les objectifs sont remplis', () => {
    const simulation = mission('first-commit');
    simulation.state.stats.featuresShipped = 3;
    checkMission(simulation.state, makeContext(simulation.state));
    const { result } = simulation.state;
    expect(simulation.state.stage).toBe('ENDED');
    expect(result?.outcome).toBe('ZOMBIE');
    expect(result?.mission).toEqual({ id: 'first-commit', success: true, failure: null });
    expect(result?.headline.fr).toContain('Premier commit');
  });

  it('perdue dès qu’une contrainte est enfreinte', () => {
    const simulation = mission('server-room');
    simulation.state.stats.prodOutages = 2;
    checkMission(simulation.state, makeContext(simulation.state));
    expect(simulation.state.result?.mission).toEqual({
      id: 'server-room',
      success: false,
      failure: 'CONSTRAINT',
    });
  });

  it('perdue à la fin du temps imparti si un objectif manque', () => {
    const simulation = mission('leave-garage');
    missionTimeUp(simulation.state, makeContext(simulation.state));
    expect(simulation.state.result?.mission?.failure).toBe('TIME');
  });

  it('un rachat accepté avant les objectifs fait perdre la mission', () => {
    const simulation = mission('clean-series-a');
    simulation.state.acquisitionOffer = {
      amount: 50_000_000,
      buyer: { fr: 'Un géant', en: 'A giant' },
    } as never;
    expect(simulation.dispatch({ type: 'ANSWER_ACQUISITION', accept: true }).result).toEqual({
      ok: true,
    });
    expect(simulation.state.result?.outcome).toBe('ACQUISITION');
    expect(simulation.state.result?.mission).toMatchObject({ success: false, failure: 'SOLD' });
  });

  it('une introduction en Bourse avec les objectifs remplis gagne la mission', () => {
    const simulation = mission('opening-bell');
    const { state } = simulation;
    state.gauges.users = 20_000_000;
    state.gauges.hype = 90;
    state.gauges.stability = 90;
    state.valuation = 2_500_000_000;
    expect(goalProgress(state, { kind: 'valuation', min: 2_000_000_000 }).met).toBe(true);
    expect(simulation.dispatch({ type: 'LAUNCH_IPO' }).result).toEqual({ ok: true });
    expect(state.result?.outcome).toBe('IPO');
    expect(state.result?.mission).toEqual({ id: 'opening-bell', success: true, failure: null });
  });

  it('la faillite fait perdre la mission', () => {
    const simulation = mission('first-commit');
    simulation.dispatch({ type: 'START_SPRINT' });
    simulation.state.gauges.treasury = -1;
    simulation.runUntilBlocked();
    checkMission(simulation.state, makeContext(simulation.state));
    expect(simulation.state.result?.outcome).toBe('BANKRUPTCY');
    expect(simulation.state.result?.mission?.failure).toBe('BANKRUPTCY');
  });

  it('le rejeu de la graine et des commandes retrouve la même issue', () => {
    const simulation = mission('coffee-first', 'rejeu');
    simulation.dispatch({ type: 'START_SPRINT' });
    simulation.runUntilBlocked();
    const again = replay({
      seed: 'rejeu',
      mode: 'STORY',
      mission: 'coffee-first',
      commands: simulation.commands,
      cards,
    });
    expect(again.state).toEqual(simulation.state);
  });

  it('la vue expose la mission et ses objectifs en direct', () => {
    const simulation = mission('useful-meeting');
    const view = toGameView(simulation.state, { speed: 1, running: false, card: () => undefined });
    expect(view.story?.missionId).toBe('useful-meeting');
    expect(view.story?.goals.map((g) => g.met)).toEqual([false, false]);
    expect(view.story?.sprints).toBe(4);
  });
});

describe('Récompenses dans les autres modes', () => {
  it('« Carnet d’adresses » donne +10 de hype au départ', () => {
    const without = Simulation.create({ seed: 'perk', mode: 'NORMAL' }, cards).state;
    const withPerk = Simulation.create(
      { seed: 'perk', mode: 'NORMAL', unlocks: ['perk-network'] },
      cards,
    ).state;
    expect(withPerk.unlocks).toEqual(['perk-network']);
    expect(withPerk.gauges.hype).toBe(Math.min(100, without.gauges.hype + 10));
  });

  it('« Expresso dès le garage » remplace la cafetière du départ', () => {
    const owned = (unlocks: [] | ['perk-espresso']) =>
      Object.values(
        Simulation.create({ seed: 'perk', mode: 'EASY', unlocks }, cards).state.components
          .furniture,
      ).map((f) => f?.itemId);
    expect(owned([])).toContain('drip-coffee-maker');
    expect(owned(['perk-espresso'])).toContain('espresso-machine');
    expect(owned(['perk-espresso'])).not.toContain('drip-coffee-maker');
  });

  it('les contenus gagnés restent verrouillés sans la récompense', () => {
    const locked = Simulation.create({ seed: 'lock', mode: 'NORMAL' }, cards);
    locked.state.gauges.treasury = 1_000_000;
    expect(
      locked.dispatch({ type: 'COVER_WALL', zone: 'back-open', finish: 'blueprint' }).result,
    ).toEqual({ ok: false, error: 'LOCKED' });

    const open = Simulation.create(
      { seed: 'lock', mode: 'NORMAL', unlocks: ['wall-blueprint'] },
      cards,
    );
    open.state.gauges.treasury = 1_000_000;
    expect(
      open.dispatch({ type: 'COVER_WALL', zone: 'back-open', finish: 'blueprint' }).result,
    ).toEqual({ ok: true });
  });

  it('les récompenses inconnues ou en double sont ignorées', () => {
    const state = Simulation.create(
      {
        seed: 'dup',
        mode: 'NORMAL',
        unlocks: ['color-neon', 'color-gold', 'color-neon'],
      },
      cards,
    ).state;
    expect(state.unlocks).toEqual(['color-gold', 'color-neon']);
  });
});
