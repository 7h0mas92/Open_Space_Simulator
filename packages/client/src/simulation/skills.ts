import {
  BALANCE,
  PROD_FIX_TEMPLATE,
  ROLE_TRADE,
  SKILLS,
  SKILL_RESET_SALARY_MONTHS,
  canHaveSkill,
  skillNode,
  skillPointsForLevel,
  skillsEnabled,
  trainingOf,
  type CommandResult,
  type DevSkills,
  type EntityId,
  type GameState,
  type SkillId,
  type Task,
  type TrainingKind,
} from '@oss/shared';
import {
  addDevLog,
  addGauge,
  addMoney,
  changeMoral,
  devIds,
  notify,
  text,
  type SimContext,
} from './helpers';
import type { SimClock } from './time';

/**
 * Arbre de compétences des devs : achat des nœuds, formations, réinitialisation, Crunch, et
 * calcul des bonus lus par les systèmes (travail, fatigue, moral, pannes).
 *
 * Règle d'or : un dev sans compétence a tous ses multiplicateurs à exactement 1, et les effets
 * d'équipe valent `NO_SKILL_EFFECTS`. Multiplier un nombre par 1 ne change aucun bit : une partie
 * où l'on ne touche pas à l'arbre reste identique (replays, Daily, sauvegardes). Aucun tirage.
 */

const fail = (error: Extract<CommandResult, { ok: false }>['error']): CommandResult => ({
  ok: false,
  error,
});

/** Le dev a-t-il appris ce nœud ? */
export function hasSkill(state: GameState, devId: EntityId, skill: SkillId): boolean {
  return state.components.skills[devId]?.learned.includes(skill) ?? false;
}

export interface SkillPoints {
  readonly earned: number;
  readonly spent: number;
  readonly available: number;
}

/** Points gagnés (1 par niveau), dépensés et restants. */
export function skillPoints(state: GameState, devId: EntityId): SkillPoints {
  const level = state.components.employment[devId]?.level ?? 1;
  const earned = skillPointsForLevel(level);
  const spent = state.components.skills[devId]?.learned.length ?? 0;
  return { earned, spent, available: Math.max(0, earned - spent) };
}

/** Le dev peut-il avoir un arbre ? (l'encadrement ne code pas, il n'a pas d'arbre) */
export function hasSkillTree(state: GameState, devId: EntityId): boolean {
  const role = state.components.identity[devId]?.role;
  return role !== undefined && ROLE_TRADE[role] !== null;
}

/** Composant « compétences » du dev, créé au premier besoin. */
function skillsOf(state: GameState, devId: EntityId): DevSkills {
  const existing = state.components.skills[devId];
  if (existing) return existing;
  const created: DevSkills = { learned: [] };
  state.components.skills[devId] = created;
  return created;
}

/** Pourquoi ce nœud ne peut pas être pris (null : il peut l'être). */
export function skillBlocker(
  state: GameState,
  devId: EntityId,
  skill: SkillId,
): 'LEARNED' | 'ROLE' | 'REQUIRES' | 'POINTS' | null {
  const role = state.components.identity[devId]?.role;
  if (!role || !canHaveSkill(role, skill)) return 'ROLE';
  if (hasSkill(state, devId, skill)) return 'LEARNED';
  const requires = skillNode(skill).requires;
  if (requires && !hasSkill(state, devId, requires)) return 'REQUIRES';
  if (skillPoints(state, devId).available <= 0) return 'POINTS';
  return null;
}

/** Vérifications communes à toutes les commandes de l'arbre. */
function checkDev(state: GameState, devId: EntityId): CommandResult | null {
  if (!skillsEnabled(state.mode)) return fail('NOT_AVAILABLE');
  if (state.stage !== 'PLANNING' && state.stage !== 'EXECUTION' && state.stage !== 'DEMO')
    return fail('WRONG_STAGE');
  if (!state.components.identity[devId]) return fail('NOT_FOUND');
  if (!hasSkillTree(state, devId)) return fail('NOT_ELIGIBLE');
  return null;
}

/** Commande LEARN_SKILL : le dev dépense un point dans un nœud. */
export function learnSkill(
  state: GameState,
  ctx: SimContext,
  devId: EntityId,
  skill: SkillId,
): CommandResult {
  const refused = checkDev(state, devId);
  if (refused) return refused;
  if (skillBlocker(state, devId, skill) !== null) return fail('NOT_ELIGIBLE');
  skillsOf(state, devId).learned.push(skill);
  state.stats.skillsLearned += 1;
  const node = skillNode(skill);
  const name = state.components.identity[devId]?.name ?? '?';
  const message = text(['{name} apprend « {skill} ».', '{name} learns "{skill}".'], {
    name,
    skill: node.name,
  });
  addDevLog(state, devId, message);
  notify(state, ctx, 'SKILL_LEARNED', message, devId);
  return { ok: true };
}

/** Prix d'une réinitialisation : un mois de salaire du dev. */
export function resetCost(state: GameState, devId: EntityId): number {
  return Math.round((state.components.employment[devId]?.salary ?? 0) * SKILL_RESET_SALARY_MONTHS);
}

/** Commande RESET_SKILLS : tous les points reviennent, contre un mois de salaire. */
export function resetSkills(state: GameState, ctx: SimContext, devId: EntityId): CommandResult {
  const refused = checkDev(state, devId);
  if (refused) return refused;
  const skills = state.components.skills[devId];
  if (!skills || skills.learned.length === 0) return fail('NOT_ELIGIBLE');
  const cost = resetCost(state, devId);
  if (state.gauges.treasury < cost) return fail('NOT_ENOUGH_MONEY');
  addMoney(state, -cost);
  skills.learned = [];
  // Un Crunch en cours s'arrête avec l'arbre.
  delete skills.crunchUntilTick;
  const name = state.components.identity[devId]?.name ?? '?';
  const message = text(
    [
      '{name} repart de zéro : ses points de compétence sont rendus.',
      '{name} starts over: skill points refunded.',
    ],
    { name },
  );
  addDevLog(state, devId, message);
  notify(state, ctx, 'SKILLS_RESET', message, devId);
  return { ok: true };
}

/**
 * Ajoute de l'expérience d'une formation. Les niveaux gagnés ainsi ne tirent aucune statistique
 * au hasard (contrairement à ceux gagnés en travaillant) : aucun tirage, juste des points.
 */
function addTrainingXp(state: GameState, ctx: SimContext, devId: EntityId, levels: number): void {
  const employment = state.components.employment[devId];
  const identity = state.components.identity[devId];
  if (!employment || !identity) return;
  employment.xp += levels * employment.level * BALANCE.work.xpPerLevel;
  while (employment.xp >= employment.level * BALANCE.work.xpPerLevel) {
    employment.xp -= employment.level * BALANCE.work.xpPerLevel;
    employment.level += 1;
    const message = text(['{name} passe niveau {level} !', '{name} reaches level {level}!'], {
      name: identity.name,
      level: employment.level,
    });
    addDevLog(state, devId, message);
    notify(state, ctx, 'DEV_LEVEL_UP', message, devId);
  }
}

/** Commande TRAIN_DEV : livre, formation ou conférence, en planification, une par sprint. */
export function trainDev(
  state: GameState,
  ctx: SimContext,
  devId: EntityId,
  kind: TrainingKind,
): CommandResult {
  const refused = checkDev(state, devId);
  if (refused) return refused;
  if (state.stage !== 'PLANNING') return fail('WRONG_STAGE');
  const skills = state.components.skills[devId];
  if (skills?.trainedSprint === state.sprint) return fail('COOLDOWN');
  const training = trainingOf(kind);
  if (state.gauges.treasury < training.price) return fail('NOT_ENOUGH_MONEY');
  addMoney(state, -training.price);
  skillsOf(state, devId).trainedSprint = state.sprint;
  addTrainingXp(state, ctx, devId, training.levels);
  if (training.moral !== 0) changeMoral(state, devId, training.moral);
  if (training.hype !== 0) addGauge(state, 'hype', training.hype);
  state.stats.trainings += 1;
  const name = state.components.identity[devId]?.name ?? '?';
  addDevLog(
    state,
    devId,
    text(['Suivi : {training}.', 'Took: {training}.'], { training: training.name }),
  );
  notify(
    state,
    ctx,
    'DEV_TRAINED',
    text(['{name} : {training}.', '{name}: {training}.'], { name, training: training.name }),
    devId,
  );
  return { ok: true };
}

/** Commande USE_CRUNCH : +50 % de vitesse pendant 24 h, -10 de moral, une fois par sprint. */
export function startCrunch(state: GameState, ctx: SimContext, devId: EntityId): CommandResult {
  const refused = checkDev(state, devId);
  if (refused) return refused;
  if (state.stage !== 'EXECUTION') return fail('WRONG_STAGE');
  if (!hasSkill(state, devId, 'crunch')) return fail('NOT_ELIGIBLE');
  const skills = skillsOf(state, devId);
  if (skills.crunchSprint === state.sprint) return fail('COOLDOWN');
  skills.crunchSprint = state.sprint;
  skills.crunchUntilTick = state.tick + SKILLS.crunchTicks;
  changeMoral(state, devId, SKILLS.crunchMoral);
  state.stats.crunches += 1;
  const name = state.components.identity[devId]?.name ?? '?';
  notify(
    state,
    ctx,
    'CRUNCH',
    text(
      [
        '{name} passe en mode crunch. Pizza et Red Bull jusqu’à demain.',
        '{name} goes into crunch mode. Pizza and energy drinks until tomorrow.',
      ],
      { name },
    ),
    devId,
  );
  return { ok: true };
}

/** Le Crunch du dev est-il en cours ? */
export function isCrunching(state: GameState, devId: EntityId): boolean {
  const until = state.components.skills[devId]?.crunchUntilTick;
  return until !== undefined && state.tick < until;
}

// ─── Effets lus par les systèmes ────────────────────────────────────────────

/** Effets d'équipe de l'arbre, calculés une fois par tick. */
export interface SkillTeamEffects {
  /** Multiplicateur de la dette des features (Revue de code, Architecte en chef, Tests). */
  readonly featureDebtFactor: number;
  /** Multiplicateur du malus des réunions du PO (Réunions efficaces). */
  readonly meetingFactor: number;
  /** Mentors de l'équipe : leurs collègues gagnent plus d'XP. */
  readonly mentors: readonly EntityId[];
  /** Moral quotidien de toute l'équipe (Bonne humeur). */
  readonly dailyMoral: number;
  /** Un Leader est là : personne ne démissionne pour un moral à 0. */
  readonly leader: boolean;
  /** Un designer a « Pixel perfect ». */
  readonly pixelPerfect: boolean;
}

export const NO_SKILL_EFFECTS: SkillTeamEffects = {
  featureDebtFactor: 1,
  meetingFactor: 1,
  mentors: [],
  dailyMoral: 0,
  leader: false,
  pixelPerfect: false,
};

/** Effets d'équipe de l'arbre pour la partie en cours (fonction pure, sans tirage). */
export function skillTeamEffects(state: GameState): SkillTeamEffects {
  const store = state.components.skills;
  const holders = Object.keys(store).filter(
    (id) => (store[id]?.learned.length ?? 0) > 0 && id in state.components.identity,
  );
  if (holders.length === 0) return NO_SKILL_EFFECTS;
  const count = (skill: SkillId) => holders.filter((id) => hasSkill(state, id, skill)).length;
  const reviewers = Math.min(SKILLS.codeReviewMax, count('code-review'));
  return {
    featureDebtFactor:
      SKILLS.codeReviewDebt ** reviewers *
      (count('chief-architect') > 0 ? SKILLS.chiefArchitectDebt : 1) *
      (count('test-automation') > 0 ? SKILLS.testAutomationDebt : 1),
    meetingFactor: count('efficient-meetings') > 0 ? SKILLS.efficientMeetings : 1,
    mentors: holders.filter((id) => hasSkill(state, id, 'mentor')),
    dailyMoral: Math.min(SKILLS.goodMoodMax, count('good-mood')) * SKILLS.goodMoodDaily,
    leader: count('leader') > 0,
    pixelPerfect: count('pixel-perfect') > 0,
  };
}

/** Multiplicateur de vitesse personnel d'un dev sur une tâche (1 sans compétence). */
export function skillSpeedMultiplier(
  state: GameState,
  devId: EntityId,
  task: Task,
  clock: SimClock,
): number {
  const skills = state.components.skills[devId];
  if (!skills || skills.learned.length === 0) return 1;
  const has = (skill: SkillId) => skills.learned.includes(skill);
  let multiplier = 1;
  if (has('shortcuts')) multiplier *= SKILLS.shortcutsSpeed;
  if (has('deep-work') && clock.hour < SKILLS.deepWorkUntilHour) multiplier *= SKILLS.deepWorkSpeed;
  if (has('sprint-finish') && clock.dayInSprint >= SKILLS.sprintFinishDay)
    multiplier *= SKILLS.sprintFinishSpeed;
  if (has('debugger') && task.type === 'BUGFIX') multiplier *= SKILLS.debuggerBugfix;
  if (has('architect') && task.type === 'REFACTO') multiplier *= SKILLS.architectRefacto;
  if (has('infra-as-code') && task.type === 'INFRA') multiplier *= SKILLS.infraAsCodeInfra;
  if (has('prod-guardian') && task.template === PROD_FIX_TEMPLATE)
    multiplier *= SKILLS.prodGuardianFix;
  if (isCrunching(state, devId)) multiplier *= SKILLS.crunchSpeed;
  return multiplier;
}

/** Multiplicateur du malus des réunions du PO pour ce dev (Concentration). */
export function skillMeetingFactor(state: GameState, devId: EntityId): number {
  return hasSkill(state, devId, 'focus') ? SKILLS.focusMeeting : 1;
}

/** Multiplicateur de la dette laissée par le code de ce dev (Code propre, Code commenté). */
export function skillDebtFactor(state: GameState, devId: EntityId): number {
  const skills = state.components.skills[devId];
  if (!skills || skills.learned.length === 0) return 1;
  let factor = 1;
  if (skills.learned.includes('clean-code')) factor *= SKILLS.cleanCodeDebt;
  if (skills.learned.includes('commented-code')) factor *= SKILLS.commentedCodeDebt;
  return factor;
}

/** Multiplicateur d'XP d'un dev : +20 % si un autre dev de l'équipe est mentor. */
export function skillXpFactor(effects: SkillTeamEffects, devId: EntityId): number {
  return effects.mentors.some((id) => id !== devId) ? SKILLS.mentorXp : 1;
}

/** Bonus quotidien de l'arbre (à minuit) : Bonne humeur. */
export function applyDailySkills(state: GameState, effects: SkillTeamEffects): void {
  if (effects.dailyMoral <= 0) return;
  for (const id of devIds(state)) changeMoral(state, id, effects.dailyMoral);
}
