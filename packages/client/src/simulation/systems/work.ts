import {
  BALANCE,
  ROLE_PROFILES,
  ROLE_TRADE,
  TIME,
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
import { recordTaskDone, recordWork } from '../performance';

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
  // Product Owner : 4 réunions par jour, −10 % pour tout le monde (sauf casque antibruit).
  if (hasProductOwner && !ctx.office.meetingShielded[devId]) {
    rate *= 1 - BALANCE.work.poMeetingPenalty;
  }
  rate *= 1 + ctx.office.teamProductivity + (ctx.office.seatProductivity[devId] ?? 0);
  if (identity.role === 'SENIOR_BEARD' && task.shinyFramework)
    rate *= BALANCE.roles.seniorShinyMalus;
  if (thinksInRust(state, devId)) {
    rate *= task.type === 'REFACTO' ? BALANCE.roles.rustRefactoBonus : BALANCE.roles.rustOtherMalus;
  }
  // Télétravail : moins de collaboration (le Dev Fantôme, lui, a toujours travaillé ainsi).
  if (remote && identity.role !== 'GHOST') rate *= 1 - BALANCE.remote.productivityPenalty;
  // Hors de son métier (tâche confiée à la main), on tâtonne.
  if (ROLE_TRADE[identity.role] !== taskTrade(task)) rate *= BALANCE.work.offTradeMultiplier;
  if (identity.trait === 'PERFECTIONIST') rate *= 0.9;
  if (identity.trait === 'COFFEE_ADDICT' && state.gauges.coffee > 50) rate *= 1.1;
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
  // Télétravail : moins de relectures à deux devant le même écran.
  if (devId in state.components.remote && identity.role !== 'GHOST')
    quality *= 1 - BALANCE.remote.qualityPenalty;
  return clamp(quality, 0, 1);
}

function gainXp(state: GameState, ctx: SimContext, devId: EntityId, amount: number): void {
  const employment = state.components.employment[devId];
  const stats = state.components.stats[devId];
  const identity = state.components.identity[devId];
  if (!employment || !stats || !identity) return;
  employment.xp += amount * BALANCE.work.xpPerUnit;
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
function completeTask(state: GameState, ctx: SimContext, taskId: EntityId, devId: EntityId): void {
  const task = state.components.task[taskId];
  const identity = state.components.identity[devId];
  if (!task || !identity) return;

  // La designeuse bloque la release tant que le padding est faux (une fois par feature).
  if (task.type === 'FEATURE' && !task.designApproved && hasRole(state, 'DESIGNER')) {
    task.designApproved = true;
    if (ctx.rng.chance(BALANCE.roles.designerBlock)) {
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

  const quality = task.progress > 0 ? task.qualitySum / task.progress : 0.5;
  const debtMultiplier = task.progress > 0 ? task.debtFactor / task.progress : 1;
  const { debt, stability } = BALANCE;
  switch (task.type) {
    case 'FEATURE':
      addGauge(state, 'debt', task.size * debt.featurePerPoint * (1.3 - quality) * debtMultiplier);
      addGauge(state, 'stability', task.size * stability.featurePerPoint);
      state.stats.featuresShipped += 1;
      if (identity.role === 'AI_AGENT' && ctx.rng.chance(BALANCE.roles.aiHallucination)) {
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
      addGauge(state, 'debt', task.size * debt.refactoPerPoint * (0.5 + quality));
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

/** Système « travail » : fait avancer les tâches des devs en train de travailler. */
export function workSystem(state: GameState, ctx: SimContext): void {
  const hasProductOwner = hasRole(state, 'PRODUCT_OWNER');
  for (const devId of devIds(state)) {
    if (state.components.activity[devId]?.kind !== 'WORKING') continue;
    const taskId = state.components.worker[devId]?.taskId;
    const task = taskId ? state.components.task[taskId] : undefined;
    const identity = state.components.identity[devId];
    if (!taskId || !task || !identity) continue;
    if (task.column === 'TODO') task.column = 'IN_PROGRESS';
    const rate = productivity(state, ctx, devId, task, hasProductOwner);
    task.progress += rate;
    const quality = effectiveQuality(state, ctx, devId);
    task.qualitySum += rate * quality;
    recordWork(state, devId, rate, quality);
    task.debtFactor += rate * ROLE_PROFILES[identity.role].debtMultiplier;
    gainXp(state, ctx, devId, rate);
    if (task.progress >= task.work) completeTask(state, ctx, taskId, devId);
  }
}
