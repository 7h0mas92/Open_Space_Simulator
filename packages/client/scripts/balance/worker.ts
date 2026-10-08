// Fil d'exécution (worker_threads) qui joue un lot de parties et renvoie leurs résumés.
import { parentPort, workerData } from 'node:worker_threads';
import { defaultCardLibrary } from '../../src/simulation';
import { playBalanceGame } from '../../src/simulation/analysis';
import type { BotName } from '../../src/simulation/bots';
import type { GameMode } from '@oss/shared';

interface Job {
  games: { seed: string; bot: BotName; mode: GameMode }[];
}

const cards = defaultCardLibrary();
const { games } = workerData as Job;
const records = games.map(({ seed, bot, mode }) => playBalanceGame(seed, bot, cards, mode));
parentPort?.postMessage(records);
