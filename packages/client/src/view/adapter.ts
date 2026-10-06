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
  BALANCE,
  TEAM_MAX,
  TIME,
  getInvestor,
  getPitchArgument,
  type Command,
  type EventCard,
  type GameState,
  type Speed,
  type TaskColumn,
} from '@oss/shared';
import { escalate } from '../events/effects';
import { RESALE_RATIO } from '../simulation/furniture';
import { devIds } from '../simulation/helpers';
import { tasksInColumn } from '../simulation/tasks';
import { getClock } from '../simulation/time';
import type {
  CandidateView,
  DevActivity,
  DevView,
  EventView,
  GameCommand,
  GameView,
  GaugeName,
  KanbanColumn,
  PlacedItemView,
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

function devView(state: GameState, id: string): DevView | null {
  const c = state.components;
  const identity = c.identity[id];
  const stats = c.stats[id];
  if (!identity || !stats) return null;
  const employment = c.employment[id];
  const mood = c.mood[id];
  return {
    id,
    name: identity.name,
    age: identity.age,
    role: identity.role,
    trait: identity.trait,
    bio: identity.bio,
    stats,
    salary: employment?.salary ?? 0,
    level: employment?.level ?? 1,
    morale: mood?.moral ?? 50,
    energy: mood?.energy ?? 100,
    activity: activityOf(state, id),
    relations: c.relations[id] ?? {},
    history: [...(c.devLog[id] ?? [])].reverse(),
    look: identity.look,
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
        size: task.size,
        column: COLUMNS[task.column],
        assigneeId: task.assigneeId,
        progress: Math.min(1, task.progress / task.work),
        impact: TASK_IMPACT[type],
        hallucinated: task.hallucinated,
      });
    }
  }
  return tasks;
}

function candidateViews(state: GameState): CandidateView[] {
  return state.candidates
    .filter((candidate) => candidate.status === 'OPEN')
    .map((candidate) => ({
      id: candidate.id,
      askingSalary: candidate.askingSalary,
      dev: {
        id: candidate.id,
        name: candidate.identity.name,
        age: candidate.identity.age,
        role: candidate.identity.role,
        trait: candidate.identity.trait,
        bio: candidate.identity.bio,
        stats: candidate.stats,
        salary: candidate.askingSalary,
        level: 1,
        morale: 70,
        energy: 100,
        activity: 'WORKING',
        relations: {},
        history: [],
        look: candidate.identity.look,
      },
    }));
}

function itemViews(state: GameState): PlacedItemView[] {
  return Object.entries(state.components.furniture).map(([id, item]) => ({
    id,
    kind: item.itemId,
    x: item.x,
    z: item.y,
    rotation: (item.rotation % 4) as Rotation,
    resale: Math.round(item.purchasePrice * RESALE_RATIO),
  }));
}

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
          effects[key] = Math.round(escalate(value, BAD_DIRECTION[key], pending.level));
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

export function toGameView(state: GameState, context: ViewContext): GameView {
  const clock = getClock(state);
  const minutes = Math.round(clock.hour * 60);
  const lastIncident = state.notifications.findLast((n) => n.kind === 'PROD_DOWN');
  const pitch = state.pitch;
  const investor = pitch ? getInvestor(pitch.investor) : null;
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
    tasks: taskViews(state),
    candidates: candidateViews(state),
    items: itemViews(state),
    incident:
      state.stage === 'EXECUTION' &&
      lastIncident !== undefined &&
      state.tick - lastIncident.tick < INCIDENT_TICKS,
    teamMax: TEAM_MAX[state.phase],
    valuation: state.valuation,
    ownership: state.ownership,
    event: eventView(state, context),
    lastReport: state.history.sprints.at(-1) ?? null,
    pitch:
      pitch && investor
        ? {
            investor: { name: investor.name, intro: investor.intro },
            round: pitch.round,
            rounds: BALANCE.fundraising.rounds,
            options: pitch.options.flatMap((id) => {
              const argument = getPitchArgument(id);
              return argument ? [{ id, label: argument.label }] : [];
            }),
            chosen: pitch.chosen.flatMap((id) => {
              const argument = getPitchArgument(id);
              return argument ? [argument.label] : [];
            }),
            result: pitch.result,
          }
        : null,
    pitchBlocker: pitchBlocker(state),
    acquisitionOffer: state.acquisitionOffer,
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
      };
    case 'moveItem':
    case 'rotateItem': {
      const item = view.items.find((i) => i.id === command.itemId);
      if (!item) return null;
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
    case 'endDemo':
      return { type: 'END_DEMO' };
    case 'answerAcquisition':
      return { type: 'ANSWER_ACQUISITION', accept: command.accept };
    case 'launchIpo':
      return { type: 'LAUNCH_IPO' };
  }
}
