/**
 * Salle des serveurs et abonnement fibre côté simulation : effets du matériel des salles qui
 * tournent, économies d'hébergement, souscription et facturation hebdomadaire de la fibre. Les
 * règles (ce qu'il faut pour qu'une salle tourne, les offres) sont dans `@oss/shared`
 * (`serverRoom.ts`), partagées avec l'interface. Aucun tirage aléatoire.
 */
import {
  FIBRE_WEEK_TICKS,
  HOSTING_SAVING_MAX,
  getFibrePlan,
  getFurniture,
  hasFibreBox,
  serverRooms,
  type CommandResult,
  type FibrePlanId,
  type FurnitureEffects,
  type GameState,
  type ServerRoomItem,
  type ServerRoomStatus,
} from '@oss/shared';
import { query } from './ecs';
import { phaseIndex } from './furniture';
import { addMoney, moneyText, notify, text, type SimContext } from './helpers';

/** Objets posés, dans l'ordre d'achat, sous la forme attendue par `serverRooms`. */
export function serverRoomItems(state: GameState): ServerRoomItem[] {
  return query(state, 'furniture').flatMap((id) => {
    const placed = state.components.furniture[id];
    if (!placed) return [];
    return [
      {
        id,
        itemId: placed.itemId,
        ...(placed.hostId !== undefined ? { hostId: placed.hostId } : {}),
      },
    ];
  });
}

/** Les salles des serveurs posées, leur matériel et ce qui leur manque. */
export function serverRoomStatuses(state: GameState): ServerRoomStatus[] {
  return serverRooms(serverRoomItems(state));
}

/** Effets du matériel installé dans les salles qui tournent (les autres surchauffent). */
export function serverGearEffects(state: GameState): FurnitureEffects[] {
  const effects: FurnitureEffects[] = [];
  for (const room of serverRoomStatuses(state)) {
    if (!room.running) continue;
    for (const id of room.gear) {
      const placed = state.components.furniture[id];
      const item = placed ? getFurniture(placed.itemId) : undefined;
      if (item) effects.push(item.effects);
    }
  }
  return effects;
}

/** Part de la facture d'hébergement épargnée grâce aux serveurs maison (plafonnée). */
export function hostingSaving(state: GameState): number {
  const total = serverGearEffects(state).reduce((sum, e) => sum + (e.hostingSaving ?? 0), 0);
  return Math.min(HOSTING_SAVING_MAX, total);
}

/** La fibre arrive-t-elle quelque part ? (abonnement en cours et box posée dans une salle) */
export function fibreConnected(state: GameState): boolean {
  return state.fibre !== null && hasFibreBox(serverRoomItems(state));
}

/** Effets de la fibre : ceux de l'offre souscrite, si la ligne arrive dans une box. */
export function fibreEffects(state: GameState): FurnitureEffects | null {
  if (!state.fibre || !fibreConnected(state)) return null;
  return getFibrePlan(state.fibre.plan).effects;
}

/** Coût mensuel de la fibre (30 jours de jeu), pour le calcul des mois de trésorerie. */
export function fibreMonthly(state: GameState): number {
  return state.fibre ? (getFibrePlan(state.fibre.plan).weeklyPrice * 30) / 7 : 0;
}

/**
 * Souscrit à une offre fibre, ou passe à une autre : la première semaine de la nouvelle offre est
 * payée tout de suite (la semaine entamée de l'ancienne n'est pas remboursée). Il faut une box
 * fibre posée dans une salle des serveurs.
 */
export function subscribeFibre(
  state: GameState,
  ctx: SimContext,
  planId: FibrePlanId,
): CommandResult {
  if (state.stage === 'PITCH') return { ok: false, error: 'WRONG_STAGE' };
  const plan = getFibrePlan(planId);
  if (phaseIndex(state.phase) < phaseIndex(plan.minPhase)) return { ok: false, error: 'LOCKED' };
  if (state.fibre?.plan === planId) return { ok: false, error: 'NOT_ELIGIBLE' };
  if (!hasFibreBox(serverRoomItems(state))) return { ok: false, error: 'NOT_ELIGIBLE' };
  if (state.gauges.treasury < plan.weeklyPrice) return { ok: false, error: 'NOT_ENOUGH_MONEY' };
  addMoney(state, -plan.weeklyPrice);
  const changed = state.fibre !== null;
  state.fibre = {
    plan: planId,
    paidUntil: state.tick + FIBRE_WEEK_TICKS,
    since: changed && state.fibre ? state.fibre.since : state.sprint,
    totalPaid: (state.fibre?.totalPaid ?? 0) + plan.weeklyPrice,
  };
  notify(
    state,
    ctx,
    'FIBRE_SUBSCRIBED',
    text(
      changed
        ? ['Nouvelle offre fibre : {plan} ({speed}).', 'New fibre plan: {plan} ({speed}).']
        : [
            'La fibre est arrivée : {plan} ({speed}), {price} par semaine.',
            'Fibre is in: {plan} ({speed}), {price} a week.',
          ],
      { plan: plan.name, speed: plan.speed, price: moneyText(plan.weeklyPrice) },
    ),
  );
  return { ok: true };
}

/** Résilie l'abonnement : la ligne est coupée tout de suite, sans remboursement. */
export function cancelFibre(state: GameState, ctx: SimContext): CommandResult {
  if (state.stage === 'PITCH') return { ok: false, error: 'WRONG_STAGE' };
  if (!state.fibre) return { ok: false, error: 'NOT_FOUND' };
  state.fibre = null;
  notify(
    state,
    ctx,
    'FIBRE_CANCELLED',
    text(['Abonnement fibre résilié.', 'Fibre subscription cancelled.']),
  );
  return { ok: true };
}

/**
 * Facture de la fibre, chaque semaine de jeu (7 jours après la précédente). Si la trésorerie ne
 * la couvre pas, l'opérateur coupe la ligne plutôt que de pousser la startup à la faillite.
 */
export function fibreSystem(state: GameState, ctx: SimContext): void {
  const fibre = state.fibre;
  if (!fibre || state.tick < fibre.paidUntil) return;
  const plan = getFibrePlan(fibre.plan);
  if (state.gauges.treasury < plan.weeklyPrice) {
    state.fibre = null;
    notify(
      state,
      ctx,
      'FIBRE_CUT',
      text([
        'Facture fibre impayée : l’opérateur a coupé la ligne.',
        'Unpaid fibre bill: the provider cut the line.',
      ]),
    );
    return;
  }
  addMoney(state, -plan.weeklyPrice);
  fibre.paidUntil += FIBRE_WEEK_TICKS;
  fibre.totalPaid += plan.weeklyPrice;
}
