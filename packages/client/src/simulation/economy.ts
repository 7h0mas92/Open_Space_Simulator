import {
  BALANCE,
  difficultyOf,
  endlessCostMultiplier,
  userValue,
  type GameState,
} from '@oss/shared';
import { devIds, teamSize } from './helpers';
import { receptionistsMonthly } from './lobby';
import { hostingSaving } from './serverRoom';
import { subscriptionsMonthly } from './subscriptions';
import { currentPricing } from './pricing';
import { clientsMonthly } from './clients';

/** Revenu mensuel par utilisateur, selon le modèle économique et le niveau de prix. */
export function arpuMonthly(state: GameState): number {
  return BALANCE.economy.arpuMonthly * currentPricing(state).arpu;
}

/** Revenu récurrent annuel (ARR), en euros : utilisateurs et contrats des clients B2B. */
export function annualRevenue(state: GameState): number {
  return (state.gauges.users * arpuMonthly(state) + clientsMonthly(state)) * 12;
}

/** Masse salariale mensuelle chargée (devs, et secrétaires de l'accueil). */
export function monthlyPayroll(state: GameState): number {
  let total = receptionistsMonthly(state);
  for (const id of devIds(state)) total += state.components.employment[id]?.salary ?? 0;
  return total;
}

/** Mensualité du prêt bancaire en cours (0 sans prêt). */
export function loanPayment(state: GameState): number {
  const loan = state.financing.loan;
  return loan ? Math.min(loan.monthly, loan.remaining) : 0;
}

/**
 * Rembourse le prêt pour `days` jours écoulés : la mensualité est comptée dans
 * `monthlyExpenses`, on retire ici ce qui a été payé du reste dû.
 */
export function repayLoan(state: GameState, days: number): void {
  const loan = state.financing.loan;
  if (!loan) return;
  loan.remaining = Math.max(0, loan.remaining - (loan.monthly * days) / 30);
  if (loan.remaining < 1) state.financing.loan = null;
}

/**
 * Facture d'hébergement mensuelle : elle suit le nombre d'utilisateurs, allégée par les serveurs
 * des salles qui tournent.
 */
export function hostingCost(state: GameState): number {
  const cost = state.gauges.users * BALANCE.economy.serverCostPerUserMonthly;
  const saving = hostingSaving(state);
  return saving > 0 ? cost * (1 - saving) : cost;
}

/**
 * Frais fixes mensuels de la phase (loyer, marketing...). En mode illimité, ils montent à
 * chaque sprint au-delà des 18 mois : la concurrence fait grimper les prix.
 */
export function fixedCosts(state: GameState): number {
  return (
    BALANCE.economy.fixedCostsMonthly[state.phase] * endlessCostMultiplier(state.mode, state.sprint)
  );
}

/**
 * Dépenses mensuelles totales : salaires, frais par dev, frais fixes, hébergement, prêt. Les
 * abonnements, payés à part à chaque échéance, n'y sont pas. Plus chères
 * en Hardcore (`difficultyOf`).
 */
export function monthlyExpenses(state: GameState): number {
  return (
    (monthlyPayroll(state) +
      teamSize(state) * BALANCE.economy.overheadPerDevMonthly +
      fixedCosts(state) +
      hostingCost(state) +
      loanPayment(state)) *
    difficultyOf(state.mode).expenses
  );
}

/**
 * Revenus mensuels des utilisateurs (selon le modèle économique), plus maigres en Hardcore. Les
 * achats uniques sont encaissés à l'arrivée de chaque utilisateur (`acquireUsers`).
 */
export function monthlyRevenue(state: GameState): number {
  return state.gauges.users * arpuMonthly(state) * difficultyOf(state.mode).revenue;
}

/**
 * Valorisation de la startup. Ce que regardent les investisseurs : les utilisateurs (un client
 * qui paie compte plus qu'un visiteur, selon le modèle économique) et le chiffre d'affaires,
 * gonflés par la hype, plombés par la dette et l'instabilité.
 */
export function computeValuation(state: GameState): number {
  const { valuation } = BALANCE;
  const { users, hype, debt, stability } = state.gauges;
  const raw =
    valuation.base +
    teamSize(state) * valuation.perDev +
    users * valuation.perUser * userValue(state.pricing.model, state.pricing.tier) +
    annualRevenue(state) * valuation.arrMultiple;
  const hypeFactor = 0.4 + hype / 60;
  const debtFactor = 1 - debt / 200;
  const stabilityFactor = 0.75 + stability / 400;
  return Math.round(raw * hypeFactor * debtFactor * stabilityFactor) + portfolioValue(state);
}

/**
 * Valeur des parts détenues dans les filiales actives. Elle s'ajoute à la valorisation :
 * une startup qui a des filiales devient un groupe.
 */
export function portfolioValue(state: GameState): number {
  let total = 0;
  for (const venture of state.ventures) {
    if (venture.status === 'ACTIVE') total += Math.round(venture.valuation * venture.stake);
  }
  return total;
}

/** Nombre de mois de trésorerie restants au rythme actuel (Infinity si rentable). */
export function runwayMonths(state: GameState): number {
  const burn =
    monthlyExpenses(state) +
    subscriptionsMonthly(state) -
    monthlyRevenue(state) -
    clientsMonthly(state) * difficultyOf(state.mode).revenue;
  if (burn <= 0) return Number.POSITIVE_INFINITY;
  return state.gauges.treasury / burn;
}
