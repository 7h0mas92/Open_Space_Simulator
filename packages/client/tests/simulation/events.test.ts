import {
  BALANCE,
  CARD_ACHIEVEMENTS,
  EventCardSchema,
  EVENT_CARDS,
  type EventCard,
} from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { conditionsMet, inCooldown, isEligible } from '../../src/events/conditions';
import { drawCard, eventSystem, forceCard } from '../../src/events/draw';
import { applyEffects, escalate } from '../../src/events/effects';
import { CardLibrary } from '../../src/events/library';
import { resolveEvent } from '../../src/events/resolve';
import { teamSize } from '../../src/simulation/helpers';
import { clockAt } from '../../src/simulation/time';
import { FixedRng, makeContext, newSimulation, stateWithTeam, testCard } from './fixtures';

/** Mercredi 10h du sprint courant. */
const WEDNESDAY_10H = clockAt(1, (2 * 24 + 2) * 2);

describe('Les 100 cartes (et les cartes de saison)', () => {
  it('sont 100 de base et 24 de saison, valides et avec des identifiants uniques', () => {
    const seasonal = EVENT_CARDS.filter((card) => card.conditions.season !== undefined);
    expect(EVENT_CARDS.length - seasonal.length).toBe(100);
    expect(seasonal).toHaveLength(24);
    for (const card of EVENT_CARDS) expect(() => EventCardSchema.parse(card)).not.toThrow();
    expect(new Set(EVENT_CARDS.map((card) => card.id)).size).toBe(EVENT_CARDS.length);
  });

  it('pointent vers des cartes et des succès qui existent', () => {
    const ids = new Set(EVENT_CARDS.map((card) => card.id));
    for (const card of EVENT_CARDS) {
      if (card.conditions.requiresSeen) expect(ids).toContain(card.conditions.requiresSeen);
      for (const choice of card.choices) {
        const { requeue, unlockAchievement } = choice.effects;
        if (requeue?.cardId) expect(ids).toContain(requeue.cardId);
        if (unlockAchievement) expect(CARD_ACHIEVEMENTS).toContain(unlockAchievement);
      }
    }
  });

  it('contiennent les cartes imposées par le sujet', () => {
    const ids = EVENT_CARDS.map((card) => card.id);
    for (const id of [
      'cto-medium-microservices',
      'friday-prod-down',
      'intern-force-push',
      'weekend-hackathon',
      'investor-blockchain',
      'coffee-machine-broken',
      'rubber-duck',
      'competitor-raised-50m',
      'button-color-meeting',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('les cartes de chaîne (poids 0) sont atteignables par un requeue', () => {
    const targets = new Set(
      EVENT_CARDS.flatMap((card) => card.choices.map((choice) => choice.effects.requeue?.cardId)),
    );
    for (const card of EVENT_CARDS.filter((c) => c.weight === 0)) {
      expect(targets).toContain(card.id);
    }
  });

  it('valide une liste venue de l’API', () => {
    expect(CardLibrary.parse([testCard()]).size).toBe(1);
    expect(() => CardLibrary.parse([{ id: 'x' }])).toThrow();
  });
});

describe('Conditions', () => {
  it('vérifie la phase, le rôle, les jauges, le jour et l’heure', () => {
    const { state } = stateWithTeam(['INTERN']);
    const check = (conditions: EventCard['conditions']) =>
      conditionsMet(state, testCard({ conditions }), WEDNESDAY_10H);
    expect(check({})).toBe(true);
    expect(check({ minPhase: 'UNICORN' })).toBe(false);
    expect(check({ maxPhase: 'SEED' })).toBe(false);
    expect(check({ minPhase: 'SEED', maxPhase: 'UNICORN' })).toBe(true);
    expect(check({ hasRole: 'INTERN' })).toBe(true);
    expect(check({ hasRole: 'GHOST' })).toBe(false);
    expect(check({ dayOfWeek: 3 })).toBe(true);
    expect(check({ dayOfWeek: 5 })).toBe(false);
    expect(check({ afterHour: 11 })).toBe(false);
    expect(check({ requiresSeen: 'rubber-duck' })).toBe(false);
    state.events.lastSeenSprint['rubber-duck'] = 1;
    expect(check({ requiresSeen: 'rubber-duck' })).toBe(true);
    state.gauges.debt = 70;
    expect(check({ gauges: { debt: { min: 60 } } })).toBe(true);
    expect(check({ gauges: { debt: { max: 60 } } })).toBe(false);
    expect(check({ gauges: { moral: { min: 101 } } })).toBe(false);
  });

  it('respecte le cooldown et ignore les cartes de poids nul', () => {
    const { state } = stateWithTeam([]);
    const card = testCard({ cooldownSprints: 2 });
    expect(inCooldown(state, card)).toBe(false);
    state.events.lastSeenSprint[card.id] = 1;
    state.sprint = 3;
    expect(inCooldown(state, card)).toBe(true);
    state.sprint = 4;
    expect(inCooldown(state, card)).toBe(false);
    expect(isEligible(state, card, WEDNESDAY_10H)).toBe(true);
    expect(isEligible(state, testCard({ weight: 0 }), WEDNESDAY_10H)).toBe(false);
  });
});

describe('Tirage', () => {
  it('tire une carte éligible pendant les heures ouvrées', () => {
    const { state } = stateWithTeam(['INTERN']);
    state.stage = 'EXECUTION';
    const ctx = makeContext(state, { rng: new FixedRng(0), cards: [testCard()] });
    eventSystem(state, ctx, WEDNESDAY_10H);
    expect(state.events.pending).toMatchObject({ cardId: 'test-card', level: 0 });
    expect(state.events.drawnThisSprint).toBe(1);
    expect(ctx.outbox[0]?.kind).toBe('CARD_DRAWN');
  });

  it('ne tire rien la nuit, le week-end, en planification ou au-delà du quota', () => {
    const { state } = stateWithTeam([]);
    const ctx = makeContext(state, { rng: new FixedRng(0), cards: [testCard()] });
    eventSystem(state, ctx, WEDNESDAY_10H);
    expect(state.events.pending).toBeNull();
    state.stage = 'EXECUTION';
    eventSystem(state, ctx, clockAt(1, 2 * 24 * 2 + 30));
    eventSystem(state, ctx, clockAt(1, 5 * 24 * 2 + 4));
    expect(state.events.pending).toBeNull();
    state.events.drawnThisSprint = BALANCE.events.maxPerSprint;
    eventSystem(state, ctx, WEDNESDAY_10H);
    expect(state.events.pending).toBeNull();
  });

  it('ne tire rien si aucune carte n’est éligible ou si le dé dit non', () => {
    const { state } = stateWithTeam([]);
    expect(
      drawCard(
        state,
        makeContext(state, { rng: new FixedRng(0.999), cards: [testCard()] }),
        WEDNESDAY_10H,
      ),
    ).toBe(false);
    expect(drawCard(state, makeContext(state, { rng: new FixedRng(0) }), WEDNESDAY_10H)).toBe(
      false,
    );
  });

  it('fait revenir en priorité une carte remise en file', () => {
    const { state } = stateWithTeam([]);
    const ctx = makeContext(state, {
      rng: new FixedRng(0),
      cards: [testCard(), testCard({ id: 'worse', weight: 0 })],
    });
    state.events.queue.push({ cardId: 'worse', level: 2, availableAtSprint: 1 });
    expect(drawCard(state, ctx, WEDNESDAY_10H)).toBe(true);
    expect(state.events.pending).toMatchObject({ cardId: 'worse', level: 2 });
    expect(state.events.queue).toHaveLength(0);
  });

  it('impose une carte sauf si une autre est affichée ou en cooldown', () => {
    const { state } = stateWithTeam([]);
    const ctx = makeContext(state, { cards: [testCard({ cooldownSprints: 1 })] });
    expect(forceCard(state, ctx, 'inconnue')).toBe(false);
    expect(forceCard(state, ctx, 'test-card')).toBe(true);
    expect(forceCard(state, ctx, 'test-card')).toBe(false);
    state.events.pending = null;
    expect(forceCard(state, ctx, 'test-card')).toBe(false);
  });

  it('résout seule une carte ignorée en Hardcore avec le dernier choix', () => {
    const { state } = stateWithTeam([], 'HARDCORE');
    state.stage = 'EXECUTION';
    const ctx = makeContext(state, { cards: [testCard()] });
    forceCard(state, ctx, 'test-card');
    state.tick += BALANCE.events.hardcoreAutoResolveTicks;
    const debt = state.gauges.debt;
    eventSystem(state, ctx, WEDNESDAY_10H);
    expect(state.events.pending).toBeNull();
    expect(state.gauges.debt).toBe(debt + 5);
  });
});

describe('Effets et résolution', () => {
  it('aggrave seulement les effets négatifs', () => {
    expect(escalate(-10, -1, 0)).toBe(-10);
    expect(escalate(-10, -1, 2)).toBe(-10 * (1 + BALANCE.events.escalation * 2));
    expect(escalate(10, -1, 2)).toBe(10);
    expect(escalate(10, 1, 1)).toBe(10 * (1 + BALANCE.events.escalation));
  });

  it('applique tous les types d’effets', () => {
    const { state, ids } = stateWithTeam(['INTERN', 'SENIOR_BEARD', 'DESIGNER']);
    const ctx = makeContext(state);
    state.gauges.users = 1000;
    const before = structuredClone(state.gauges);
    const moralSenior = state.components.mood[ids[1]!]!.moral;
    const moralDesigner = state.components.mood[ids[2]!]!.moral;
    applyEffects(
      state,
      ctx,
      testCard(),
      {
        treasury: -1000,
        coffee: -10,
        hype: 5,
        debt: 5,
        stability: -5,
        users: 10,
        'moral.SENIOR_BEARD': -10,
        sprintsLost: 1,
        requeue: { delaySprints: 2 },
        spawnDev: 'GHOST',
        fireDev: 'INTERN',
        unlockAchievement: 'duck-lead',
      },
      0,
    );
    expect(state.gauges.coffee).toBe(before.coffee - 10);
    expect(state.gauges.hype).toBe(before.hype + 5);
    expect(state.gauges.debt).toBe(before.debt + 5);
    expect(state.gauges.stability).toBe(before.stability - 5);
    expect(state.gauges.users).toBe(1100);
    // Le licenciement du stagiaire pèse sur tout le monde ; le Senior perd 10 points de plus.
    const seniorLoss = moralSenior - state.components.mood[ids[1]!]!.moral;
    const designerLoss = moralDesigner - state.components.mood[ids[2]!]!.moral;
    expect(seniorLoss - designerLoss).toBeCloseTo(10, 5);
    expect(state.lostSprintsPending).toBe(1);
    expect(state.events.queue).toEqual([{ cardId: 'test-card', level: 1, availableAtSprint: 3 }]);
    expect(state.components.identity[ids[0]!]).toBeUndefined();
    expect(Object.values(state.components.identity).some((i) => i.role === 'GHOST')).toBe(true);
    expect(teamSize(state)).toBe(3);
    expect(state.achievements).toEqual(['duck-lead']);
    applyEffects(state, ctx, testCard(), { unlockAchievement: 'duck-lead', moral: -5 }, 0);
    expect(state.achievements).toEqual(['duck-lead']);
  });

  it('une carte suite (« version pire ») garde le niveau', () => {
    const { state } = stateWithTeam([]);
    applyEffects(state, makeContext(state), testCard(), { requeue: { cardId: 'other' } }, 1);
    expect(state.events.queue[0]).toEqual({ cardId: 'other', level: 1, availableAtSprint: 2 });
  });

  it('résout la carte affichée et enregistre le choix', () => {
    const { state } = stateWithTeam([]);
    const ctx = makeContext(state, { cards: [testCard()] });
    expect(resolveEvent(state, ctx, 0)).toEqual({ ok: false, error: 'WRONG_STAGE' });
    forceCard(state, ctx, 'test-card');
    expect(resolveEvent(state, ctx, 5)).toEqual({ ok: false, error: 'INVALID_CHOICE' });
    expect(resolveEvent(state, ctx, 0)).toEqual({ ok: true });
    expect(state.events.choices).toEqual([{ cardId: 'test-card', choiceIndex: 0, sprint: 1 }]);
    expect(state.stats.cardsResolved).toBe(1);
    // Carte désactivée entre-temps : on l'oublie simplement.
    state.events.pending = { cardId: 'disparue', level: 0, drawnAtTick: 0 };
    expect(resolveEvent(state, ctx, 0)).toEqual({ ok: true });
    expect(state.events.pending).toBeNull();
  });

  it('la commande RESOLVE_EVENT passe par la simulation', () => {
    const simulation = newSimulation('resolve', 'NORMAL', [testCard()]);
    simulation.dispatch({ type: 'START_SPRINT' });
    let guard = 0;
    while (
      !simulation.state.events.pending &&
      simulation.state.stage === 'EXECUTION' &&
      guard++ < 5
    ) {
      simulation.runUntilBlocked(48);
    }
    expect(simulation.state.events.pending?.cardId).toBe('test-card');
    expect(simulation.isRunning).toBe(false);
    expect(simulation.dispatch({ type: 'RESOLVE_EVENT', choiceIndex: 1 }).result.ok).toBe(true);
    expect(simulation.isRunning).toBe(true);
  });
});
