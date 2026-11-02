/**
 * Abonnements côté simulation : souscription, changement d'offre, résiliation, facturation à
 * chaque échéance et effets des abonnements actifs. Le catalogue (services, offres) est dans
 * `@oss/shared` (`subscriptions.ts`), partagé avec l'interface. Aucun tirage aléatoire.
 */
import {
  SUBSCRIPTION_SERVICE_INFO,
  TIME,
  firstPayment,
  getSubscriptionOffer,
  hasFibreBox,
  monthlyPrice,
  saturationPenalty,
  type CommandResult,
  type GameState,
  type LocalizedText,
  type Subscription,
  type SubscriptionEffects,
  type SubscriptionOffer,
  type SubscriptionRequirement,
  type SubscriptionService,
} from '@oss/shared';
import { phaseIndex } from './furniture';
import { addMoney, moneyText, notify, teamSize, text, type SimContext } from './helpers';
import { serverRoomItems } from './serverRoom';

/**
 * Comment vérifier chaque installation demandée par une offre. Un nouveau service qui demande
 * une installation ajoute sa ligne ici.
 */
export const REQUIREMENT_CHECKS: Readonly<
  Record<SubscriptionRequirement, (state: GameState) => boolean>
> = {
  fibreBox: (state) => hasFibreBox(serverRoomItems(state)),
};

export function requirementMet(state: GameState, offer: SubscriptionOffer): boolean {
  return offer.requires === undefined || REQUIREMENT_CHECKS[offer.requires](state);
}

/** L'abonnement en cours pour ce service, avec son offre. */
export function subscriptionOf(
  state: GameState,
  service: SubscriptionService,
): { subscription: Subscription; offer: SubscriptionOffer } | null {
  for (const subscription of state.subscriptions) {
    const offer = getSubscriptionOffer(subscription.offer);
    if (offer?.service === service) return { subscription, offer };
  }
  return null;
}

/**
 * L'offre en cours pour ce service, seulement si elle donne ses effets (installation présente).
 * C'est ce que lisent les autres systèmes (ménage, sécurité…).
 */
export function activeOffer(
  state: GameState,
  service: SubscriptionService,
): SubscriptionOffer | null {
  const current = subscriptionOf(state, service);
  return current && requirementMet(state, current.offer) ? current.offer : null;
}

/**
 * Salariés qui utilisent un service : toute l'équipe (pour internet, ceux en télétravail passent
 * par le VPN du bureau, le compte ne bouge donc pas chaque matin).
 */
export function serviceUsers(state: GameState): number {
  return teamSize(state);
}

/** Charge d'une offre : salariés sur salariés supportés (au-delà de 1 : saturée), 0 sans limite. */
export function offerLoad(state: GameState, offer: SubscriptionOffer): number {
  return offer.maxUsers ? serviceUsers(state) / offer.maxUsers : 0;
}

/**
 * Effets des abonnements actifs (ceux dont l'installation est présente). Une offre saturée ne
 * donne plus ses effets et ralentit l'équipe.
 */
export function subscriptionEffects(state: GameState): SubscriptionEffects[] {
  return state.subscriptions.flatMap((subscription) => {
    const offer = getSubscriptionOffer(subscription.offer);
    if (!offer || !requirementMet(state, offer)) return [];
    const penalty = saturationPenalty(offerLoad(state, offer));
    return [penalty > 0 ? { teamProductivity: -penalty } : offer.effects];
  });
}

/** Coût des abonnements ramené à 30 jours de jeu, pour le calcul des mois de trésorerie. */
export function subscriptionsMonthly(state: GameState): number {
  return state.subscriptions.reduce((sum, subscription) => {
    const offer = getSubscriptionOffer(subscription.offer);
    return sum + (offer ? monthlyPrice(offer) : 0);
  }, 0);
}

/** « par semaine », « par mois » ou « tous les N jours ». */
export function periodText(days: number): LocalizedText {
  if (days === 7) return text(['par semaine', 'a week']);
  if (days === 30) return text(['par mois', 'a month']);
  return text(['tous les {days} jours', 'every {days} days'], { days });
}

/**
 * Souscrit à une offre, ou passe à une autre offre du même service : la première période de la
 * nouvelle offre et ses frais de mise en service sont payés tout de suite (la période entamée de
 * l'ancienne n'est pas remboursée).
 */
export function subscribe(state: GameState, ctx: SimContext, offerId: string): CommandResult {
  if (state.stage === 'PITCH') return { ok: false, error: 'WRONG_STAGE' };
  const offer = getSubscriptionOffer(offerId);
  if (!offer) return { ok: false, error: 'NOT_FOUND' };
  if (phaseIndex(state.phase) < phaseIndex(offer.minPhase)) return { ok: false, error: 'LOCKED' };
  const previous = subscriptionOf(state, offer.service);
  if (previous?.offer.id === offer.id) return { ok: false, error: 'NOT_ELIGIBLE' };
  if (!requirementMet(state, offer)) return { ok: false, error: 'NOT_ELIGIBLE' };
  const cost = firstPayment(offer);
  if (state.gauges.treasury < cost) return { ok: false, error: 'NOT_ENOUGH_MONEY' };
  addMoney(state, -cost);
  const next: Subscription = {
    offer: offer.id,
    paidUntil: state.tick + offer.periodDays * TIME.ticksPerDay,
    since: previous?.subscription.since ?? state.sprint,
    totalPaid: (previous?.subscription.totalPaid ?? 0) + cost,
  };
  if (offer.maxUsers) next.saturated = offerLoad(state, offer) > 1;
  // Changer d'offre garde la place du service dans la liste (ordre de facturation).
  const index = previous ? state.subscriptions.indexOf(previous.subscription) : -1;
  if (index >= 0) state.subscriptions[index] = next;
  else state.subscriptions.push(next);
  const params = {
    offer: offer.name,
    detail: offer.detail ?? offer.name,
    price: moneyText(offer.price),
    period: periodText(offer.periodDays),
  };
  notify(
    state,
    ctx,
    SUBSCRIPTION_SERVICE_INFO[offer.service].notifications.started,
    previous
      ? text(['Nouvelle offre : {offer} ({detail}).', 'New plan: {offer} ({detail}).'], params)
      : text(
          [
            'Abonnement souscrit : {offer} ({detail}), {price} {period}.',
            'Subscribed: {offer} ({detail}), {price} {period}.',
          ],
          params,
        ),
  );
  return { ok: true };
}

/** Résilie l'abonnement d'un service : il s'arrête tout de suite, sans remboursement. */
export function cancelSubscription(
  state: GameState,
  ctx: SimContext,
  service: SubscriptionService,
): CommandResult {
  if (state.stage === 'PITCH') return { ok: false, error: 'WRONG_STAGE' };
  const current = subscriptionOf(state, service);
  if (!current) return { ok: false, error: 'NOT_FOUND' };
  state.subscriptions.splice(state.subscriptions.indexOf(current.subscription), 1);
  notify(
    state,
    ctx,
    SUBSCRIPTION_SERVICE_INFO[service].notifications.cancelled,
    text(['Abonnement résilié : {offer}.', 'Subscription cancelled: {offer}.'], {
      offer: current.offer.name,
    }),
  );
  return { ok: true };
}

/** Prévient quand une offre se met à saturer (trop de salariés), ou ne sature plus. */
function watchSaturation(
  state: GameState,
  ctx: SimContext,
  subscription: Subscription,
  offer: SubscriptionOffer,
): void {
  if (!offer.maxUsers) return;
  const saturated = offerLoad(state, offer) > 1;
  if (saturated === (subscription.saturated ?? false)) return;
  subscription.saturated = saturated;
  const kinds = SUBSCRIPTION_SERVICE_INFO[offer.service].notifications;
  const kind = saturated ? kinds.saturated : kinds.recovered;
  if (!kind) return;
  notify(
    state,
    ctx,
    kind,
    saturated
      ? text(
          [
            'Ça rame : {offer} supporte {max} personnes. Passe à une offre plus grosse.',
            'Everything is crawling: {offer} handles {max} people. Upgrade your plan.',
          ],
          { offer: offer.name, max: offer.maxUsers },
        )
      : text(['{offer} respire à nouveau.', '{offer} can breathe again.'], { offer: offer.name }),
  );
}

/**
 * Facture chaque abonnement à son échéance, dans l'ordre de souscription. Si la trésorerie ne
 * couvre pas la période, le prestataire coupe le service plutôt que de pousser la startup à la
 * faillite. Prévient aussi quand une offre sature.
 */
export function subscriptionSystem(state: GameState, ctx: SimContext): void {
  for (const subscription of [...state.subscriptions]) {
    const current = getSubscriptionOffer(subscription.offer);
    if (current) watchSaturation(state, ctx, subscription, current);
    if (state.tick < subscription.paidUntil) continue;
    const offer = getSubscriptionOffer(subscription.offer);
    if (!offer || state.gauges.treasury < offer.price) {
      state.subscriptions.splice(state.subscriptions.indexOf(subscription), 1);
      if (!offer) continue;
      notify(
        state,
        ctx,
        SUBSCRIPTION_SERVICE_INFO[offer.service].notifications.cut,
        text(
          [
            'Facture impayée : le prestataire a coupé {offer}.',
            'Unpaid bill: the provider cut {offer}.',
          ],
          { offer: offer.name },
        ),
      );
      continue;
    }
    addMoney(state, -offer.price);
    subscription.paidUntil += offer.periodDays * TIME.ticksPerDay;
    subscription.totalPaid += offer.price;
  }
}

/** Vieille sauvegarde : l'ancien abonnement fibre devient un abonnement internet. */
export function migrateLegacyFibre(state: GameState): void {
  const fibre = state.fibre;
  if (!fibre) return;
  state.fibre = null;
  if (state.subscriptions.some((s) => getSubscriptionOffer(s.offer)?.service === 'internet'))
    return;
  state.subscriptions.push({
    offer: fibre.plan,
    paidUntil: fibre.paidUntil,
    since: fibre.since,
    totalPaid: fibre.totalPaid,
  });
}
