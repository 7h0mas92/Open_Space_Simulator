import {
  VENTURE_IDEAS,
  VENTURE_RISKS,
  VENTURES,
  type CommandError,
  type CommandResult,
  type GameState,
  type Venture,
  type VentureIdea,
} from '@oss/shared';
import { computeValuation, monthlyExpenses } from './economy';
import { phaseIndex } from './furniture';
import { addGauge, addMoney, moneyText, notify, text, type SimContext } from './helpers';
import { sideRng, type Rng } from './rng';

/*
 * Filiales : la startup investit sa trésorerie pour créer d'autres startups.
 *
 * Tout le hasard des filiales passe par `ventureRng`, un générateur créé à la volée à
 * partir de la graine de la partie, de la filiale et du sprint. Le générateur principal
 * (`ctx.rng`) n'est jamais utilisé ici : une partie sans filiale tire exactement les mêmes
 * nombres qu'avant l'ajout de la fonctionnalité, et ses replays restent valides.
 */

/** Générateur dédié, reproductible : même graine, même filiale, même sprint ⇒ même tirage. */
function ventureRng(state: GameState, key: string): Rng {
  return sideRng(state.seed, 'venture', key, state.sprint);
}

/** Projet proposé pendant la planification, avec son coût. */
export interface VentureOffer {
  readonly idea: VentureIdea;
  readonly cost: number;
}

export function activeVentures(state: GameState): Venture[] {
  return state.ventures.filter((venture) => venture.status === 'ACTIVE');
}

/** Ailes du bureau : une par filiale fondée (elles restent après une revente ou une faillite). */
export function officeWings(state: GameState): number {
  return Math.min(state.ventures.length, VENTURES.maxFounded);
}

/** Les filiales sont-elles débloquées (Série A atteinte) ? */
export function venturesUnlocked(state: GameState): boolean {
  return phaseIndex(state.phase) >= phaseIndex(VENTURES.unlockPhase) && state.phase !== 'END';
}

/**
 * Projets du sprint : un prudent, un audacieux, un moonshot, jamais un projet déjà fondé.
 * Fonction pure de (graine, sprint, filiales fondées) : l'interface et la simulation
 * retrouvent les mêmes projets sans rien stocker dans l'état.
 */
export function ventureOffers(state: GameState): VentureOffer[] {
  if (!venturesUnlocked(state)) return [];
  const rng = ventureRng(state, 'ideas');
  const founded = new Set(state.ventures.map((venture) => venture.ideaId));
  const offers: VentureOffer[] = [];
  for (const risk of VENTURE_RISKS) {
    const pool = VENTURE_IDEAS.filter((idea) => idea.risk === risk && !founded.has(idea.id));
    const roll = rng.next();
    const idea = pool[Math.floor(roll * pool.length)];
    const { min, max } = VENTURES.risks[risk].cost;
    const cost = Math.round(rng.range(min, max) / 50_000) * 50_000;
    if (idea) offers.push({ idea, cost });
  }
  return offers.slice(0, VENTURES.ideasPerSprint);
}

/**
 * Pourquoi on ne peut pas créer de filiale maintenant (`null` si c'est possible).
 * Le coût n'est vérifié qu'au moment du choix d'un projet (`foundVenture`).
 */
export function ventureBlocker(state: GameState): CommandError | null {
  if (!venturesUnlocked(state)) return 'LOCKED';
  if (state.stage !== 'PLANNING') return 'WRONG_STAGE';
  if (state.ventures.length >= VENTURES.maxFounded) return 'VENTURE_LIMIT';
  if (state.sprint > state.totalSprints - VENTURES.closedLastSprints) return 'TOO_LATE';
  if (
    state.lastVentureSprint !== null &&
    state.sprint - state.lastVentureSprint < VENTURES.cooldownSprints
  )
    return 'COOLDOWN';
  return null;
}

/** Trésorerie disponible pour investir : on garde toujours quelques mois de salaires. */
export function investableCash(state: GameState): number {
  return state.gauges.treasury - monthlyExpenses(state) * VENTURES.minRunwayMonthsAfter;
}

export function foundVenture(state: GameState, ctx: SimContext, ideaId: string): CommandResult {
  const blocker = ventureBlocker(state);
  if (blocker) return { ok: false, error: blocker };
  const offer = ventureOffers(state).find((candidate) => candidate.idea.id === ideaId);
  if (!offer) return { ok: false, error: 'INVALID_CHOICE' };
  if (offer.cost > investableCash(state)) return { ok: false, error: 'NOT_ENOUGH_MONEY' };
  const { idea, cost } = offer;
  addMoney(state, -cost);
  const venture: Venture = {
    id: `v${state.ventures.length + 1}`,
    ideaId: idea.id,
    name: { fr: idea.name.fr, en: idea.name.en },
    risk: idea.risk,
    invested: cost,
    stake: VENTURES.stake,
    // On finance tout le premier tour : nos parts valent exactement la mise.
    valuation: Math.round(cost / VENTURES.stake),
    foundedAtSprint: state.sprint,
    status: 'ACTIVE',
    dividends: 0,
    soldFor: null,
    closedAtSprint: null,
    history: [],
  };
  state.ventures.push(venture);
  state.lastVentureSprint = state.sprint;
  state.stats.venturesFounded += 1;
  addGauge(state, 'hype', VENTURES.hypeOnCreate);
  state.valuation = computeValuation(state);
  notify(
    state,
    ctx,
    'VENTURE_FOUNDED',
    text(
      [
        'Nouvelle filiale : {name} ({amount} investis). Ton bureau gagne une aile.',
        'New subsidiary: {name} ({amount} invested). Your office gets a new wing.',
      ],
      { name: venture.name, amount: moneyText(cost) },
    ),
  );
  return { ok: true };
}

/** Prix de revente de nos parts. */
export function salePrice(venture: Venture): number {
  return Math.round(venture.valuation * venture.stake * VENTURES.saleDiscount);
}

function closeVentureSale(state: GameState, ctx: SimContext, venture: Venture, price: number) {
  addMoney(state, price);
  venture.status = 'SOLD';
  venture.soldFor = price;
  venture.closedAtSprint = state.sprint;
  state.stats.ventureCashIn += price;
  notify(
    state,
    ctx,
    'VENTURE_SOLD',
    text(['Parts de {name} revendues pour {amount}.', 'Stake in {name} sold for {amount}.'], {
      name: venture.name,
      amount: moneyText(price),
    }),
  );
}

export function sellVenture(state: GameState, ctx: SimContext, ventureId: string): CommandResult {
  if (state.stage !== 'PLANNING' && state.stage !== 'DEMO')
    return { ok: false, error: 'WRONG_STAGE' };
  const venture = state.ventures.find((candidate) => candidate.id === ventureId);
  if (venture?.status !== 'ACTIVE') return { ok: false, error: 'NOT_FOUND' };
  closeVentureSale(state, ctx, venture, salePrice(venture));
  state.valuation = computeValuation(state);
  return { ok: true };
}

/**
 * Dernier recours avant la faillite : les parts des filiales sont bradées (à moitié prix)
 * jusqu'à repasser au-dessus de zéro. Renvoie vrai si la startup est sauvée.
 */
export function emergencySale(state: GameState, ctx: SimContext): boolean {
  for (const venture of activeVentures(state)) {
    if (state.gauges.treasury >= 0) break;
    closeVentureSale(state, ctx, venture, Math.round(salePrice(venture) / 2));
  }
  return state.gauges.treasury >= 0;
}

function killVenture(state: GameState, ctx: SimContext, venture: Venture): void {
  venture.status = 'DEAD';
  venture.valuation = 0;
  venture.closedAtSprint = state.sprint;
  addGauge(state, 'hype', VENTURES.hypeOnDeath);
  notify(
    state,
    ctx,
    'VENTURE_DIED',
    text(
      [
        '{name} a coulé. « Notre incroyable aventure » est terminée, dit le post LinkedIn.',
        '{name} went under. "Our incredible journey" is over, says the LinkedIn post.',
      ],
      { name: venture.name },
    ),
  );
}

/** Modifie la valorisation d'une filiale (cartes) dans ses bornes. */
export function changeVentureValuation(venture: Venture, factor: number): void {
  venture.valuation = Math.round(
    Math.min(VENTURES.maxValuation, Math.max(1, venture.valuation * factor)),
  );
}

/**
 * Fin de sprint : chaque filiale active grandit (ou rétrécit), peut couler, et verse des
 * dividendes une fois installée et rentable.
 */
export function ventureSprint(state: GameState, ctx: SimContext): void {
  let dividends = 0;
  for (const venture of activeVentures(state)) {
    const rng = ventureRng(state, venture.id);
    const profile = VENTURES.risks[venture.risk];
    // Une filiale ne coule pas pendant son premier sprint.
    if (venture.foundedAtSprint < state.sprint && rng.chance(profile.deathChance)) {
      killVenture(state, ctx, venture);
      venture.history.push(0);
      continue;
    }
    changeVentureValuation(venture, rng.range(profile.growth.min, profile.growth.max));
    venture.history.push(venture.valuation);
    const age = state.sprint - venture.foundedAtSprint;
    const startValuation = venture.invested / venture.stake;
    if (
      age >= VENTURES.dividendsAfterSprints &&
      venture.valuation >= startValuation * VENTURES.dividendsMinMultiple
    ) {
      const amount = Math.round(venture.valuation * venture.stake * profile.dividendRate);
      venture.dividends += amount;
      dividends += amount;
    }
  }
  if (dividends > 0) {
    addMoney(state, dividends);
    state.stats.ventureCashIn += dividends;
    notify(
      state,
      ctx,
      'VENTURE_DIVIDENDS',
      text(['Dividendes des filiales : {amount}.', 'Dividends from subsidiaries: {amount}.'], {
        amount: moneyText(dividends),
      }),
    );
  }
}

/** Filiale visée par les cartes : la dernière créée encore en vie. */
export function latestActiveVenture(state: GameState): Venture | undefined {
  return activeVentures(state).at(-1);
}
