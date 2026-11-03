import {
  ACHIEVEMENTS,
  BALANCE,
  CAREER_LEGENDS,
  careerLegend,
  careerLegendOfSeed,
  careerMilestoneLabel,
  careerSeed,
  careerStars,
  type CareerLegendId,
  type GameState,
} from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { careerDemo } from '../../src/simulation/career';
import { createBot, playWithBot } from '../../src/simulation/bots';
import { endGame } from '../../src/simulation/endings';
import { replay } from '../../src/simulation/replay';
import { teamSize } from '../../src/simulation/helpers';
import { toGameView } from '../../src/view/adapter';
import { makeContext, newSimulation } from './fixtures';
import { Simulation } from '../../src/simulation/simulation';
import { CardLibrary } from '../../src/events/library';

const career = (legend: CareerLegendId, base = 'test') =>
  newSimulation(careerSeed(legend, base), 'CAREER');

const viewOf = (state: GameState) =>
  toGameView(state, { speed: 1, running: false, card: () => undefined });

const statusOf = (state: GameState, id: string) => state.career?.milestones[id]?.status;

describe('Mode Carrière : légendes', () => {
  it('propose 8 légendes aux identifiants et jalons uniques', () => {
    expect(CAREER_LEGENDS).toHaveLength(8);
    expect(new Set(CAREER_LEGENDS.map((legend) => legend.id)).size).toBe(8);
    for (const legend of CAREER_LEGENDS) {
      const ids = legend.milestones.map((milestone) => milestone.id);
      expect(new Set(ids).size, legend.id).toBe(ids.length);
      expect(legend.milestones.length, legend.id).toBeGreaterThanOrEqual(3);
      // Chaque légende finit par une issue à atteindre.
      expect(legend.milestones.at(-1)?.kind, legend.id).toBe('outcome');
      for (const milestone of legend.milestones) {
        if ('bySprint' in milestone && milestone.bySprint !== undefined)
          expect(milestone.bySprint).toBeLessThanOrEqual(39);
      }
    }
  });

  it('ne cite jamais le nom réel des entreprises', () => {
    const forbidden =
      /apple|google|microsoft|amazon|facebook|meta|airbnb|netflix|tesla|steve|jobs|gates|bezos|zuckerberg|musk/i;
    for (const legend of CAREER_LEGENDS) {
      for (const text of [legend.name, legend.story, legend.twist])
        for (const value of [text.fr, text.en]) expect(value, legend.id).not.toMatch(forbidden);
    }
  });

  it('écrit la légende dans la graine et la relit', () => {
    const seed = careerSeed('trombi', '2026-10-13.abc');
    expect(seed).toBe('career:trombi:2026-10-13.abc');
    expect(seed.length).toBeLessThanOrEqual(64);
    expect(careerLegendOfSeed(seed)).toBe('trombi');
    expect(careerLegendOfSeed('2026-10-13.abc')).toBeNull();
    expect(careerLegendOfSeed('career:inconnue:x')).toBeNull();
  });

  it('donne les étoiles selon la part des jalons tenus', () => {
    expect(careerStars(0, 4)).toBe(0);
    expect(careerStars(1, 4)).toBe(1);
    expect(careerStars(2, 4)).toBe(2);
    expect(careerStars(3, 4)).toBe(2);
    expect(careerStars(4, 4)).toBe(3);
  });

  it('rédige chaque jalon en français et en anglais', () => {
    const label = careerMilestoneLabel({
      id: 'u',
      kind: 'metric',
      metric: 'users',
      min: 150_000,
      bySprint: 16,
    });
    expect(label.fr).toBe('Avoir 150 k utilisateurs avant la fin du sprint 16');
    expect(label.en).toBe('Have 150k users by the end of sprint 16');
    expect(
      careerMilestoneLabel({ id: 'e', kind: 'outcome', outcomes: ['IPO', 'ACQUISITION'] }).fr,
    ).toBe('Finir par : entrée en Bourse ou rachat');
  });
});

describe('Mode Carrière : départ', () => {
  it('applique les contraintes de la légende', () => {
    const pepin = career('pepin').state;
    expect(pepin.mode).toBe('CAREER');
    expect(pepin.career?.legend).toBe('pepin');
    expect(pepin.gauges.treasury).toBeLessThan(BALANCE.start.treasury);
    // Un cofondateur designer dès le garage.
    expect(teamSize(pepin)).toBe(2);
    const roles = Object.values(pepin.components.identity).map((identity) => identity.role);
    expect(roles).toContain('DESIGNER');
    expect(roles).toContain('SENIOR_BEARD');

    const ampere = career('ampere').state;
    expect(ampere.gauges.debt).toBe(45);
    expect(ampere.gauges.hype).toBe(40);
    expect(ampere.tracker.hypeAtStart).toBe(40);
    expect(ampere.totalRaised).toBe(BALANCE.start.treasury * 1.5);
    expect(Object.values(ampere.career?.milestones ?? {}).every((m) => m.status === 'PENDING'));
  });

  it('ne change rien aux autres modes', () => {
    const normal = newSimulation('career:pepin:x', 'NORMAL').state;
    expect(normal.career).toBeNull();
    expect(normal.gauges.treasury).toBe(BALANCE.start.treasury);
  });

  it('expose la légende et ses jalons à l’interface', () => {
    const view = viewOf(career('micromou').state);
    expect(view.career?.legend).toBe('micromou');
    expect(view.career?.total).toBe(careerLegend('micromou').milestones.length);
    expect(view.career?.done).toBe(0);
    const features = view.career?.milestones.find((m) => m.id === 'features');
    expect(features?.bySprint).toBe(12);
    expect(features?.progress).toBe(0);
    expect(view.career?.milestones.find((m) => m.id === 'end')?.bySprint).toBeNull();
    expect(viewOf(newSimulation().state).career).toBeNull();
  });
});

describe('Mode Carrière : jalons', () => {
  it('tient un jalon atteint avant l’échéance, à la démo', () => {
    const { state } = career('pepin');
    const ctx = makeContext(state);
    state.sprint = 5;
    careerDemo(state, ctx);
    expect(statusOf(state, 'seed')).toBe('PENDING');
    state.phase = 'SEED';
    careerDemo(state, ctx);
    expect(statusOf(state, 'seed')).toBe('DONE');
    expect(state.career?.milestones.seed?.sprint).toBe(5);
    expect(ctx.outbox.map((n) => n.kind)).toContain('CAREER_MILESTONE');
  });

  it('manque un jalon dont l’échéance est passée', () => {
    const { state } = career('pepin');
    const ctx = makeContext(state);
    state.sprint = 6;
    careerDemo(state, ctx);
    expect(statusOf(state, 'seed')).toBe('FAILED');
    // Trop tard : atteindre la Seed ensuite n'y change rien.
    state.phase = 'SEED';
    state.sprint = 7;
    careerDemo(state, ctx);
    expect(statusOf(state, 'seed')).toBe('FAILED');
    expect(ctx.outbox.map((n) => n.kind)).toContain('CAREER_MISSED');
  });

  it('juge les jalons de fin et donne le bilan', () => {
    const { state } = career('micromou');
    const ctx = makeContext(state);
    state.stats.featuresShipped = 30;
    state.sprint = 10;
    careerDemo(state, ctx);
    state.phase = 'UNICORN';
    state.ownership = 0.5;
    state.gauges.users = 600_000;
    state.sprint = 31;
    careerDemo(state, ctx);
    expect(statusOf(state, 'users')).toBe('FAILED');
    endGame(state, ctx, 'IPO', 2_000_000_000);
    expect(statusOf(state, 'features')).toBe('DONE');
    expect(statusOf(state, 'ownership')).toBe('DONE');
    expect(statusOf(state, 'end')).toBe('DONE');
    expect(state.result?.career).toEqual({ legend: 'micromou', done: 3, total: 4, stars: 2 });
    expect(state.result?.headline.fr).toContain('Carrière « MicroMou » : 3 jalons sur 4 (★★☆).');
    expect(state.result?.headline.en).toContain('Career "MicroSquishy": 3 of 4 milestones');
  });

  it('compte une échéance pas encore passée si la partie finit avant', () => {
    const { state } = career('centillion');
    const ctx = makeContext(state);
    state.sprint = 32;
    state.phase = 'UNICORN';
    state.gauges.users = 2_000_000;
    state.gauges.debt = 10;
    endGame(state, ctx, 'IPO', 3_000_000_000);
    // Le million d'utilisateurs était dû au sprint 30 : la partie a dépassé l'échéance.
    expect(statusOf(state, 'users')).toBe('FAILED');
    expect(statusOf(state, 'unicorn')).toBe('DONE');
    expect(statusOf(state, 'debt')).toBe('DONE');
    expect(state.result?.career?.stars).toBe(2);
  });

  it('fait tout manquer à la faillite', () => {
    const { state } = career('matelas');
    const ctx = makeContext(state);
    state.phase = 'SEED';
    endGame(state, ctx, 'BANKRUPTCY');
    expect(state.result?.career).toMatchObject({ done: 0, stars: 0 });
  });

  it('débloque les succès de carrière', () => {
    const { state } = career('micromou');
    const ctx = makeContext(state);
    state.stats.featuresShipped = 30;
    state.gauges.users = 600_000;
    state.ownership = 0.6;
    state.sprint = 12;
    careerDemo(state, ctx);
    state.phase = 'UNICORN';
    endGame(state, ctx, 'IPO', 2_000_000_000);
    expect(state.result?.career?.stars).toBe(3);
    const unlocked = ACHIEVEMENTS.filter((a) => a.check?.(state)).map((a) => a.id);
    expect(unlocked).toEqual(expect.arrayContaining(['career-first-star', 'career-legend']));
  });
});

describe('Mode Carrière : déterminisme', () => {
  it('se rejoue à l’identique depuis la graine et les commandes', () => {
    const seed = careerSeed('rembobine', 'replay');
    // Partie avec son arbre R&D, comme le rejeu.
    const cards = new CardLibrary([]);
    const simulation = Simulation.create({ seed, mode: 'CAREER' }, cards);
    playWithBot(simulation, createBot('balanced', seed), cards);
    const again = replay({
      seed,
      mode: 'CAREER',
      commands: simulation.commands,
      cards,
    });
    expect(again.state.result).toEqual(simulation.state.result);
    expect(again.state.career).toEqual(simulation.state.career);
    expect(simulation.state.result?.career?.legend).toBe('rembobine');
  }, 60_000);
});
