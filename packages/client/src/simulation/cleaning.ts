/**
 * Saleté du bureau et entreprise de nettoyage côté simulation : la saleté qui monte pendant les
 * heures de bureau, le ménage (appel ponctuel, express ou abonnement) et la facture
 * hebdomadaire de l'abonnement. Les règles et les tarifs sont dans `@oss/shared`
 * (`cleaning.ts`), partagés avec l'interface. Aucun tirage aléatoire.
 */
import {
  CLEANING,
  CLEANING_WEEK_TICKS,
  TIME,
  VENTURES,
  annexCount,
  cleaningCallPrice,
  cleaningVisitPrice,
  cleaningWeeklyPrice,
  dirtGrowth,
  dirtProductivity,
  getCleaningPlan,
  type CleaningPlanId,
  type CommandResult,
  type EntityId,
  type GameState,
} from '@oss/shared';
import { addMoney, clamp, devIds, moneyText, notify, text, type SimContext } from './helpers';
import { getClock, type SimClock } from './time';

/** Ticks d'une journée de bureau (de l'ouverture à la fermeture). */
const OPEN_TICKS = (CLEANING.closeHour - CLEANING.openHour) * TIME.ticksPerHour;

/** Ailes de filiales et annexes ouvertes : autant de surface en plus à nettoyer. */
export function extraRooms(state: GameState): number {
  return Math.min(state.ventures.length, VENTURES.maxFounded) + annexCount(state.fundingRounds);
}

/** Prix d'un passage pour le bureau actuel. */
export function visitPrice(state: GameState): number {
  return cleaningVisitPrice(state.phase, extraRooms(state));
}

/** Prix de la semaine d'un abonnement, pour le bureau actuel. */
export function planWeeklyPrice(state: GameState, planId: CleaningPlanId): number {
  return cleaningWeeklyPrice(getCleaningPlan(planId), visitPrice(state));
}

/** Coût mensuel de l'abonnement (30 jours de jeu), pour le calcul des mois de trésorerie. */
export function cleaningMonthly(state: GameState): number {
  const plan = state.cleaning.plan;
  return plan ? (planWeeklyPrice(state, plan.plan) * 30) / 7 : 0;
}

/**
 * Le dev travaille-t-il dans un bureau sale ? Les télétravailleurs (et le Dev Fantôme) sont
 * chez eux, l'IA Agent n'a pas de nez.
 */
export function feelsDirt(state: GameState, devId: EntityId): boolean {
  if (devId in state.components.remote) return false;
  const role = state.components.identity[devId]?.role;
  return role !== 'AI_AGENT' && role !== 'GHOST';
}

/** Multiplicateur de productivité d'un dev, selon la saleté du bureau. */
export function dirtMultiplier(state: GameState, devId: EntityId): number {
  return feelsDirt(state, devId) ? dirtProductivity(state.cleaning.dirt) : 1;
}

/** Devs présents dans l'open space en ce moment (ceux qui salissent). */
function devsInOffice(state: GameState): number {
  let count = 0;
  for (const id of devIds(state)) {
    if (!feelsDirt(state, id)) continue;
    if (state.components.activity[id]?.kind === 'GONE') continue;
    count += 1;
  }
  return count;
}

/** Prochain passage du soir (19h) à partir de maintenant, en ticks. */
function nextEveningTick(state: GameState, clock: SimClock): number {
  const hoursLeft = CLEANING.eveningHour - clock.hour;
  const ticks = Math.round(hoursLeft * TIME.ticksPerHour);
  return state.tick + (ticks >= 0 ? ticks : ticks + TIME.ticksPerDay);
}

function startVisit(state: GameState, ctx: SimContext, express: boolean): void {
  const cleaning = state.cleaning;
  const length = express ? CLEANING.expressTicks : CLEANING.visitTicks;
  cleaning.visit = { start: state.tick, end: state.tick + length, from: cleaning.dirt, express };
  notify(
    state,
    ctx,
    'CLEANING_STARTED',
    text(
      express
        ? [
            'Nickel Chrome débarque en express : Fatou, Jean-Marc et Lucía attaquent le ménage.',
            'Nickel Chrome rushes in: Fatou, Jean-Marc and Lucía get cleaning.',
          ]
        : [
            'Nickel Chrome est là : Fatou, Jean-Marc et Lucía font le ménage.',
            'Nickel Chrome is here: Fatou, Jean-Marc and Lucía are cleaning up.',
          ],
    ),
  );
}

/**
 * Appelle l'entreprise de nettoyage : le soir même à 19h (le lendemain s'il est plus tard),
 * ou en express, tout de suite et plus cher. Payé à la réservation.
 */
export function callCleaning(state: GameState, ctx: SimContext, express: boolean): CommandResult {
  if (state.stage === 'PITCH' || state.stage === 'ENDED')
    return { ok: false, error: 'WRONG_STAGE' };
  const cleaning = state.cleaning;
  if (cleaning.booking || cleaning.visit) return { ok: false, error: 'NOT_ELIGIBLE' };
  const price = cleaningCallPrice(visitPrice(state), express);
  if (state.gauges.treasury < price) return { ok: false, error: 'NOT_ENOUGH_MONEY' };
  addMoney(state, -price);
  cleaning.spent += price;
  // En planification, le temps est arrêté : l'équipe passe au premier soir (ou pas) du sprint.
  const start = express ? state.tick : nextEveningTick(state, getClock(state));
  cleaning.booking = { start, express };
  notify(
    state,
    ctx,
    'CLEANING_BOOKED',
    text(
      express
        ? [
            'Ménage express commandé ({price}) : l’équipe arrive tout de suite.',
            'Express cleaning ordered ({price}): the crew is on its way.',
          ]
        : [
            'Ménage commandé ({price}) : Nickel Chrome passe ce soir à 19h.',
            'Cleaning booked ({price}): Nickel Chrome comes tonight at 7 pm.',
          ],
      { price: moneyText(price) },
    ),
  );
  return { ok: true };
}

/**
 * Souscrit à un abonnement de ménage, ou passe à un autre : la première semaine de la nouvelle
 * formule est payée tout de suite (la semaine entamée de l'ancienne n'est pas remboursée).
 */
export function subscribeCleaning(
  state: GameState,
  ctx: SimContext,
  planId: CleaningPlanId,
): CommandResult {
  if (state.stage === 'PITCH' || state.stage === 'ENDED')
    return { ok: false, error: 'WRONG_STAGE' };
  const current = state.cleaning.plan;
  if (current?.plan === planId) return { ok: false, error: 'NOT_ELIGIBLE' };
  const price = planWeeklyPrice(state, planId);
  if (state.gauges.treasury < price) return { ok: false, error: 'NOT_ENOUGH_MONEY' };
  addMoney(state, -price);
  state.cleaning.spent += price;
  state.cleaning.plan = {
    plan: planId,
    paidUntil: state.tick + CLEANING_WEEK_TICKS,
    since: current ? current.since : state.sprint,
    totalPaid: (current?.totalPaid ?? 0) + price,
  };
  const plan = getCleaningPlan(planId);
  notify(
    state,
    ctx,
    'CLEANING_SUBSCRIBED',
    text(
      current
        ? ['Nouvelle formule de ménage : {plan}.', 'New cleaning plan: {plan}.']
        : [
            'Abonnement Nickel Chrome : {plan}, {price} par semaine.',
            'Nickel Chrome subscription: {plan}, {price} a week.',
          ],
      { plan: plan.name, price: moneyText(price) },
    ),
  );
  return { ok: true };
}

/** Résilie l'abonnement de ménage tout de suite, sans remboursement. */
export function cancelCleaning(state: GameState, ctx: SimContext): CommandResult {
  if (state.stage === 'PITCH' || state.stage === 'ENDED')
    return { ok: false, error: 'WRONG_STAGE' };
  if (!state.cleaning.plan) return { ok: false, error: 'NOT_FOUND' };
  state.cleaning.plan = null;
  notify(
    state,
    ctx,
    'CLEANING_CANCELLED',
    text(['Abonnement de ménage résilié.', 'Cleaning subscription cancelled.']),
  );
  return { ok: true };
}

/** Facture de l'abonnement chaque semaine ; impayée, Nickel Chrome arrête de venir. */
function billPlan(state: GameState, ctx: SimContext): void {
  const plan = state.cleaning.plan;
  if (!plan || state.tick < plan.paidUntil) return;
  const price = planWeeklyPrice(state, plan.plan);
  if (state.gauges.treasury < price) {
    state.cleaning.plan = null;
    notify(
      state,
      ctx,
      'CLEANING_CUT',
      text([
        'Facture de ménage impayée : Nickel Chrome ne viendra plus.',
        'Unpaid cleaning bill: Nickel Chrome won’t come back.',
      ]),
    );
    return;
  }
  addMoney(state, -price);
  state.cleaning.spent += price;
  plan.paidUntil += CLEANING_WEEK_TICKS;
  plan.totalPaid += price;
}

/** La saleté monte pendant les heures de bureau, selon l'équipe présente et les chats. */
function getDirty(state: GameState, ctx: SimContext, clock: SimClock): void {
  const cleaning = state.cleaning;
  let gain = (state.pets.length * CLEANING.dirtPerPetDay) / TIME.ticksPerDay;
  const open =
    !clock.isWeekend && clock.hour >= CLEANING.openHour && clock.hour < CLEANING.closeHour;
  const present = open ? devsInOffice(state) : 0;
  if (present > 0) {
    gain +=
      ((CLEANING.dirtPerOpenDay + present * CLEANING.dirtPerDevDay) / OPEN_TICKS) *
      dirtGrowth(cleaning.daysSinceClean);
  }
  cleaning.dirt = clamp(cleaning.dirt + gain, 0, 100);
  // À la fermeture d'un jour de semaine, un jour de plus sans ménage.
  if (!clock.isWeekend && clock.hour === CLEANING.closeHour) cleaning.daysSinceClean += 1;
  if (!cleaning.alerted && cleaning.dirt >= CLEANING.dirtyAlert) {
    cleaning.alerted = true;
    notify(
      state,
      ctx,
      'OFFICE_DIRTY',
      text(
        [
          'Le bureau est sale ({dirt} %) : emballages, gobelets, boîtes de pizza… l’équipe travaille moins bien.',
          'The office is dirty ({dirt}%): wrappers, cups, pizza boxes… the team works worse.',
        ],
        { dirt: Math.round(cleaning.dirt) },
      ),
    );
  }
}

/** Le ménage en cours fait baisser la saleté peu à peu, jusqu'à zéro à la fin du passage. */
function clean(state: GameState, ctx: SimContext): void {
  const cleaning = state.cleaning;
  const visit = cleaning.visit;
  if (!visit) return;
  const length = Math.max(1, visit.end - visit.start);
  cleaning.dirt = clamp(cleaning.dirt - visit.from / length, 0, 100);
  if (state.tick + 1 < visit.end) return;
  cleaning.dirt = 0;
  cleaning.daysSinceClean = 0;
  cleaning.alerted = false;
  cleaning.visit = null;
  cleaning.visits += 1;
  notify(
    state,
    ctx,
    'CLEANING_DONE',
    text([
      'Ménage terminé : le bureau brille (merci Fatou, Jean-Marc et Lucía).',
      'Cleaning done: the office shines (thanks Fatou, Jean-Marc and Lucía).',
    ]),
  );
}

/** Le passage du soir de l'abonnement est-il prévu maintenant ? */
function planVisitDue(state: GameState, clock: SimClock): boolean {
  const plan = state.cleaning.plan;
  if (!plan || clock.hour !== CLEANING.eveningHour) return false;
  return getCleaningPlan(plan.plan).days.includes(clock.dayOfWeek);
}

/**
 * Système de ménage, à chaque pas : facture de l'abonnement, saleté, arrivée de l'équipe de
 * nettoyage (appel ou passage prévu), puis le ménage lui-même.
 */
export function cleaningSystem(state: GameState, ctx: SimContext, clock: SimClock): void {
  billPlan(state, ctx);
  getDirty(state, ctx, clock);
  const cleaning = state.cleaning;
  if (!cleaning.visit) {
    const booking = cleaning.booking;
    if (booking && state.tick >= booking.start) {
      cleaning.booking = null;
      startVisit(state, ctx, booking.express);
    } else if (planVisitDue(state, clock)) {
      startVisit(state, ctx, false);
    }
  }
  clean(state, ctx);
}
