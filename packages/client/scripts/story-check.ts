/**
 * Calibrage du mode Histoire : joue chaque mission avec les bots (et, pour les missions qui
 * demandent un aménagement que les bots ne font pas, avec un aménagement posé au départ).
 * `pnpm balance:story [parties par bot] [missions séparées par des virgules]`
 */
import { STORY_MISSIONS, type Command, type StoryMissionId } from '@oss/shared';
import {
  BOT_NAMES,
  createBot,
  defaultCardLibrary,
  findFreeSpot,
  playWithBot,
  Simulation,
} from '../src/simulation';
import { findFreeSlot } from '../src/simulation/furniture';
import { missionProgress } from '../src/simulation/story';
import type { Bot } from '../src/simulation/bots';

const cards = defaultCardLibrary();
const N = Number(process.argv[2] ?? 20);

/** Ce qu'un joueur attentif fait au premier sprint de la mission. */
function prepare(sim: Simulation, id: StoryMissionId): void {
  const buy = (itemId: string) => {
    const spot = findFreeSpot(sim.state, itemId);
    if (spot) sim.dispatch({ type: 'BUY_FURNITURE', itemId, ...spot, rotation: 0 } as Command);
  };
  const accessory = (itemId: string) => {
    const spot = findFreeSlot(sim.state, itemId);
    if (spot) sim.dispatch({ type: 'BUY_ACCESSORY', itemId, ...spot, rotation: 0 } as Command);
  };
  if (id === 'useful-meeting') sim.dispatch({ type: 'FIT_MEETING_ROOM', format: 'standup' });
  if (id === 'server-room') {
    buy('server-closet');
    for (const gear of ['rack-server', 'network-switch', 'precision-cooling']) accessory(gear);
  }
  if (id === 'office-cats') {
    for (const item of ['litter-open', 'cat-bowl', 'cat-tree-small']) buy(item);
    sim.dispatch({ type: 'ADOPT_PET', coat: 'ginger' });
    sim.dispatch({ type: 'ADOPT_PET', coat: 'black' });
    sim.dispatch({ type: 'ADOPT_PET', coat: 'white' });
  }
}

/** Un joueur de mission ne vend pas et n'entre pas en Bourse avant d'avoir rempli ses objectifs. */
function patient(bot: Bot): Bot {
  return {
    name: bot.name,
    decide(state, library) {
      const ready = missionProgress(state as never)?.goals.every((g) => g.met) ?? true;
      return bot
        .decide(state, library)
        .map((c) =>
          !ready && c.type === 'ANSWER_ACQUISITION' && c.accept ? { ...c, accept: false } : c,
        )
        .filter((c) => ready || c.type !== 'LAUNCH_IPO');
    },
  };
}

const diag: Record<string, number[][]> = {};
const ONLY = process.argv[3]?.split(',');
for (const mission of STORY_MISSIONS.filter((m) => !ONLY || ONLY.includes(m.id))) {
  const row: string[] = [];
  for (const bot of BOT_NAMES) {
    let won = 0;
    const fails: Record<string, number> = {};
    let sprints = 0;
    for (let i = 0; i < N; i++) {
      const seed = `story-${mission.id}-${bot}-${i}`;
      const sim = Simulation.create({ seed, mode: 'STORY', mission: mission.id }, cards);
      prepare(sim, mission.id);
      playWithBot(sim, patient(createBot(bot, seed)), cards);
      const st = sim.state;
      (diag[mission.id] ??= []).push([
        ['GARAGE', 'SEED', 'SERIES_A', 'UNICORN'].indexOf(st.result?.phaseReached ?? st.phase),
        Math.round(st.gauges.debt),
        Math.round(st.valuation / 1e6),
        Math.round(st.gauges.stability),
        st.stats.urgentDone,
        st.stats.urgentMissed,
        st.stats.prodOutages,
        st.stats.meetingsUseful,
      ]);
      const m = sim.state.result?.mission;
      if (m?.success) won++;
      else fails[m?.failure ?? 'none'] = (fails[m?.failure ?? 'none'] ?? 0) + 1;
      sprints += sim.state.sprint;
    }
    row.push(
      `${bot}:${Math.round((won / N) * 100)}% ${(sprints / N).toFixed(1)}sp ${JSON.stringify(fails)}`,
    );
  }
  console.log(mission.id.padEnd(18), row.join(' | '));
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
console.log('médianes: phase dette valo(M) stab urgOK urgKO pannes réunionsUtiles');
for (const [id, rows] of Object.entries(diag))
  console.log(id.padEnd(18), rows[0].map((_, k) => median(rows.map((r) => r[k]))).join(' '));
