import { z } from 'zod';
import type { Phase } from '../game.js';
import type { LocalizedText } from '../i18n.js';
import { TIME } from './balance.js';
import { getFurniture, type FurnitureEffects } from './furniture.js';

/**
 * Salle des serveurs et abonnement fibre.
 *
 * Le joueur achète une salle (un local vitré au sol technique, posé comme un meuble) puis choisit
 * le matériel qu'il y installe : serveurs, switch, box fibre, climatisation, onduleur,
 * sauvegardes, pare-feu… Chaque équipement prend un emplacement de la salle, comme un appareil
 * sur un plan de travail (voir `serverRoom` et `serverGear` dans `furniture.ts`).
 *
 * Une salle ne tourne que si elle a au moins un serveur, du réseau et de la climatisation : sans
 * elle, les serveurs surchauffent et aucun équipement de la salle ne donne son effet. Les
 * serveurs d'une salle qui tourne hébergent une partie du produit : la facture d'hébergement
 * (`serverCostPerUserMonthly`) baisse.
 *
 * La fibre est un abonnement payé chaque semaine (tous les 7 jours de jeu). Elle arrive dans la
 * box fibre : sans box posée dans une salle des serveurs, la ligne est payée mais ne sert à rien.
 * Si la trésorerie ne couvre plus la facture, l'opérateur coupe la ligne.
 *
 * Aucun tirage aléatoire : une partie sans salle ni fibre reste identique (replays, Daily).
 */

/** Familles d'équipements de la salle des serveurs. */
export const SERVER_GEAR_KINDS = [
  'server',
  'network',
  'cooling',
  'power',
  'storage',
  'security',
] as const;
export type ServerGearKind = (typeof SERVER_GEAR_KINDS)[number];

/** Ce qu'il faut dans une salle pour qu'elle tourne. */
export const SERVER_ROOM_NEEDS = [
  'server',
  'network',
  'cooling',
] as const satisfies readonly ServerGearKind[];
export type ServerRoomNeed = (typeof SERVER_ROOM_NEEDS)[number];

/** La box fibre : sans elle (posée dans une salle), l'abonnement ne sert à rien. */
export const FIBRE_BOX_ID = 'fibre-router';

/** Une semaine de jeu, en ticks : la fibre est facturée à ce rythme. */
export const FIBRE_WEEK_TICKS = TIME.ticksPerDay * 7;

/** Plafond de la baisse de la facture d'hébergement (les serveurs ne remplacent pas tout le cloud). */
export const HOSTING_SAVING_MAX = 0.4;

export const FIBRE_PLAN_IDS = ['fibre-essential', 'fibre-pro', 'fibre-dedicated'] as const;
export const FibrePlanIdSchema = z.enum(FIBRE_PLAN_IDS);
export type FibrePlanId = z.infer<typeof FibrePlanIdSchema>;

export interface FibrePlan {
  readonly id: FibrePlanId;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  /** Débit annoncé, pour l'affichage. */
  readonly speed: LocalizedText;
  /** Prix payé chaque semaine de jeu. */
  readonly weeklyPrice: number;
  readonly minPhase: Phase;
  /** Effets tant que la ligne arrive dans une box fibre (mêmes unités que le mobilier). */
  readonly effects: Pick<FurnitureEffects, 'teamProductivity' | 'stabilityPerDay' | 'hypePerDay'>;
}

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

export const FIBRE_PLANS: readonly FibrePlan[] = [
  {
    id: 'fibre-essential',
    name: t('Fibre Essentiel', 'Fibre Essential'),
    description: t(
      'Les déploiements ne prennent plus la pause café : +1 % de productivité, +stabilité.',
      'Deploys no longer take a coffee break: +1% productivity, +stability.',
    ),
    speed: t('1 Gb/s', '1 Gb/s'),
    weeklyPrice: 400,
    minPhase: 'SEED',
    effects: { teamProductivity: 0.01, stabilityPerDay: 0.03 },
  },
  {
    id: 'fibre-pro',
    name: t('Fibre Pro', 'Fibre Pro'),
    description: t(
      'Débit symétrique, IP fixe, support qui décroche : +2 % de productivité, +stabilité.',
      'Symmetric speed, static IP, support that answers: +2% productivity, +stability.',
    ),
    speed: t('2 Gb/s symétrique', '2 Gb/s symmetric'),
    weeklyPrice: 900,
    minPhase: 'SEED',
    effects: { teamProductivity: 0.02, stabilityPerDay: 0.06 },
  },
  {
    id: 'fibre-dedicated',
    name: t('Fibre dédiée', 'Dedicated fibre'),
    description: t(
      'Une ligne rien qu’à vous, rétablie en 4 h garanties : +3 % de productivité, +stabilité, +hype.',
      'A line all to yourselves, fixed within 4 h guaranteed: +3% productivity, +stability, +hype.',
    ),
    speed: t('10 Gb/s garantis', '10 Gb/s guaranteed'),
    weeklyPrice: 2500,
    minPhase: 'SERIES_A',
    effects: { teamProductivity: 0.03, stabilityPerDay: 0.12, hypePerDay: 0.02 },
  },
];

export function getFibrePlan(id: FibrePlanId): FibrePlan {
  return FIBRE_PLANS.find((plan) => plan.id === id) ?? (FIBRE_PLANS[0] as FibrePlan);
}

/** Abonnement fibre en cours. */
export const FibreSubscriptionSchema = z.object({
  plan: FibrePlanIdSchema,
  /** Tick jusqu'auquel la ligne est payée : la semaine suivante est facturée à ce moment-là. */
  paidUntil: z.number().int().nonnegative(),
  /** Sprint de la souscription. */
  since: z.number().int().min(1),
  /** Total payé pour la fibre depuis la souscription. */
  totalPaid: z.number().nonnegative(),
});
export type FibreSubscription = z.infer<typeof FibreSubscriptionSchema>;

export function isServerRoom(itemId: string): boolean {
  return getFurniture(itemId)?.serverRoom === true;
}

export function serverGearKind(itemId: string): ServerGearKind | undefined {
  return getFurniture(itemId)?.serverGear;
}

/** Un objet posé, tel que le voient la simulation et l'interface. */
export interface ServerRoomItem {
  readonly id: string;
  readonly itemId: string;
  /** Équipement : la salle qui l'accueille. */
  readonly hostId?: string;
}

/** Une salle des serveurs et ce qu'elle contient. */
export interface ServerRoomStatus {
  readonly id: string;
  readonly itemId: string;
  /** Équipements installés (identifiants des objets posés), dans l'ordre d'achat. */
  readonly gear: readonly string[];
  /** Ce qui manque pour qu'elle tourne (vide : elle tourne). */
  readonly missing: readonly ServerRoomNeed[];
  readonly running: boolean;
}

/** État de chaque salle des serveurs posée : son matériel et ce qui lui manque. */
export function serverRooms(items: readonly ServerRoomItem[]): ServerRoomStatus[] {
  return items
    .filter((item) => !item.hostId && isServerRoom(item.itemId))
    .map((room) => {
      const gear = items.filter((item) => item.hostId === room.id);
      const kinds = new Set<ServerGearKind | undefined>(
        gear.map((item) => serverGearKind(item.itemId)),
      );
      const missing = SERVER_ROOM_NEEDS.filter((need) => !kinds.has(need));
      return {
        id: room.id,
        itemId: room.itemId,
        gear: gear.map((item) => item.id),
        missing,
        running: missing.length === 0,
      };
    });
}

/** Une box fibre est-elle posée dans une salle des serveurs ? */
export function hasFibreBox(items: readonly ServerRoomItem[]): boolean {
  const rooms = new Set(
    items.filter((item) => !item.hostId && isServerRoom(item.itemId)).map((item) => item.id),
  );
  return items.some(
    (item) => item.itemId === FIBRE_BOX_ID && item.hostId !== undefined && rooms.has(item.hostId),
  );
}
