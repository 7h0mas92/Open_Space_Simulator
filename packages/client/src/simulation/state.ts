import {
  BALANCE,
  ENDLESS,
  GAME,
  STATE_VERSION,
  emptyRaisesState,
  type DevRole,
  type GameMode,
  type GameState,
} from '@oss/shared';
import { generateDev, hireDev } from './devs';
import { placeFurniture } from './furniture';
import type { SimContext } from './helpers';
import { seedToState } from './rng';
import { beginPlanning } from './sprint';
import { computeValuation } from './economy';
import { announceSeasons, calendarDay } from './systems/calendar';
import { recordHistory } from './systems/daily';

export interface GameConfig {
  seed: string;
  mode: GameMode;
}

/** État vide, avant l'arrivée du premier dev. */
export function createEmptyState(config: GameConfig): GameState {
  const { start } = BALANCE;
  const treasury =
    config.mode === 'EASY' ? start.treasury * BALANCE.easy.treasuryMultiplier : start.treasury;
  return {
    version: STATE_VERSION,
    seed: config.seed,
    mode: config.mode,
    rng: seedToState(config.seed),
    tick: 0,
    sprint: 1,
    totalSprints:
      config.mode === 'SHIP_IN_3'
        ? 3
        : config.mode === 'ENDLESS'
          ? ENDLESS.sprintCap
          : GAME.totalSprints,
    sprintTick: 0,
    stage: 'PLANNING',
    phase: 'GARAGE',
    nextEntityId: 1,
    components: {
      identity: {},
      stats: {},
      employment: {},
      mood: {},
      relations: {},
      activity: {},
      worker: {},
      devLog: {},
      task: {},
      furniture: {},
      remote: {},
      remoteReason: {},
      rustConverted: {},
      performance: {},
    },
    gauges: {
      treasury,
      coffee: start.coffee,
      debt: start.debt,
      stability: start.stability,
      hype: start.hype,
      users: start.users,
    },
    valuation: 0,
    ownership: 1,
    totalRaised: treasury,
    fundingRounds: 0,
    lastPitchSprint: null,
    pitch: null,
    candidates: [],
    events: { pending: null, lastSeenSprint: {}, queue: [], drawnThisSprint: 0, choices: [] },
    acquisitionOffer: null,
    ventures: [],
    lastVentureSprint: null,
    meetingRoom: null,
    objective: null,
    financing: { lastSprint: {}, loan: null },
    inventory: [],
    walls: {},
    floors: {},
    annexDecor: {},
    pets: [],
    raises: emptyRaisesState(),
    fibre: null,
    recentTaskTitles: [],
    lostSprintsPending: 0,
    tracker: {
      usersAtStart: 0,
      usersLost: 0,
      revenue: 0,
      expenses: 0,
      hypeAtStart: start.hype,
      incidents: 0,
      specialDone: 0,
      specialMissed: 0,
    },
    history: { daily: [], sprints: [] },
    stats: {
      prodOutages: 0,
      fridayOutages: 0,
      fridayOutageStreak: 0,
      maxFridayOutageStreak: 0,
      resignations: 0,
      burnouts: 0,
      fired: 0,
      hired: 0,
      meetings: 0,
      featuresShipped: 0,
      refactosDone: 0,
      hallucinations: 0,
      cardsResolved: 0,
      maxTeamSize: 0,
      coffeeShortageDays: 0,
      maxValuation: 0,
      maxUsers: 0,
      remoteDays: 0,
      venturesFounded: 0,
      ventureCashIn: 0,
      meetingsUseful: 0,
      meetingsUseless: 0,
      crisisMeetings: 0,
      urgentDone: 0,
      urgentMissed: 0,
      weeklyDone: 0,
      weeklyMissed: 0,
      objectivesDone: 0,
      objectivesFailed: 0,
      petsAdopted: 0,
    },
    achievements: [],
    notifications: [],
    result: null,
  };
}

/** Le garage du départ : un fondateur, un premier dev, deux bureaux IKEA et une cafetière. */
export function setupNewGame(state: GameState, ctx: SimContext): void {
  const firstRoles: DevRole[] =
    state.mode === 'INTERNS_ONLY' ? ['INTERN'] : ['SENIOR_BEARD', 'TEN_X', 'RUSTACEAN'];
  const first = generateDev(ctx.rng, ctx.rng.pick(firstRoles));
  hireDev(state, ctx, first, first.askingSalary);
  placeFurniture(state, 'ikea-desk', 1, 1, 0);
  const desk = placeFurniture(state, 'ikea-desk', 1, 3, 0);
  // Pas encore de cuisine au garage : la cafetière est posée sur le second bureau.
  const coffee = placeFurniture(state, 'drip-coffee-maker', 1, 3, 0);
  const coffeeMaker = state.components.furniture[coffee];
  if (coffeeMaker) {
    coffeeMaker.hostId = desk;
    coffeeMaker.slot = 0;
  }
  placeFurniture(state, 'small-plant', 7, 5, 0);
  state.valuation = computeValuation(state);
  state.stats.maxValuation = state.valuation;
  beginPlanning(state, ctx);
  announceSeasons(state, ctx, calendarDay(state, 0), false);
  recordHistory(state, 0);
}
