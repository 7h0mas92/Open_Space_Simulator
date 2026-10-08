import { BALANCE, type DevRole, type GameState } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { generateCandidates, spawnDev } from '../../src/simulation/devs';
import { computeValuation, monthlyExpenses, runwayMonths } from '../../src/simulation/economy';
import { teamSize } from '../../src/simulation/helpers';
import {
  activitySystem,
  isMeetingTime,
  isPresent,
  scheduledBreak,
} from '../../src/simulation/systems/activity';
import { dailySystem, hypeDrift } from '../../src/simulation/systems/daily';
import { incidentSystem } from '../../src/simulation/systems/incidents';
import { coffeeSystem, energySystem } from '../../src/simulation/systems/needs';
import { productivity, thinksInRust, workSystem } from '../../src/simulation/systems/work';
import { assignTask, createTask } from '../../src/simulation/tasks';
import { clockAt } from '../../src/simulation/time';
import { FixedRng, makeContext, stateWithTeam, testCard } from './fixtures';

/** Horloge à un jour (0 = lundi) et une heure donnés du sprint 1. */
const at = (day: number, hour: number) => clockAt(1, (day * 24 + hour - 8) * 2);

/** Un dev qui travaille sur une tâche toute neuve. */
function devOnTask(role: DevRole, type: 'FEATURE' | 'REFACTO' | 'BUGFIX' | 'INFRA' = 'FEATURE') {
  const { state, ids } = stateWithTeam([role]);
  state.stage = 'EXECUTION';
  const devId = ids[0]!;
  const ctx = makeContext(state, { rng: new FixedRng(0.999) });
  const taskId = createTask(state, ctx.rng, type);
  assignTask(state, taskId, devId);
  state.components.activity[devId]!.kind = 'WORKING';
  return { state, ctx, devId, taskId };
}

function workUntilDone(state: GameState, ctx: ReturnType<typeof makeContext>, taskId: string) {
  for (let i = 0; i < 2000 && state.components.task[taskId]?.column !== 'DONE'; i++) {
    workSystem(state, ctx);
  }
}

describe('Travail', () => {
  it('fait avancer puis termine une tâche, avec ses effets sur les jauges', () => {
    for (const type of ['FEATURE', 'REFACTO', 'BUGFIX', 'INFRA'] as const) {
      const { state, ctx, devId, taskId } = devOnTask('SENIOR_BEARD', type);
      const before = structuredClone(state.gauges);
      workSystem(state, ctx);
      expect(state.components.task[taskId]?.column).toBe('IN_PROGRESS');
      workUntilDone(state, ctx, taskId);
      expect(state.components.task[taskId]?.column).toBe('DONE');
      expect(state.components.worker[devId]?.taskId).toBeNull();
      expect(state.components.employment[devId]?.tasksDone).toBe(1);
      if (type === 'REFACTO') expect(state.gauges.debt).toBeLessThan(before.debt);
      if (type === 'BUGFIX' || type === 'INFRA')
        expect(state.gauges.stability).toBeGreaterThanOrEqual(before.stability);
    }
  });

  it('les facteurs de productivité suivent les règles du jeu', () => {
    const { state, ctx, devId, taskId } = devOnTask('SENIOR_BEARD');
    const task = state.components.task[taskId]!;
    const base = productivity(state, ctx, devId, task);
    state.gauges.coffee = 0;
    expect(productivity(state, ctx, devId, task)).toBeCloseTo(base / 3, 5);
    state.gauges.coffee = 50;
    expect(productivity(state, ctx, devId, task, true)).toBeLessThan(base);
    task.shinyFramework = true;
    expect(productivity(state, ctx, devId, task)).toBeLessThan(base);
    task.shinyFramework = false;
    state.components.rustConverted[devId] = true;
    expect(thinksInRust(state, devId)).toBe(true);
    expect(productivity(state, ctx, devId, task)).toBeLessThan(base);
    task.type = 'REFACTO';
    expect(productivity(state, ctx, devId, task)).toBeGreaterThan(base);
    expect(productivity(state, ctx, 'e999', task)).toBe(0);
  });

  it('la designeuse bloque une feature, l’IA hallucine', () => {
    const designer = stateWithTeam(['DESIGNER']);
    designer.state.stage = 'EXECUTION';
    const ctx = makeContext(designer.state, { rng: new FixedRng(0) });
    const taskId = createTask(designer.state, ctx.rng, 'FEATURE');
    assignTask(designer.state, taskId, designer.ids[0]!);
    designer.state.components.activity[designer.ids[0]!]!.kind = 'WORKING';
    const work = designer.state.components.task[taskId]!.work;
    workUntilDone(designer.state, ctx, taskId);
    expect(designer.state.components.task[taskId]?.work).toBeGreaterThan(work);
    expect(ctx.outbox.some((n) => n.kind === 'DESIGN_BLOCKED')).toBe(true);

    const ai = devOnTask('AI_AGENT');
    const aiCtx = { ...ai.ctx, rng: new FixedRng(0) };
    workUntilDone(ai.state, aiCtx, ai.taskId);
    expect(ai.state.components.task[ai.taskId]?.hallucinated).toBe(true);
    expect(ai.state.stats.hallucinations).toBe(1);
  });

  it('les devs gagnent de l’expérience et des niveaux', () => {
    const { state, ctx, devId, taskId } = devOnTask('TEN_X');
    state.components.task[taskId]!.work = 10_000;
    for (let i = 0; i < 1000; i++) workSystem(state, ctx);
    expect(state.components.employment[devId]?.level).toBeGreaterThan(1);
    expect(ctx.outbox.some((n) => n.kind === 'DEV_LEVEL_UP')).toBe(true);
  });
});

describe('Activité (behavior trees)', () => {
  it('gère la présence selon le trait et les réunions du PO', () => {
    expect(isPresent('ZEN', at(0, 10))).toBe(true);
    expect(isPresent('ZEN', at(0, 3))).toBe(false);
    expect(isPresent('ZEN', at(5, 10))).toBe(false);
    expect(isPresent('WORKAHOLIC', at(5, 10))).toBe(true);
    expect(isPresent('ZEN', at(6, 10))).toBe(false);
    expect(isMeetingTime(at(0, BALANCE.work.poMeetingHours[0]!))).toBe(true);
    expect(isMeetingTime(at(5, BALANCE.work.poMeetingHours[0]!))).toBe(false);
  });

  it('envoie tout le monde en réunion, dormir, ou à la maison', () => {
    const { state, ids } = stateWithTeam(['PRODUCT_OWNER', 'SENIOR_BEARD', 'AI_AGENT']);
    state.stage = 'EXECUTION';
    for (const id of ids) state.components.identity[id]!.trait = 'ZEN';
    const ctx = makeContext(state, { rng: new FixedRng(0.999) });
    activitySystem(state, ctx, at(0, BALANCE.work.poMeetingHours[0]!));
    expect(state.components.activity[ids[1]!]?.kind).toBe('MEETING');
    expect(state.components.activity[ids[2]!]?.kind).not.toBe('MEETING');
    expect(state.stats.meetings).toBe(1);

    state.tick += 10;
    state.components.mood[ids[1]!]!.energy = 0;
    activitySystem(state, ctx, at(0, 17));
    expect(state.components.activity[ids[1]!]?.kind).toBe('SLEEPING');

    state.tick += 10;
    activitySystem(state, ctx, at(0, 23));
    expect(ids.every((id) => state.components.activity[id]?.kind === 'GONE')).toBe(true);
  });

  it('prend des pauses, discute et se dispute selon le hasard', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'TEN_X', 'INTERN', 'DESIGNER']);
    state.stage = 'EXECUTION';
    for (const id of ids) state.components.identity[id]!.trait = 'ZEN';
    const [a, b, c, d] = ids as [string, string, string, string];
    state.components.relations[a]![b] = 90;
    state.components.relations[b]![a] = 90;
    state.components.relations[c]![d] = -90;
    state.components.relations[d]![c] = -90;
    state.gauges.debt = 90;
    for (const id of ids) {
      const taskId = createTask(state, makeContext(state).rng, 'FEATURE');
      assignTask(state, taskId, id);
    }
    const seen = new Set<string>();
    const ctx = makeContext(state);
    ctx.office.babyfoot = true;
    for (let tick = 0; tick < 2000; tick++) {
      state.tick = tick;
      activitySystem(state, ctx, at(1, 10 + (tick % 8)));
      for (const id of ids) seen.add(state.components.activity[id]!.kind);
    }
    for (const kind of ['WORKING', 'COFFEE', 'CHATTING', 'ARGUING', 'YELLING', 'BABYFOOT']) {
      expect(seen).toContain(kind);
    }
  });
});

describe('Vraies pauses', () => {
  const { morning, lunch, afternoon, stagger } = BALANCE.breaks;

  it('trois pauses à heure fixe, un dev sur deux décalé d’une demi-heure', () => {
    expect(scheduledBreak('ZEN', 0, at(0, morning.hour))?.slot).toBe('morning');
    expect(scheduledBreak('ZEN', 1, at(0, morning.hour))).toBeNull();
    expect(scheduledBreak('ZEN', 1, at(0, morning.hour + stagger))?.slot).toBe('morning');
    expect(scheduledBreak('ZEN', 0, at(0, lunch.hour))).toEqual({
      slot: 'lunch',
      endHour: lunch.hour + lunch.hours,
    });
    expect(scheduledBreak('ZEN', 0, at(0, afternoon.hour))?.slot).toBe('afternoon');
    expect(scheduledBreak('ZEN', 0, at(0, 9))).toBeNull();
    // Pas de pause le week-end ; le noctambule décale tout, le bourreau de travail ne garde
    // que le déjeuner.
    expect(scheduledBreak('ZEN', 0, at(5, lunch.hour))).toBeNull();
    expect(scheduledBreak('NIGHT_OWL', 0, at(0, lunch.hour))).toBeNull();
    expect(
      scheduledBreak('NIGHT_OWL', 0, at(0, lunch.hour + BALANCE.work.nightOwlShift))?.slot,
    ).toBe('lunch');
    expect(scheduledBreak('WORKAHOLIC', 0, at(0, morning.hour))).toBeNull();
    expect(scheduledBreak('WORKAHOLIC', 0, at(0, lunch.hour))?.slot).toBe('lunch');
  });

  it('le déjeuner dure tout le créneau, réunion comprise ; l’IA Agent ne s’arrête pas', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'TEN_X', 'AI_AGENT', 'PRODUCT_OWNER']);
    state.stage = 'EXECUTION';
    for (const id of ids) state.components.identity[id]!.trait = 'ZEN';
    const ctx = makeContext(state);
    for (const id of ids) assignTask(state, createTask(state, ctx.rng, 'FEATURE'), id);
    state.tick = 100;
    activitySystem(state, ctx, at(0, lunch.hour));
    const lunching = state.components.activity[ids[0]!]!;
    expect(lunching.kind).toBe('LUNCH');
    expect(lunching.untilTick).toBe(100 + lunch.hours * 2);
    expect(state.components.activity[ids[1]!]!.kind).not.toBe('LUNCH'); // décalé
    expect(state.components.activity[ids[2]!]!.kind).toBe('WORKING');
    // Une demi-heure plus tard : le premier mange encore, le second le rejoint.
    state.tick = 101;
    activitySystem(state, ctx, at(0, lunch.hour + stagger));
    expect(state.components.activity[ids[0]!]!.kind).toBe('LUNCH');
    expect(state.components.activity[ids[1]!]!.kind).toBe('LUNCH');
  });

  it('pause courte : café, babyfoot ou balade, selon le bureau et le caractère', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD']);
    state.stage = 'EXECUTION';
    const id = ids[0]!;
    state.components.identity[id]!.trait = 'GAMER';
    const ctx = makeContext(state);
    ctx.office.babyfoot = true;
    const seen = new Set<string>();
    for (let day = 0; day < 40; day++) {
      state.tick = day * 48;
      activitySystem(state, ctx, at(day % 5, morning.hour));
      seen.add(state.components.activity[id]!.kind);
    }
    expect([...seen].sort()).toEqual(['BABYFOOT', 'BREAK', 'COFFEE']);
    // Sans café ni babyfoot, il reste la balade dans la cuisine.
    state.gauges.coffee = 0;
    ctx.office.babyfoot = false;
    state.tick += 48;
    activitySystem(state, ctx, at(0, morning.hour));
    expect(state.components.activity[id]!.kind).toBe('BREAK');
  });

  it('les télétravailleurs font leurs pauses chez eux', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD']);
    state.stage = 'EXECUTION';
    const id = ids[0]!;
    state.components.identity[id]!.trait = 'ZEN';
    state.components.remote[id] = true;
    const ctx = makeContext(state);
    activitySystem(state, ctx, at(0, morning.hour));
    expect(state.components.activity[id]!.kind).toBe('BREAK');
    state.tick += 10;
    activitySystem(state, ctx, at(0, lunch.hour));
    expect(state.components.activity[id]!.kind).toBe('LUNCH');
  });
});

describe('Besoins : café et énergie', () => {
  it('réapprovisionne le café à 8h et prévient quand il est vide', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD']);
    state.gauges.coffee = 10;
    const ctx = makeContext(state);
    ctx.office.coffeeRestock = 60;
    const cash = state.gauges.treasury;
    coffeeSystem(state, ctx, at(0, 8));
    expect(state.gauges.coffee).toBeGreaterThan(10);
    expect(state.gauges.treasury).toBeLessThan(cash);
    state.gauges.coffee = 0.01;
    state.components.activity[ids[0]!]!.kind = 'WORKING';
    coffeeSystem(state, ctx, at(0, 10));
    expect(state.gauges.coffee).toBe(0);
    expect(ctx.outbox.some((n) => n.kind === 'COFFEE_EMPTY')).toBe(true);
  });

  it('la cuisine livre du café à partir de la phase Seed', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD']);
    const ctx = makeContext(state);
    ctx.office.coffeeRestock = 0;
    state.phase = 'GARAGE';
    state.gauges.coffee = 10;
    coffeeSystem(state, ctx, at(0, 8));
    expect(state.gauges.coffee).toBe(10);
    state.phase = 'SERIES_A';
    coffeeSystem(state, ctx, at(1, 8));
    expect(state.gauges.coffee).toBe(10 + BALANCE.coffee.kitchenRestock.SERIES_A);
  });

  it('un grand stock fait durer le café d’une grande équipe', () => {
    const drink = (phase: GameState['phase']) => {
      const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'TEN_X']);
      state.phase = phase;
      state.gauges.coffee = 50;
      for (const id of ids) state.components.activity[id]!.kind = 'WORKING';
      coffeeSystem(state, makeContext(state), at(0, 10));
      return 50 - state.gauges.coffee;
    };
    expect(drink('UNICORN')).toBeLessThan(drink('SEED'));
  });

  it('fatigue au travail, repos la nuit, l’IA ne se fatigue jamais', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'AI_AGENT']);
    const ctx = makeContext(state);
    const [human, ai] = ids as [string, string];
    state.components.mood[human]!.energy = 50;
    state.components.mood[ai]!.energy = 50;
    state.components.activity[human]!.kind = 'WORKING';
    energySystem(state, ctx);
    expect(state.components.mood[human]!.energy).toBeLessThan(50);
    expect(state.components.mood[ai]!.energy).toBe(100);
    for (const kind of ['SLEEPING', 'GONE', 'IDLE', 'COFFEE'] as const) {
      state.components.mood[human]!.energy = 50;
      state.components.activity[human]!.kind = kind;
      energySystem(state, ctx);
      expect(state.components.mood[human]!.energy).toBeGreaterThan(50);
    }
  });
});

describe('Incidents', () => {
  it('le stagiaire casse la prod à midi', () => {
    const { state } = stateWithTeam(['INTERN']);
    state.stage = 'EXECUTION';
    state.gauges.users = 1000;
    for (const id of Object.keys(state.components.activity)) {
      state.components.activity[id]!.kind = 'WORKING';
    }
    const ctx = makeContext(state, { rng: new FixedRng(0) });
    incidentSystem(state, ctx, at(0, 12));
    expect(state.stats.prodOutages).toBe(1);
    expect(state.gauges.users).toBeLessThan(1000);
  });

  it('la dette provoque des bugs à 15h', () => {
    const { state } = stateWithTeam([]);
    state.stage = 'EXECUTION';
    state.gauges.debt = 100;
    incidentSystem(state, makeContext(state, { rng: new FixedRng(0) }), at(0, 15));
    expect(state.stats.prodOutages).toBe(1);
  });

  it('vendredi 17h : la prod tombe et la carte est imposée', () => {
    const { state } = stateWithTeam([]);
    state.stage = 'EXECUTION';
    const ctx = makeContext(state, {
      rng: new FixedRng(0),
      cards: [testCard({ id: 'friday-prod-down' })],
    });
    incidentSystem(state, ctx, at(4, 17));
    expect(state.stats.fridayOutages).toBe(1);
    expect(state.stats.fridayOutageStreak).toBe(1);
    expect(state.events.pending?.cardId).toBe('friday-prod-down');
    expect(ctx.outbox.some((n) => n.kind === 'FRIDAY_17H')).toBe(true);

    incidentSystem(state, makeContext(state, { rng: new FixedRng(0.999) }), at(4, 17));
    expect(state.stats.fridayOutageStreak).toBe(0);
    expect(state.stats.maxFridayOutageStreak).toBe(1);
  });

  it('rien ne se passe le week-end ou hors exécution', () => {
    const { state } = stateWithTeam(['INTERN']);
    const ctx = makeContext(state, { rng: new FixedRng(0) });
    incidentSystem(state, ctx, at(0, 12));
    state.stage = 'EXECUTION';
    incidentSystem(state, ctx, at(5, 12));
    expect(state.stats.prodOutages).toBe(0);
  });
});

describe('Journée (minuit)', () => {
  it('paie les salaires, fait évoluer les jauges et l’historique', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD', 'PRODUCT_OWNER']);
    state.gauges.users = 10_000;
    const cash = state.gauges.treasury;
    dailySystem(state, makeContext(state), at(1, 0));
    expect(state.gauges.treasury).toBeLessThan(cash);
    expect(state.history.daily).toHaveLength(1);
    expect(state.valuation).toBe(computeValuation(state));
    expect(runwayMonths(state)).toBeGreaterThan(0);
    expect(monthlyExpenses(state)).toBeGreaterThan(0);
    dailySystem(state, makeContext(state), at(1, 10));
    expect(state.history.daily).toHaveLength(1);
  });

  it('la hype revient vers son niveau de base au lieu de rester collée à 0', () => {
    expect(hypeDrift(0)).toBeGreaterThan(0);
    expect(hypeDrift(BALANCE.hype.baseline)).toBe(0);
    expect(hypeDrift(90)).toBeLessThan(hypeDrift(40));
    const { state } = stateWithTeam(['SENIOR_BEARD']);
    state.gauges.hype = 0;
    for (let day = 1; day <= 60; day++) dailySystem(state, makeContext(state), at(day, 0));
    expect(state.gauges.hype).toBeGreaterThan(5);
    expect(state.gauges.hype).toBeLessThan(BALANCE.hype.baseline);
  });

  it('la dette monte un peu chaque jour, la charge use la prod', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD', 'TEN_X']);
    state.gauges.debt = 0;
    dailySystem(state, makeContext(state), at(1, 0));
    expect(state.gauges.debt).toBeGreaterThan(0);

    const stabilityAfterADay = (users: number) => {
      const { state: s } = stateWithTeam([]);
      s.gauges.debt = 0;
      s.gauges.stability = 50;
      s.gauges.users = users;
      dailySystem(s, makeContext(s), at(1, 0));
      return s.gauges.stability;
    };
    expect(stabilityAfterADay(1_000_000)).toBeLessThan(stabilityAfterADay(100));
  });

  it('un dev à bout démissionne avec un faux post LinkedIn', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'TEN_X']);
    state.components.mood[ids[0]!]!.moral = 0;
    state.gauges.debt = 100;
    state.gauges.coffee = 0;
    const ctx = makeContext(state);
    dailySystem(state, ctx, at(1, 0));
    expect(state.components.identity[ids[0]!]).toBeUndefined();
    expect(state.stats.resignations).toBe(1);
    expect(ctx.outbox.some((n) => n.kind === 'DEV_RESIGNED')).toBe(true);
    expect(state.stats.coffeeShortageDays).toBe(1);
  });

  it('le Rustacé convertit ses collègues et les relations s’estompent', () => {
    const { state, ids } = stateWithTeam(['RUSTACEAN', 'SENIOR_BEARD']);
    const [rustacean, senior] = ids as [string, string];
    state.components.relations[senior]![rustacean] = 50;
    state.components.relations[rustacean]![senior] = -50;
    dailySystem(state, makeContext(state, { rng: new FixedRng(0) }), at(1, 0));
    expect(thinksInRust(state, senior)).toBe(true);
    expect(state.components.relations[senior]![rustacean]).toBeLessThan(50);
    expect(state.components.relations[rustacean]![senior]).toBeGreaterThan(-50);
  });
});

describe('Équipe', () => {
  it('génère des candidats et fait apparaître des devs dans la limite de la phase', () => {
    const { state } = stateWithTeam([]);
    const ctx = makeContext(state);
    generateCandidates(state, ctx);
    expect(state.candidates).toHaveLength(3);
    state.phase = 'GARAGE';
    expect(spawnDev(state, ctx, 'GHOST')).not.toBeNull();
    expect(state.components.remote).not.toEqual({});
    spawnDev(state, ctx, 'INTERN');
    expect(spawnDev(state, ctx, 'INTERN')).toBeNull();
    expect(teamSize(state)).toBe(2);
  });
});
