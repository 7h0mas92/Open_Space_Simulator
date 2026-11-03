import { z } from 'zod';
import type { Phase } from '../game.js';
import type { LocalizedText } from '../i18n.js';
import { CLEANING_PLANS, CLEANING_VISIT_PRICE, cleaningWeeklyPrice } from './cleaning.js';
import type { FurnitureEffects } from './furniture.js';
import { SECURITY_PLANS } from './lobby.js';
import { FIBRE_PLANS, weeklyPrice } from './serverRoom.js';
import type { NotificationKind } from './state.js';

/**
 * Abonnements : le modèle commun des services payés à intervalle régulier (internet, ménage,
 * sécurité…), gérés depuis la rubrique « Abonnements ».
 *
 * - Un **service** (internet, ménage…) a plusieurs **offres** ; on a au plus un abonnement par
 *   service. Changer d'offre remplace l'abonnement du même service.
 * - La première période est payée à la souscription, puis chaque période (en jours de jeu) à
 *   l'échéance. Si la trésorerie ne couvre pas l'échéance, le prestataire coupe le service plutôt
 *   que de pousser la startup à la faillite. Résilier coupe tout de suite, sans remboursement.
 * - Une offre peut avoir des frais de mise en service (`setupFee`, payés une fois à la
 *   souscription) et une capacité (`maxUsers` salariés) : au-delà, le service sature, ne donne
 *   plus ses effets et ralentit l'équipe (voir `saturationPenalty` dans `serverRoom.ts`).
 * - Une offre peut demander une installation (`requires`, par exemple une box fibre posée dans une
 *   salle des serveurs) : sans elle, on ne peut pas souscrire, et un abonnement en cours est payé
 *   mais ne donne pas ses effets. La vérification est faite par la simulation
 *   (`client/src/simulation/subscriptions.ts`, `REQUIREMENT_CHECKS`).
 * - Le prix d'une offre peut suivre la partie (`PRICE_RULES` côté simulation, par exemple le
 *   ménage selon la taille du bureau) : `price` est alors le prix de départ, au garage.
 *
 * Ajouter un service : son identifiant dans `SUBSCRIPTION_SERVICES`, sa fiche dans
 * `SUBSCRIPTION_SERVICE_INFO`, ses offres dans `SUBSCRIPTION_OFFERS`, ses textes FR/EN dans
 * `i18n` (`subscriptions.services.<service>`) ; les autres systèmes lisent l'offre en cours avec
 * `activeOffer(state, service)` côté simulation.
 *
 * Aucun tirage aléatoire : une partie sans abonnement reste identique (replays, Daily).
 */

/** Les services auxquels on peut s'abonner, dans l'ordre d'affichage. */
export const SUBSCRIPTION_SERVICES = ['internet', 'cleaning', 'security'] as const;
export const SubscriptionServiceSchema = z.enum(SUBSCRIPTION_SERVICES);
export type SubscriptionService = z.infer<typeof SubscriptionServiceSchema>;

/** Installations qu'une offre peut demander (vérifiées par la simulation). */
export const SUBSCRIPTION_REQUIREMENTS = ['fibreBox', 'lobby'] as const;
export type SubscriptionRequirement = (typeof SUBSCRIPTION_REQUIREMENTS)[number];

/** Effets d'un abonnement actif (mêmes unités que le mobilier, appliqués chaque jour). */
export type SubscriptionEffects = Pick<
  FurnitureEffects,
  'moral' | 'teamProductivity' | 'quality' | 'hypePerDay' | 'stabilityPerDay' | 'debtPerDay'
>;

export interface SubscriptionOffer {
  readonly id: string;
  readonly service: SubscriptionService;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  /** Précision affichée à côté du nom (débit, fréquence de passage…). */
  readonly detail?: LocalizedText;
  /** Prix d'une période. */
  readonly price: number;
  /** Durée d'une période, en jours de jeu (7 : chaque semaine, 30 : chaque mois). */
  readonly periodDays: number;
  readonly minPhase: Phase;
  /** Frais de mise en service, payés une fois à la souscription (aucun par défaut). */
  readonly setupFee?: number;
  /** Salariés que l'offre supporte : au-delà, elle sature (pas de limite par défaut). */
  readonly maxUsers?: number;
  /** Installation sans laquelle on ne peut pas souscrire, ni profiter des effets. */
  readonly requires?: SubscriptionRequirement;
  readonly effects: SubscriptionEffects;
}

export interface SubscriptionServiceInfo {
  readonly id: SubscriptionService;
  readonly icon: string;
  /** Notifications émises (souscription ou changement, résiliation, coupure pour impayé). */
  readonly notifications: {
    readonly started: NotificationKind;
    readonly cancelled: NotificationKind;
    readonly cut: NotificationKind;
    /** Le service sature (trop de salariés pour l'offre), puis ne sature plus. */
    readonly saturated?: NotificationKind;
    readonly recovered?: NotificationKind;
  };
}

export const SUBSCRIPTION_SERVICE_INFO: Readonly<
  Record<SubscriptionService, SubscriptionServiceInfo>
> = {
  internet: {
    id: 'internet',
    icon: '🌐',
    notifications: {
      started: 'FIBRE_SUBSCRIBED',
      cancelled: 'FIBRE_CANCELLED',
      cut: 'FIBRE_CUT',
      saturated: 'INTERNET_SATURATED',
      recovered: 'INTERNET_OK',
    },
  },
  cleaning: {
    id: 'cleaning',
    icon: '🧹',
    notifications: {
      started: 'CLEANING_SUBSCRIBED',
      cancelled: 'CLEANING_CANCELLED',
      cut: 'CLEANING_CUT',
    },
  },
  security: {
    id: 'security',
    icon: '🛡️',
    notifications: {
      started: 'SECURITY_SUBSCRIBED',
      cancelled: 'SECURITY_CANCELLED',
      cut: 'SECURITY_CUT',
    },
  },
};

/** Toutes les offres, service par service. */
export const SUBSCRIPTION_OFFERS: readonly SubscriptionOffer[] = [
  // Internet : de la box 4G à la fibre dédiée (`serverRoom.ts`), prix mensuel prélevé chaque
  // semaine au prorata.
  ...FIBRE_PLANS.map((plan): SubscriptionOffer => ({
    id: plan.id,
    service: 'internet',
    name: plan.name,
    description: plan.description,
    detail: plan.speed,
    price: weeklyPrice(plan),
    periodDays: 7,
    minPhase: plan.minPhase,
    ...(plan.setupFee > 0 ? { setupFee: plan.setupFee } : {}),
    maxUsers: plan.maxUsers,
    ...(plan.needsRouter ? { requires: 'fibreBox' as const } : {}),
    effects: plan.effects,
  })),
  // Ménage : les passages du soir de l'entreprise de nettoyage (`cleaning.ts`). Pas d'effet
  // direct : le passage remet la saleté à zéro. Prix au garage, puis selon le bureau.
  ...CLEANING_PLANS.map((plan): SubscriptionOffer => ({
    id: plan.id,
    service: 'cleaning',
    name: plan.name,
    description: plan.description,
    detail: plan.detail,
    price: cleaningWeeklyPrice(plan, CLEANING_VISIT_PRICE.GARAGE),
    periodDays: 7,
    minPhase: 'GARAGE',
    effects: {},
  })),
  // Sécurité : les formules du hall d'entrée (`lobby.ts`), payées chaque semaine.
  ...SECURITY_PLANS.map((plan): SubscriptionOffer => ({
    id: plan.id,
    service: 'security',
    name: plan.name,
    description: plan.description,
    detail: plan.coverage,
    price: plan.weeklyPrice,
    periodDays: 7,
    minPhase: plan.minPhase,
    requires: 'lobby',
    effects: plan.effects,
  })),
];

export function getSubscriptionOffer(id: string): SubscriptionOffer | undefined {
  return SUBSCRIPTION_OFFERS.find((offer) => offer.id === id);
}

export function offersOf(service: SubscriptionService): SubscriptionOffer[] {
  return SUBSCRIPTION_OFFERS.filter((offer) => offer.service === service);
}

/** Ce que coûte la souscription : la première période et la mise en service. */
export function firstPayment(offer: SubscriptionOffer, price = offer.price): number {
  return price + (offer.setupFee ?? 0);
}

/** Coût d'une offre ramené à 30 jours de jeu (pour la trésorerie en mois). */
export function monthlyPrice(offer: SubscriptionOffer, price = offer.price): number {
  return (price * 30) / offer.periodDays;
}

/** Un abonnement en cours. */
export const SubscriptionSchema = z.object({
  /** Offre souscrite (voir `SUBSCRIPTION_OFFERS`). */
  offer: z.string().max(64),
  /** Tick jusqu'auquel le service est payé : la période suivante est facturée à ce moment-là. */
  paidUntil: z.number().int().nonnegative(),
  /** Sprint de la première souscription au service (gardé quand on change d'offre). */
  since: z.number().int().min(1),
  /** Total payé pour ce service depuis la souscription (mise en service comprise). */
  totalPaid: z.number().nonnegative(),
  /** Le service saturait au dernier pas (pour prévenir quand ça change ; absent = non). */
  saturated: z.boolean().optional(),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

/** Au plus un abonnement par service. */
export const SubscriptionsSchema = z.array(SubscriptionSchema).max(SUBSCRIPTION_SERVICES.length);
