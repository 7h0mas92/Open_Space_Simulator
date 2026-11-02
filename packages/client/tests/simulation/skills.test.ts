import {
  BALANCE,
  EVENT_CARDS,
  GameStateSchema,
  SKILLS,
  SKILL_TREE,
  branchNodes,
  canHaveSkill,
  roleSkillOf,
  skillPointsForLevel,
  skillsEnabled,
  type DevRole,
  type GameState,
  type SkillId,
  type Task,
} from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { CardLibrary } from '../../src/events/library';
import {
  createBot,
  playWithBot,
  preferredBranches,
  skillCommands,
} from '../../src/simulation/bots';
import { applyCommand } from '../../src/simulation/commands';
import { replay } from '../../src/simulation/replay';
import {
  NO_SKILL_EFFECTS,
  hasSkill,
  resetCost,
  skillBlocker,
  skillDebtFactor,
  skillPoints,
  skillSpeedMultiplier,
  skillTeamEffects,
  skillXpFactor,
} from '../../src/simulation/skills';
import { Simulation } from '../../src/simulation/simulation';
import { dailySystem } from '../../src/simulation/systems/daily';
import { incidentSystem } from '../../src/simulation/systems/incidents';
import { energySystem } from '../../src/simulation/systems/needs';
import { productivity, workSystem } from '../../src/simulation/systems/work';
import { clockAt, getClock } from '../../src/simulation/time';
import { FixedRng, makeContext, stateWithTeam } from './fixtures';

/** Tâche de code minimale. */
function task(type: Task['type'] = 'FEATURE', overrides: Partial<Task> = {}): Task {
  return {
    title: { fr: 'Tâche', en: 'Task' },
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
    designApproved: true,
    hallucinated: false,
    createdAtSprint: 1,
    doneAtSprint: null,
    ...overrides,
  };
}

/** Équipe en planification, avec des devs au niveau voulu. */
function team(roles: DevRole[], level = 6, mode: GameState['mode'] = 'NORMAL') {
  const { state, ids } = stateWithTeam(roles, mode);
  state.stage = 'PLANNING';
  for (const id of ids) {
    const employment = state.components.employment[id];
    if (employment) employment.level = level;
  }
  return { state, ids, ctx: makeContext(state) };
}

/** Donne directement des compétences à un dev (sans passer par les commandes). */
function give(state: GameState, devId: string, skills: SkillId[]): void {
  state.components.skills[devId] = { learned: [...skills] };
}

const learn = (state: GameState, devId: string, skill: SkillId) =>
  applyCommand(state, makeContext(state), { type: 'LEARN_SKILL', devId, skill });

describe('Arbre de compétences : catalogue', () => {
  it('a 3 branches de 5 nœuds communs, chacun demandant le précédent', () => {
    for (const branch of ['TECH', 'SPEED', 'HUMAN'] as const) {
      const nodes = branchNodes(branch, 'MANAGER');
      expect(nodes).toHaveLength(5);
      expect(nodes[0]?.requires).toBeNull();
      for (let i = 1; i < nodes.length; i++) expect(nodes[i]?.requires).toBe(nodes[i - 1]?.id);
    }
  });

  it('donne un nœud de métier à chaque profil qui code, aucun à l’encadrement', () => {
    for (const role of [
      'SENIOR_BEARD',
      'TEN_X',
      'INTERN',
      'RUSTACEAN',
      'DESIGNER',
      'PRODUCT_OWNER',
      'AI_AGENT',
      'GHOST',
      'FRONTEND',
      'BACKEND',
      'FULLSTACK',
      'TECH_LEAD',
      'DEVOPS',
      'QA_TESTER',
    ] as const) {
      const node = roleSkillOf(role);
      expect(node, role).not.toBeNull();
      // Le nœud de métier demande le 3e nœud de sa branche.
      if (node) expect(branchNodes(node.branch, role)[2]?.id).toBe(node.requires);
    }
    for (const role of ['SCRUM_MASTER', 'MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR'] as const)
      expect(roleSkillOf(role)).toBeNull();
    expect(canHaveSkill('INTERN', 'fewer-hallucinations')).toBe(false);
    expect(canHaveSkill('AI_AGENT', 'fewer-hallucinations')).toBe(true);
    expect(canHaveSkill('INTERN', 'mentor')).toBe(true);
  });

  it('a des identifiants uniques et des textes dans les deux langues', () => {
    const ids = SKILL_TREE.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const node of SKILL_TREE) {
      expect(node.name.fr && node.name.en && node.effect.fr && node.effect.en).toBeTruthy();
    }
  });

  it('donne 1 point par niveau gagné et ferme l’arbre en Daily seulement', () => {
    expect(skillPointsForLevel(1)).toBe(0);
    expect(skillPointsForLevel(6)).toBe(5);
    expect(skillsEnabled('DAILY')).toBe(false);
    for (const mode of ['NORMAL', 'EASY', 'HARDCORE', 'ENDLESS', 'STORY', 'CAREER'] as const)
      expect(skillsEnabled(mode)).toBe(true);
  });
});

describe('Arbre de compétences : commandes', () => {
  it('dépense un point par nœud, dans l’ordre de la branche', () => {
    const { state, ids } = team(['SENIOR_BEARD'], 3);
    const dev = ids[0] ?? '';
    expect(skillPoints(state, dev)).toEqual({ earned: 2, spent: 0, available: 2 });
    expect(learn(state, dev, 'debugger')).toEqual({ ok: false, error: 'NOT_ELIGIBLE' });
    expect(skillBlocker(state, dev, 'debugger')).toBe('REQUIRES');
    expect(learn(state, dev, 'clean-code').ok).toBe(true);
    expect(learn(state, dev, 'clean-code').ok).toBe(false);
    expect(learn(state, dev, 'debugger').ok).toBe(true);
    expect(skillBlocker(state, dev, 'architect')).toBe('POINTS');
    expect(learn(state, dev, 'architect').ok).toBe(false);
    expect(state.components.skills[dev]?.learned).toEqual(['clean-code', 'debugger']);
    expect(state.stats.skillsLearned).toBe(2);
  });

  it('refuse le nœud de métier d’un autre profil, l’encadrement et le Daily', () => {
    const { state, ids } = team(['INTERN', 'MANAGER'], 6);
    give(state, ids[0] ?? '', ['clean-code', 'debugger', 'architect']);
    expect(learn(state, ids[0] ?? '', 'fewer-hallucinations').ok).toBe(false);
    expect(learn(state, ids[0] ?? '', 'hands-off-main').ok).toBe(true);
    expect(learn(state, ids[1] ?? '', 'clean-code')).toEqual({ ok: false, error: 'NOT_ELIGIBLE' });

    const daily = team(['SENIOR_BEARD'], 6, 'DAILY');
    expect(learn(daily.state, daily.ids[0] ?? '', 'clean-code')).toEqual({
      ok: false,
      error: 'NOT_AVAILABLE',
    });
  });

  it('réinitialise l’arbre contre un mois de salaire', () => {
    const { state, ids } = team(['SENIOR_BEARD'], 6);
    const dev = ids[0] ?? '';
    const ctx = makeContext(state);
    expect(applyCommand(state, ctx, { type: 'RESET_SKILLS', devId: dev }).ok).toBe(false);
    give(state, dev, ['clean-code', 'debugger']);
    const cost = resetCost(state, dev);
    expect(cost).toBe(Math.round(state.components.employment[dev]?.salary ?? 0));
    const before = state.gauges.treasury;
    expect(applyCommand(state, ctx, { type: 'RESET_SKILLS', devId: dev }).ok).toBe(true);
    expect(state.gauges.treasury).toBeCloseTo(before - cost);
    expect(skillPoints(state, dev).available).toBe(5);
    state.gauges.treasury = 10;
    give(state, dev, ['clean-code']);
    expect(applyCommand(state, ctx, { type: 'RESET_SKILLS', devId: dev })).toEqual({
      ok: false,
      error: 'NOT_ENOUGH_MONEY',
    });
  });

  it('vend des formations en planification, une par dev et par sprint, sans tirage', () => {
    const { state, ids } = team(['SENIOR_BEARD'], 1);
    const dev = ids[0] ?? '';
    const ctx = makeContext(state);
    const rngBefore = [...state.rng];
    const statsBefore = { ...state.components.stats[dev] };
    const before = state.gauges.treasury;
    expect(applyCommand(state, ctx, { type: 'TRAIN_DEV', devId: dev, kind: 'COURSE' }).ok).toBe(
      true,
    );
    expect(state.components.employment[dev]?.level).toBe(2);
    expect(state.gauges.treasury).toBe(before - 2_000);
    expect(skillPoints(state, dev).available).toBe(1);
    // Niveau gagné en formation : aucune statistique tirée au hasard.
    expect(state.components.stats[dev]).toEqual(statsBefore);
    expect(state.rng).toEqual(rngBefore);
    expect(applyCommand(state, ctx, { type: 'TRAIN_DEV', devId: dev, kind: 'BOOK' })).toEqual({
      ok: false,
      error: 'COOLDOWN',
    });
    state.sprint += 1;
    expect(applyCommand(state, ctx, { type: 'TRAIN_DEV', devId: dev, kind: 'BOOK' }).ok).toBe(true);
    // Un livre : la moitié d'un niveau (niveau 2 : 240 XP pour passer).
    expect(state.components.employment[dev]?.xp).toBeCloseTo(BALANCE.work.xpPerLevel);
    state.stage = 'EXECUTION';
    state.sprint += 1;
    expect(applyCommand(state, ctx, { type: 'TRAIN_DEV', devId: dev, kind: 'CONFERENCE' })).toEqual(
      { ok: false, error: 'WRONG_STAGE' },
    );
  });

  it('déclenche le Crunch une fois par sprint, pendant l’exécution', () => {
    const { state, ids } = team(['TEN_X'], 6);
    const dev = ids[0] ?? '';
    const ctx = makeContext(state);
    give(state, dev, ['shortcuts', 'focus', 'deep-work', 'sprint-finish']);
    state.stage = 'EXECUTION';
    expect(applyCommand(state, ctx, { type: 'USE_CRUNCH', devId: dev })).toEqual({
      ok: false,
      error: 'NOT_ELIGIBLE',
    });
    expect(learn(state, dev, 'crunch').ok).toBe(true);
    const moral = state.components.mood[dev]?.moral ?? 0;
    expect(applyCommand(state, ctx, { type: 'USE_CRUNCH', devId: dev }).ok).toBe(true);
    expect(state.components.mood[dev]?.moral).toBe(Math.max(0, moral + SKILLS.crunchMoral));
    expect(applyCommand(state, ctx, { type: 'USE_CRUNCH', devId: dev })).toEqual({
      ok: false,
      error: 'COOLDOWN',
    });
    const clock = getClock(state);
    const crunching = skillSpeedMultiplier(state, dev, task(), clock);
    state.tick += SKILLS.crunchTicks;
    expect(crunching / skillSpeedMultiplier(state, dev, task(), clock)).toBeCloseTo(
      SKILLS.crunchSpeed,
    );
  });
});

describe('Arbre de compétences : effets', () => {
  it('vaut exactement 1 partout sans compétence', () => {
    const { state, ids } = team(['SENIOR_BEARD'], 6);
    const dev = ids[0] ?? '';
    expect(skillTeamEffects(state)).toBe(NO_SKILL_EFFECTS);
    expect(skillSpeedMultiplier(state, dev, task('BUGFIX'), getClock(state))).toBe(1);
    expect(skillDebtFactor(state, dev)).toBe(1);
    expect(skillXpFactor(NO_SKILL_EFFECTS, dev)).toBe(1);
  });

  it('accélère selon le type de tâche, le moment et la branche Vitesse', () => {
    const { state, ids } = team(['DEVOPS'], 8);
    const dev = ids[0] ?? '';
    give(state, dev, ['clean-code', 'debugger', 'architect', 'infra-as-code', 'shortcuts']);
    const afternoon = clockAt(1, 12); // lundi, 15h
    const s = SKILLS.shortcutsSpeed;
    expect(skillSpeedMultiplier(state, dev, task('FEATURE'), afternoon)).toBeCloseTo(s);
    expect(skillSpeedMultiplier(state, dev, task('BUGFIX'), afternoon)).toBeCloseTo(
      s * SKILLS.debuggerBugfix,
    );
    expect(skillSpeedMultiplier(state, dev, task('REFACTO'), afternoon)).toBeCloseTo(
      s * SKILLS.architectRefacto,
    );
    expect(skillSpeedMultiplier(state, dev, task('INFRA'), afternoon)).toBeCloseTo(
      s * SKILLS.infraAsCodeInfra,
    );
    give(state, dev, ['shortcuts', 'focus', 'deep-work', 'sprint-finish']);
    const morning = clockAt(1, 2); // lundi, 10h
    expect(skillSpeedMultiplier(state, dev, task(), morning)).toBeCloseTo(s * SKILLS.deepWorkSpeed);
    const lastDay = { ...afternoon, dayInSprint: SKILLS.sprintFinishDay };
    expect(skillSpeedMultiplier(state, dev, task(), lastDay)).toBeCloseTo(
      s * SKILLS.sprintFinishSpeed,
    );
  });

  it('répare la prod 2 fois plus vite avec « Gardien de la prod »', () => {
    const { state, ids } = team(['SENIOR_BEARD'], 8);
    const dev = ids[0] ?? '';
    give(state, dev, ['clean-code', 'debugger', 'architect', 'code-review', 'prod-guardian']);
    const fix = task('BUGFIX', { kind: 'URGENT', template: 'prod-fix' });
    const clock = clockAt(1, 12);
    expect(
      skillSpeedMultiplier(state, dev, fix, clock) /
        skillSpeedMultiplier(state, dev, task('FEATURE'), clock),
    ).toBeCloseTo(SKILLS.prodGuardianFix * SKILLS.debuggerBugfix);
  });

  it('divise par 2 le malus des réunions du PO avec « Concentration »', () => {
    const { state, ids, ctx } = team(['SENIOR_BEARD', 'PRODUCT_OWNER'], 6);
    const dev = ids[0] ?? '';
    const work = task('FEATURE');
    const clock = clockAt(1, 12);
    give(state, dev, ['shortcuts']);
    const plain =
      productivity(state, ctx, dev, work, true, undefined, clock) / SKILLS.shortcutsSpeed;
    give(state, dev, ['shortcuts', 'focus']);
    const focused =
      productivity(state, ctx, dev, work, true, undefined, clock) / SKILLS.shortcutsSpeed;
    const penalty = BALANCE.work.poMeetingPenalty * ctx.office.meetingPenalty;
    expect(focused / plain).toBeCloseTo((1 - penalty / 2) / (1 - penalty));
  });

  it('réduit la dette du code et celle des features de toute l’équipe', () => {
    const { state, ids } = team(['TEN_X', 'SENIOR_BEARD', 'TECH_LEAD'], 8);
    give(state, ids[0] ?? '', ['clean-code', 'debugger', 'architect', 'commented-code']);
    expect(skillDebtFactor(state, ids[0] ?? '')).toBeCloseTo(
      SKILLS.cleanCodeDebt * SKILLS.commentedCodeDebt,
    );
    give(state, ids[1] ?? '', ['clean-code', 'debugger', 'architect', 'code-review']);
    give(state, ids[2] ?? '', [
      'clean-code',
      'debugger',
      'architect',
      'code-review',
      'chief-architect',
    ]);
    expect(skillTeamEffects(state).featureDebtFactor).toBeCloseTo(
      SKILLS.codeReviewDebt ** 2 * SKILLS.chiefArchitectDebt,
    );
  });

  it('fatigue moins avec « Endurance »', () => {
    const run = (skills: SkillId[]) => {
      const { state, ids, ctx } = team(['SENIOR_BEARD'], 6);
      const dev = ids[0] ?? '';
      give(state, dev, skills);
      const activity = state.components.activity[dev];
      const mood = state.components.mood[dev];
      if (activity) activity.kind = 'WORKING';
      if (mood) mood.energy = 80;
      energySystem(state, ctx);
      return 80 - (state.components.mood[dev]?.energy ?? 0);
    };
    expect(run(['stamina']) / run([])).toBeCloseTo(SKILLS.staminaFatigue);
  });

  it('donne +20 % d’XP aux collègues d’un mentor, pas au mentor lui-même', () => {
    const { state, ids } = team(['SENIOR_BEARD', 'SENIOR_BEARD'], 6);
    give(state, ids[0] ?? '', ['stamina', 'diplomat', 'mentor']);
    const effects = skillTeamEffects(state);
    expect(skillXpFactor(effects, ids[0] ?? '')).toBe(1);
    expect(skillXpFactor(effects, ids[1] ?? '')).toBe(SKILLS.mentorXp);
  });

  it('remonte le moral de l’équipe et empêche les démissions avec « Leader »', () => {
    const { state, ids, ctx } = team(['SENIOR_BEARD', 'SENIOR_BEARD'], 8);
    const victim = ids[1] ?? '';
    const mood = state.components.mood[victim];
    if (mood) mood.moral = 0;
    give(state, ids[0] ?? '', ['stamina', 'diplomat', 'mentor', 'good-mood', 'leader']);
    expect(skillTeamEffects(state).dailyMoral).toBeCloseTo(SKILLS.goodMoodDaily);
    state.gauges.debt = 100; // le moral redescend à 0 malgré la bonne humeur
    dailySystem(state, ctx, { ...clockAt(1, 0), hour: 0 });
    expect(victim in state.components.identity).toBe(true);
    // Sans leader, il démissionne.
    give(state, ids[0] ?? '', ['stamina']);
    const after = state.components.mood[victim];
    if (after) after.moral = 0;
    dailySystem(state, ctx, { ...clockAt(1, 0), hour: 0 });
    expect(victim in state.components.identity).toBe(false);
  });

  it('change les probabilités du stagiaire sans changer le nombre de tirages', () => {
    const { state, ids } = team(['INTERN'], 6);
    const intern = ids[0] ?? '';
    state.stage = 'EXECUTION';
    const activity = state.components.activity[intern];
    if (activity) activity.kind = 'WORKING';
    const noon = { ...clockAt(1, 6), hour: 12, isWeekend: false };
    // Tirage à 0,03 : sous les 5 % habituels, au-dessus des 2 % du nœud de métier.
    const outages = (skills: SkillId[]) => {
      give(state, intern, skills);
      const before = state.stats.prodOutages;
      incidentSystem(state, makeContext(state, { rng: new FixedRng(0.03) }), noon);
      return state.stats.prodOutages - before;
    };
    expect(outages([])).toBe(1);
    expect(outages(['clean-code', 'debugger', 'architect', 'hands-off-main'])).toBe(0);
  });

  it('fait avancer les tâches plus vite dans le système de travail', () => {
    const progressWith = (skills: SkillId[]) => {
      const { state, ids, ctx } = team(['SENIOR_BEARD'], 6);
      const dev = ids[0] ?? '';
      give(state, dev, skills);
      state.stage = 'EXECUTION';
      const id = `e${state.nextEntityId++}`;
      state.components.task[id] = task('BUGFIX', { assigneeId: dev, column: 'IN_PROGRESS' });
      const worker = state.components.worker[dev];
      if (worker) worker.taskId = id;
      const activity = state.components.activity[dev];
      if (activity) activity.kind = 'WORKING';
      workSystem(state, ctx, clockAt(1, 12));
      return state.components.task[id]?.progress ?? 0;
    };
    expect(progressWith(['clean-code', 'debugger']) / progressWith([])).toBeCloseTo(
      SKILLS.debuggerBugfix,
    );
    expect(hasSkill(stateWithTeam(['INTERN']).state, 'e1', 'debugger')).toBe(false);
  });
});

describe('Arbre de compétences : bots, replays, sauvegardes', () => {
  it('choisit la branche selon le profil et dépense tous les points', () => {
    expect(preferredBranches('PRODUCT_OWNER')[0]).toBe('HUMAN');
    expect(preferredBranches('TEN_X')[0]).toBe('SPEED');
    expect(preferredBranches('SENIOR_BEARD')[0]).toBe('TECH');
    const { state, ids } = team(['SENIOR_BEARD'], 6);
    const commands = skillCommands(state, 6);
    expect(commands.map((c) => (c.type === 'LEARN_SKILL' ? c.skill : c.type))).toEqual([
      'clean-code',
      'debugger',
      'architect',
      'wise-elder',
      'code-review',
    ]);
    for (const command of commands)
      expect(applyCommand(state, makeContext(state), command).ok).toBe(true);
    expect(skillPoints(state, ids[0] ?? '').available).toBe(0);
    // Avec de la marge, un livre pour le moins expérimenté.
    expect(skillCommands(state, 20).some((c) => c.type === 'TRAIN_DEV')).toBe(true);
    expect(skillCommands({ ...state, mode: 'DAILY' }, 20)).toEqual([]);
  });

  it('rejoue à l’identique une partie du bot « coach » à partir de la graine et des commandes', () => {
    const cards = new CardLibrary(EVENT_CARDS);
    const simulation = Simulation.create({ seed: 'coach-replay', mode: 'NORMAL' }, cards);
    playWithBot(simulation, createBot('coach', 'coach'), cards, (s) => s.sprint > 12);
    expect(simulation.state.stats.skillsLearned).toBeGreaterThan(0);
    const again = replay({
      seed: 'coach-replay',
      mode: 'NORMAL',
      commands: simulation.commands,
      cards,
    });
    expect(again.state.components.skills).toEqual(simulation.state.components.skills);
    expect(again.state.gauges).toEqual(simulation.state.gauges);
  });

  it('charge une sauvegarde d’avant l’arbre (sans composant « skills »)', () => {
    const { state } = team(['SENIOR_BEARD'], 2);
    const old = JSON.parse(JSON.stringify(state)) as { components: Record<string, unknown> };
    delete old.components.skills;
    const parsed = GameStateSchema.parse(old);
    expect(parsed.components.skills).toEqual({});
  });
});
