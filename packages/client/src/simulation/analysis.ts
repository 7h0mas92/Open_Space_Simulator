import {
  ACHIEVEMENTS,
  OUTCOMES,
  type AchievementDifficulty,
  PHASES,
  type EventCard,
  type GameMode,
  type Outcome,
  type Phase,
} from '@oss/shared';
import type { CardLibrary } from '../events/library';
import { createBot, playWithBot, scoreEffects, type BotName } from './bots';
import { createEmptyState } from './state';
import { Simulation } from './simulation';

/**
 * Analyse d'équilibrage : on joue des parties complètes avec des bots, puis on agrège.
 * Utilisé par `pnpm balance` (des milliers de parties, en parallèle) et par les tests.
 */

/** Résumé d'une partie jouée par un bot. */
export interface GameRecord {
  bot: BotName;
  seed: string;
  outcome: Outcome;
  phaseReached: Phase;
  sprint: number;
  valuation: number;
  maxUsers: number;
  /** Cartes tirées et choix faits : [identifiant, index du choix]. */
  choices: [string, number][];
  /** Succès débloqués pendant la partie. */
  achievements: string[];
}

export function playBalanceGame(
  seed: string,
  bot: BotName,
  cards: CardLibrary,
  mode: GameMode = 'NORMAL',
): GameRecord {
  const simulation = Simulation.create({ seed, mode }, cards);
  playWithBot(simulation, createBot(bot, seed), cards);
  const { state } = simulation;
  const result = state.result ?? {
    outcome: 'ZOMBIE' as const,
    phaseReached: state.phase,
    sprint: state.sprint,
    valuation: state.valuation,
  };
  return {
    bot,
    seed,
    outcome: result.outcome,
    phaseReached: result.phaseReached,
    sprint: result.sprint,
    valuation: result.valuation,
    maxUsers: state.stats.maxUsers,
    choices: state.events.choices.map((c) => [c.cardId, c.choiceIndex]),
    achievements: [...state.achievements],
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

export interface BalanceReport {
  games: number;
  bots: BotSummary[];
  /** Nombre de tirages de chaque carte (les plus tirées d'abord). */
  draws: [string, number][];
  neverDrawn: string[];
  choices: ChoiceStat[];
  alerts: CardAlert[];
  /** Part des parties qui débloquent chaque succès (vérifie que la difficulté annoncée est juste). */
  achievements: AchievementRate[];
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

export function aggregate(records: GameRecord[], cards: CardLibrary): BalanceReport {
  const bots = [...new Set(records.map((r) => r.bot))].map((bot) =>
    summarizeBot(
      bot,
      records.filter((r) => r.bot === bot),
    ),
  );

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
    draws: sortedDraws,
    neverDrawn: cards.cards.filter((c) => !draws.has(c.id)).map((c) => c.id),
    choices,
    alerts,
    achievements,
  };
}

const pct = (value: number) => `${(value * 100).toFixed(1)} %`;
const money = (value: number) => `${(value / 1e6).toFixed(1)} M€`;

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
