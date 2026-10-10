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
  WALL_FINISHES,
  wallZones,
} from '@oss/shared';
import { wallOffice } from '../simulation/walls';
import { badEffectFactor, escalate } from '../events/effects';
import { portfolioValue, runwayMonths } from '../simulation/economy';
import { financingOffers } from '../simulation/financing';
import { currentTier } from '../simulation/fundraising';
import { softSigmoid } from '../simulation/math';
import { countDesks, monitorOf, RESALE_RATIO } from '../simulation/furniture';
import { leadershipEffects, teamShape } from '../simulation/leadership';
import { devIds, teamMax } from '../simulation/helpers';
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
import type {
  CandidateView,
  DevActivity,
  DevView,
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
  PetsView,
  WallsView,
  GaugeName,
  KanbanColumn,
  LeadershipView,
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
      },
    }));
}

/** Écran d'un poste de travail, sans son prix d'achat. */
function monitorView(item: Parameters<typeof monitorOf>[0]): MonitorChoice {
  const { model, size, mount } = monitorOf(item);
  return { model, size, mount };
}

function itemViews(state: GameState): PlacedItemView[] {
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
    interest: Math.round(softSigmoid(pitch.interest - tier.bar) * 100) / 100,
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
    leadership: leadershipView(state),
    tasks: taskViews(state),
    candidates: candidateViews(state),
    items: itemViews(state),
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
    pitch: pitch ? pitchView(state, pitch) : null,
    pitchBlocker: pitchBlocker(state),
    funding: fundingView(state),
    acquisitionOffer: state.acquisitionOffer,
    raiseRequest: raiseRequestView(state),
    group: groupView(state),
    meetingRoom: meetingRoomView(state),
    pets: petsView(state),
    walls: wallsView(state),
    canIpo:
      (state.stage === 'PLANNING' || state.stage === 'DEMO') &&
      state.phase === 'UNICORN' &&
      state.gauges.stability >= BALANCE.phases.ipoMinStability,
    result: state.result,
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
    case 'launchIpo':
      return { type: 'LAUNCH_IPO' };
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
    case 'adoptPet':
      return { type: 'ADOPT_PET', coat: command.coat };
    case 'rehomePet':
      return { type: 'REHOME_PET', petId: command.petId };
  }
}
