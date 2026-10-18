/**
 * Salle des serveurs et abonnement internet côté simulation : température et effets du matériel
 * des salles, économies d'hébergement, souscription, saturation et facturation hebdomadaire de
 * la ligne. Les règles (ce qu'il faut pour qu'une salle tourne, la température, les offres) sont
 * dans `@oss/shared` (`serverRoom.ts`), partagées avec l'interface. Aucun tirage aléatoire.
 */
import {
  FIBRE_WEEK_TICKS,
  HOSTING_SAVING_MAX,
  civilFromDays,
  getFibrePlan,
  getFurniture,
  hasFibreBox,
  internetLoad,
  isSummerMonth,
  overheatStability,
  saturationPenalty,
  serverRooms,
  weeklyPrice,
  type CommandResult,
  type FibrePlanId,
  type FurnitureEffects,
  type GameState,
  type ServerHeatLevel,
  type ServerRoomItem,
  type ServerRoomStatus,
} from '@oss/shared';
import { query } from './ecs';
import { phaseIndex } from './furniture';
import { addMoney, moneyText, notify, teamSize, text, type SimContext } from './helpers';
import { calendarDay } from './systems/calendar';
import { getClock } from './time';

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

/** Été dans le calendrier de la partie (juin à août) : les salles des serveurs chauffent plus. */
export function isSummer(state: GameState): boolean {
  return isSummerMonth(civilFromDays(calendarDay(state, getClock(state).day)).month);
}

/** Les salles des serveurs posées : leur matériel, leur température, ce qui leur manque. */
export function serverRoomStatuses(state: GameState): ServerRoomStatus[] {
  return serverRooms(serverRoomItems(state), { summer: isSummer(state) });
}

/** Les effets d'un équipement, réduits quand sa salle chauffe. */
function scaled(effects: FurnitureEffects, factor: number): FurnitureEffects {
  if (factor === 1) return effects;
  const out: FurnitureEffects = {};
  for (const key of [
    'moral',
    'teamProductivity',
    'hypePerDay',
    'stabilityPerDay',
    'debtPerDay',
    'hostingSaving',
  ] as const) {
    const value = effects[key];
    if (value !== undefined) out[key] = value * factor;
  }
  return out;
}

/**
 * Effets du matériel installé dans les salles qui tournent (réduits si elles chauffent), et
 * stabilité perdue par celles où des serveurs surchauffent.
 */
export function serverGearEffects(state: GameState): FurnitureEffects[] {
  const effects: FurnitureEffects[] = [];
  for (const room of serverRoomStatuses(state)) {
    const crash = overheatStability(room);
    if (crash !== 0) effects.push({ stabilityPerDay: crash });
    if (!room.running) continue;
    for (const id of room.gear) {
      const placed = state.components.furniture[id];
      const item = placed ? getFurniture(placed.itemId) : undefined;
      if (item) effects.push(scaled(item.effects, room.efficiency));
    }
  }
  return effects;
}

/** Part de la facture d'hébergement épargnée grâce aux serveurs maison (plafonnée). */
export function hostingSaving(state: GameState): number {
  const total = serverGearEffects(state).reduce((sum, e) => sum + (e.hostingSaving ?? 0), 0);
  return Math.min(HOSTING_SAVING_MAX, total);
}

/**
 * Salariés qui utilisent la connexion : toute l'équipe, ceux en télétravail passant par le VPN
 * du bureau (le compte ne bouge donc pas chaque matin).
 */
export function internetUsers(state: GameState): number {
  return teamSize(state);
}

/**
 * La ligne arrive-t-elle ? Il faut un abonnement ; la fibre dédiée doit en plus arriver dans
 * une box fibre posée dans une salle des serveurs.
 */
export function fibreConnected(state: GameState): boolean {
  if (!state.fibre) return false;
  return !getFibrePlan(state.fibre.plan).needsRouter || hasFibreBox(serverRoomItems(state));
}

/** Charge de la ligne (salariés sur salariés supportés), 0 sans abonnement. */
export function fibreLoad(state: GameState): number {
  return state.fibre ? internetLoad(getFibrePlan(state.fibre.plan), internetUsers(state)) : 0;
}

/**
 * Effets de la ligne : ceux de l'offre si elle arrive et tient la charge ; saturée, elle ne
 * donne plus rien et ralentit l'équipe.
 */
export function fibreEffects(state: GameState): FurnitureEffects | null {
  if (!state.fibre || !fibreConnected(state)) return null;
  const penalty = saturationPenalty(fibreLoad(state));
  if (penalty > 0) return { teamProductivity: -penalty };
  return getFibrePlan(state.fibre.plan).effects;
}

/** Coût mensuel de l'abonnement, pour le calcul des mois de trésorerie. */
export function fibreMonthly(state: GameState): number {
  return state.fibre ? (weeklyPrice(getFibrePlan(state.fibre.plan)) * 30) / 7 : 0;
}

/** Ce que coûte la souscription à une offre : la première semaine et la mise en service. */
export function subscriptionCost(planId: FibrePlanId): number {
  const plan = getFibrePlan(planId);
  return weeklyPrice(plan) + plan.setupFee;
}

/**
 * Souscrit à une offre internet, ou passe à une autre : la première semaine de la nouvelle offre
 * et ses frais de mise en service sont payés tout de suite (la semaine entamée de l'ancienne
 * n'est pas remboursée). La fibre dédiée demande une box fibre posée dans une salle des serveurs.
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
  if (plan.needsRouter && !hasFibreBox(serverRoomItems(state)))
    return { ok: false, error: 'NOT_ELIGIBLE' };
  const cost = subscriptionCost(planId);
  if (state.gauges.treasury < cost) return { ok: false, error: 'NOT_ENOUGH_MONEY' };
  addMoney(state, -cost);
  const changed = state.fibre !== null;
  state.fibre = {
    plan: planId,
    paidUntil: state.tick + FIBRE_WEEK_TICKS,
    since: changed && state.fibre ? state.fibre.since : state.sprint,
    totalPaid: (state.fibre?.totalPaid ?? 0) + cost,
  };
  state.fibre.saturated = fibreLoad(state) > 1;
  notify(
    state,
    ctx,
    'FIBRE_SUBSCRIBED',
    text(
      changed
        ? ['Nouvelle offre internet : {plan} ({speed}).', 'New internet plan: {plan} ({speed}).']
        : [
            'Internet est arrivé : {plan} ({speed}), {price} par mois.',
            'Internet is in: {plan} ({speed}), {price} a month.',
          ],
      { plan: plan.name, speed: plan.speed, price: moneyText(plan.monthlyPrice) },
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
    text(['Abonnement internet résilié.', 'Internet subscription cancelled.']),
  );
  return { ok: true };
}

/**
 * Facture de la ligne, chaque semaine de jeu (7 jours après la précédente). Si la trésorerie ne
 * la couvre pas, l'opérateur coupe la ligne plutôt que de pousser la startup à la faillite.
 * Prévient aussi quand la ligne se met à saturer, ou ne sature plus.
 */
export function fibreSystem(state: GameState, ctx: SimContext): void {
  const fibre = state.fibre;
  if (!fibre) return;
  const plan = getFibrePlan(fibre.plan);
  const saturated = fibreLoad(state) > 1;
  if (saturated !== (fibre.saturated ?? false)) {
    fibre.saturated = saturated;
    notify(
      state,
      ctx,
      saturated ? 'INTERNET_SATURATED' : 'INTERNET_OK',
      saturated
        ? text(
            [
              'Le réseau rame : {plan} supporte {max} personnes au bureau. Passe à une offre plus grosse.',
              'The network is crawling: {plan} handles {max} people in the office. Upgrade your plan.',
            ],
            { plan: plan.name, max: plan.maxUsers },
          )
        : text(['Le réseau respire à nouveau.', 'The network can breathe again.']),
    );
  }
  if (state.tick < fibre.paidUntil) return;
  const price = weeklyPrice(plan);
  if (state.gauges.treasury < price) {
    state.fibre = null;
    notify(
      state,
      ctx,
      'FIBRE_CUT',
      text([
        'Facture internet impayée : l’opérateur a coupé la ligne.',
        'Unpaid internet bill: the provider cut the line.',
      ]),
    );
    return;
  }
  addMoney(state, -price);
  fibre.paidUntil += FIBRE_WEEK_TICKS;
  fibre.totalPaid += price;
}

const HEAT_ALERTS: Record<
  ServerHeatLevel,
  { kind: 'SERVER_ROOM_COOL' | 'SERVER_ROOM_WARM' | 'SERVER_ROOM_OVERHEAT'; text: [string, string] }
> = {
  cool: {
    kind: 'SERVER_ROOM_COOL',
    text: [
      'Salle des serveurs revenue à {temp} °C : tout va bien.',
      'Server room back to {temp} °C: all good.',
    ],
  },
  warm: {
    kind: 'SERVER_ROOM_WARM',
    text: [
      'Supervision : la salle des serveurs monte à {temp} °C, les serveurs ralentissent.',
      'Monitoring: the server room is up to {temp} °C, the servers are throttling.',
    ],
  },
  overheat: {
    kind: 'SERVER_ROOM_OVERHEAT',
    text: [
      'Alerte supervision : {temp} °C en salle des serveurs, arrêt d’urgence. Ajoute de la clim !',
      'Monitoring alert: {temp} °C in the server room, emergency shutdown. Add more cooling!',
    ],
  },
};

/**
 * Suit la température de chaque salle des serveurs : retient son dernier niveau (frais, chaud,
 * surchauffe) et, si une sonde de supervision est installée, prévient quand il change. Sans
 * sonde, personne ne remarque rien avant que la prod tombe.
 */
export function serverHeatSystem(state: GameState, ctx: SimContext): void {
  const rooms = serverRoomStatuses(state);
  if (rooms.length === 0 && Object.keys(state.serverHeat).length === 0) return;
  const known: Record<string, ServerHeatLevel> = {};
  for (const room of rooms) {
    // Une salle vide ou sans serveur n'a rien à surveiller.
    const level = room.missing.includes('server') ? 'cool' : room.level;
    known[room.id] = level;
    const before = state.serverHeat[room.id] ?? 'cool';
    if (level === before || !room.monitored) continue;
    const alert = HEAT_ALERTS[level];
    notify(
      state,
      ctx,
      alert.kind,
      text(alert.text, { temp: Math.round(room.temperature) }),
      room.id,
    );
  }
  state.serverHeat = known;
}
