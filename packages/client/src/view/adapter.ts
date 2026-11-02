/**
 * Adaptateur simulation → affichage.
 *
 * - `toGameView` convertit un `GameState` (l'état complet de la simulation, en ECS) en
 *   `GameView`, l'instantané simple que lisent le rendu et l'interface.
 * - `toCommand` traduit une `GameCommand` de l'interface en commande de la simulation.
 *
 * Ce sont des fonctions pures : aucun accès au DOM, à Three.js ni au Web Worker.
 */
import {
  ANNEXES,
  BALANCE,
  DEFAULT_COMPUTER,
  hasComputer,
  DAILY_SYNC,
  MEETING_FORMATS,
  PETS,
  FUNDING_TIERS,
  PITCH_QUESTIONS,
  ROLE_PROFILES,
  ROLE_STACK,
  ROLE_TRADE,
  hasOpening,
  taskStack,
  annexCount,
  fundingTier,
  fundingTierIndex,
  TIME,
  OUTINGS,
  OUTING_DEFINITIONS,
  TEAM_BUILDING,
  VENTURES,
  birthdayFromKey,
  civilFromDays,
  getFurniture,
  getInvestor,
  getVentureIdea,
  seasonsAt,
  getPitchArgument,
  taskTrade,
  type Command,
  type EventCard,
  type FurnitureColor,
  type GameState,
  type MonitorChoice,
  type Identity,
  type PitchState,
  type Speed,
  type SprintPerformance,
  type Stats,
  type TaskColumn,
  PHASES,
  FLOOR_MATERIALS,
  WALL_FINISHES,
  floorZones,
  wallZones,
  CLEANING,
  CLEANING_CREW,
  CLEANING_PLANS,
  cleaningCallPrice,
  dirtProductivity,
  HOSTING_SAVING_MAX,
  saturationPenalty,
  firstPayment,
  SUBSCRIPTION_SERVICES,
  SUBSCRIPTION_SERVICE_INFO,
  hasFibreBox,
  monthlyPrice,
  offersOf,
  type SubscriptionOffer,
  careerLegend,
  careerMilestoneLabel,
  SKILL_BRANCHES,
  TRAININGS,
  branchNodes,
  isRoleSkill,
  skillsEnabled,
  getRival,
  type CampaignState,
} from '@oss/shared';
import { careerMetricValue } from '../simulation/career';
import { wallOffice } from '../simulation/walls';
import { marketShare } from '../simulation/rivals';
import { actProgress, completedSprints, missionProgress } from '../simulation/story';
import { hasUnlock } from '../simulation/unlocks';
import {
  hasSkill,
  hasSkillTree,
  isCrunching,
  resetCost,
  skillBlocker,
  skillPoints,
} from '../simulation/skills';
import { officeLayout, settleFixtures, type Fixture } from './layout';
import { badEffectFactor, escalate } from '../events/effects';
import { portfolioValue, runwayMonths } from '../simulation/economy';
import { financingOffers } from '../simulation/financing';
import { currentTier, pitchBar } from '../simulation/fundraising';
import { softSigmoid } from '../simulation/math';
import { countDesks, monitorOf, RESALE_RATIO } from '../simulation/furniture';
import { activeProjections } from '../simulation/projection';
import { leadershipEffects, teamShape } from '../simulation/leadership';
import { clamp, devIds, teamMax } from '../simulation/helpers';
import {
  expectedProductivity,
  expectedQuality,
  hoursOf,
  overallPerformance,
  productivityOf,
  qualityOf,
} from '../simulation/performance';
import { objectiveReached, objectiveValue, sprintTime } from '../simulation/taskFlow';
import { tasksInColumn } from '../simulation/tasks';
import { birthdayOf, birthdayPartyIds, calendarDay } from '../simulation/systems/calendar';
import { clockAt, getClock } from '../simulation/time';
import {
  meetingFormatBlocker,
  meetingRoomRefund,
  meetingRoomUnlocked,
} from '../simulation/meetings';
import {
  investableCash,
  officeWings,
  salePrice,
  ventureBlocker,
  ventureOffers,
  venturesUnlocked,
} from '../simulation/ventures';
import { adoptionBlocker, missingPetNeeds, petEquipment } from '../simulation/pets';
import { leavingAtSprint } from '../simulation/raises';
import { holidayOf, leaveSlots, sprintHasBridge } from '../simulation/teamLife';
import { activeRetro, retroWinner } from '../simulation/retro';
import { outingBlocker, outingPrice } from '../simulation/teamBuilding';
import { planWeeklyPrice, visitPrice } from '../simulation/cleaning';
import {
  offerLoad,
  requirementMet,
  serviceUsers,
  subscriptionOf,
  subscriptionsMonthly,
} from '../simulation/subscriptions';
import {
  hostingSaving,
  isSummer,
  serverRoomItems,
  serverRoomStatuses,
} from '../simulation/serverRoom';
import type {
  AbsenceView,
  TeamBuildingView,
  RetroView,
  StoryView,
  CampaignView,
  MarketView,
  CandidateView,
  DevActivity,
  DevView,
  DevSkillsView,
  PerformanceView,
  PitchAnswerView,
  PitchArgumentView,
  PitchView,
  SprintPerformanceView,
  EventView,
  GameCommand,
  FundingView,
  GroupView,
  GameView,
  MeetingRoomView,
  DailyView,
  PetsView,
  ServersView,
  CleaningView,
  SubscriptionOfferView,
  SubscriptionServiceView,
  SubscriptionsView,
  WallsView,
  FloorsView,
  GaugeName,
  KanbanColumn,
  LeadershipView,
  CareerMilestoneView,
  LegendRunView,
  ObjectiveView,
  PlacedItemView,
  StoredItemView,
  RaiseRequestView,
  RemoteReason,
  Rotation,
  TaskType,
  TaskView,
} from './types';

/** Ce que l'adaptateur sait en plus de l'état : la vitesse vient de l'horloge du moteur. */
export interface ViewContext {
  readonly speed: Speed;
  readonly running: boolean;
  /** Texte des cartes d'événements (l'état ne garde que leur identifiant). */
  readonly card: (id: string) => EventCard | undefined;
  /** Progression du replay (null pour une partie jouée). */
  readonly replay?: { readonly played: number; readonly total: number } | null;
  /** Durée réelle d'un tick à la vitesse actuelle, en ms (horloge continue). */
  readonly tickDurationMs?: number;
  /** Instant de réception du snapshot (performance.now), en ms. */
  readonly receivedAt?: number;
}

const COLUMNS: Record<TaskColumn, KanbanColumn> = {
  BACKLOG: 'BACKLOG',
  TODO: 'TODO',
  IN_PROGRESS: 'DOING',
  DONE: 'DONE',
};

const TASK_TYPES: Record<GameState['components']['task'][string]['type'], TaskType> = {
  FEATURE: 'FEATURE',
  REFACTO: 'REFACTOR',
  BUGFIX: 'BUGFIX',
  INFRA: 'INFRA',
};

/** Sens de l'effet de chaque type de tâche, pour l'affichage sur les cartes du Kanban. */
const TASK_IMPACT: Record<TaskType, Partial<Record<GaugeName, number>>> = {
  FEATURE: { users: 1, hype: 1, debt: 1 },
  REFACTOR: { debt: -1, hype: -1 },
  BUGFIX: { stability: 1 },
  INFRA: { stability: 1, debt: -1 },
};

/** Durée pendant laquelle une panne reste visible (fumée, écran rouge) : 2 heures simulées. */
const INCIDENT_TICKS = 2 * TIME.ticksPerHour;

const BAD_DIRECTION: Record<GaugeName | 'moral', 1 | -1> = {
  treasury: -1,
  coffee: -1,
  hype: -1,
  debt: 1,
  stability: -1,
  users: -1,
  moral: -1,
};
const EFFECT_KEYS = Object.keys(BAD_DIRECTION) as (GaugeName | 'moral')[];

function activityOf(state: GameState, id: string): DevActivity {
  if (id in state.components.remote) return 'REMOTE';
  const kind = state.components.activity[id]?.kind ?? 'WORKING';
  switch (kind) {
    case 'IDLE':
      return 'WORKING';
    case 'GONE':
      // Hors exécution (planification, démo…), l'équipe est au bureau pour préparer le sprint.
      return state.stage === 'EXECUTION' ? 'LEAVING' : 'WORKING';
    default:
      return kind;
  }
}

function remoteReasonOf(state: GameState, id: string): RemoteReason | null {
  if (!(id in state.components.remote)) return null;
  // Les sauvegardes d'avant le télétravail automatique n'ont que le Dev Fantôme à distance.
  return state.components.remoteReason[id] ?? 'GHOST';
}

function sprintPerformanceView(sprint: SprintPerformance): SprintPerformanceView {
  return {
    sprint: sprint.sprint,
    productivity: productivityOf(sprint),
    quality: qualityOf(sprint),
    points: sprint.points,
    tasks: sprint.tasks,
    hours: hoursOf(sprint),
    incidents: sprint.incidents,
    lost: sprint.lost,
  };
}

/** Performance d'un dev (ou d'un candidat, sans sprint mesuré). */
export function performanceView(
  identity: Identity,
  stats: Stats,
  level: number,
  sprints: readonly SprintPerformance[] = [],
  current: SprintPerformance | null = null,
): PerformanceView {
  const overall = overallPerformance(identity, stats, level, sprints);
  return {
    ...overall,
    expectedProductivity: expectedProductivity(identity, stats, level),
    expectedQuality: expectedQuality(identity, stats),
    lastSprints: sprints.slice(-2).reverse().map(sprintPerformanceView),
    current: current ? sprintPerformanceView(current) : null,
  };
}

/** Arbre de compétences d'un dev, prêt à afficher (null : pas d'arbre pour lui ici). */
function devSkillsView(state: GameState, id: string): DevSkillsView | null {
  const role = state.components.identity[id]?.role;
  if (!role || !skillsEnabled(state.mode) || !hasSkillTree(state, id)) return null;
  const points = skillPoints(state, id);
  const skills = state.components.skills[id];
  const crunchLearned = hasSkill(state, id, 'crunch');
  return {
    ...points,
    branches: SKILL_BRANCHES.map((branch) => ({
      branch,
      nodes: branchNodes(branch, role).map((node) => {
        const blocker = skillBlocker(state, id, node.id);
        return {
          id: node.id,
          icon: node.icon,
          name: node.name,
          effect: node.effect,
          status: blocker === 'LEARNED' ? 'LEARNED' : blocker === null ? 'AVAILABLE' : 'LOCKED',
          roleNode: isRoleSkill(node.id),
          active: node.active === true,
        };
      }),
    })),
    trainedThisSprint: skills?.trainedSprint === state.sprint,
    trainings: TRAININGS.map(({ kind, icon, name, effect, price }) => ({
      kind,
      icon,
      name,
      effect,
      price,
    })),
    resetCost: resetCost(state, id),
    crunch: {
      learned: crunchLearned,
      ready: crunchLearned && state.stage === 'EXECUTION' && skills?.crunchSprint !== state.sprint,
      active: isCrunching(state, id),
    },
  };
}

function devView(state: GameState, id: string): DevView | null {
  const c = state.components;
  const identity = c.identity[id];
  const stats = c.stats[id];
  if (!identity || !stats) return null;
  const employment = c.employment[id];
  const mood = c.mood[id];
  const level = employment?.level ?? 1;
  const performance = c.performance[id];
  const taskId = c.worker[id]?.taskId;
  return {
    id,
    name: identity.name,
    age: identity.age,
    role: identity.role,
    trade: ROLE_TRADE[identity.role],
    stack: ROLE_STACK[identity.role] ?? null,
    specialty: identity.specialty ?? null,
    trait: identity.trait,
    bio: identity.bio,
    stats,
    salary: employment?.salary ?? 0,
    level,
    morale: mood?.moral ?? 50,
    energy: mood?.energy ?? 100,
    activity: activityOf(state, id),
    remoteReason: remoteReasonOf(state, id),
    relations: c.relations[id] ?? {},
    history: [...(c.devLog[id] ?? [])].reverse(),
    look: identity.look,
    birthday: birthdayOf(state, id),
    performance: performanceView(
      identity,
      stats,
      level,
      performance?.sprints,
      performance?.current ?? null,
    ),
    career: employment
      ? {
          hiredAtSprint: employment.hiredAtSprint,
          sprintsInTeam: state.sprint - employment.hiredAtSprint + 1,
          xp: employment.xp,
          xpToNext: employment.level * BALANCE.work.xpPerLevel,
          tasksDone: employment.tasksDone,
          currentTask: (taskId && c.task[taskId]?.title) || null,
        }
      : null,
    leavingAtSprint: leavingAtSprint(state, id),
    absence: absenceView(state, id),
    leave:
      state.teamLife && identity.role !== 'GHOST' && identity.role !== 'AI_AGENT'
        ? (state.teamLife.leave[id] ?? 0)
        : null,
    skills: devSkillsView(state, id),
  };
}

function teamBuildingView(state: GameState): TeamBuildingView {
  const booked = state.teamBuilding.booked;
  const last = state.teamBuilding.last;
  return {
    booked:
      booked && booked.sprint === state.sprint
        ? { outing: booked.outing, cost: booked.cost }
        : null,
    outings: OUTINGS.map((id) => {
      const outing = OUTING_DEFINITIONS[id];
      const days = outing.endDay - outing.startDay;
      return {
        id,
        icon: outing.icon,
        phase: outing.phase,
        price: outingPrice(state, outing),
        blocker: outingBlocker(state, outing),
        repeat: last?.outing === id && last.sprint === state.sprint - 1,
        moral: outing.moral,
        hoursLost: Math.max(0, TEAM_BUILDING.endHour - outing.startHour) + days * 9,
      };
    }),
    count: state.teamBuilding.count,
  };
}

function retroView(state: GameState): RetroView | null {
  const pending = state.retro.pending;
  if (!pending || pending.sprint !== state.sprint || state.stage !== 'PLANNING') return null;
  return {
    options: pending.options.map((action) => ({
      action,
      voters: Object.entries(pending.votes)
        .filter(([id, vote]) => vote === action && state.components.identity[id])
        .map(([id]) => id),
    })),
    winner: retroWinner(pending.options, pending.votes),
  };
}

function absenceView(state: GameState, id: string): AbsenceView | null {
  const absence = state.teamLife?.absences[id];
  if (!absence) return null;
  const today = getClock(state).day;
  const sprintStart = (state.sprint - 1) * TIME.daysPerSprint;
  const offset = absence.from - sprintStart;
  return {
    kind: absence.kind,
    days: absence.days,
    // En planification, un congé qui commence lundi n'a pas encore commencé (il s'annule).
    started: absence.from <= today && !(state.stage === 'PLANNING' && offset === 0),
    week: absence.kind === 'LEAVE' && offset >= 0 ? (offset >= 7 ? 1 : 0) : null,
    returnDate: civilFromDays(calendarDay(state, absence.until)),
  };
}

function raiseRequestView(state: GameState): RaiseRequestView | null {
  const request = state.raises.pending;
  if (!request) return null;
  const { raises } = BALANCE;
  return {
    devId: request.devId,
    currentSalary: request.currentSalary,
    requestedSalary: request.requestedSalary,
    acceptMoral: raises.acceptMoral,
    skillsGained: raises.skillsGained,
    resignChance: raises.resignChance,
    skillsLost: raises.skillsLost,
    noticeSprints: raises.noticeSprints,
  };
}

function taskViews(state: GameState): TaskView[] {
  const tasks: TaskView[] = [];
  for (const column of ['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE'] as const) {
    for (const id of tasksInColumn(state, column)) {
      const task = state.components.task[id];
      if (!task) continue;
      const type = TASK_TYPES[task.type];
      tasks.push({
        id,
        title: task.title,
        type,
        trade: taskTrade(task),
        stack: taskStack(task),
        size: task.size,
        column: COLUMNS[task.column],
        assigneeId: task.assigneeId,
        progress: Math.min(1, task.progress / task.work),
        // Urgences et tâches de la semaine : seule leur récompense compte, pas l'effet du type.
        impact: task.kind ? {} : TASK_IMPACT[type],
        hallucinated: task.hallucinated,
        kind: task.kind ?? null,
        ...dueOf(state, task.deadline),
      });
    }
  }
  return tasks;
}

/** Échéance d'une tâche spéciale, lisible : « avant mardi 14h », « encore 6 h ». */
function dueOf(
  state: GameState,
  deadline: number | undefined,
): Pick<TaskView, 'due' | 'hoursLeft'> {
  if (deadline === undefined) return { due: null, hoursLeft: null };
  const sprint = Math.floor(deadline / TIME.ticksPerSprint);
  const clock = clockAt(sprint, deadline - sprint * TIME.ticksPerSprint);
  return {
    due: { dayOfWeek: clock.dayOfWeek, hour: clock.hour },
    hoursLeft: Math.max(0, (deadline - sprintTime(state)) / TIME.ticksPerHour),
  };
}

function objectiveView(state: GameState): ObjectiveView | null {
  const objective = state.objective;
  if (!objective || objective.status !== 'ACTIVE' || objective.sprint !== state.sprint) return null;
  const value = objectiveValue(state, objective);
  return {
    kind: objective.kind,
    difficulty: objective.difficulty,
    target: objective.target,
    value,
    reached: objectiveReached(objective, value),
    reward: objective.reward,
  };
}

/** Mode Carrière : la légende et l'état de chaque jalon, avec la progression vers sa cible. */
function legendRunView(state: GameState): LegendRunView | null {
  const career = state.career;
  if (!career) return null;
  const legend = careerLegend(career.legend);
  const milestones = legend.milestones.map((milestone): CareerMilestoneView => {
    const progress = career.milestones[milestone.id] ?? { status: 'PENDING', sprint: null };
    const bySprint =
      milestone.kind === 'phase' || milestone.kind === 'metric'
        ? (milestone.bySprint ?? null)
        : null;
    return {
      id: milestone.id,
      label: careerMilestoneLabel(milestone),
      status: progress.status,
      sprint: progress.sprint,
      bySprint,
      progress:
        milestone.kind === 'metric'
          ? Math.min(1, careerMetricValue(state, milestone.metric) / milestone.min)
          : null,
    };
  });
  return {
    legend: legend.id,
    icon: legend.icon,
    name: legend.name,
    year: legend.year,
    difficulty: legend.difficulty,
    story: legend.story,
    twist: legend.twist,
    milestones,
    done: milestones.filter((m) => m.status === 'DONE').length,
    total: milestones.length,
  };
}

/** Postes affichés dans « Encadrement » (les devs front, back et fullstack sont illimités). */
const LEADERSHIP_ROLES = [
  'DIRECTOR',
  'DEPUTY_DIRECTOR',
  'MANAGER',
  'SCRUM_MASTER',
  'TECH_LEAD',
  'QA_TESTER',
  'DEVOPS',
] as const;

function leadershipView(state: GameState): LeadershipView {
  const effects = leadershipEffects(state);
  const shape = teamShape(state);
  return {
    productivity: Math.round(effects.productivity * 100),
    coverage: Math.round(effects.coverage * 100),
    lighterMeetings: effects.meetingFactor < 1,
    featureDebtCut: Math.round((1 - effects.featureDebtFactor) * 100),
    dailyStability: effects.dailyStability,
    dailyMoral: effects.dailyMoral,
    openings: LEADERSHIP_ROLES.filter((role) => hasOpening(role, shape)),
  };
}

function candidateViews(state: GameState): CandidateView[] {
  return state.candidates
    .filter((candidate) => candidate.status === 'OPEN')
    .map((candidate) => ({
      id: candidate.id,
      askingSalary: candidate.askingSalary,
      marketSalary: ROLE_PROFILES[candidate.identity.role].salary,
      dev: {
        id: candidate.id,
        name: candidate.identity.name,
        age: candidate.identity.age,
        role: candidate.identity.role,
        trade: ROLE_TRADE[candidate.identity.role],
        stack: ROLE_STACK[candidate.identity.role] ?? null,
        specialty: candidate.identity.specialty ?? null,
        trait: candidate.identity.trait,
        bio: candidate.identity.bio,
        stats: candidate.stats,
        salary: candidate.askingSalary,
        level: 1,
        morale: 70,
        energy: 100,
        activity: 'WORKING',
        remoteReason: null,
        relations: {},
        history: [],
        look: candidate.identity.look,
        birthday: candidate.identity.birthday ?? birthdayFromKey(`${state.seed}:${candidate.id}`),
        performance: performanceView(candidate.identity, candidate.stats, 1),
        career: null,
        leavingAtSprint: null,
        absence: null,
        leave: null,
        skills: null,
      },
    }));
}

/** Écran d'un poste de travail, sans son prix d'achat. */
function monitorView(item: Parameters<typeof monitorOf>[0]): MonitorChoice {
  const { model, size, mount } = monitorOf(item);
  return { model, size, mount };
}

/**
 * Décor offert avec les annexes : des objets posés comme les autres, à leur place d'origine ou
 * là où le joueur les a déplacés. Sans valeur de revente : ils se déplacent et se tournent
 * seulement (identifiant `annex:<clé>`, jamais celui d'une entité).
 */
function annexDecorViews(state: GameState, furniture: readonly PlacedItemView[]): PlacedItemView[] {
  const { phase, annexes, wings } = wallOffice(state);
  const layout = officeLayout(phase, wings, annexes);
  const view = (fixture: Fixture): PlacedItemView => {
    const moved = state.annexDecor[fixture.key];
    return {
      id: `annex:${fixture.key}`,
      kind: fixture.kind,
      x: moved?.x ?? fixture.x,
      z: moved?.y ?? fixture.z,
      rotation: ((moved?.rotation ?? 0) % 4) as Rotation,
      resale: 0,
      color: 'natural',
      host: null,
      annexDecor: fixture.key,
    };
  };
  const fixtures = layout.fixtures ?? [];
  // Le décor déplacé par le joueur reste où il l'a mis ; le reste évite le mobilier déjà posé.
  const pinned = fixtures.filter((fixture) => state.annexDecor[fixture.key]).map(view);
  const settled = new Map(
    settleFixtures(layout, [...furniture, ...pinned]).map((fixture) => [fixture.key, fixture]),
  );
  return fixtures.flatMap((fixture) => {
    if (state.annexDecor[fixture.key]) return [view(fixture)];
    const spot = settled.get(fixture.key);
    return spot ? [view(spot)] : [];
  });
}

function itemViews(state: GameState): PlacedItemView[] {
  const furniture = furnitureViews(state);
  return [...furniture, ...annexDecorViews(state, furniture)];
}

function furnitureViews(state: GameState): PlacedItemView[] {
  return Object.entries(state.components.furniture).map(([id, item]) => ({
    id,
    kind: item.itemId,
    x: item.x,
    z: item.y,
    rotation: (item.rotation % 4) as Rotation,
    // Un poste de travail se revend avec son écran.
    resale: Math.round((item.purchasePrice + (item.monitor?.price ?? 0)) * RESALE_RATIO),
    color: item.color ?? 'natural',
    host: item.hostId !== undefined ? { id: item.hostId, slot: item.slot ?? 0 } : null,
    ...(getFurniture(item.itemId)?.monitor ? { monitor: monitorView(item) } : {}),
    ...(item.on ? { on: true } : {}),
    ...(hasComputer(item.itemId) ? { computer: item.computer ?? DEFAULT_COMPUTER } : {}),
  }));
}

function inventoryView(state: GameState): StoredItemView[] {
  const stacks = new Map<string, StoredItemView>();
  for (const stored of state.inventory) {
    const color = stored.color ?? 'natural';
    const key = `${stored.itemId}#${color}`;
    const stack = stacks.get(key);
    stacks.set(
      key,
      stack
        ? { ...stack, count: stack.count + 1 }
        : {
            kind: stored.itemId,
            color,
            count: 1,
            resale: Math.round(
              (stored.purchasePrice + (stored.monitor?.price ?? 0)) * RESALE_RATIO,
            ),
          },
    );
  }
  return [...stacks.values()];
}

/** Couleur d'une commande d'inventaire : `natural` n'est pas transmise. */
const storedColor = (color: FurnitureColor) => (color === 'natural' ? {} : { color });

function eventView(state: GameState, context: ViewContext): EventView | null {
  const pending = state.events.pending;
  const card = pending ? context.card(pending.cardId) : undefined;
  if (!pending || !card) return null;
  return {
    cardId: card.id,
    title: card.title,
    description: card.description,
    level: pending.level,
    choices: card.choices.map((choice) => {
      const effects: Partial<Record<GaugeName | 'moral', number>> = {};
      for (const key of EFFECT_KEYS) {
        const value = choice.effects[key];
        if (value !== undefined && value !== 0)
          effects[key] = Math.round(
            escalate(value, BAD_DIRECTION[key], pending.level, badEffectFactor(state.mode)),
          );
      }
      return { label: choice.label, effects };
    }),
  };
}

function pitchBlocker(state: GameState): GameView['pitchBlocker'] {
  if (state.stage !== 'PLANNING') return 'WRONG_STAGE';
  if (state.gauges.hype <= 0) return 'NO_HYPE';
  if (
    state.lastPitchSprint !== null &&
    state.sprint - state.lastPitchSprint < BALANCE.fundraising.cooldownSprints
  ) {
    return 'COOLDOWN';
  }
  return null;
}

/** Argument du pitch tel que l'interface l'affiche. */
function pitchArgumentView(id: string): PitchArgumentView | null {
  const argument = getPitchArgument(id);
  return argument
    ? { id, label: argument.label, category: argument.category, bluff: argument.bluff ?? false }
    : null;
}

/** Réaction de l'investisseur à une réponse, d'après son effet sur l'intérêt. */
function reaction(delta: number): PitchAnswerView['reaction'] {
  return delta >= 0.5 ? 'good' : delta <= -0.3 ? 'bad' : 'neutral';
}

function pitchView(state: GameState, pitch: PitchState): PitchView {
  const investor = getInvestor(pitch.investor);
  const tier = currentTier(state);
  const question = pitch.question
    ? PITCH_QUESTIONS.filter((q) => q.category === pitch.question?.category)[pitch.question.index]
    : undefined;
  return {
    investor: { name: investor.name, intro: investor.intro },
    roundName: tier.name,
    tier: pitch.tier,
    tiers: FUNDING_TIERS.length,
    round: pitch.round,
    rounds: pitch.manches,
    question: question ? { text: question.text, category: question.category } : null,
    options: pitch.options.flatMap((id) => pitchArgumentView(id) ?? []),
    chosen: pitch.chosen.flatMap((id, index) => {
      const argument = pitchArgumentView(id);
      const entry = pitch.log[index];
      if (!argument) return [];
      return [
        {
          ...argument,
          reaction: entry ? reaction(entry.delta) : 'neutral',
          offTopic: entry ? !entry.onTopic : false,
          bluffCaught: entry?.bluffCaught ?? false,
        },
      ];
    }),
    interest: Math.round(softSigmoid(pitch.interest - pitchBar(state, tier)) * 100) / 100,
    walkedOut: pitch.walkedOut,
    result: pitch.result,
  };
}

/** Levées de fonds : prochain tour de table, autres financements, prêt et annexes. */
function fundingView(state: GameState): FundingView {
  const next = fundingTier(state.fundingRounds);
  const loan = state.financing.loan;
  return {
    nextRound: {
      name: next.name,
      tier: fundingTierIndex(state.fundingRounds),
      manches: next.manches,
      options: next.options,
    },
    tiers: FUNDING_TIERS.length,
    nextPitchSprint:
      state.lastPitchSprint !== null &&
      state.sprint - state.lastPitchSprint < BALANCE.fundraising.cooldownSprints
        ? state.lastPitchSprint + BALANCE.fundraising.cooldownSprints
        : null,
    offers: financingOffers(state),
    loan: loan ? { remaining: Math.round(loan.remaining), monthly: loan.monthly } : null,
    rounds: state.fundingRounds,
    totalRaised: state.totalRaised,
    annexes: annexCount(state.fundingRounds),
    maxAnnexes: ANNEXES.max,
  };
}

/** Les filiales du groupe et les projets du sprint. */
function groupView(state: GameState): GroupView {
  const blocker = ventureBlocker(state);
  const investable = investableCash(state);
  return {
    unlocked: venturesUnlocked(state),
    // Les autres refus (`NOT_ENOUGH_MONEY`…) ne concernent qu'un projet donné.
    blocker:
      blocker === 'LOCKED' ||
      blocker === 'WRONG_STAGE' ||
      blocker === 'VENTURE_LIMIT' ||
      blocker === 'TOO_LATE' ||
      blocker === 'COOLDOWN'
        ? blocker
        : null,
    nextSprint:
      blocker === 'COOLDOWN' && state.lastVentureSprint !== null
        ? state.lastVentureSprint + VENTURES.cooldownSprints
        : null,
    offers: ventureOffers(state).map(({ idea, cost }) => ({
      id: idea.id,
      icon: idea.icon,
      name: idea.name,
      pitch: idea.pitch,
      risk: idea.risk,
      cost,
      affordable: cost <= investable,
    })),
    ventures: state.ventures.map((venture) => ({
      id: venture.id,
      icon: getVentureIdea(venture.ideaId)?.icon ?? '🏢',
      name: venture.name,
      risk: venture.risk,
      status: venture.status,
      invested: venture.invested,
      stake: venture.stake,
      valuation: venture.valuation,
      stakeValue: Math.round(venture.valuation * venture.stake),
      dividends: venture.dividends,
      salePrice: salePrice(venture),
      soldFor: venture.soldFor,
      foundedAtSprint: venture.foundedAtSprint,
      history: [...venture.history],
    })),
    wings: officeWings(state),
    maxVentures: VENTURES.maxFounded,
    investable: Math.max(0, investable),
    portfolio: portfolioValue(state),
  };
}

/** Nombre de réunions récentes affichées dans le panneau de la salle. */
const RECENT_MEETINGS = 4;

function dailyView(state: GameState): DailyView | null {
  const sync = state.morningSync;
  if (!sync) return null;
  const today = sync.day === getClock(state).day;
  return {
    tick: sync.tick,
    today,
    // Le snapshot qui suit le tick du Daily : l'équipe est en salle, l'appli est projetée.
    live: state.stage === 'EXECUTION' && sync.tick === state.tick - 1,
    useful: sync.useful,
    focus: sync.useful && today ? Math.round(DAILY_SYNC.focusBonus * 100) : 0,
    attendees: [...sync.attendees],
    entries: sync.entries.map((entry) => ({ ...entry })),
  };
}

function meetingRoomView(state: GameState): MeetingRoomView {
  const recent = state.notifications
    .filter(
      (n) =>
        n.kind === 'MEETING_USEFUL' || n.kind === 'MEETING_USELESS' || n.kind === 'CRISIS_MEETING',
    )
    .slice(-RECENT_MEETINGS)
    .reverse()
    .map((n) => ({
      tick: n.tick,
      useful: n.kind !== 'MEETING_USELESS',
      crisis: n.kind === 'CRISIS_MEETING',
      text: n.text,
    }));
  return {
    unlocked: meetingRoomUnlocked(state),
    format: state.meetingRoom?.format ?? null,
    refund: meetingRoomRefund(state),
    formats: MEETING_FORMATS.map((format) => {
      const blocker = meetingFormatBlocker(state, format);
      return {
        id: format.id,
        icon: format.icon,
        name: format.name,
        bonus: format.bonus,
        malus: format.malus,
        price: format.price,
        minPhase: format.minPhase,
        usefulOdds: format.usefulOdds,
        crisisHeadStart: format.crisisHeadStart,
        blocker: blocker === 'NOT_FOUND' ? 'LOCKED' : blocker,
      };
    }),
    useful: state.stats.meetingsUseful,
    useless: state.stats.meetingsUseless,
    crisis: state.stats.crisisMeetings,
    daily: dailyView(state),
    duplicates: state.stats.duplicateWork,
    recent,
  };
}

function petsView(state: GameState): PetsView {
  return {
    pets: state.pets.map((pet) => ({ ...pet })),
    max: PETS.max,
    price: PETS.price,
    needs: petEquipment(state),
    happy: missingPetNeeds(state).length === 0,
    blocker: adoptionBlocker(state),
  };
}

function serversView(state: GameState): ServersView {
  return {
    rooms: serverRoomStatuses(state).map((room) => ({
      id: room.id,
      kind: room.itemId,
      running: room.running,
      missing: [...room.missing],
      heat: room.heat,
      cooling: room.cooling,
      temperature: room.temperature,
      level: room.level,
      monitored: room.monitored,
      efficiency: room.efficiency,
      gear: room.gear.length,
      slots: getFurniture(room.itemId)?.surfaceSlots ?? 0,
    })),
    hostingSaving: hostingSaving(state),
    hostingSavingMax: HOSTING_SAVING_MAX,
    summer: isSummer(state),
    hasBox: hasFibreBox(serverRoomItems(state)),
  };
}

function subscriptionOfferView(
  state: GameState,
  offer: SubscriptionOffer,
  currentId: string | undefined,
): SubscriptionOfferView {
  return {
    id: offer.id,
    service: offer.service,
    name: offer.name,
    description: offer.description,
    detail: offer.detail ?? null,
    price: offer.price,
    periodDays: offer.periodDays,
    minPhase: offer.minPhase,
    setupFee: offer.setupFee ?? 0,
    firstPayment: firstPayment(offer),
    maxUsers: offer.maxUsers ?? null,
    requires: offer.requires ?? null,
    blocker:
      currentId === offer.id
        ? 'CURRENT'
        : PHASES.indexOf(offer.minPhase) > PHASES.indexOf(state.phase)
          ? 'LOCKED'
          : state.stage === 'PITCH'
            ? 'WRONG_STAGE'
            : !requirementMet(state, offer)
              ? 'REQUIREMENT'
              : state.gauges.treasury < firstPayment(offer)
                ? 'NOT_ENOUGH_MONEY'
                : null,
  };
}

function subscriptionsView(state: GameState): SubscriptionsView {
  const services = SUBSCRIPTION_SERVICES.map((service): SubscriptionServiceView => {
    const current = subscriptionOf(state, service);
    const currentId = current?.offer.id;
    return {
      id: service,
      icon: SUBSCRIPTION_SERVICE_INFO[service].icon,
      current: current
        ? {
            offer: subscriptionOfferView(state, current.offer, currentId),
            active: requirementMet(state, current.offer),
            nextBillDays: Math.max(
              0,
              (current.subscription.paidUntil - state.tick) / TIME.ticksPerDay,
            ),
            since: current.subscription.since,
            totalPaid: current.subscription.totalPaid,
            monthly: monthlyPrice(current.offer),
            penalty: saturationPenalty(offerLoad(state, current.offer)),
          }
        : null,
      offers: offersOf(service).map((offer) => subscriptionOfferView(state, offer, currentId)),
    };
  });
  return {
    services,
    users: serviceUsers(state),
    count: services.filter((service) => service.current !== null).length,
    monthlyTotal: subscriptionsMonthly(state),
  };
}

function cleaningView(state: GameState): CleaningView {
  const cleaning = state.cleaning;
  const visitCost = visitPrice(state);
  const callPrice = cleaningCallPrice(visitCost, false);
  const expressPrice = cleaningCallPrice(visitCost, true);
  const busy = cleaning.booking !== null || cleaning.visit !== null;
  const wrongStage = state.stage === 'PITCH' || state.stage === 'ENDED';
  const plan = cleaning.plan;
  const visit = cleaning.visit;
  return {
    dirt: cleaning.dirt,
    alert: CLEANING.dirtyAlert,
    productivity: dirtProductivity(cleaning.dirt),
    daysSinceClean: cleaning.daysSinceClean,
    visit: visit
      ? {
          express: visit.express,
          progress: clamp((state.tick - visit.start) / Math.max(1, visit.end - visit.start), 0, 1),
        }
      : null,
    booking: cleaning.booking
      ? {
          express: cleaning.booking.express,
          inHours: Math.max(0, (cleaning.booking.start - state.tick) / TIME.ticksPerHour),
        }
      : null,
    plan: plan
      ? {
          plan: plan.plan,
          weeklyPrice: planWeeklyPrice(state, plan.plan),
          nextBillDays: Math.max(0, (plan.paidUntil - state.tick) / TIME.ticksPerDay),
          totalPaid: plan.totalPaid,
        }
      : null,
    plans: CLEANING_PLANS.map((option) => {
      const weeklyPrice = planWeeklyPrice(state, option.id);
      return {
        id: option.id,
        name: option.name,
        description: option.description,
        days: [...option.days],
        weeklyPrice,
        discount: option.discount,
        blocker:
          plan?.plan === option.id
            ? 'CURRENT'
            : wrongStage
              ? 'WRONG_STAGE'
              : state.gauges.treasury < weeklyPrice
                ? 'NOT_ENOUGH_MONEY'
                : null,
      };
    }),
    visitPrice: visitCost,
    callPrice,
    expressPrice,
    callBlocker: busy
      ? 'BUSY'
      : wrongStage
        ? 'WRONG_STAGE'
        : state.gauges.treasury < callPrice
          ? 'NOT_ENOUGH_MONEY'
          : null,
    crew: CLEANING_CREW.map((member) => ({ ...member })),
    visits: cleaning.visits,
    spent: cleaning.spent,
  };
}

function wallsView(state: GameState): WallsView {
  const phase = PHASES.indexOf(state.phase);
  return {
    zones: wallZones(wallOffice(state)).map((zone) => ({
      zone,
      finish: state.walls[zone] ?? null,
    })),
    locked: WALL_FINISHES.filter((finish) => PHASES.indexOf(finish.minPhase) > phase).map(
      (finish) => finish.id,
    ),
    storyLocked: WALL_FINISHES.filter((finish) => !hasUnlock(state, finish.unlock)).map(
      (finish) => finish.id,
    ),
  };
}

function floorsView(state: GameState): FloorsView {
  const phase = PHASES.indexOf(state.phase);
  return {
    zones: floorZones(wallOffice(state)).map((zone) => ({
      zone,
      finish: state.floors[zone] ?? null,
    })),
    locked: FLOOR_MATERIALS.filter((material) => PHASES.indexOf(material.minPhase) > phase).map(
      (material) => material.id,
    ),
    storyLocked: FLOOR_MATERIALS.filter((material) => !hasUnlock(state, material.unlock)).map(
      (material) => material.id,
    ),
  };
}

function storyView(state: GameState): StoryView | null {
  const progress = missionProgress(state);
  if (!progress) return null;
  return {
    missionId: progress.mission.id,
    goals: progress.goals,
    constraints: progress.constraints,
    sprintsDone: completedSprints(state),
    sprints: progress.mission.sprints,
  };
}

function marketView(state: GameState, campaign: CampaignState): MarketView {
  const total =
    state.gauges.users +
    campaign.rivals.reduce((sum, rival) => sum + (rival.alive ? rival.users : 0), 0);
  return {
    share: marketShare(state),
    usersHistory: [...campaign.usersHistory],
    rivals: campaign.rivals.map((rival) => {
      const profile = getRival(rival.id);
      return {
        id: rival.id,
        name: profile.name,
        icon: profile.icon,
        color: profile.color,
        tagline: profile.tagline,
        users: Math.round(rival.users),
        valuation: Math.round(rival.valuation),
        share: rival.alive && total > 0 ? rival.users / total : 0,
        alive: rival.alive,
        boughtBy: rival.boughtBy,
        lastAction: rival.lastAction,
        lastActionSprint: rival.lastActionSprint,
        history: [...rival.history],
      };
    }),
  };
}

function campaignView(state: GameState): CampaignView | null {
  const progress = actProgress(state);
  if (!progress) return null;
  return {
    act: progress.act.id,
    actIndex: progress.campaign.act,
    deadline: progress.act.deadline,
    goals: progress.goals,
    side: progress.side.map((side) => ({
      id: side.mission.id,
      status: side.status,
      goals: side.goals,
      constraints: side.constraints,
    })),
    done: [...progress.campaign.done],
    sprintsDone: completedSprints(state),
    market: marketView(state, progress.campaign),
    freeSeason: progress.campaign.freeSeason !== undefined,
    freeSeasonSprints: progress.campaign.freeSeason
      ? Math.max(0, state.sprint - progress.campaign.freeSeason.fromSprint)
      : 0,
  };
}

export function toGameView(state: GameState, context: ViewContext): GameView {
  const clock = getClock(state);
  const today = calendarDay(state, clock.day);
  const minutes = Math.round(clock.hour * 60);
  const lastIncident = state.notifications.findLast((n) => n.kind === 'PROD_DOWN');
  const runway = runwayMonths(state);
  const pitch = state.pitch;
  return {
    seed: state.seed,
    mode: state.mode,
    tick: state.tick,
    time: {
      sprint: state.sprint,
      totalSprints: state.totalSprints,
      day: clock.dayInSprint,
      minute: minutes,
      speed: context.speed,
      tickMs:
        context.running && context.tickDurationMs !== undefined
          ? context.tickDurationMs
          : Number.POSITIVE_INFINITY,
      syncedAt: context.receivedAt ?? 0,
    },
    calendar: {
      date: civilFromDays(today),
      seasons: seasonsAt(today),
      birthdays: birthdayPartyIds(state, clock.day),
      holiday: holidayOf(state, clock.day),
    },
    phase: state.phase,
    step: state.stage,
    gauges: { ...state.gauges },
    history: state.history.daily.map((point) => ({
      treasury: point.treasury,
      coffee: point.coffee,
      debt: point.debt,
      stability: point.stability,
      hype: point.hype,
      users: point.users,
    })),
    devs: devIds(state)
      .map((id) => devView(state, id))
      .filter((dev): dev is DevView => dev !== null),
    teamBuilding: teamBuildingView(state),
    retro: retroView(state),
    retroAction: activeRetro(state),
    teamLife: state.teamLife
      ? {
          slots: leaveSlots(state),
          bridge: sprintHasBridge(state),
          bridgesRefused: state.teamLife.bridgesRefusedSprint === state.sprint,
        }
      : null,
    leadership: leadershipView(state),
    tasks: taskViews(state),
    candidates: candidateViews(state),
    items: itemViews(state),
    projections: activeProjections(state).map(({ projector, screen }) => ({ projector, screen })),
    inventory: inventoryView(state),
    incident:
      state.stage === 'EXECUTION' &&
      lastIncident !== undefined &&
      state.tick - lastIncident.tick < INCIDENT_TICKS,
    teamMax: teamMax(state),
    desks: countDesks(state),
    valuation: state.valuation,
    runwayMonths: Number.isFinite(runway) ? runway : null,
    ownership: state.ownership,
    event: eventView(state, context),
    lastReport: state.history.sprints.at(-1) ?? null,
    objective: objectiveView(state),
    career: legendRunView(state),
    pitch: pitch ? pitchView(state, pitch) : null,
    pitchBlocker: pitchBlocker(state),
    funding: fundingView(state),
    acquisitionOffer: state.acquisitionOffer,
    raiseRequest: raiseRequestView(state),
    group: groupView(state),
    meetingRoom: meetingRoomView(state),
    pets: petsView(state),
    walls: wallsView(state),
    servers: serversView(state),
    cleaning: cleaningView(state),
    subscriptions: subscriptionsView(state),
    floors: floorsView(state),
    canIpo:
      (state.stage === 'PLANNING' || state.stage === 'DEMO') &&
      state.phase === 'UNICORN' &&
      state.gauges.stability >= BALANCE.phases.ipoMinStability,
    result: state.result,
    story: storyView(state),
    campaign: campaignView(state),
    unlocks: [...state.unlocks],
    achievements: [...state.achievements],
    replay: context.replay ?? null,
    running: context.running,
  };
}

/**
 * Traduit une commande de l'interface en commande de la simulation. Renvoie null pour
 * `setSpeed`, qui règle l'horloge du moteur et n'est pas une commande de jeu.
 */
export function toCommand(command: GameCommand, view: GameView): Command | null {
  switch (command.type) {
    case 'setSpeed':
      return null;
    case 'moveTask':
      return command.column === 'BACKLOG' || command.column === 'TODO'
        ? {
            type: 'MOVE_TASK',
            taskId: command.taskId,
            column: command.column,
            index: command.index,
          }
        : null;
    case 'moveAllToTodo':
      return { type: 'MOVE_ALL_TO_TODO' };
    case 'assignTask':
      return { type: 'ASSIGN_TASK', taskId: command.taskId, devId: command.devId };
    case 'hire':
      return { type: 'MAKE_OFFER', candidateId: command.candidateId, salary: command.offer };
    case 'fire':
      return { type: 'FIRE_DEV', devId: command.devId };
    case 'placeItem':
      return {
        type: 'BUY_FURNITURE',
        itemId: command.kind,
        x: command.x,
        y: command.z,
        rotation: command.rotation,
        ...(command.color ? { color: command.color } : {}),
      };
    case 'placeAccessory':
      return {
        type: 'BUY_ACCESSORY',
        itemId: command.kind,
        hostId: command.host.id,
        slot: command.host.slot,
        rotation: command.rotation,
        ...(command.color ? { color: command.color } : {}),
      };
    case 'moveAccessory':
      return {
        type: 'MOVE_ACCESSORY',
        furnitureId: command.itemId,
        hostId: command.host.id,
        slot: command.host.slot,
        rotation: command.rotation,
      };
    case 'switchProjector':
      return { type: 'SWITCH_PROJECTOR', furnitureId: command.itemId, on: command.on };
    case 'paintItem':
      return { type: 'PAINT_FURNITURE', furnitureId: command.itemId, color: command.color };
    case 'setMonitor':
      return {
        type: 'SET_MONITOR',
        furnitureId: command.itemId,
        model: command.monitor.model,
        size: command.monitor.size,
        mount: command.monitor.mount,
      };
    case 'setComputer':
      return { type: 'SET_COMPUTER', furnitureId: command.itemId, computer: command.computer };
    case 'moveItem':
    case 'rotateItem': {
      const item = view.items.find((i) => i.id === command.itemId);
      if (!item) return null;
      // Un accessoire tourne sur place, sur son emplacement.
      if (command.type === 'rotateItem' && item.host)
        return {
          type: 'MOVE_ACCESSORY',
          furnitureId: item.id,
          hostId: item.host.id,
          slot: item.host.slot,
          rotation: (item.rotation + 1) % 4,
        };
      // Le décor d'une annexe n'est pas une entité : il a sa propre commande.
      if (item.annexDecor !== undefined)
        return {
          type: 'MOVE_ANNEX_DECOR',
          key: item.annexDecor,
          x: command.type === 'moveItem' ? command.x : item.x,
          y: command.type === 'moveItem' ? command.z : item.z,
          rotation:
            command.type === 'moveItem'
              ? (command.rotation ?? item.rotation)
              : (item.rotation + 1) % 4,
        };
      return command.type === 'moveItem'
        ? {
            type: 'MOVE_FURNITURE',
            furnitureId: item.id,
            x: command.x,
            y: command.z,
            rotation: command.rotation ?? item.rotation,
          }
        : {
            type: 'MOVE_FURNITURE',
            furnitureId: item.id,
            x: item.x,
            y: item.z,
            rotation: (item.rotation + 1) % 4,
          };
    }
    case 'sellItem':
      return { type: 'SELL_FURNITURE', furnitureId: command.itemId };
    case 'storeItem':
      return { type: 'STORE_FURNITURE', furnitureId: command.itemId };
    case 'placeStored':
      return {
        type: 'PLACE_STORED',
        itemId: command.kind,
        ...storedColor(command.color),
        x: command.x,
        y: command.z,
        rotation: command.rotation,
      };
    case 'placeStoredAccessory':
      return {
        type: 'PLACE_STORED_ACCESSORY',
        itemId: command.kind,
        ...storedColor(command.color),
        hostId: command.host.id,
        slot: command.host.slot,
        rotation: command.rotation,
      };
    case 'sellStored':
      return { type: 'SELL_STORED', itemId: command.kind, ...storedColor(command.color) };
    case 'startSprint':
      return { type: 'START_SPRINT' };
    case 'resolveEvent':
      return { type: 'RESOLVE_EVENT', choiceIndex: command.choiceIndex };
    case 'startPitch':
      return { type: 'START_PITCH' };
    case 'pitchArgument':
      return { type: 'PITCH_ARGUMENT', argumentId: command.argumentId };
    case 'closePitch':
      return { type: 'CLOSE_PITCH' };
    case 'takeFinancing':
      return { type: 'TAKE_FINANCING', kind: command.kind };
    case 'endDemo':
      return { type: 'END_DEMO' };
    case 'answerAcquisition':
      return { type: 'ANSWER_ACQUISITION', accept: command.accept };
    case 'answerRaise':
      return { type: 'ANSWER_RAISE', accept: command.accept };
    case 'bookLeave':
      return {
        type: 'BOOK_LEAVE',
        devId: command.devId,
        week: command.week,
        days: Math.min(5, Math.max(1, Math.round(command.days))),
      };
    case 'cancelLeave':
      return { type: 'CANCEL_LEAVE', devId: command.devId };
    case 'refuseBridges':
      return { type: 'REFUSE_BRIDGES', refuse: command.refuse };
    case 'holdRetro':
      return { type: 'HOLD_RETRO', action: command.action };
    case 'bookTeamBuilding':
      return { type: 'BOOK_TEAM_BUILDING', outing: command.outing };
    case 'cancelTeamBuilding':
      return { type: 'CANCEL_TEAM_BUILDING' };
    case 'launchIpo':
      return { type: 'LAUNCH_IPO' };
    case 'endStory':
      return { type: 'END_STORY' };
    case 'foundVenture':
      return { type: 'FOUND_VENTURE', ideaId: command.ideaId };
    case 'sellVenture':
      return { type: 'SELL_VENTURE', ventureId: command.ventureId };
    case 'fitMeetingRoom':
      return { type: 'FIT_MEETING_ROOM', format: command.format };
    case 'clearMeetingRoom':
      return { type: 'CLEAR_MEETING_ROOM' };
    case 'coverWall':
      return { type: 'COVER_WALL', zone: command.zone, finish: command.finish };
    case 'coverFloor':
      return {
        type: 'COVER_FLOOR',
        zone: command.zone,
        material: command.finish.material,
        tint: command.finish.tint,
      };
    case 'adoptPet':
      return { type: 'ADOPT_PET', coat: command.coat };
    case 'rehomePet':
      return { type: 'REHOME_PET', petId: command.petId };
    case 'subscribe':
      return { type: 'SUBSCRIBE', offer: command.offer };
    case 'cancelSubscription':
      return { type: 'CANCEL_SUBSCRIPTION', service: command.service };
    case 'callCleaning':
      return { type: 'CALL_CLEANING', express: command.express };
    case 'subscribeCleaning':
      return { type: 'SUBSCRIBE_CLEANING', plan: command.plan };
    case 'cancelCleaning':
      return { type: 'CANCEL_CLEANING' };
    case 'learnSkill':
      return { type: 'LEARN_SKILL', devId: command.devId, skill: command.skill };
    case 'resetSkills':
      return { type: 'RESET_SKILLS', devId: command.devId };
    case 'trainDev':
      return { type: 'TRAIN_DEV', devId: command.devId, kind: command.kind };
    case 'useCrunch':
      return { type: 'USE_CRUNCH', devId: command.devId };
  }
}
