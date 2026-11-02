/**
 * Salle des serveurs côté simulation : température et effets du matériel des salles, économies
 * d'hébergement, alertes de la sonde de supervision. Les règles (ce qu'il faut pour qu'une salle
 * tourne, la température) sont dans `@oss/shared` (`serverRoom.ts`), partagées avec
 * l'interface. L'abonnement internet est un abonnement comme les autres (`subscriptions.ts`).
 * Aucun tirage aléatoire.
 */
import {
  HOSTING_SAVING_MAX,
  civilFromDays,
  getFurniture,
  isSummerMonth,
  overheatStability,
  serverRooms,
  type FurnitureEffects,
  type GameState,
  type ServerHeatLevel,
  type ServerRoomItem,
  type ServerRoomStatus,
} from '@oss/shared';
import { query } from './ecs';
import { notify, text, type SimContext } from './helpers';
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
