import { BALANCE, type GameState } from '@oss/shared';
import { resignDev } from '../devs';
import { computeValuation, monthlyExpenses, monthlyRevenue } from '../economy';
import {
  addDevLog,
  addGauge,
  addMoney,
  addUsers,
  clamp,
  devIds,
  devsWithRole,
  notify,
  teamMoral,
  text,
  type SimContext,
} from '../helpers';
import { round } from '../math';
import type { SimClock } from '../time';
import { thinksInRust } from './work';

const DAYS_PER_MONTH = 30;

/** Économie du jour : salaires, loyer, serveurs ; revenus des abonnements. */
function economy(state: GameState): void {
  addMoney(state, -monthlyExpenses(state) / DAYS_PER_MONTH);
  addMoney(state, monthlyRevenue(state) / DAYS_PER_MONTH);
}

/** Croissance organique (hype) et départs (churn, aggravé par l'instabilité). */
function users(state: GameState): void {
  const { users: u } = BALANCE;
  const { hype, stability } = state.gauges;
  const instability = 1 - stability / 100;
  const growth = state.gauges.users * u.organicDailyGrowth * (hype / 100);
  const churn =
    state.gauges.users * (u.baseDailyChurn + u.instabilityDailyChurn * instability * instability);
  addUsers(state, growth);
  addUsers(state, -churn);
}

/** Dérive naturelle des jauges et effets du mobilier. */
function gauges(state: GameState, ctx: SimContext): void {
  const productOwners = devsWithRole(state, 'PRODUCT_OWNER').length;
  addGauge(
    state,
    'hype',
    -BALANCE.hype.dailyDecay + productOwners * BALANCE.hype.poDailyGain + ctx.office.hypePerDay,
  );
  addGauge(
    state,
    'stability',
    BALANCE.stability.dailyRecovery -
      state.gauges.debt * BALANCE.stability.dailyDebtErosion +
      ctx.office.stabilityPerDay,
  );
  addGauge(state, 'debt', ctx.office.debtPerDay);
}

/** Moral quotidien de chaque dev ; à 0, il démissionne (faux post LinkedIn). */
function moral(state: GameState, ctx: SimContext, clock: SimClock): void {
  const { moral: m } = BALANCE;
  const coffeeEmpty = state.gauges.coffee <= 0;
  for (const id of devIds(state)) {
    const identity = state.components.identity[id];
    const mood = state.components.mood[id];
    if (!identity || !mood || identity.role === 'AI_AGENT') continue;
    const relations = Object.values(state.components.relations[id] ?? {});
    const affinity =
      relations.length > 0 ? relations.reduce((a, b) => a + b, 0) / relations.length : 0;

    let gain = m.dailyBase + ctx.office.moral + Math.max(0, affinity) / m.affinityDivider;
    if (clock.isWeekend) gain += m.weekendRecovery;
    let loss = state.gauges.debt / m.debtDivider + Math.max(0, -affinity) / m.affinityDivider;
    if (mood.energy < 30) loss += m.lowEnergyPenalty;
    if (coffeeEmpty && identity.role !== 'GHOST') loss += m.coffeeEmptyPenalty;
    const taskId = state.components.worker[id]?.taskId;
    if (identity.role === 'SENIOR_BEARD' && taskId && state.components.task[taskId]?.shinyFramework)
      loss += 1;
    if (identity.trait === 'ZEN') loss /= 2;
    if (identity.trait === 'WORKAHOLIC') gain += 0.3;
    mood.moral = clamp(mood.moral + gain - loss, 0, 100);
  }
  for (const id of devIds(state)) {
    const mood = state.components.mood[id];
    if (mood && mood.moral <= BALANCE.moral.resignationThreshold) resignDev(state, ctx, id);
  }
}

/** Les affinités s'estompent doucement vers 0 (on oublie les disputes... et les amitiés). */
function relations(state: GameState): void {
  const drift = BALANCE.relations.dailyDrift;
  for (const id of devIds(state)) {
    const relations = state.components.relations[id];
    if (!relations) continue;
    for (const [otherId, affinity] of Object.entries(relations)) {
      relations[otherId] =
        affinity > 0 ? Math.max(0, affinity - drift) : Math.min(0, affinity + drift);
    }
  }
}

/** Le Rustacé convertit progressivement ses collègues. */
function rustConversion(state: GameState, ctx: SimContext): void {
  for (const rustacean of devsWithRole(state, 'RUSTACEAN')) {
    if (!ctx.rng.chance(BALANCE.roles.rustConvertDaily)) continue;
    const targets = devIds(state).filter(
      (id) => !thinksInRust(state, id) && state.components.identity[id]?.role !== 'AI_AGENT',
    );
    if (targets.length === 0) continue;
    const target = ctx.rng.pick(targets);
    state.components.rustConverted[target] = true;
    const name = state.components.identity[target]?.name ?? '?';
    const by = state.components.identity[rustacean]?.name ?? '?';
    addDevLog(
      state,
      target,
      text(['Converti·e à Rust par {by}.', 'Converted to Rust by {by}.'], { by }),
    );
    notify(
      state,
      ctx,
      'RUST_CONVERT',
      text(
        [
          '{name} veut maintenant tout réécrire en Rust. Merci {by}.',
          '{name} now wants to rewrite everything in Rust. Thanks, {by}.',
        ],
        { name, by },
      ),
      target,
    );
  }
}

/** Point quotidien de l'historique (graphiques du dashboard). */
export function recordHistory(state: GameState, day: number): void {
  const { gauges: g } = state;
  state.history.daily.push({
    day,
    sprint: state.sprint,
    treasury: Math.round(g.treasury),
    coffee: round(g.coffee, 1),
    debt: round(g.debt, 1),
    stability: round(g.stability, 1),
    hype: round(g.hype, 1),
    users: Math.round(g.users),
    moral: round(teamMoral(state), 1),
    valuation: state.valuation,
  });
}

/** Système quotidien, exécuté à minuit. */
export function dailySystem(state: GameState, ctx: SimContext, clock: SimClock): void {
  if (clock.hour !== 0) return;
  economy(state);
  users(state);
  gauges(state, ctx);
  moral(state, ctx, clock);
  relations(state);
  rustConversion(state, ctx);
  if (state.gauges.coffee <= 0) state.stats.coffeeShortageDays += 1;
  state.valuation = computeValuation(state);
  state.stats.maxValuation = Math.max(state.stats.maxValuation, state.valuation);
  state.stats.maxUsers = Math.max(state.stats.maxUsers, Math.round(state.gauges.users));
  recordHistory(state, clock.day);
}
