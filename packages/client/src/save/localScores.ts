import {
  GLOBAL_EXCLUDED_MODES,
  companyName,
  compareGames,
  type GameMode,
  type Outcome,
  type Phase,
} from '@oss/shared';
import { localStore } from './storage';

const KEY = 'scores:local';
/** Parties gardées sur l'appareil (les meilleures de chaque mode restent). */
const KEPT_PER_MODE = 50;

/** Une partie terminée sur cet appareil, pour le classement « Sur cet appareil ». */
export interface LocalScore {
  readonly id: string;
  readonly company: string;
  readonly mode: GameMode;
  readonly outcome: Outcome;
  readonly phaseReached: Phase;
  readonly valuation: number;
  readonly sprintsPlayed: number;
  readonly seed: string;
  readonly dailyDate: string | null;
  readonly createdAt: string;
}

/** Ce que l'écran de fin connaît d'une partie : le reste est déduit. */
export interface FinishedGame {
  readonly seed: string;
  readonly mode: GameMode;
  readonly outcome: Outcome;
  readonly phaseReached: Phase;
  readonly valuation: number;
  readonly sprint: number;
  readonly dailyDate?: string;
}

/** Filtre d'un onglet : tous les modes classés ensemble, un Daily, ou un mode. */
export type LocalBoard =
  { kind: 'global' } | { kind: 'daily'; date: string } | { kind: 'mode'; mode: GameMode };

function inBoard(score: LocalScore, board: LocalBoard): boolean {
  if (board.kind === 'global') return !GLOBAL_EXCLUDED_MODES.includes(score.mode);
  if (board.kind === 'daily') return score.mode === 'DAILY' && score.dailyDate === board.date;
  return score.mode === board.mode;
}

/**
 * Classement des parties jouées sur cet appareil, invité ou connecté, même sans serveur. Il
 * ne sert qu'à l'affichage : seul le classement en ligne est vérifié par le rejeu du serveur.
 */
export const localScores = {
  async all(): Promise<LocalScore[]> {
    return (await localStore().get<LocalScore[]>(KEY)) ?? [];
  },

  /** Inscrit une partie terminée (une seule fois par partie : même graine, même date). */
  async add(game: FinishedGame, now = new Date()): Promise<LocalScore> {
    const score: LocalScore = {
      id: `${game.seed}@${now.toISOString()}`,
      company: companyName(game.seed),
      mode: game.mode,
      outcome: game.outcome,
      phaseReached: game.phaseReached,
      valuation: game.valuation,
      sprintsPlayed: game.sprint,
      seed: game.seed,
      dailyDate: game.dailyDate ?? null,
      createdAt: now.toISOString(),
    };
    const kept: LocalScore[] = [];
    const scores = [...(await this.all()), score];
    for (const mode of new Set(scores.map((entry) => entry.mode))) {
      kept.push(
        ...scores
          .filter((entry) => entry.mode === mode)
          .sort(compareGames(mode))
          .slice(0, KEPT_PER_MODE),
      );
    }
    await localStore().set(KEY, kept);
    return score;
  },

  /** Les parties d'un onglet, de la meilleure à la moins bonne. */
  async top(board: LocalBoard, limit = 50): Promise<LocalScore[]> {
    const mode = board.kind === 'mode' ? board.mode : board.kind === 'daily' ? 'DAILY' : null;
    return (await this.all())
      .filter((score) => inBoard(score, board))
      .sort(compareGames(mode))
      .slice(0, limit);
  },
};
