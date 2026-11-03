import {
  BALANCE,
  ENDLESS,
  GAME,
  STATE_VERSION,
  difficultyOf,
  emptyCleaningState,
  STORY_MISSION_IDS,
  STORY_REWARD_IDS,
  UNLOCK_MODES,
  emptyRaisesState,
  emptyTeamLifeState,
  emptyRetroState,
  emptyTeamBuildingState,
  teamLifeEnabled,
  getStoryMission,
  type DevRole,
  type GameMode,
  type GameState,
  type StoryMissionId,
  type StoryRewardId,
} from '@oss/shared';
import { generateDev, hireDev } from './devs';
import { createCareerState, legendOfSeed } from './career';
import { placeFurniture } from './furniture';
import type { SimContext } from './helpers';
import { seedToState } from './rng';
import { beginPlanning } from './sprint';
import { computeValuation } from './economy';
import { announceSeasons, calendarDay } from './systems/calendar';
import { recordHistory } from './systems/daily';
import { applyStartPerks, setupMission, startingCoffeeMaker } from './story';

export interface GameConfig {
  seed: string;
  mode: GameMode;
  /** Mode Histoire : la mission jouée (la première de la campagne par défaut). */
  mission?: StoryMissionId;
  /** Récompenses du mode Histoire débloquées par le joueur (ignorées en Daily et en mission). */
  unlocks?: readonly StoryRewardId[];
}

/** Récompenses retenues pour la partie : rangées dans l'ordre de la campagne, sans doublon. */
function gameUnlocks(config: GameConfig): StoryRewardId[] {
  if (!UNLOCK_MODES.includes(config.mode)) return [];
  const owned = new Set(config.unlocks ?? []);
  return STORY_REWARD_IDS.filter((id) => owned.has(id));
}

/** État vide, avant l'arrivée du premier dev. */
export function createEmptyState(config: GameConfig): GameState {
  const { start } = BALANCE;
  // Mode Carrière : la légende écrite dans la graine fixe l'argent, la hype et la dette du départ.
  const legend = config.mode === 'CAREER' ? legendOfSeed(config.seed) : null;
  const treasury =
    start.treasury * difficultyOf(config.mode).treasury * (legend?.start.treasuryFactor ?? 1);
  const hype = legend?.start.hype ?? start.hype;
  const mission =
    config.mode === 'STORY' ? getStoryMission(config.mission ?? STORY_MISSION_IDS[0]) : undefined;
  return {
    version: STATE_VERSION,
    seed: config.seed,
    mode: config.mode,
    rng: seedToState(config.seed),
    tick: 0,
    sprint: 1,
    totalSprints:
      mission?.sprints ??
      (config.mode === 'SHIP_IN_3'
        ? 3
        : config.mode === 'ENDLESS'
          ? ENDLESS.sprintCap
          : GAME.totalSprints),
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
      skills: {},
    },
    gauges: {
      treasury,
      coffee: start.coffee,
      debt: legend?.start.debt ?? start.debt,
      stability: start.stability,
      hype,
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
    morningSync: null,
    objective: null,
    financing: { lastSprint: {}, loan: null },
    inventory: [],
    walls: {},
    floors: {},
    annexDecor: {},
    pets: [],
    raises: emptyRaisesState(),
    teamLife: teamLifeEnabled(config.mode) ? emptyTeamLifeState() : null,
    retro: emptyRetroState(),
    teamBuilding: emptyTeamBuildingState(),
    fibre: null,
    cleaning: emptyCleaningState(),
    subscriptions: [],
    career: legend ? createCareerState(config.seed) : null,
    serverHeat: {},
    recentTaskTitles: [],
    story: mission ? { missionId: mission.id, startSprint: 1 } : null,
    unlocks: gameUnlocks(config),
    lostSprintsPending: 0,
    tracker: {
      usersAtStart: 0,
      usersLost: 0,
      revenue: 0,
      expenses: 0,
      hypeAtStart: hype,
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
      leaveDays: 0,
      sickDays: 0,
      burnoutLeaves: 0,
      venturesFounded: 0,
      ventureCashIn: 0,
      meetingsUseful: 0,
      meetingsUseless: 0,
      crisisMeetings: 0,
      duplicateWork: 0,
      skillsLearned: 0,
      trainings: 0,
      crunches: 0,
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
  const legend = state.career ? legendOfSeed(state.seed) : null;
  const firstRoles: readonly DevRole[] =
    state.mode === 'INTERNS_ONLY'
      ? ['INTERN']
      : (legend?.start.firstRoles ?? ['SENIOR_BEARD', 'TEN_X', 'RUSTACEAN']);
  const first = generateDev(ctx.rng, ctx.rng.pick(firstRoles));
  hireDev(state, ctx, first, first.askingSalary);
  // Certaines légendes démarrent à deux : le cofondateur est là dès le garage.
  if (legend?.start.cofounder) {
    const cofounder = generateDev(ctx.rng, legend.start.cofounder);
    hireDev(state, ctx, cofounder, cofounder.askingSalary);
  }
  placeFurniture(state, 'ikea-desk', 1, 1, 0);
  const desk = placeFurniture(state, 'ikea-desk', 1, 3, 0);
  // Pas encore de cuisine au garage : la cafetière est posée sur le second bureau.
  const coffee = placeFurniture(state, startingCoffeeMaker(state), 1, 3, 0);
  const coffeeMaker = state.components.furniture[coffee];
  if (coffeeMaker) {
    coffeeMaker.hostId = desk;
    coffeeMaker.slot = 0;
  }
  placeFurniture(state, 'small-plant', 7, 5, 0);
  applyStartPerks(state);
  // Mode Histoire : phase, jauges et équipe du début de la mission (avant les premiers
  // candidats et le premier backlog, qui en dépendent).
  setupMission(state, ctx);
  state.valuation = computeValuation(state);
  state.stats.maxValuation = Math.max(state.stats.maxValuation, state.valuation);
  beginPlanning(state, ctx);
  announceSeasons(state, ctx, calendarDay(state, 0), false);
  recordHistory(state, 0);
}
