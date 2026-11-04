import { z } from 'zod';
import type { Phase } from '../game.js';
import type { LocalizedText } from '../i18n.js';
import { TIME } from './balance.js';
import { getFurniture, type FurnitureEffects } from './furniture.js';

/**
 * Salle des serveurs, température et offres internet.
 *
 * Le joueur achète une salle (un local vitré au sol technique, posé comme un meuble) puis choisit
 * le matériel qu'il y installe : serveurs, switch, box fibre, climatisations, supervision,
 * onduleur, sauvegardes, pare-feu… Chaque équipement prend un emplacement de la salle, comme un
 * appareil sur un plan de travail (voir `serverRoom` et `serverGear` dans `furniture.ts`).
 *
 * Une salle ne tourne que si elle a au moins un serveur, du réseau et de la climatisation, et si
 * elle ne surchauffe pas : chaque appareil chauffe, chaque clim refroidit, et la température suit
 * le rapport des deux (voir `roomTemperature`). Une salle qui chauffe ne donne qu'une partie de
 * ses effets ; en surchauffe, les serveurs plantent et la prod en pâtit. La sonde de supervision
 * affiche la température, prévient quand elle monte et limite les dégâts. Les serveurs d'une
 * salle qui tourne hébergent une partie du produit : la facture d'hébergement baisse.
 *
 * L'abonnement internet va de la box 4G à la fibre dédiée, à des prix d'opérateurs réels. Il est
 * payé chaque semaine (tous les 7 jours de jeu), plus des frais de mise en service. Chaque offre
 * supporte un nombre de salariés : au-delà, la ligne sature et ralentit tout le monde.
 * La fibre dédiée arrive dans la box fibre d'une salle des serveurs. Si la trésorerie ne couvre
 * plus la facture, l'opérateur coupe la ligne. Pour ne pas casser les sauvegardes, l'état et les
 * commandes gardent le nom « fibre » (`state.fibre`, `SUBSCRIBE_FIBRE`) quelle que soit l'offre.
 *
 * Aucun tirage aléatoire : une partie sans salle ni abonnement reste identique (replays, Daily).
 */

/** Familles d'équipements de la salle des serveurs. */
export const SERVER_GEAR_KINDS = [
  'server',
  'network',
  'cooling',
  'monitoring',
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

/** La box fibre : sans elle (posée dans une salle), la fibre dédiée ne sert à rien. */
export const FIBRE_BOX_ID = 'fibre-router';

/** Une semaine de jeu, en ticks : l'abonnement internet est facturé à ce rythme. */
export const FIBRE_WEEK_TICKS = TIME.ticksPerDay * 7;

/** Plafond de la baisse de la facture d'hébergement (les serveurs ne remplacent pas tout le cloud). */
export const HOSTING_SAVING_MAX = 0.4;

export const FIBRE_PLAN_IDS = [
  'wifi-4g',
  'wifi-5g',
  'fibre-essential',
  'fibre-pro',
  'fibre-dedicated',
  'fibre-dedicated-10g',
] as const;
export const FibrePlanIdSchema = z.enum(FIBRE_PLAN_IDS);
export type FibrePlanId = z.infer<typeof FibrePlanIdSchema>;

/** Technologie de la ligne : box mobile en Wi-Fi, fibre mutualisée (FTTH) ou dédiée (FTTO). */
export type InternetTechnology = 'mobile' | 'ftth' | 'ftto';

/**
 * Une offre internet professionnelle. Les prix sont ceux constatés chez les opérateurs français
 * pour les entreprises (hors taxes, 2026, à titre indicatif) : la facture est mensuelle dans la
 * vraie vie, le jeu la prélève chaque semaine au prorata (`weeklyPrice`).
 */
export interface FibrePlan {
  readonly id: FibrePlanId;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  /** Débit annoncé, pour l'affichage. */
  readonly speed: LocalizedText;
  readonly technology: InternetTechnology;
  /** Prix mensuel hors taxes, comme sur la grille de l'opérateur. */
  readonly monthlyPrice: number;
  /** Frais de mise en service, payés une fois à la souscription. */
  readonly setupFee: number;
  /** Salariés que la ligne supporte : au-delà, elle sature (voir `INTERNET_SATURATION`). */
  readonly maxUsers: number;
  readonly minPhase: Phase;
  /**
   * Fibre dédiée : elle arrive dans la box fibre d'une salle des serveurs. Les box 4G/5G et la
   * fibre mutualisée sont livrées avec leur box, branchée n'importe où.
   */
  readonly needsRouter: boolean;
  /** Effets tant que la ligne arrive et ne sature pas (mêmes unités que le mobilier). */
  readonly effects: Pick<FurnitureEffects, 'teamProductivity' | 'stabilityPerDay' | 'hypePerDay'>;
}

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

export const FIBRE_PLANS: readonly FibrePlan[] = [
  {
    id: 'wifi-4g',
    name: t('Box 4G Wi-Fi Pro', '4G Wi-Fi business box'),
    description: t(
      'Une box sur la fenêtre et du Wi-Fi pour 3 personnes. +0,5 % de productivité.',
      'A box on the windowsill and Wi-Fi for 3 people. +0.5% productivity.',
    ),
    speed: t('jusqu’à 150 Mb/s', 'up to 150 Mb/s'),
    technology: 'mobile',
    monthlyPrice: 39,
    setupFee: 0,
    maxUsers: 3,
    minPhase: 'GARAGE',
    needsRouter: false,
    effects: { teamProductivity: 0.005 },
  },
  {
    id: 'wifi-5g',
    name: t('Box 5G Pro', '5G business box'),
    description: t(
      'Rapide quand l’antenne est d’accord, pour 6 personnes. +1 % de productivité.',
      'Fast when the mast agrees, for 6 people. +1% productivity.',
    ),
    speed: t('jusqu’à 1 Gb/s', 'up to 1 Gb/s'),
    technology: 'mobile',
    monthlyPrice: 59,
    setupFee: 0,
    maxUsers: 6,
    minPhase: 'GARAGE',
    needsRouter: false,
    effects: { teamProductivity: 0.01 },
  },
  {
    id: 'fibre-essential',
    name: t('Fibre Pro', 'Business fibre'),
    description: t(
      'La fibre mutualisée avec sa box, pour 10 personnes : +1,5 % de productivité, +stabilité.',
      'Shared fibre with its own box, for 10 people: +1.5% productivity, +stability.',
    ),
    speed: t('2 Gb/s', '2 Gb/s'),
    technology: 'ftth',
    monthlyPrice: 49,
    setupFee: 0,
    maxUsers: 10,
    minPhase: 'SEED',
    needsRouter: false,
    effects: { teamProductivity: 0.015, stabilityPerDay: 0.03 },
  },
  {
    id: 'fibre-pro',
    name: t('Fibre Pro+', 'Business fibre+'),
    description: t(
      'IP fixe, secours 4G, rétablie en 4 h, pour 25 personnes : +2 % de productivité, +stabilité.',
      'Static IP, 4G backup, fixed within 4 h, for 25 people: +2% productivity, +stability.',
    ),
    speed: t('8 Gb/s', '8 Gb/s'),
    technology: 'ftth',
    monthlyPrice: 119,
    setupFee: 99,
    maxUsers: 25,
    minPhase: 'SEED',
    needsRouter: false,
    effects: { teamProductivity: 0.02, stabilityPerDay: 0.06 },
  },
  {
    id: 'fibre-dedicated',
    name: t('Fibre dédiée 1 Gb/s', 'Dedicated fibre 1 Gb/s'),
    description: t(
      'Une ligne rien qu’à vous, débit garanti, pour 60 personnes : +3 % de productivité, +stabilité, +hype.',
      'A line all to yourselves, guaranteed speed, for 60 people: +3% productivity, +stability, +hype.',
    ),
    speed: t('1 Gb/s garanti', '1 Gb/s guaranteed'),
    technology: 'ftto',
    monthlyPrice: 890,
    setupFee: 1500,
    maxUsers: 60,
    minPhase: 'SERIES_A',
    needsRouter: true,
    effects: { teamProductivity: 0.03, stabilityPerDay: 0.12, hypePerDay: 0.02 },
  },
  {
    id: 'fibre-dedicated-10g',
    name: t('Fibre dédiée 10 Gb/s', 'Dedicated fibre 10 Gb/s'),
    description: t(
      'Deux arrivées, 10 Gb/s garantis, pour 200 personnes : +4 % de productivité, +stabilité, +hype.',
      'Two entry points, 10 Gb/s guaranteed, for 200 people: +4% productivity, +stability, +hype.',
    ),
    speed: t('10 Gb/s garantis', '10 Gb/s guaranteed'),
    technology: 'ftto',
    monthlyPrice: 2600,
    setupFee: 3000,
    maxUsers: 200,
    minPhase: 'UNICORN',
    needsRouter: true,
    effects: { teamProductivity: 0.04, stabilityPerDay: 0.18, hypePerDay: 0.04 },
  },
];

/** Prix prélevé chaque semaine de jeu : le prix mensuel au prorata de 7 jours sur 30. */
export function weeklyPrice(plan: FibrePlan): number {
  return Math.round((plan.monthlyPrice * 7) / 30);
}

/**
 * Ligne saturée : plus de salariés que l'offre n'en supporte. Elle ne donne plus ses
 * effets et ralentit tout le monde, d'autant plus que la ligne est chargée (12 personnes sur une
 * offre pour 10 : charge 1,2, soit -3 % de productivité), dans la limite de `maxPenalty`.
 */
export const INTERNET_SATURATION = {
  /** Productivité perdue par point de charge au-delà de 1. */
  penaltyPerLoad: 0.15,
  maxPenalty: 0.12,
} as const;

/** Malus de productivité d'une ligne saturée (0 si elle tient la charge). */
export function saturationPenalty(load: number): number {
  if (load <= 1) return 0;
  return Math.min(INTERNET_SATURATION.maxPenalty, (load - 1) * INTERNET_SATURATION.penaltyPerLoad);
}

// --- Température des salles -----------------------------------------------------------------

/**
 * Chaque équipement chauffe (`heat`, en kW) et chaque climatisation refroidit (`cooling`, en kW,
 * voir `furniture.ts`). La température de la salle suit la charge thermique (chaleur sur froid) :
 * 18 °C à vide, 28 °C quand la clim tourne à fond, 3 °C de plus en été (juin à août). Au-dessus
 * de 27 °C la salle chauffe, au-dessus de 32 °C elle surchauffe.
 */
export const SERVER_HEAT = {
  baseTemperature: 18,
  /** Degrés gagnés quand la charge thermique passe de 0 à 1. */
  perLoad: 10,
  /** Été : l'air extérieur réchauffe la salle. */
  summer: 3,
  warmAbove: 27,
  overheatAbove: 32,
  /** Température affichée quand des appareils chauffent sans aucune clim. */
  noCooling: 45,
  /** Part des effets gardée quand la salle chauffe (sans, puis avec supervision). */
  warmFactor: 0.5,
  warmFactorMonitored: 0.75,
  /** Stabilité perdue chaque jour par une salle en surchauffe (sans, puis avec supervision). */
  overheatStability: -0.25,
  overheatStabilityMonitored: -0.1,
} as const;

export const SERVER_HEAT_LEVELS = ['cool', 'warm', 'overheat'] as const;
export const ServerHeatLevelSchema = z.enum(SERVER_HEAT_LEVELS);
export type ServerHeatLevel = z.infer<typeof ServerHeatLevelSchema>;

/** Température d'une salle selon la chaleur dégagée et le froid disponible, en °C. */
export function roomTemperature(heat: number, cooling: number, summer = false): number {
  const outside = summer ? SERVER_HEAT.summer : 0;
  if (heat <= 0) return SERVER_HEAT.baseTemperature + outside;
  if (cooling <= 0) return SERVER_HEAT.noCooling + outside;
  return SERVER_HEAT.baseTemperature + outside + (SERVER_HEAT.perLoad * heat) / cooling;
}

export function heatLevel(temperature: number): ServerHeatLevel {
  if (temperature > SERVER_HEAT.overheatAbove) return 'overheat';
  if (temperature > SERVER_HEAT.warmAbove) return 'warm';
  return 'cool';
}

/** Été dans la partie : juin, juillet ou août du calendrier de la graine. */
export function isSummerMonth(month: number): boolean {
  return month >= 6 && month <= 8;
}

/**
 * Ancien abonnement fibre, d'avant la rubrique Abonnements : repris dans `subscriptions` au
 * chargement des vieilles sauvegardes.
 */
export const FibreSubscriptionSchema = z.object({
  plan: FibrePlanIdSchema,
  /** Tick jusqu'auquel la ligne est payée : la semaine suivante est facturée à ce moment-là. */
  paidUntil: z.number().int().nonnegative(),
  /** Sprint de la souscription. */
  since: z.number().int().min(1),
  /** Total payé pour la ligne depuis la souscription (frais de mise en service compris). */
  totalPaid: z.number().nonnegative(),
});
export type FibreSubscription = z.infer<typeof FibreSubscriptionSchema>;

export function isServerRoom(itemId: string): boolean {
  return getFurniture(itemId)?.serverRoom === true;
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
  /** Ce qui manque pour qu'elle tourne (vide : rien ne manque). */
  readonly missing: readonly ServerRoomNeed[];
  /** Chaleur dégagée et froid disponible, en kW. */
  readonly heat: number;
  readonly cooling: number;
  /** Température de la salle, en °C. */
  readonly temperature: number;
  readonly level: ServerHeatLevel;
  /** Une sonde de supervision est installée : on voit la température et on est prévenu. */
  readonly monitored: boolean;
  /** Rien ne manque et elle ne surchauffe pas : son matériel donne ses effets. */
  readonly running: boolean;
  /** Part des effets que donne son matériel : 1, moins si elle chauffe, 0 si elle ne tourne pas. */
  readonly efficiency: number;
}

/** État de chaque salle des serveurs posée : son matériel, sa température, ce qui lui manque. */
export function serverRooms(
  items: readonly ServerRoomItem[],
  options: { readonly summer?: boolean } = {},
): ServerRoomStatus[] {
  return items
    .filter((item) => !item.hostId && isServerRoom(item.itemId))
    .map((room) => {
      const gear = items.filter((item) => item.hostId === room.id);
      const defs = gear.map((item) => getFurniture(item.itemId));
      const kinds = new Set<ServerGearKind | undefined>(defs.map((def) => def?.serverGear));
      const missing = SERVER_ROOM_NEEDS.filter((need) => !kinds.has(need));
      const heat = defs.reduce((sum, def) => sum + (def?.heat ?? 0), 0);
      const cooling = defs.reduce((sum, def) => sum + (def?.cooling ?? 0), 0);
      const temperature = roomTemperature(heat, cooling, options.summer);
      const level = heatLevel(temperature);
      const monitored = kinds.has('monitoring');
      const running = missing.length === 0 && level !== 'overheat';
      const efficiency = !running
        ? 0
        : level === 'warm'
          ? monitored
            ? SERVER_HEAT.warmFactorMonitored
            : SERVER_HEAT.warmFactor
          : 1;
      return {
        id: room.id,
        itemId: room.itemId,
        gear: gear.map((item) => item.id),
        missing,
        heat,
        cooling,
        temperature,
        level,
        monitored,
        running,
        efficiency,
      };
    });
}

/** Stabilité perdue chaque jour par une salle : seulement si des serveurs y surchauffent. */
export function overheatStability(room: ServerRoomStatus): number {
  if (room.level !== 'overheat' || room.missing.includes('server')) return 0;
  return room.monitored ? SERVER_HEAT.overheatStabilityMonitored : SERVER_HEAT.overheatStability;
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
