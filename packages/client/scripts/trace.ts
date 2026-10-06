// Trace sprint par sprint d'une partie jouée par un bot (outil d'équilibrage).
import { parseArgs } from 'node:util';
import { createBot, defaultCardLibrary, Simulation, type BotName } from '../src/simulation';

const { values } = parseArgs({
  options: {
    bot: { type: 'string', default: 'balanced' },
    seed: { type: 'string', default: 'trace' },
  },
});
const cards = defaultCardLibrary();
const sim = Simulation.create({ seed: values.seed, mode: 'NORMAL' }, cards);
const bot = createBot(values.bot as BotName, values.seed);
let lastSprint = 0;
for (let i = 0; i < 5000 && sim.state.stage !== 'ENDED'; i++) {
  if (sim.isRunning) {
    sim.runUntilBlocked();
    continue;
  }
  const s = sim.state;
  if (s.stage === 'DEMO' && s.sprint !== lastSprint) {
    lastSprint = s.sprint;
    const g = s.gauges;
    console.log(
      `S${s.sprint} ${s.phase.padEnd(8)} users=${Math.round(g.users)} cash=${(g.treasury / 1e6).toFixed(2)}M debt=${g.debt.toFixed(0)} stab=${g.stability.toFixed(0)} hype=${g.hype.toFixed(0)} coffee=${g.coffee.toFixed(0)} team=${Object.keys(s.components.identity).length} val=${(s.valuation / 1e6).toFixed(1)}M own=${(s.ownership * 100).toFixed(0)}% shipped=${s.history.sprints.at(-1)?.featuresShipped}`,
    );
  }
  const cmds = bot.decide(s, cards);
  let ok = false;
  for (const c of cmds) {
    const r = sim.dispatch(c).result;
    ok ||= r.ok;
    if (!r.ok && process.env.VERBOSE) console.log('  refused', c.type, r.error);
  }
  if (!ok)
    sim.dispatch(
      s.stage === 'DEMO'
        ? { type: 'END_DEMO' }
        : s.stage === 'PITCH'
          ? { type: 'CLOSE_PITCH' }
          : s.events.pending
            ? { type: 'RESOLVE_EVENT', choiceIndex: 0 }
            : { type: 'START_SPRINT' },
    );
}
console.log(sim.state.result?.headline.fr);
for (const n of sim.state.notifications.filter((n) =>
  ['FUNDS_RAISED', 'PITCH_FAILED', 'PHASE_UP', 'ACQUISITION_OFFER'].includes(n.kind),
))
  console.log(' ', n.kind, n.text.fr);
