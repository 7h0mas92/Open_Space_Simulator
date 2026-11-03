import {
  BALANCE,
  MEETINGS,
  RETRO,
  ROLE_PROFILES,
  ROLE_TRADE,
  SKILLS,
  TIME,
  stackMultiplier,
  taskTrade,
  type EntityId,
  type GameState,
  type Task,
} from '@oss/shared';
import {
  addDevLog,
  addGauge,
  clamp,
  devIds,
  devsWithRole,
  hasRole,
  notify,
  text,
  type SimContext,
} from '../helpers';
import { dirtMultiplier } from '../cleaning';
import { leadershipEffects, NO_LEADERSHIP, type LeadershipEffects } from '../leadership';
import { recordTaskDone, recordWork } from '../performance';
import { checkDuplicateWork, dailyFocus, isTeamMeetingTime } from '../meetings';
import { completeSpecialTask } from '../taskFlow';
import { activeRetro, retroActive } from '../retro';
import {
  NO_SKILL_EFFECTS,
  hasSkill,
  skillDebtFactor,
  skillMeetingFactor,
  skillSpeedMultiplier,
  skillTeamEffects,
  skillXpFactor,
  type SkillTeamEffects,
} from '../skills';
import { getClock, type SimClock } from '../time';

/** Le dev pense en Rust : le Rustacé lui-même, ou un collègue converti. */
export function thinksInRust(state: GameState, devId: EntityId): boolean {
  return (
    state.components.identity[devId]?.role === 'RUSTACEAN' ||
    devId in state.components.rustConverted
  );
}

/**
 * Productivité d'un dev sur une tâche, en unités de travail par tick.
 * Chaque facteur correspond à une règle du jeu, ce qui la rend facile à expliquer.
 */
export function productivity(
  state: GameState,
  ctx: SimContext,
  devId: EntityId,
  task: Task,
  hasProductOwner = hasRole(state, 'PRODUCT_OWNER'),
  leadership: LeadershipEffects = leadershipEffects(state),
  clock: SimClock = getClock(state),
  skills: SkillTeamEffects = skillTeamEffects(state),
): number {
  const identity = state.components.identity[devId];
  const stats = state.components.stats[devId];
  const mood = state.components.mood[devId];
  const employment = state.components.employment[devId];
  if (!identity || !stats || !mood || !employment) return 0;
  const profile = ROLE_PROFILES[identity.role];
  const hours = TIME.tickMinutes / 60;

  let rate = (stats.speed / 5) * hours * profile.speedMultiplier;
  rate *= 1 + (employment.level - 1) * 0.05;
  // Café à 0 : productivité divisée par 3 (l'IA Agent et les télétravailleurs ne boivent pas notre café).
  const remote = devId in state.components.remote;
  const drinksCoffee = identity.role !== 'AI_AGENT' && !remote;
  if (drinksCoffee && state.gauges.coffee <= 0) rate /= BALANCE.work.coffeeEmptyDivider;
  rate *= 0.6 + (0.5 * mood.moral) / 100;
  if (mood.energy < 30) rate *= 0.75;
  rate *= 1 - state.gauges.debt / BALANCE.work.debtProductivityDivider;
  // Bureau sale (emballages, gobelets, pizzas…) : on travaille moins bien, sauf de chez soi.
  rate *= dirtMultiplier(state, devId);
  // Product Owner : 4 réunions par jour, −10 % pour tout le monde (sauf écouteurs à réduction de bruit) ;
  // la salle de réunion rend ce malus plus léger (stand-up) ou plus lourd (brainstorming).
  // Avec un scrum master, ces réunions pèsent moitié moins.
  const retro = activeRetro(state);
  if (
    hasProductOwner &&
    !ctx.office.meetingShielded[devId] &&
    !(retro === 'NO_MEETING_WEDNESDAY' && getClock(state).dayOfWeek === 3)
  ) {
    // Arbre de compétences : Concentration (ce dev) et Réunions efficaces (le PO).
    rate *=
      1 -
      BALANCE.work.poMeetingPenalty *
        ctx.office.meetingPenalty *
        leadership.meetingFactor *
        skills.meetingFactor *
        skillMeetingFactor(state, devId);
  }
  rate *=
    1 +
    ctx.office.teamProductivity +
    (ctx.office.seatProductivity[devId] ?? 0) +
    leadership.productivity +
    // Sorti d'un Daily utile ce matin : il sait exactement où il en est sur son ticket.
    dailyFocus(state, devId);
  if (
    identity.role === 'SENIOR_BEARD' &&
    task.shinyFramework &&
    !hasSkill(state, devId, 'wise-elder')
  )
    rate *= BALANCE.roles.seniorShinyMalus;
  if (thinksInRust(state, devId)) {
    rate *= task.type === 'REFACTO' ? BALANCE.roles.rustRefactoBonus : BALANCE.roles.rustOtherMalus;
  }
  // Télétravail : moins de collaboration (le Dev Fantôme, lui, a toujours travaillé ainsi).
  if (remote && identity.role !== 'GHOST') rate *= 1 - BALANCE.remote.productivityPenalty;
  // Hors de son métier (tâche confiée à la main), on tâtonne.
  if (ROLE_TRADE[identity.role] !== taskTrade(task)) rate *= BALANCE.work.offTradeMultiplier;
  // Front, back ou fullstack : plus vite de son côté de la stack, et sur sa spécialité.
  // Le nœud « Polyvalent » rend l'autre côté de la stack moins pénible.
  const stack = stackMultiplier(identity.role, identity.specialty, task);
  rate *=
    stack < SKILLS.versatileCrossStack && hasSkill(state, devId, 'versatile')
      ? SKILLS.versatileCrossStack
      : stack;
  if (identity.trait === 'PERFECTIONIST') rate *= 0.9;
  if (identity.trait === 'COFFEE_ADDICT' && state.gauges.coffee > 50) rate *= 1.1;
  // Action de la dernière rétrospective (aucune : rien ne change).
  if (retro === 'CODE_REVIEW') rate *= RETRO.codeReviewSpeed;
  else if (retro === 'KEEP_GOING') rate *= RETRO.keepGoingSpeed;
  else if (retro === 'ON_CALL' && task.kind === 'URGENT') rate *= RETRO.onCallUrgentSpeed;
  else if (retro === 'SMALLER_TICKETS' && task.size <= RETRO.smallTicketMaxSize)
    rate *= RETRO.smallTicketsSpeed;
  // Arbre de compétences : vitesse, type de tâche, matinée, fin de sprint, Crunch (1 sans compétence).
  rate *= skillSpeedMultiplier(state, devId, task, clock);
  return rate;
}

/** Qualité effective d'un dev, de 0 à 1. */
export function effectiveQuality(state: GameState, ctx: SimContext, devId: EntityId): number {
  const identity = state.components.identity[devId];
  const stats = state.components.stats[devId];
  if (!identity || !stats) return 0;
  let quality = (stats.quality / 10) * ROLE_PROFILES[identity.role].qualityMultiplier;
  quality *= 1 + ctx.office.quality;
  if (identity.trait === 'PERFECTIONIST') quality *= 1.15;
  if (hasSkill(state, devId, 'always-online')) quality *= SKILLS.alwaysOnlineQuality;
  // Télétravail : moins de relectures à deux devant le même écran.
  if (devId in state.components.remote && identity.role !== 'GHOST')
    quality *= 1 - BALANCE.remote.qualityPenalty;
  if (retroActive(state, 'CODE_REVIEW')) quality *= RETRO.codeReviewQuality;
  return clamp(quality, 0, 1);
}

function gainXp(
  state: GameState,
  ctx: SimContext,
  devId: EntityId,
  amount: number,
  skills: SkillTeamEffects = NO_SKILL_EFFECTS,
): void {
  const employment = state.components.employment[devId];
  const stats = state.components.stats[devId];
  const identity = state.components.identity[devId];
  if (!employment || !stats || !identity) return;
  // Un mentor dans l'équipe : +20 % d'XP pour ses collègues (facteur 1 sinon).
  employment.xp += amount * BALANCE.work.xpPerUnit * skillXpFactor(skills, devId);
  if (employment.xp < employment.level * BALANCE.work.xpPerLevel) return;
  employment.xp -= employment.level * BALANCE.work.xpPerLevel;
  employment.level += 1;
  const stat = ctx.rng.pick(['speed', 'quality', 'endurance'] as const);
  stats[stat] = clamp(stats[stat] + 1, 1, 10);
  const message = text(['{name} passe niveau {level} !', '{name} reaches level {level}!'], {
    name: identity.name,
    level: employment.level,
  });
  addDevLog(state, devId, message);
  notify(state, ctx, 'DEV_LEVEL_UP', message, devId);
}

/** Conséquences d'une tâche terminée sur les jauges, selon son type. */
function completeTask(
  state: GameState,
  ctx: SimContext,
  taskId: EntityId,
  devId: EntityId,
  leadership: LeadershipEffects = NO_LEADERSHIP,
  skills: SkillTeamEffects = NO_SKILL_EFFECTS,
): void {
  const task = state.components.task[taskId];
  const identity = state.components.identity[devId];
  if (!task || !identity) return;

  // La designeuse bloque la release tant que le padding est faux (une fois par feature).
  if (task.type === 'FEATURE' && !task.designApproved && hasRole(state, 'DESIGNER')) {
    task.designApproved = true;
    // « Pixel perfect » : même tirage, mais 2 fois moins de chances d'être bloqué.
    const blockOdds = skills.pixelPerfect
      ? BALANCE.roles.designerBlock * SKILLS.pixelPerfectBlock
      : BALANCE.roles.designerBlock;
    if (ctx.rng.chance(blockOdds)) {
      task.work += task.work * BALANCE.roles.designerExtraWork;
      const designer = devsWithRole(state, 'DESIGNER')[0] ?? null;
      notify(
        state,
        ctx,
        'DESIGN_BLOCKED',
        text(
          [
            '« {task} » bloquée : le padding est faux de 2 px.',
            '"{task}" blocked: the padding is off by 2px.',
          ],
          { task: task.title },
        ),
        designer,
      );
      return;
    }
  }

  task.column = 'DONE';
  task.doneAtSprint = state.sprint;
  task.assigneeId = null;
  const worker = state.components.worker[devId];
  if (worker) worker.taskId = null;
  const employment = state.components.employment[devId];
  if (employment) employment.tasksDone += 1;
  recordTaskDone(state, devId, task.size);
  // Tâche urgente ou hebdomadaire : seule sa récompense compte (pas l'effet de son type).
  if (task.kind) {
    completeSpecialTask(state, ctx, task);
    addDevLog(
      state,
      devId,
      text(['A terminé « {task} ».', 'Finished "{task}".'], { task: task.title }),
    );
    return;
  }

  const quality = task.progress > 0 ? task.qualitySum / task.progress : 0.5;
  const debtMultiplier = task.progress > 0 ? task.debtFactor / task.progress : 1;
  const { debt, stability } = BALANCE;
  switch (task.type) {
    case 'FEATURE':
      // Revue de code du tech lead et recette des testeurs : moins de dette à la livraison.
      addGauge(
        state,
        'debt',
        task.size *
          debt.featurePerPoint *
          (1.3 - quality) *
          debtMultiplier *
          leadership.featureDebtFactor *
          skills.featureDebtFactor *
          (retroActive(state, 'MORE_TESTS') ? RETRO.moreTestsDebtFactor : 1),
      );
      addGauge(state, 'stability', task.size * stability.featurePerPoint);
      state.stats.featuresShipped += 1;
      // « Moins d'hallucinations » change la probabilité, pas le nombre de tirages.
      if (
        identity.role === 'AI_AGENT' &&
        ctx.rng.chance(
          hasSkill(state, devId, 'fewer-hallucinations')
            ? SKILLS.fewerHallucinationsOdds
            : BALANCE.roles.aiHallucination,
        )
      ) {
        task.hallucinated = true;
        addGauge(state, 'debt', debt.hallucinationDebt);
        state.stats.hallucinations += 1;
        notify(
          state,
          ctx,
          'HALLUCINATION',
          text(
            [
              '{name} a halluciné « {task} ». La feature n’existe pas, mais le ticket est fermé.',
              '{name} hallucinated "{task}". The feature does not exist, but the ticket is closed.',
            ],
            {
              name: identity.name,
              task: task.title,
            },
          ),
          devId,
        );
        return;
      }
      break;
    case 'REFACTO':
      addGauge(
        state,
        'debt',
        task.size *
          debt.refactoPerPoint *
          (0.5 + quality) *
          (hasSkill(state, devId, 'successful-rewrite') ? SKILLS.successfulRewriteRefacto : 1),
      );
      state.stats.refactosDone += 1;
      break;
    case 'BUGFIX':
      addGauge(state, 'stability', task.size * stability.bugfixPerPoint * (0.5 + quality));
      addGauge(state, 'debt', task.size * debt.bugfixPerPoint);
      break;
    case 'INFRA':
      addGauge(state, 'stability', task.size * stability.infraPerPoint * (0.5 + quality));
      addGauge(state, 'debt', task.size * debt.infraPerPoint);
      break;
  }
  addDevLog(
    state,
    devId,
    text(['A terminé « {task} ».', 'Finished "{task}".'], { task: task.title }),
  );
  notify(
    state,
    ctx,
    task.type === 'FEATURE' ? 'FEATURE_DONE' : 'TASK_DONE',
    text(['{name} a terminé « {task} ».', '{name} finished "{task}".'], {
      name: identity.name,
      task: task.title,
    }),
    devId,
  );
}

/** Part de la demi-heure qui reste pour travailler après la réunion d'équipe du matin (20 min). */
const AFTER_MORNING_MEETING = 1 - MEETINGS.dailyMinutes / TIME.tickMinutes;

/** Système « travail » : fait avancer les tâches des devs en train de travailler. */
export function workSystem(
  state: GameState,
  ctx: SimContext,
  clock: SimClock = getClock(state),
): void {
  const hasProductOwner = hasRole(state, 'PRODUCT_OWNER');
  const morningMeeting = state.stage === 'EXECUTION' && isTeamMeetingTime(state, clock);
  const leadership = leadershipEffects(state);
  const skills = skillTeamEffects(state);
  for (const devId of devIds(state)) {
    const kind = state.components.activity[devId]?.kind;
    // La réunion du matin dure 20 minutes : les 10 dernières de la demi-heure, on code.
    const share =
      kind === 'WORKING' ? 1 : morningMeeting && kind === 'MEETING' ? AFTER_MORNING_MEETING : 0;
    if (share === 0) continue;
    const taskId = state.components.worker[devId]?.taskId;
    const task = taskId ? state.components.task[taskId] : undefined;
    const identity = state.components.identity[devId];
    if (!taskId || !task || !identity) continue;
    if (task.column === 'TODO') task.column = 'IN_PROGRESS';
    const rate =
      productivity(state, ctx, devId, task, hasProductOwner, leadership, clock, skills) * share;
    task.progress += rate;
    const quality = effectiveQuality(state, ctx, devId);
    task.qualitySum += rate * quality;
    recordWork(state, devId, rate, quality);
    task.debtFactor +=
      rate * ROLE_PROFILES[identity.role].debtMultiplier * skillDebtFactor(state, devId);
    gainXp(state, ctx, devId, rate, skills);
    if (task.progress >= task.work) completeTask(state, ctx, taskId, devId, leadership, skills);
  }
  // Sans Daily ce matin, deux devs finissent par coder la même chose.
  checkDuplicateWork(state, ctx, clock);
}
