/**
 * `pnpm balance` : simule des milliers de parties avec des stratégies automatiques,
 * sans navigateur, et produit un rapport d'équilibrage (taux de faillite, valorisation
 * moyenne, cartes trop fortes).
 *
 * Options : --games 10000 (total, réparti entre les bots), --threads 4, --out reports/balance.md
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Worker } from 'node:worker_threads';
import { defaultCardLibrary } from '../../src/simulation';
import { aggregate, renderReport, type GameRecord } from '../../src/simulation/analysis';
import { BOT_NAMES, type BotName } from '../../src/simulation/bots';

const { values } = parseArgs({
  options: {
    games: { type: 'string', default: '10000' },
    threads: { type: 'string', default: String(availableParallelism()) },
    out: { type: 'string', default: 'reports/balance.md' },
  },
});

const total = Number(values.games);
const threads = Math.max(1, Math.min(Number(values.threads), total));
const jobs: { seed: string; bot: BotName }[] = [];
for (let i = 0; i < total; i++)
  jobs.push({ seed: `balance-${i}`, bot: BOT_NAMES[i % BOT_NAMES.length] as BotName });

const started = performance.now();
console.log(`Simulation de ${total} parties sur ${threads} threads...`);

function runBatch(games: typeof jobs): Promise<GameRecord[]> {
  return new Promise((resolvePromise, reject) => {
    const worker = new Worker(new URL('./worker-bootstrap.mjs', import.meta.url), {
      workerData: { games },
    });
    worker.once('message', resolvePromise);
    worker.once('error', reject);
  });
}

const batches = Array.from({ length: threads }, (_, t) => jobs.filter((_, i) => i % threads === t));
const records = (await Promise.all(batches.map(runBatch))).flat();
const report = aggregate(records, defaultCardLibrary());
const markdown = renderReport(report);

const outPath = resolve(values.out);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, markdown);
console.log(markdown.split('## Cartes les plus tirées')[0]);
console.log(
  `Rapport complet : ${outPath} (${((performance.now() - started) / 1000).toFixed(1)} s)`,
);
