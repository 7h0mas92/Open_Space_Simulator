import {
  ACHIEVEMENTS,
  CAREER_LEGENDS,
  type CareerLegendId,
  ANNEXES,
  OUTCOMES,
  type AchievementDifficulty,
  PHASES,
  STORY_ACTS,
  STORY_CAMPAIGN,
  type EventCard,
  type GameMode,
  type GameState,
  OBJECTIVE_DIFFICULTIES,
  OBJECTIVE_KINDS,
  type ObjectiveDifficulty,
  type ObjectiveKind,
  type Outcome,
  type Phase,
} from '@oss/shared';
import type { CardLibrary } from '../events/library';
import { BOT_NAMES, createBot, playWithBot, scoreEffects, type Bot, type BotName } from './bots';
import { portfolioValue } from './economy';
import { createEmptyState } from './state';
import { Simulation } from './simulation';
import { actProgress } from './story';

/**
 * Analyse d'équilibrage : on joue des parties complètes avec des bots, puis on agrège.
 * Utilisé par `pnpm balance` (des milliers de parties, en parallèle) et par les tests.
 */

/** Jauges suivies sur la durée d'une partie (rapport « Trajectoire des jauges »). */
export const TRACKED_GAUGES = ['treasury', 'coffee', 'debt', 'stability', 'hype', 'users'] as const;
export type TrackedGauge = (typeof TRACKED_GAUGES)[number];

/** Sprints où l'on photographie les jauges : début, tiers, mi-parcours, fin. */
export const CHECKPOINT_SPRINTS = [5, 13, 26, 39] as const;

/** Une jauge est « collée » à son plancher ou à son plafond sous / au-delà de ces valeurs. */
const FLOOR = 2;
const CEILING = 98;

/** Ce que la partie a fait des jauges, jour après jour. */
export interface GaugeTrace {
  /**
   * Valeur des jauges à la fin de chaque sprint de référence (null si la partie était
   * déjà finie). La trésorerie est exprimée en mois de dépenses : 24,1 M€ ne veut rien
   * dire seul, mais « 40 mois de salaires d'avance » dit que l'argent ne compte plus.
   */
  checkpoints: (Record<TrackedGauge, number> | null)[];
  /** Part des jours passés au plancher (≤ 2), par jauge (hors trésorerie et utilisateurs). */
  floorShare: Record<'coffee' | 'debt' | 'stability' | 'hype', number>;
  /** Part des jours passés au plafond (≥ 98). */
  ceilingShare: Record<'coffee' | 'debt' | 'stability' | 'hype', number>;
}

const BOUNDED_GAUGES = ['coffee', 'debt', 'stability', 'hype'] as const;

/** Mois de dépenses en caisse à la fin d'un sprint (dépenses du sprint ramenées au mois). */
function cashMonths(treasury: number, sprintExpenses: number): number {
  const monthly = (sprintExpenses * 30) / 14;
  return monthly > 0 ? Math.max(0, treasury) / monthly : 99;
}

export function traceGauges(state: Readonly<GameState>): GaugeTrace {
  const daily = state.history.daily;
  const checkpoints = CHECKPOINT_SPRINTS.map((sprint) => {
    const point = daily.filter((d) => d.sprint === sprint).at(-1);
    const report = state.history.sprints.find((r) => r.sprint === sprint);
    if (!point || !report) return null;
    return {
      treasury: cashMonths(point.treasury, report.expenses),
      coffee: point.coffee,
      debt: point.debt,
      stability: point.stability,
      hype: point.hype,
      users: point.users,
    };
  });
  const share = (test: (value: number) => boolean) =>
    Object.fromEntries(
      BOUNDED_GAUGES.map((gauge) => [
        gauge,
        daily.length > 0 ? daily.filter((d) => test(d[gauge])).length / daily.length : 0,
      ]),
    ) as GaugeTrace['floorShare'];
  return {
    checkpoints,
    floorShare: share((value) => value <= FLOOR),
    ceilingShare: share((value) => value >= CEILING),
  };
}

/** Résumé d'une partie jouée par un bot. */
export interface GameRecord {
  bot: BotName;
  mode: GameMode;
  seed: string;
  outcome: Outcome;
  phaseReached: Phase;
  sprint: number;
  valuation: number;
  maxUsers: number;
  /** Cartes tirées et choix faits : [identifiant, index du choix]. */
  choices: [string, number][];
  /** Filiales : créées, coulées, argent rapporté (dividendes et reventes), parts en fin de partie. */
  ventures: { founded: number; dead: number; cashIn: number; invested: number; portfolio: number };
  /** Levées : pitchs tentés, tours de table réussis, autres financements obtenus. */
  funding?: { pitches: number; rounds: number; financings: number };
  /** Succès débloqués pendant la partie. */
  achievements: string[];
  trace: GaugeTrace;
  /** Tâches dynamiques : urgences et tâches hebdo réussies ou ratées, objectifs de sprint. */
  flow: FlowRecord;
  /** Mode Carrière : légende, jalons tenus et étoiles. */
  career?: { legend: CareerLegendId; done: string[]; stars: number };
  /** Histoire en actes : acte atteint, réussite, échec, objectifs secondaires remplis. */
  campaign?: { act: number; success: boolean; failure: string | null; goals: number };
  /** Vie de l'équipe : jours de congé et d'arrêt, burn-out, démissions (absent des vieux rapports). */
  teamLife?: TeamLifeRecord;
}

export interface TeamLifeRecord {
  leaveDays: number;
  sickDays: number;
  burnoutLeaves: number;
  resignations: number;
}

/** Mode Carrière : réussite de chaque légende et de chacun de ses jalons. */
export interface CareerSummary {
  legend: CareerLegendId;
  games: number;
  bankruptcyRate: number;
  /** Part des parties à 0, 1, 2 et 3 étoiles. */
  stars: [number, number, number, number];
  /** Part des parties qui tiennent chaque jalon, dans l'ordre de la légende. */
  milestones: { id: string; rate: number }[];
}

/** Histoire en actes, par bot (bot conteur : il ne vend pas avant « Le géant »). */
export interface CampaignSummary {
  bot: BotName;
  games: number;
  successRate: number;
  /** Part des parties qui atteignent chaque acte, dans l'ordre de l'histoire. */
  reached: number[];
  /** Objectifs secondaires remplis par partie. */
  goals: number;
  /** Échec le plus fréquent (« acte:raison »), null si aucune partie ratée. */
  mainFailure: string | null;
  sprints: number;
}

export interface FlowRecord {
  urgentDone: number;
  urgentMissed: number;
  weeklyDone: number;
  weeklyMissed: number;
  /** Objectifs de sprint : [type, difficulté, réussi]. */
  objectives: [ObjectiveKind, ObjectiveDifficulty, boolean][];
}

/**
 * Bot conteur de l'histoire en actes : il joue comme le bot donné, mais refuse les offres de
 * rachat avant l'acte « Le géant » (une vente plus tôt arrête l'histoire).
 */
export function storyteller(bot: Bot): Bot {
  const giant = STORY_ACTS.findIndex((act) => act.id === 'giant');
  return {
    name: bot.name,
    decide(state, library) {
      const act = actProgress(state as GameState)?.campaign.act ?? 0;
      return bot
        .decide(state, library)
        .map((c) =>
          act < giant && c.type === 'ANSWER_ACQUISITION' && c.accept ? { ...c, accept: false } : c,
        );
    },
  };
}

export function playBalanceGame(
  seed: string,
  bot: BotName,
  cards: CardLibrary,
  mode: GameMode = 'NORMAL',
): GameRecord {
  const story = mode === 'STORY';
  const simulation = Simulation.create(
    story ? { seed, mode, mission: STORY_CAMPAIGN } : { seed, mode },
    cards,
  );
  const player = createBot(bot, seed);
  playWithBot(simulation, story ? storyteller(player) : player, cards);
  const { state } = simulation;
  const result = state.result ?? {
    outcome: 'ZOMBIE' as const,
    phaseReached: state.phase,
    sprint: state.sprint,
    valuation: state.valuation,
  };
  return {
    bot,
    mode,
    seed,
    outcome: result.outcome,
    phaseReached: result.phaseReached,
    sprint: result.sprint,
    valuation: result.valuation,
    maxUsers: state.stats.maxUsers,
    choices: state.events.choices.map((c) => [c.cardId, c.choiceIndex]),
    ventures: {
      founded: state.ventures.length,
      dead: state.ventures.filter((v) => v.status === 'DEAD').length,
      cashIn: state.stats.ventureCashIn,
      invested: state.ventures.reduce((total, v) => total + v.invested, 0),
      portfolio: portfolioValue(state),
    },
    funding: {
      pitches: simulation.commands.filter((c) => c.command.type === 'START_PITCH').length,
      rounds: state.fundingRounds,
      financings: simulation.commands.filter((c) => c.command.type === 'TAKE_FINANCING').length,
    },
    achievements: [...state.achievements],
    trace: traceGauges(state),
    ...(state.career
      ? {
          career: {
            legend: state.career.legend,
            done: Object.entries(state.career.milestones)
              .filter(([, milestone]) => milestone.status === 'DONE')
              .map(([id]) => id),
            stars: state.result?.career?.stars ?? 0,
          },
        }
      : {}),
    ...(state.story?.campaign
      ? {
          campaign: {
            act: state.story.campaign.act,
            success: state.result?.campaign?.success ?? false,
            failure: state.result?.campaign
              ? `${state.result.campaign.act}:${state.result.campaign.failure}`
              : null,
            goals: state.story.campaign.done.length,
          },
        }
      : {}),
    teamLife: {
      leaveDays: state.stats.leaveDays,
      sickDays: state.stats.sickDays,
      burnoutLeaves: state.stats.burnoutLeaves,
      resignations: state.stats.resignations,
    },
    flow: {
      urgentDone: state.stats.urgentDone,
      urgentMissed: state.stats.urgentMissed,
      weeklyDone: state.stats.weeklyDone,
      weeklyMissed: state.stats.weeklyMissed,
      objectives: state.history.sprints.flatMap((report) =>
        report.objective
          ? [
              [
                report.objective.kind,
                report.objective.difficulty,
                report.objective.status === 'SUCCESS',
              ] as [ObjectiveKind, ObjectiveDifficulty, boolean],
            ]
          : [],
      ),
    },
  };
}

export interface BotSummary {
  bot: BotName;
  games: number;
  outcomes: Record<Outcome, number>;
  bankruptcyRate: number;
  /** Faillites selon la phase atteinte. */
  bankruptcyByPhase: Partial<Record<Phase, number>>;
  averageValuation: number;
  medianValuation: number;
  averageSprints: number;
  unicornRate: number;
  /** Filiales créées par partie, part coulée, et retour sur investissement (argent + parts). */
  ventures: { perGame: number; deadShare: number; returnMultiple: number };
  /**
   * Levées : tours réussis par partie, part des pitchs réussis, parties qui ont ouvert au
   * moins une annexe (Série B), autres financements par partie.
   */
  funding: { rounds: number; successRate: number; annexShare: number; financings: number };
}

export interface ChoiceStat {
  cardId: string;
  choiceIndex: number;
  picks: number;
  /** Valorisation finale moyenne des parties où ce choix a été fait. */
  averageValuation: number;
  bankruptcyRate: number;
}

export interface CardAlert {
  cardId: string;
  reason: string;
}

/** Comportement moyen des jauges pour un groupe de parties (un bot, ou un mode de jeu). */
export interface GaugeSummary {
  label: string;
  games: number;
  /** Médiane de chaque jauge aux sprints de référence, sur les parties encore en cours. */
  checkpoints: ({ games: number; values: Record<TrackedGauge, number> } | null)[];
  floorShare: GaugeTrace['floorShare'];
  ceilingShare: GaugeTrace['ceilingShare'];
}

export interface ModeSummary extends GaugeSummary {
  mode: GameMode;
  bankruptcyRate: number;
  medianValuation: number;
  /** Mêmes mesures stratégie par stratégie : vérifie l'écart de difficulté entre les modes. */
  bots: ModeBotSummary[];
}

export interface ModeBotSummary {
  bot: BotName;
  games: number;
  bankruptcyRate: number;
  zombieRate: number;
  unicornRate: number;
  medianValuation: number;
}

export interface BalanceReport {
  games: number;
  bots: BotSummary[];
  /** Trajectoire des jauges de chaque bot, en mode Normal. */
  gauges: GaugeSummary[];
  /** Mêmes mesures pour chaque mode de jeu (tous bots confondus). */
  modes: ModeSummary[];
  /** Nombre de tirages de chaque carte (les plus tirées d'abord). */
  draws: [string, number][];
  neverDrawn: string[];
  choices: ChoiceStat[];
  alerts: CardAlert[];
  /** Part des parties qui débloquent chaque succès (vérifie que la difficulté annoncée est juste). */
  achievements: AchievementRate[];
  /** Tâches dynamiques par bot, et réussite des objectifs par type et difficulté. */
  flow: { bots: FlowSummary[]; objectives: ObjectiveRate[] };
  /** Mode Carrière, légende par légende (vide si aucune partie Carrière n'a été jouée). */
  career: CareerSummary[];
  /** Histoire en actes, bot par bot (vide si aucune histoire n'a été jouée). */
  campaign: CampaignSummary[];
  /** Vie de l'équipe par bot, en moyenne par partie (mode Normal). */
  teamLife: TeamLifeSummary[];
}

export interface TeamLifeSummary extends TeamLifeRecord {
  bot: BotName;
}

function summarizeTeamLife(bot: BotName, records: GameRecord[]): TeamLifeSummary {
  const n = Math.max(1, records.length);
  const mean = (pick: (life: TeamLifeRecord) => number) =>
    records.reduce((total, record) => total + (record.teamLife ? pick(record.teamLife) : 0), 0) / n;
  return {
    bot,
    leaveDays: mean((life) => life.leaveDays),
    sickDays: mean((life) => life.sickDays),
    burnoutLeaves: mean((life) => life.burnoutLeaves),
    resignations: mean((life) => life.resignations),
  };
}

export interface FlowSummary {
  bot: BotName;
  urgentPerGame: number;
  urgentSuccess: number;
  weeklySuccess: number;
  objectivesPerGame: number;
  objectiveSuccess: number;
}

export interface ObjectiveRate {
  kind: ObjectiveKind;
  difficulty: ObjectiveDifficulty;
  count: number;
  success: number;
}

function summarizeFlow(bot: BotName, records: GameRecord[]): FlowSummary {
  const n = Math.max(1, records.length);
  const sum = (pick: (flow: FlowRecord) => number) =>
    records.reduce((total, record) => total + pick(record.flow), 0);
  const urgent = sum((f) => f.urgentDone + f.urgentMissed);
  const weekly = sum((f) => f.weeklyDone + f.weeklyMissed);
  const objectives = sum((f) => f.objectives.length);
  return {
    bot,
    urgentPerGame: urgent / n,
    urgentSuccess: urgent > 0 ? sum((f) => f.urgentDone) / urgent : 0,
    weeklySuccess: weekly > 0 ? sum((f) => f.weeklyDone) / weekly : 0,
    objectivesPerGame: objectives / n,
    objectiveSuccess:
      objectives > 0 ? sum((f) => f.objectives.filter(([, , ok]) => ok).length) / objectives : 0,
  };
}

function objectiveRates(records: GameRecord[]): ObjectiveRate[] {
  const rates: ObjectiveRate[] = [];
  for (const kind of OBJECTIVE_KINDS) {
    for (const difficulty of OBJECTIVE_DIFFICULTIES) {
      let count = 0;
      let success = 0;
      for (const record of records) {
        for (const [k, d, ok] of record.flow.objectives) {
          if (k !== kind || d !== difficulty) continue;
          count += 1;
          if (ok) success += 1;
        }
      }
      if (count > 0) rates.push({ kind, difficulty, count, success: success / count });
    }
  }
  return rates;
}

export interface AchievementRate {
  id: string;
  difficulty: AchievementDifficulty;
  secret: boolean;
  /** Part des parties (0 à 1) où le succès a été débloqué. */
  rate: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function summarizeBot(bot: BotName, records: GameRecord[]): BotSummary {
  const outcomes = Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<Outcome, number>;
  const bankruptcyByPhase: Partial<Record<Phase, number>> = {};
  for (const record of records) {
    outcomes[record.outcome] += 1;
    if (record.outcome === 'BANKRUPTCY') {
      bankruptcyByPhase[record.phaseReached] = (bankruptcyByPhase[record.phaseReached] ?? 0) + 1;
    }
  }
  const valuations = records.map((r) => r.valuation);
  const n = Math.max(1, records.length);
  return {
    bot,
    games: records.length,
    outcomes,
    bankruptcyRate: outcomes.BANKRUPTCY / n,
    bankruptcyByPhase,
    averageValuation: valuations.reduce((a, b) => a + b, 0) / n,
    medianValuation: median(valuations),
    averageSprints: records.reduce((a, r) => a + r.sprint, 0) / n,
    unicornRate: records.filter((r) => r.phaseReached === 'UNICORN').length / n,
    ventures: summarizeVentures(records),
    funding: summarizeFunding(records),
  };
}

function summarizeFunding(records: GameRecord[]): BotSummary['funding'] {
  const n = Math.max(1, records.length);
  let pitches = 0;
  let rounds = 0;
  let financings = 0;
  let annexes = 0;
  for (const { funding } of records) {
    if (!funding) continue;
    pitches += funding.pitches;
    rounds += funding.rounds;
    financings += funding.financings;
    if (funding.rounds > ANNEXES.firstRound) annexes += 1;
  }
  return {
    rounds: rounds / n,
    successRate: rounds / Math.max(1, pitches),
    annexShare: annexes / n,
    financings: financings / n,
  };
}

function summarizeVentures(records: GameRecord[]): BotSummary['ventures'] {
  let founded = 0;
  let dead = 0;
  let invested = 0;
  let returned = 0;
  for (const { ventures } of records) {
    founded += ventures.founded;
    dead += ventures.dead;
    invested += ventures.invested;
    returned += ventures.cashIn + ventures.portfolio;
  }
  return {
    perGame: founded / Math.max(1, records.length),
    deadShare: dead / Math.max(1, founded),
    returnMultiple: returned / Math.max(1, invested),
  };
}

function summarizeGauges(label: string, records: GameRecord[]): GaugeSummary {
  const checkpoints = CHECKPOINT_SPRINTS.map((_, index) => {
    const points = records
      .map((r) => r.trace.checkpoints[index])
      .filter((p): p is Record<TrackedGauge, number> => p !== null && p !== undefined);
    if (points.length === 0) return null;
    const values = Object.fromEntries(
      TRACKED_GAUGES.map((gauge) => [gauge, median(points.map((p) => p[gauge]))]),
    ) as Record<TrackedGauge, number>;
    return { games: points.length, values };
  });
  const n = Math.max(1, records.length);
  const average = (pick: (trace: GaugeTrace) => GaugeTrace['floorShare']) =>
    Object.fromEntries(
      BOUNDED_GAUGES.map((gauge) => [
        gauge,
        records.reduce((total, r) => total + pick(r.trace)[gauge], 0) / n,
      ]),
    ) as GaugeTrace['floorShare'];
  return {
    label,
    games: records.length,
    checkpoints,
    floorShare: average((t) => t.floorShare),
    ceilingShare: average((t) => t.ceilingShare),
  };
}

/**
 * Un choix est « dominé » si un autre choix de la même carte est au moins aussi bon
 * sur toutes les jauges et meilleur sur une : il n'y a alors pas de vrai dilemme.
 */
export function dominatedChoices(card: EventCard): number[] {
  const keys = ['treasury', 'coffee', 'hype', 'stability', 'users', 'moral'] as const;
  const value = (index: number, key: (typeof keys)[number] | 'debt' | 'sprintsLost'): number => {
    const effects = card.choices[index]?.effects ?? {};
    const raw = effects[key] ?? 0;
    // Pour la dette et les sprints perdus, moins c'est mieux.
    return key === 'debt' || key === 'sprintsLost' ? -raw : raw;
  };
  const allKeys = [...keys, 'debt', 'sprintsLost'] as const;
  const hasSideEffects = (index: number) => {
    const e = card.choices[index]?.effects ?? {};
    return (
      Boolean(e.requeue || e.spawnDev || e.fireDev || e.unlockAchievement) ||
      Object.keys(e).some((k) => k.startsWith('moral.'))
    );
  };
  const dominated: number[] = [];
  card.choices.forEach((_, a) => {
    if (hasSideEffects(a)) return;
    const beaten = card.choices.some((__, b) => {
      if (a === b || hasSideEffects(b)) return false;
      const better = allKeys.every((k) => value(b, k) >= value(a, k));
      const strictly = allKeys.some((k) => value(b, k) > value(a, k));
      return better && strictly;
    });
    if (beaten) dominated.push(a);
  });
  return dominated;
}

export function aggregate(allRecords: GameRecord[], cards: CardLibrary): BalanceReport {
  // Les stratégies, les cartes et les succès se comparent en mode Normal ; les autres
  // modes n'ont qu'une section à eux (jauges, faillites).
  const records = allRecords.filter((r) => r.mode === 'NORMAL');
  // Ordre fixe (celui de BOT_NAMES), quel que soit l'ordre d'arrivée des parties des threads.
  const played = new Set(records.map((r) => r.bot));
  const botNames = BOT_NAMES.filter((bot) => played.has(bot));
  const bots = botNames.map((bot) =>
    summarizeBot(
      bot,
      records.filter((r) => r.bot === bot),
    ),
  );
  const gauges = botNames.map((bot) =>
    summarizeGauges(
      bot,
      records.filter((r) => r.bot === bot),
    ),
  );
  const modes = [...new Set(allRecords.map((r) => r.mode))].map((mode): ModeSummary => {
    const games = allRecords.filter((r) => r.mode === mode);
    return {
      ...summarizeGauges(mode, games),
      mode,
      bankruptcyRate:
        games.filter((r) => r.outcome === 'BANKRUPTCY').length / Math.max(1, games.length),
      medianValuation: median(games.map((r) => r.valuation)),
      bots: BOT_NAMES.flatMap((bot): ModeBotSummary[] => {
        const own = games.filter((r) => r.bot === bot);
        const n = own.length;
        if (n === 0) return [];
        const share = (test: (r: GameRecord) => boolean) => own.filter(test).length / n;
        return [
          {
            bot,
            games: n,
            bankruptcyRate: share((r) => r.outcome === 'BANKRUPTCY'),
            zombieRate: share((r) => r.outcome === 'ZOMBIE'),
            unicornRate: share((r) => r.phaseReached === 'UNICORN'),
            medianValuation: median(own.map((r) => r.valuation)),
          },
        ];
      }),
    };
  });

  const draws = new Map<string, number>();
  const choiceStats = new Map<string, { picks: number; valuation: number; bankruptcies: number }>();
  for (const record of records) {
    for (const [cardId, choiceIndex] of record.choices) {
      draws.set(cardId, (draws.get(cardId) ?? 0) + 1);
      const key = `${cardId}#${choiceIndex}`;
      const stat = choiceStats.get(key) ?? { picks: 0, valuation: 0, bankruptcies: 0 };
      stat.picks += 1;
      stat.valuation += record.valuation;
      if (record.outcome === 'BANKRUPTCY') stat.bankruptcies += 1;
      choiceStats.set(key, stat);
    }
  }
  const choices: ChoiceStat[] = [...choiceStats.entries()].map(([key, stat]) => {
    const [cardId = '', index = '0'] = key.split('#');
    return {
      cardId,
      choiceIndex: Number(index),
      picks: stat.picks,
      averageValuation: stat.valuation / stat.picks,
      bankruptcyRate: stat.bankruptcies / stat.picks,
    };
  });

  const alerts: CardAlert[] = [];
  const reference = createEmptyState({ seed: 'analysis', mode: 'NORMAL' });
  for (const card of cards.cards) {
    for (const index of dominatedChoices(card)) {
      alerts.push({
        cardId: card.id,
        reason: `choix ${index + 1} dominé : un autre choix est meilleur sur toutes les jauges`,
      });
    }
    const scores = card.choices.map((choice) => scoreEffects(choice.effects, reference));
    const best = Math.max(...scores);
    const second = [...scores].sort((a, b) => b - a)[1] ?? best;
    if (best - second > 6)
      alerts.push({
        cardId: card.id,
        reason: `un choix écrase les autres (écart de score ${(best - second).toFixed(1)})`,
      });
  }
  // Choix dont les parties finissent bien mieux que celles des autres choix de la MÊME carte
  // (comparer à la moyenne globale serait faussé : les cartes de fin de partie
  // n'apparaissent que dans les parties qui ont réussi).
  const byCard = new Map<string, ChoiceStat[]>();
  for (const stat of choices) byCard.set(stat.cardId, [...(byCard.get(stat.cardId) ?? []), stat]);
  for (const [cardId, stats] of byCard) {
    const picks = stats.reduce((a, s) => a + s.picks, 0);
    const cardMean =
      stats.reduce((a, s) => a + s.averageValuation * s.picks, 0) / Math.max(1, picks);
    for (const stat of stats) {
      if (stat.picks < 30 || cardMean === 0) continue;
      const ratio = stat.averageValuation / cardMean;
      if (ratio > 1.5)
        alerts.push({
          cardId,
          reason: `choix ${stat.choiceIndex + 1} : valorisation finale ×${ratio.toFixed(2)} par rapport aux autres choix (trop fort ?)`,
        });
    }
  }

  const unlocks = new Map<string, number>();
  for (const record of records)
    for (const id of record.achievements) unlocks.set(id, (unlocks.get(id) ?? 0) + 1);
  const achievements = ACHIEVEMENTS.map(({ id, difficulty, secret = false }) => ({
    id,
    difficulty,
    secret,
    rate: (unlocks.get(id) ?? 0) / Math.max(1, records.length),
  }));

  const sortedDraws = [...draws.entries()].sort((a, b) => b[1] - a[1]);
  return {
    games: records.length,
    bots,
    gauges,
    modes,
    draws: sortedDraws,
    neverDrawn: cards.cards.filter((c) => !draws.has(c.id)).map((c) => c.id),
    choices,
    alerts,
    achievements,
    flow: {
      bots: botNames.map((bot) =>
        summarizeFlow(
          bot,
          records.filter((r) => r.bot === bot),
        ),
      ),
      objectives: objectiveRates(records),
    },
    career: careerSummaries(allRecords),
    campaign: campaignSummaries(allRecords),
    teamLife: botNames.map((bot) =>
      summarizeTeamLife(
        bot,
        records.filter((r) => r.bot === bot && r.mode === 'NORMAL'),
      ),
    ),
  };
}

function campaignSummaries(records: GameRecord[]): CampaignSummary[] {
  return BOT_NAMES.flatMap((bot): CampaignSummary[] => {
    const games = records.filter((r) => r.bot === bot && r.campaign);
    if (games.length === 0) return [];
    const share = (test: (r: GameRecord) => boolean) => games.filter(test).length / games.length;
    const failures = new Map<string, number>();
    for (const r of games)
      if (!r.campaign?.success && r.campaign?.failure)
        failures.set(r.campaign.failure, (failures.get(r.campaign.failure) ?? 0) + 1);
    const mainFailure = [...failures].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return [
      {
        bot,
        games: games.length,
        successRate: share((r) => r.campaign?.success ?? false),
        reached: STORY_ACTS.map((_, act) => share((r) => (r.campaign?.act ?? 0) >= act)),
        goals: games.reduce((total, r) => total + (r.campaign?.goals ?? 0), 0) / games.length,
        mainFailure,
        sprints: games.reduce((total, r) => total + r.sprint, 0) / games.length,
      },
    ];
  });
}

function careerSummaries(records: GameRecord[]): CareerSummary[] {
  return CAREER_LEGENDS.flatMap((legend): CareerSummary[] => {
    const games = records.filter((r) => r.career?.legend === legend.id);
    if (games.length === 0) return [];
    const share = (test: (r: GameRecord) => boolean) => games.filter(test).length / games.length;
    return [
      {
        legend: legend.id,
        games: games.length,
        bankruptcyRate: share((r) => r.outcome === 'BANKRUPTCY'),
        stars: [0, 1, 2, 3].map((stars) => share((r) => r.career?.stars === stars)) as [
          number,
          number,
          number,
          number,
        ],
        milestones: legend.milestones.map(({ id }) => ({
          id,
          rate: share((r) => r.career?.done.includes(id) ?? false),
        })),
      },
    ];
  });
}

const pct = (value: number) => `${(value * 100).toFixed(1)} %`;
const money = (value: number) => `${(value / 1e6).toFixed(1)} M€`;
const users = (value: number) =>
  value >= 1e6 ? `${(value / 1e6).toFixed(2)} M` : `${Math.round(value / 1000)} k`;

/** Rapport lisible en Markdown. */
export function renderReport(report: BalanceReport): string {
  const lines: string[] = [];
  lines.push(`# Rapport d'équilibrage`, '', `${report.games} parties simulées.`, '');
  lines.push('## Par stratégie', '');
  lines.push(
    '| Bot | Parties | Faillite | IPO | Rachat | Zombie | Licorne | Valo. moyenne | Valo. médiane | Sprints joués |',
  );
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const b of report.bots) {
    const n = Math.max(1, b.games);
    lines.push(
      `| ${b.bot} | ${b.games} | ${pct(b.bankruptcyRate)} | ${pct(b.outcomes.IPO / n)} | ${pct(b.outcomes.ACQUISITION / n)} | ${pct(b.outcomes.ZOMBIE / n)} | ${pct(b.unicornRate)} | ${money(b.averageValuation)} | ${money(b.medianValuation)} | ${b.averageSprints.toFixed(1)} |`,
    );
  }
  if (report.bots.some((b) => b.ventures.perGame > 0)) {
    lines.push('', '## Filiales', '');
    lines.push(
      'Retour = (dividendes + reventes + valeur des parts en fin de partie) / sommes investies.',
      '',
      '| Bot | Filiales par partie | Coulées | Retour |',
      '| --- | ---: | ---: | ---: |',
    );
    for (const b of report.bots) {
      if (b.ventures.perGame === 0) continue;
      lines.push(
        `| ${b.bot} | ${b.ventures.perGame.toFixed(2)} | ${pct(b.ventures.deadShare)} | ×${b.ventures.returnMultiple.toFixed(2)} |`,
      );
    }
  }
  lines.push('', '## Levées de fonds', '');
  lines.push(
    'Chaque tour de table est plus dur que le précédent ; à partir de la Série B, il ouvre une annexe au bureau.',
    '',
    '| Bot | Tours réussis par partie | Pitchs réussis | Parties avec annexe | Autres financements par partie |',
    '| --- | ---: | ---: | ---: | ---: |',
  );
  for (const b of report.bots) {
    lines.push(
      `| ${b.bot} | ${b.funding.rounds.toFixed(2)} | ${pct(b.funding.successRate)} | ${pct(b.funding.annexShare)} | ${b.funding.financings.toFixed(2)} |`,
    );
  }
  if (report.teamLife.length > 0) {
    lines.push('', '## Vie de l’équipe', '');
    lines.push(
      'Moyennes par partie en mode Normal : congés pris (posés et ponts), jours d’arrêt maladie, arrêts pour burn-out et démissions.',
      '',
      '| Bot | Jours de congé | Jours d’arrêt | Burn-out | Démissions |',
      '| --- | ---: | ---: | ---: | ---: |',
    );
    for (const life of report.teamLife) {
      lines.push(
        `| ${life.bot} | ${life.leaveDays.toFixed(1)} | ${life.sickDays.toFixed(1)} | ${life.burnoutLeaves.toFixed(2)} | ${life.resignations.toFixed(2)} |`,
      );
    }
  }
  if (report.flow.bots.length > 0) {
    lines.push('', '## Tâches dynamiques', '');
    lines.push(
      'Urgences (prod cassée, faille, gros client...) et tâches de la semaine réussies à temps ; objectifs de sprint réussis.',
      '',
      '| Bot | Urgences par partie | Urgences à temps | Hebdo à temps | Objectifs par partie | Objectifs réussis |',
      '| --- | ---: | ---: | ---: | ---: | ---: |',
    );
    for (const f of report.flow.bots) {
      lines.push(
        `| ${f.bot} | ${f.urgentPerGame.toFixed(1)} | ${pct(f.urgentSuccess)} | ${pct(f.weeklySuccess)} | ${f.objectivesPerGame.toFixed(1)} | ${pct(f.objectiveSuccess)} |`,
      );
    }
    lines.push('', '| Objectif | Difficulté | Tirages | Réussite |', '| --- | --- | ---: | ---: |');
    for (const o of report.flow.objectives) {
      lines.push(`| ${o.kind} | ${o.difficulty} | ${o.count} | ${pct(o.success)} |`);
    }
  }
  lines.push('', '## Taux de faillite par phase', '');
  lines.push(`| Bot | ${PHASES.filter((p) => p !== 'END').join(' | ')} |`);
  lines.push(
    `| --- | ${PHASES.filter((p) => p !== 'END')
      .map(() => '---:')
      .join(' | ')} |`,
  );
  for (const b of report.bots) {
    const cells = PHASES.filter((p) => p !== 'END').map((p) =>
      pct((b.bankruptcyByPhase[p] ?? 0) / Math.max(1, b.games)),
    );
    lines.push(`| ${b.bot} | ${cells.join(' | ')} |`);
  }
  lines.push('', '## Trajectoire des jauges (mode Normal)', '');
  lines.push(
    'Médiane de chaque jauge à la fin des sprints 5, 13, 26 et 39, sur les parties encore en cours. La trésorerie est en mois de dépenses : au-delà de 24 mois, l’argent ne compte plus vraiment.',
    '',
  );
  lines.push(
    '| Bot | Sprint | Parties | Trésorerie (mois) | Café | Dette | Stabilité | Hype | Utilisateurs |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  );
  for (const g of report.gauges) {
    g.checkpoints.forEach((checkpoint, index) => {
      if (!checkpoint) return;
      const v = checkpoint.values;
      lines.push(
        `| ${g.label} | ${CHECKPOINT_SPRINTS[index]} | ${checkpoint.games} | ${v.treasury.toFixed(1)} | ${v.coffee.toFixed(0)} | ${v.debt.toFixed(0)} | ${v.stability.toFixed(0)} | ${v.hype.toFixed(0)} | ${users(v.users)} |`,
      );
    });
  }
  lines.push('', '## Jauges bloquées', '');
  lines.push(
    'Part des jours passés au plancher (≤ 2) ou au plafond (≥ 98). Une jauge collée à 0 ou à 100 pendant des mois ne pose plus de choix au joueur.',
    '',
  );
  lines.push(
    '| Bot / mode | Café à 0 | Hype à 0 | Stabilité à 0 | Dette à 100 | Café à 100 | Hype à 100 | Stabilité à 100 | Dette à 0 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  );
  for (const g of [...report.gauges, ...report.modes]) {
    const f = g.floorShare;
    const c = g.ceilingShare;
    lines.push(
      `| ${g.label} | ${pct(f.coffee)} | ${pct(f.hype)} | ${pct(f.stability)} | ${pct(c.debt)} | ${pct(c.coffee)} | ${pct(c.hype)} | ${pct(c.stability)} | ${pct(f.debt)} |`,
    );
  }
  if (report.modes.length > 1) {
    lines.push('', '## Par mode de jeu', '');
    lines.push(
      '| Mode | Parties | Faillite | Valo. médiane | Trésorerie S13 (mois) | Hype S13 | Café S13 | Hype S39 |',
      '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    );
    for (const m of report.modes) {
      const mid = m.checkpoints[1]?.values;
      const end = m.checkpoints[3]?.values;
      const cell = (value: number | undefined, digits = 0) =>
        value === undefined ? '—' : value.toFixed(digits);
      lines.push(
        `| ${m.mode} | ${m.games} | ${pct(m.bankruptcyRate)} | ${money(m.medianValuation)} | ${cell(mid?.treasury, 1)} | ${cell(mid?.hype)} | ${cell(mid?.coffee)} | ${cell(end?.hype)} |`,
      );
    }
    // Facile, Normal et Hardcore côte à côte, stratégie par stratégie (profils de
    // `difficultyOf`) : le Facile pardonne sans être gagné d'avance, le Hardcore punit
    // l'attentisme sans être impossible.
    const ladder = (['EASY', 'NORMAL', 'HARDCORE'] as const).flatMap(
      (mode) => report.modes.find((m) => m.mode === mode) ?? [],
    );
    if (ladder.length > 1) {
      lines.push('', '## Difficulté par mode et par stratégie', '');
      lines.push(
        '| Mode | Bot | Parties | Faillite | Zombie | Licorne | Valo. médiane |',
        '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
      );
      for (const m of ladder) {
        for (const b of m.bots) {
          lines.push(
            `| ${m.mode} | ${b.bot} | ${b.games} | ${pct(b.bankruptcyRate)} | ${pct(b.zombieRate)} | ${pct(b.unicornRate)} | ${money(b.medianValuation)} |`,
          );
        }
      }
    }
  }
  if (report.career.length > 0) {
    lines.push('', '## Mode Carrière', '');
    lines.push(
      'Les bots ne suivent pas les jalons : ils jouent comme en Normal. Un jalon à 0 % est suspect, un jalon à 100 % trop facile.',
      '',
      '| Légende | Parties | Faillite | 0 ★ | 1 ★ | 2 ★ | 3 ★ | Jalons tenus |',
      '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    );
    for (const c of report.career) {
      const goals = c.milestones.map((m) => `${m.id} ${pct(m.rate)}`).join(' · ');
      lines.push(
        `| ${c.legend} | ${c.games} | ${pct(c.bankruptcyRate)} | ${c.stars.map(pct).join(' | ')} | ${goals} |`,
      );
    }
  }
  if (report.campaign.length > 0) {
    lines.push('', '## Histoire en actes', '');
    lines.push(
      'Bot conteur : chaque bot joue comme en Normal, mais refuse les rachats avant « Le géant ». « Acte » = part des parties qui atteignent cet acte ; échec noté « acte:raison ».',
      '',
      `| Bot | Parties | Réussite | ${STORY_ACTS.map((a) => a.id).join(' | ')} | Objectifs secondaires | Sprints | Échec principal |`,
      `| --- | ---: | ---: | ${STORY_ACTS.map(() => '---:').join(' | ')} | ---: | ---: | --- |`,
    );
    for (const c of report.campaign)
      lines.push(
        `| ${c.bot} | ${c.games} | ${pct(c.successRate)} | ${c.reached.map(pct).join(' | ')} | ${c.goals.toFixed(1)} | ${c.sprints.toFixed(1)} | ${c.mainFailure ?? '-'} |`,
      );
  }
  lines.push('', '## Cartes les plus tirées', '');
  for (const [cardId, count] of report.draws.slice(0, 15)) lines.push(`- \`${cardId}\` : ${count}`);
  lines.push('', `## Cartes jamais tirées (${report.neverDrawn.length})`, '');
  lines.push(
    report.neverDrawn.length > 0
      ? report.neverDrawn.map((id) => `\`${id}\``).join(', ')
      : 'Aucune.',
  );
  lines.push('', `## Cartes à surveiller (${report.alerts.length})`, '');
  for (const alert of report.alerts) lines.push(`- \`${alert.cardId}\` : ${alert.reason}`);
  lines.push('', '## Succès débloqués par les bots', '');
  lines.push(
    'Les bots ne jouent pas comme un humain : ce taux sert à repérer un succès impossible (0 %) ou trop facile pour sa difficulté.',
    '',
  );
  lines.push('| Succès | Difficulté | Secret | Parties |', '| --- | --- | --- | ---: |');
  for (const a of report.achievements)
    lines.push(`| \`${a.id}\` | ${a.difficulty} | ${a.secret ? 'oui' : ''} | ${pct(a.rate)} |`);
  lines.push('');
  return lines.join('\n');
}
