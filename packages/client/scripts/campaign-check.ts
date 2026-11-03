/**
 * Calibrage de la longue partie du mode Histoire (« Ctrl+Alt+Fonder ») : joue l'histoire avec
 * chaque bot et compte jusqu'où il va. `pnpm balance:campaign [parties par bot]`
 */
import { STORY_ACTS } from '@oss/shared';
import {
  BOT_NAMES,
  createBot,
  defaultCardLibrary,
  playWithBot,
  Simulation,
} from '../src/simulation';
import { storyteller } from '../src/simulation/analysis';

const cards = defaultCardLibrary();
const N = Number(process.argv[2] ?? 20);

console.log(
  'bot'.padEnd(10),
  'réussite',
  STORY_ACTS.map((a) => a.id.padEnd(9)).join(' '),
  'objectifs',
  'sprints',
  'R&D (points, niveaux)',
);
for (const bot of BOT_NAMES) {
  let won = 0;
  let goals = 0;
  let sprints = 0;
  let earned = 0;
  let nodes = 0;
  const reached = STORY_ACTS.map(() => 0);
  const fails: Record<string, number> = {};
  for (let i = 0; i < N; i++) {
    const seed = `campaign-${bot}-${i}`;
    const sim = Simulation.create({ seed, mode: 'STORY', mission: 'campaign' }, cards);
    playWithBot(sim, storyteller(createBot(bot, seed)), cards);
    const result = sim.state.result?.campaign;
    const act = sim.state.story?.campaign?.act ?? 0;
    for (let a = 0; a <= act; a++) reached[a] = (reached[a] ?? 0) + 1;
    if (result?.success) won++;
    else
      fails[`${result?.act}:${result?.failure}`] =
        (fails[`${result?.act}:${result?.failure}`] ?? 0) + 1;
    goals += sim.state.story?.campaign?.done.length ?? 0;
    sprints += sim.state.sprint;
    earned += sim.state.story?.campaign?.research?.earned ?? 0;
    nodes += sim.state.story?.campaign?.research?.nodes.length ?? 0;
  }
  const pct = (n: number) => `${Math.round((n / N) * 100)}%`.padEnd(9);
  console.log(
    bot.padEnd(10),
    pct(won),
    reached.map(pct).join(' '),
    (goals / N).toFixed(1).padEnd(9),
    (sprints / N).toFixed(1).padEnd(7),
    `${(earned / N).toFixed(0)} pts, ${(nodes / N).toFixed(1)}/20`,
    JSON.stringify(fails),
  );
}
