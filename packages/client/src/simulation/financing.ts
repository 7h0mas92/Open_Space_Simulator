import {
  FINANCING,
  FINANCING_KINDS,
  type CommandResult,
  type FinancingBlocker,
  type FinancingKind,
  type GameState,
} from '@oss/shared';
import { monthlyExpenses, monthlyRevenue } from './economy';
import {
  addGauge,
  addMoney,
  changeMoral,
  clamp,
  devIds,
  moneyText,
  notify,
  text,
  type SimContext,
} from './helpers';

/*
 * Financements hors tour de table : business angels, prêt bancaire, financement participatif
 * et subvention à l'innovation. Leurs conditions et leurs montants se calculent à partir de
 * l'état, sans aucun tirage : la simulation et l'interface retrouvent les mêmes offres, et
 * une partie qui ne s'en sert pas consomme exactement les mêmes nombres aléatoires.
 */

/** Une offre de financement, telle que l'interface la présente. */
export interface FinancingOffer {
  readonly kind: FinancingKind;
  /** Montant obtenu si on accepte maintenant (0 si indisponible faute de base de calcul). */
  readonly amount: number;
  /** Raison pour laquelle l'offre n'est pas disponible, sinon null. */
  readonly blocker: FinancingBlocker | null;
  /** Sprint à partir duquel l'offre revient (cooldown), sinon null. */
  readonly nextSprint: number | null;
  /** Part du capital cédée (business angels). */
  readonly dilution: number;
  /** Mensualité et durée (prêt). */
  readonly monthly: number;
  readonly months: number;
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/** Montant de chaque financement dans l'état actuel. */
export function financingAmount(state: GameState, kind: FinancingKind): number {
  switch (kind) {
    case 'BRIDGE':
      return roundTo(monthlyExpenses(state) * FINANCING.BRIDGE.months, 10_000);
    case 'LOAN': {
      const { revenueMonths, expenseMonths } = FINANCING.LOAN;
      return roundTo(
        Math.min(monthlyRevenue(state) * revenueMonths, monthlyExpenses(state) * expenseMonths),
        10_000,
      );
    }
    case 'CROWDFUNDING': {
      const c = FINANCING.CROWDFUNDING;
      const raw = (state.gauges.users * c.perUser * state.gauges.hype) / 60;
      return roundTo(clamp(raw, c.min, c.max), 10_000);
    }
    case 'GRANT':
      return FINANCING.GRANT.amount[state.phase];
  }
}

/** Mensualité d'un prêt de ce montant (intérêts compris). */
export function loanMonthly(amount: number): number {
  const { durationMonths, interest } = FINANCING.LOAN;
  return Math.round((amount * (1 + interest)) / durationMonths);
}

function cooldownEnd(state: GameState, kind: FinancingKind): number | null {
  const last = state.financing.lastSprint[kind];
  if (last === undefined) return null;
  const end = last + FINANCING[kind].cooldownSprints;
  return state.sprint < end ? end : null;
}

/** Ce qui empêche d'obtenir ce financement maintenant, sinon null. */
export function financingBlocker(state: GameState, kind: FinancingKind): FinancingBlocker | null {
  if (state.stage !== 'PLANNING') return 'WRONG_STAGE';
  if (cooldownEnd(state, kind) !== null) return 'COOLDOWN';
  const { hype, users, debt } = state.gauges;
  switch (kind) {
    case 'BRIDGE':
      return hype < FINANCING.BRIDGE.minHype ? 'NO_HYPE' : null;
    case 'LOAN':
      if (state.financing.loan) return 'LOAN_ACTIVE';
      return financingAmount(state, kind) < FINANCING.LOAN.minAmount ? 'NO_REVENUE' : null;
    case 'CROWDFUNDING':
      if (users < FINANCING.CROWDFUNDING.minUsers) return 'NOT_ENOUGH_USERS';
      return hype < FINANCING.CROWDFUNDING.minHype ? 'NO_HYPE' : null;
    case 'GRANT':
      if (financingAmount(state, kind) <= 0) return 'TOO_BIG';
      return debt > FINANCING.GRANT.maxDebt ? 'TOO_MUCH_DEBT' : null;
  }
}

/** Toutes les offres de financement, disponibles ou non. */
export function financingOffers(state: GameState): FinancingOffer[] {
  return FINANCING_KINDS.map((kind) => {
    const amount = financingAmount(state, kind);
    return {
      kind,
      amount,
      blocker: financingBlocker(state, kind),
      nextSprint: cooldownEnd(state, kind),
      dilution: kind === 'BRIDGE' ? FINANCING.BRIDGE.dilution : 0,
      monthly: kind === 'LOAN' ? loanMonthly(amount) : 0,
      months: kind === 'LOAN' ? FINANCING.LOAN.durationMonths : 0,
    };
  });
}

/** Accepte un financement hors tour de table (commande `TAKE_FINANCING`). */
export function takeFinancing(
  state: GameState,
  ctx: SimContext,
  kind: FinancingKind,
): CommandResult {
  const blocker = financingBlocker(state, kind);
  if (blocker === 'WRONG_STAGE' || blocker === 'COOLDOWN') return { ok: false, error: blocker };
  if (blocker !== null) return { ok: false, error: 'NOT_AVAILABLE' };
  const amount = financingAmount(state, kind);
  addMoney(state, amount);
  state.financing.lastSprint[kind] = state.sprint;
  switch (kind) {
    case 'BRIDGE': {
      // Les business angels prennent une petite part, sans compter comme un tour de table.
      state.ownership *= 1 - FINANCING.BRIDGE.dilution;
      state.totalRaised += amount;
      notify(
        state,
        ctx,
        'FUNDS_RAISED',
        text(
          [
            'Des business angels apportent {amount} pour {share} % du capital.',
            'Business angels bring in {amount} for {share}% of the company.',
          ],
          { amount: moneyText(amount), share: FINANCING.BRIDGE.dilution * 100 },
        ),
      );
      break;
    }
    case 'LOAN': {
      const monthly = loanMonthly(amount);
      state.financing.loan = { remaining: monthly * FINANCING.LOAN.durationMonths, monthly };
      notify(
        state,
        ctx,
        'FUNDS_RAISED',
        text(
          [
            'Prêt bancaire de {amount} accordé : {monthly} par mois pendant {months} mois.',
            'Bank loan of {amount} granted: {monthly} a month for {months} months.',
          ],
          {
            amount: moneyText(amount),
            monthly: moneyText(monthly),
            months: FINANCING.LOAN.durationMonths,
          },
        ),
      );
      break;
    }
    case 'CROWDFUNDING': {
      state.totalRaised += amount;
      addGauge(state, 'hype', FINANCING.CROWDFUNDING.hype);
      addGauge(state, 'debt', FINANCING.CROWDFUNDING.debt);
      notify(
        state,
        ctx,
        'FUNDS_RAISED',
        text(
          [
            'Campagne de financement participatif réussie : {amount} ! Il faut maintenant livrer les mugs promis.',
            'Crowdfunding campaign funded: {amount}! Now we have to ship the promised mugs.',
          ],
          { amount: moneyText(amount) },
        ),
      );
      break;
    }
    case 'GRANT': {
      for (const id of devIds(state)) changeMoral(state, id, FINANCING.GRANT.moral);
      notify(
        state,
        ctx,
        'FUNDS_RAISED',
        text(
          [
            'Subvention à l’innovation obtenue : {amount}. Le dossier faisait 80 pages.',
            'Innovation grant awarded: {amount}. The application was 80 pages long.',
          ],
          { amount: moneyText(amount) },
        ),
      );
      break;
    }
  }
  return { ok: true };
}
