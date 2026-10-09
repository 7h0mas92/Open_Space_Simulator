import {
  BALANCE,
  classifyStack,
  roleLimit,
  ROLE_TRADE,
  stackMultiplier,
  taskTrade,
  type DevRole,
  type GameState,
  type Task,
} from '@oss/shared';
import { describe, expect, it } from 'vitest';
import {
  generateCandidates,
  generateDev,
  hireDev,
  pickCandidateRole,
  pickWebRoles,
} from '../../src/simulation/devs';
import {
  applyDailyLeadership,
  leadershipEffects,
  leadershipFor,
  teamShape,
} from '../../src/simulation/leadership';
import { Rng } from '../../src/simulation/rng';
import { activitySystem } from '../../src/simulation/systems/activity';
import { productivity } from '../../src/simulation/systems/work';
import { autoAssign, createTask, refillBacklog, tasksInColumn } from '../../src/simulation/tasks';
import { getClock } from '../../src/simulation/time';
import { createEmptyState } from '../../src/simulation/state';
import { makeContext, stateWithTeam } from './fixtures';

/** Tâche de code minimale avec un titre donné. */
function codeTask(en: string, type: Task['type'] = 'FEATURE', overrides: Partial<Task> = {}): Task {
  return {
    title: { fr: en, en },
    type,
    trade: 'DEV',
    size: 3,
    progress: 0,
    work: 15,
    column: 'TODO',
    order: 0,
    assigneeId: null,
    qualitySum: 0,
    debtFactor: 0,
    shinyFramework: false,
    designApproved: false,
    hallucinated: false,
    createdAtSprint: 1,
    doneAtSprint: null,
    ...overrides,
  };
}

/** Pose une tâche dans la colonne TODO et renvoie son identifiant. */
function addTask(state: GameState, task: Task): string {
  const id = `e${state.nextEntityId++}`;
  state.components.task[id] = { ...task, order: state.nextEntityId };
  return id;
}

describe('Front, back et fullstack', () => {
  it('classe les tâches de code par côté, d’après leur titre', () => {
    expect(classifyStack('Dark mode', 'FEATURE')).toBe('FRONT');
    expect(classifyStack('The spinner spins forever', 'BUGFIX')).toBe('FRONT');
    expect(classifyStack('Automatic database backups', 'INFRA')).toBe('BACK');
    expect(classifyStack('Public API', 'FEATURE')).toBe('BACK');
    // Titre neutre : l'infra va au back, le reste est départagé par un hachage stable.
    expect(classifyStack('Something', 'INFRA')).toBe('BACK');
    expect(classifyStack('Something', 'FEATURE')).toBe(classifyStack('Something', 'FEATURE'));
  });

  it('les profils historiques codent partout à 100 %, comme avant', () => {
    const task = codeTask('Dark mode');
    for (const role of ['SENIOR_BEARD', 'TEN_X', 'INTERN', 'AI_AGENT'] as DevRole[])
      expect(stackMultiplier(role, undefined, task)).toBe(1);
  });

  it('un dev front va plus vite sur le front, tâtonne sur le back ; le fullstack fait les deux', () => {
    const front = codeTask('Dark mode', 'REFACTO');
    const back = codeTask('Public API', 'REFACTO');
    const { stacks } = BALANCE;
    expect(stackMultiplier('FRONTEND', 'REACT', front)).toBe(stacks.specialist);
    expect(stackMultiplier('FRONTEND', 'REACT', back)).toBe(stacks.crossStack);
    expect(stackMultiplier('BACKEND', 'NODE', back)).toBe(stacks.specialist);
    expect(stackMultiplier('FULLSTACK', undefined, front)).toBe(stacks.fullstack);
    expect(stackMultiplier('FULLSTACK', undefined, back)).toBe(stacks.fullstack);
    // Spécialité : React accélère les features, de son côté seulement.
    expect(stackMultiplier('FRONTEND', 'REACT', codeTask('Dark mode', 'FEATURE'))).toBeCloseTo(
      stacks.specialist * stacks.specialtyBonus,
    );
    expect(stackMultiplier('FRONTEND', 'REACT', codeTask('Public API', 'FEATURE'))).toBe(
      stacks.crossStack,
    );
    // Les tâches qui ne sont pas du code ne changent pas.
    expect(stackMultiplier('FRONTEND', 'REACT', { ...front, trade: 'DESIGN' })).toBe(1);
  });

  it('un dev front et un dev back vont plus vite que le fullstack de leur côté', () => {
    const { state, ids } = stateWithTeam(['FRONTEND', 'FULLSTACK']);
    const [frontId, fullId] = ids as [string, string];
    // Mêmes stats pour comparer seulement le profil.
    const stats = { speed: 6, quality: 6, endurance: 6, ego: 5 };
    state.components.stats[frontId] = { ...stats };
    state.components.stats[fullId] = { ...stats };
    for (const id of ids) {
      state.components.mood[id] = { moral: 80, energy: 100 };
      state.components.identity[id]!.trait = 'ZEN';
    }
    state.components.identity[frontId]!.specialty = 'ACCESSIBILITY';
    const ctx = makeContext(state);
    const task = codeTask('Dark mode', 'FEATURE');
    const front = productivity(state, ctx, frontId, task);
    const full = productivity(state, ctx, fullId, task);
    expect(front / full).toBeCloseTo(BALANCE.stacks.specialist / BALANCE.stacks.fullstack);
  });

  it('les devs front et back reçoivent une spécialité de leur côté, le DevOps le cloud', () => {
    const rng = Rng.fromSeed('specialties');
    for (let i = 0; i < 10; i++) {
      expect(['REACT', 'ACCESSIBILITY', 'WEB_PERF', 'MOBILE']).toContain(
        generateDev(rng, 'FRONTEND').identity.specialty,
      );
      expect(['NODE', 'DATABASE', 'SECURITY', 'CLOUD']).toContain(
        generateDev(rng, 'BACKEND').identity.specialty,
      );
    }
    expect(generateDev(rng, 'DEVOPS').identity.specialty).toBe('CLOUD');
    expect(generateDev(rng, 'FULLSTACK').identity.specialty).toBeUndefined();
    expect(generateDev(rng, 'SENIOR_BEARD').identity.specialty).toBeUndefined();
  });
});

describe('Assignation selon la stack', () => {
  it('un dev front prend le front d’abord, le back s’il ne reste rien, l’urgence avant tout', () => {
    const { state, ids } = stateWithTeam(['FRONTEND']);
    const devId = ids[0]!;
    const back = addTask(state, codeTask('Public API'));
    const front = addTask(state, codeTask('Dark mode'));
    expect(autoAssign(state, devId)).toBe(front);
    state.components.task[front]!.column = 'DONE';
    state.components.worker[devId]!.taskId = null;
    // Plus de front : il dépanne côté back.
    expect(autoAssign(state, devId)).toBe(back);
    state.components.task[back]!.assigneeId = null;
    state.components.worker[devId]!.taskId = null;
    const front2 = addTask(state, codeTask('Dark mode v2'));
    expect(autoAssign(state, devId)).toBe(front2);
    state.components.task[front2]!.assigneeId = null;
    state.components.worker[devId]!.taskId = null;
    state.components.task[back]!.kind = 'URGENT';
    expect(autoAssign(state, devId)).toBe(back);
  });

  it('le fullstack et les profils historiques prennent tout', () => {
    const { state, ids } = stateWithTeam(['FULLSTACK', 'SENIOR_BEARD']);
    const back = addTask(state, codeTask('Public API'));
    expect(autoAssign(state, ids[0]!)).toBe(back);
    const back2 = addTask(state, codeTask('Automatic database backups', 'INFRA'));
    expect(autoAssign(state, ids[1]!)).toBe(back2);
  });

  it('l’encadrement ne prend aucune tâche, mais travaille à son bureau', () => {
    const { state, ids } = stateWithTeam(['MANAGER', 'DIRECTOR']);
    addTask(state, codeTask('Dark mode'));
    expect(ROLE_TRADE.MANAGER).toBeNull();
    expect(autoAssign(state, ids[0]!)).toBeNull();
    state.stage = 'EXECUTION';
    // Mardi 10h (deuxième jour du sprint) : tout le monde est au bureau.
    state.sprintTick = 2 * 2 + 48;
    state.tick = state.sprintTick;
    const clock = getClock(state);
    activitySystem(state, makeContext(state), clock);
    for (const id of ids) {
      expect(state.components.worker[id]!.taskId).toBeNull();
      expect(['WORKING', 'COFFEE', 'CHATTING', 'BREAK', 'MEETING']).toContain(
        state.components.activity[id]!.kind,
      );
    }
  });

  it('les testeurs reçoivent des tâches de recette dans le backlog', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD', 'QA_TESTER']);
    const ctx = makeContext(state);
    for (let i = 0; i < 4; i++) refillBacklog(state, ctx.rng);
    const trades = new Set(
      tasksInColumn(state, 'BACKLOG').map((id) => taskTrade(state.components.task[id]!)),
    );
    expect(trades).toEqual(new Set(['DEV', 'QA']));
    const qa = tasksInColumn(state, 'BACKLOG')
      .map((id) => state.components.task[id]!)
      .filter((task) => task.trade === 'QA');
    expect(qa.every((task) => task.type !== 'FEATURE')).toBe(true);
    expect(createTask(state, ctx.rng, undefined, 'QA')).toMatch(/^e\d+$/);
  });
});

describe('Postes ouverts', () => {
  const shape = (phase: GameState['phase'], roles: Partial<Record<DevRole, number>>) => ({
    phase,
    roles,
  });

  it('le directeur arrive en Seed avec 4 personnes, le sous-directeur en Série A', () => {
    expect(roleLimit('DIRECTOR', shape('GARAGE', { INTERN: 6 }))).toBe(0);
    expect(roleLimit('DIRECTOR', shape('SEED', { INTERN: 3 }))).toBe(0);
    expect(roleLimit('DIRECTOR', shape('SEED', { INTERN: 4 }))).toBe(1);
    expect(roleLimit('DEPUTY_DIRECTOR', shape('SERIES_A', { INTERN: 10 }))).toBe(0);
    expect(roleLimit('DEPUTY_DIRECTOR', shape('SERIES_A', { INTERN: 10, DIRECTOR: 1 }))).toBe(1);
    expect(roleLimit('DEPUTY_DIRECTOR', shape('SEED', { INTERN: 10, DIRECTOR: 1 }))).toBe(0);
  });

  it('un manager pour 5 personnes, un testeur pour 4, un tech lead pour 4 devs', () => {
    expect(roleLimit('MANAGER', shape('SEED', { FRONTEND: 4 }))).toBe(0);
    expect(roleLimit('MANAGER', shape('SEED', { FRONTEND: 5 }))).toBe(1);
    // L'encadrement ne compte pas dans l'équipe encadrée.
    expect(roleLimit('MANAGER', shape('UNICORN', { FRONTEND: 9, MANAGER: 1, DIRECTOR: 1 }))).toBe(
      1,
    );
    expect(roleLimit('MANAGER', shape('UNICORN', { FRONTEND: 10 }))).toBe(2);
    expect(roleLimit('QA_TESTER', shape('SEED', { BACKEND: 8 }))).toBe(2);
    expect(roleLimit('TECH_LEAD', shape('SEED', { DESIGNER: 4, BACKEND: 3 }))).toBe(0);
    expect(roleLimit('TECH_LEAD', shape('SEED', { BACKEND: 4 }))).toBe(1);
    expect(roleLimit('FRONTEND', shape('GARAGE', {}))).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('Candidats de l’équipe web', () => {
  it('ne changent rien aux 3 candidats habituels ni au RNG de la partie', () => {
    const state = createEmptyState({ seed: 'web-roles', mode: 'NORMAL' });
    const expected = structuredClone(state);
    generateCandidates(state, makeContext(state));
    // Les 3 candidats historiques, générés comme avant l'équipe web.
    const ctx = makeContext(expected);
    const classic = Array.from({ length: 3 }, () =>
      generateDev(ctx.rng, pickCandidateRole(expected, ctx.rng)),
    );
    expect(state.candidates.slice(0, 3).map((c) => c.identity.name)).toEqual(
      classic.map((dev) => dev.identity.name),
    );
    expect(state.rng).toEqual(expected.rng);
    expect(state.candidates).toHaveLength(3 + BALANCE.recruitment.webCandidatesPerSprint);
  });

  it('au garage, deux devs ; avec une équipe, un poste d’encadrement ouvert', () => {
    const garage = createEmptyState({ seed: 'garage', mode: 'NORMAL' });
    const dev = ['FRONTEND', 'BACKEND', 'FULLSTACK'];
    for (let sprint = 1; sprint <= 20; sprint++) {
      garage.sprint = sprint;
      for (const role of pickWebRoles(garage, Rng.fromSeed(`g${sprint}`)))
        expect(dev).toContain(role);
    }
    const { state } = stateWithTeam(['SENIOR_BEARD', 'TEN_X', 'INTERN', 'FRONTEND', 'BACKEND']);
    state.phase = 'SEED';
    const second = new Set<DevRole>();
    for (let sprint = 1; sprint <= 30; sprint++) {
      second.add(pickWebRoles(state, Rng.fromSeed(`s${sprint}`))[1]!);
    }
    for (const role of second)
      expect(['QA_TESTER', 'SCRUM_MASTER', 'MANAGER', 'DIRECTOR']).toContain(role);
    expect(second.size).toBeGreaterThan(1);
  });

  it('le mode Stagiaires Only ne propose que ses 3 stagiaires', () => {
    const state = createEmptyState({ seed: 'interns', mode: 'INTERNS_ONLY' });
    generateCandidates(state, makeContext(state));
    expect(state.candidates.map((c) => c.identity.role)).toEqual(['INTERN', 'INTERN', 'INTERN']);
  });
});

describe('Encadrement', () => {
  it('sans encadrement, rien ne change', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD', 'TEN_X']);
    const effects = leadershipEffects(state);
    expect(effects.productivity).toBe(0);
    expect(effects.meetingFactor).toBe(1);
    expect(effects.featureDebtFactor).toBe(1);
  });

  it('directeur, managers, scrum master, tech lead, testeurs et DevOps s’additionnent', () => {
    const l = BALANCE.leadership;
    const effects = leadershipFor({
      phase: 'SERIES_A',
      roles: {
        FRONTEND: 6,
        MANAGER: 1,
        DIRECTOR: 1,
        SCRUM_MASTER: 1,
        TECH_LEAD: 1,
        QA_TESTER: 2,
        DEVOPS: 1,
      },
    });
    // 6 + 1 tech lead + 2 testeurs + 1 DevOps = 10 personnes, 1 manager pour 6 : 60 %.
    expect(effects.coverage).toBeCloseTo(0.6);
    expect(effects.productivity).toBeCloseTo(
      l.directorProductivity + 0.6 * l.managerProductivity + l.scrumProductivity,
    );
    expect(effects.meetingFactor).toBe(l.scrumMeetingFactor);
    expect(effects.featureDebtFactor).toBeCloseTo(
      l.techLeadDebtFactor * (1 - 2 * l.qaDebtReductionPerTester),
    );
    expect(effects.dailyStability).toBeCloseTo(l.devopsDailyStability);
  });

  it('le directeur rend toute l’équipe plus productive', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD']);
    const task = codeTask('Dark mode');
    const before = productivity(state, makeContext(state), ids[0]!, task);
    const ctx = makeContext(state);
    hireDev(state, ctx, generateDev(ctx.rng, 'DIRECTOR'), 14_000);
    const after = productivity(state, makeContext(state), ids[0]!, task);
    expect(after / before).toBeCloseTo(1 + BALANCE.leadership.directorProductivity);
  });

  it('les managers apaisent les conflits chaque jour', () => {
    const { state, ids } = stateWithTeam(['FRONTEND', 'BACKEND', 'MANAGER']);
    const [a, b] = ids as [string, string];
    state.components.relations[a]![b] = -50;
    state.components.relations[b]![a] = -50;
    applyDailyLeadership(state);
    expect(state.components.relations[a]![b]).toBeGreaterThan(-50);
    expect(teamShape(state).roles.MANAGER).toBe(1);
  });
});
