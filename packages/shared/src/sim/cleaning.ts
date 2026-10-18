import { z } from 'zod';
import type { Phase } from '../game.js';
import type { LocalizedText } from '../i18n.js';
import { TIME } from './balance.js';

/**
 * Saleté du bureau et entreprise de nettoyage.
 *
 * Chaque jour de semaine, l'équipe présente au bureau salit les lieux : papiers d'emballage,
 * gobelets, canettes, boîtes de pizza… Plus on attend pour faire le ménage, plus la saleté
 * monte vite (« la saleté attire la saleté »). Elle se mesure de 0 à 100 % et ralentit les
 * devs présents au bureau (pas les télétravailleurs) : à 50 % de saleté, -20 % de travail.
 *
 * L'entreprise de nettoyage « Nickel Chrome » (3 personnes) fait le ménage :
 * - sur appel, le soir même à 19h, ou en express tout de suite (plus cher) ;
 * - avec un abonnement payé chaque semaine : 1, 2 ou 5 passages le soir.
 * Un passage dure quelques heures : les déchets disparaissent peu à peu, puis le bureau est
 * propre.
 *
 * Aucun tirage aléatoire : tout se calcule à partir de l'équipe présente et de l'heure.
 */

export const CLEANING = {
  /** Saleté apportée par chaque dev présent au bureau, par jour de semaine (en points de %). */
  dirtPerDevDay: 0.9,
  /** Saleté d'un bureau ouvert, même presque vide (courrier, cartons, poussière). */
  dirtPerOpenDay: 1,
  /** Saleté apportée par chaque chat du bureau, par jour (poils, croquettes, litière). */
  dirtPerPetDay: 0.6,
  /** Chaque jour de semaine sans ménage, la saleté monte 12 % plus vite… */
  growthPerDay: 0.12,
  /** … jusqu'à deux fois plus vite. */
  growthMax: 1,
  /** Heures d'ouverture du bureau (la saleté monte pendant ces heures). */
  openHour: 9,
  closeHour: 19,
  /** Travail perdu par un dev présent au bureau quand la saleté est à 100 %. */
  productivityLoss: 0.4,
  /** Seuil d'alerte : au-delà, l'équipe se plaint (une fois jusqu'au prochain ménage). */
  dirtyAlert: 50,
  /** Passage du soir : arrivée à 19h, 3 heures de ménage. */
  eveningHour: 19,
  visitTicks: 6,
  /** Passage express : arrivée au pas suivant, 2 heures de ménage pendant la journée. */
  expressTicks: 4,
  /** Prix d'un appel ponctuel, en nombre de passages d'abonnement. */
  callPriceFactor: 1.5,
  expressPriceFactor: 2.5,
  /** Supplément par aile de filiale ou annexe ouverte (plus de surface à nettoyer). */
  extraRoomPrice: 60,
} as const;

/** Prix d'un passage selon la taille du bureau (phase), avant remise. */
export const CLEANING_VISIT_PRICE: Record<Phase, number> = {
  GARAGE: 80,
  SEED: 180,
  SERIES_A: 350,
  UNICORN: 700,
  END: 700,
};

/** Une semaine de jeu, en ticks : l'abonnement est facturé à ce rythme. */
export const CLEANING_WEEK_TICKS = TIME.ticksPerDay * 7;

/** Les 3 personnes de l'entreprise de nettoyage (noms fixes, rendu et panneau). */
export const CLEANING_CREW = [
  { id: 'lead', name: 'Fatou', tool: 'cart' },
  { id: 'vacuum', name: 'Jean-Marc', tool: 'vacuum' },
  { id: 'mop', name: 'Lucía', tool: 'mop' },
] as const;
export type CleanerTool = (typeof CLEANING_CREW)[number]['tool'];

export const CLEANING_PLAN_IDS = ['cleaning-weekly', 'cleaning-twice', 'cleaning-daily'] as const;
export const CleaningPlanIdSchema = z.enum(CLEANING_PLAN_IDS);
export type CleaningPlanId = z.infer<typeof CleaningPlanIdSchema>;

export interface CleaningPlan {
  readonly id: CleaningPlanId;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  /** Jours de passage, de 1 (lundi) à 5 (vendredi), le soir à 19h. */
  readonly days: readonly number[];
  /** Remise sur le prix des passages, par rapport au tarif d'un passage. */
  readonly discount: number;
}

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

export const CLEANING_PLANS: readonly CleaningPlan[] = [
  {
    id: 'cleaning-weekly',
    name: t('Hebdomadaire', 'Weekly'),
    description: t(
      'Un passage le vendredi soir : le bureau repart propre chaque lundi.',
      'One visit on Friday evening: the office starts clean every Monday.',
    ),
    days: [5],
    discount: 0.1,
  },
  {
    id: 'cleaning-twice',
    name: t('Deux fois par semaine', 'Twice a week'),
    description: t(
      'Mardi et vendredi soir : la saleté ne dépasse presque jamais le seuil d’alerte.',
      'Tuesday and Friday evenings: dirt hardly ever reaches the alert level.',
    ),
    days: [2, 5],
    discount: 0.15,
  },
  {
    id: 'cleaning-daily',
    name: t('Tous les soirs', 'Every evening'),
    description: t(
      'Du lundi au vendredi soir : chaque matin, un bureau comme neuf.',
      'Monday to Friday evenings: a brand-new office every morning.',
    ),
    days: [1, 2, 3, 4, 5],
    discount: 0.25,
  },
];

export function getCleaningPlan(id: CleaningPlanId): CleaningPlan {
  return CLEANING_PLANS.find((plan) => plan.id === id) ?? (CLEANING_PLANS[0] as CleaningPlan);
}

/** Prix d'un passage pour un bureau de cette phase avec `extraRooms` ailes ou annexes. */
export function cleaningVisitPrice(phase: Phase, extraRooms = 0): number {
  return CLEANING_VISIT_PRICE[phase] + CLEANING.extraRoomPrice * Math.max(0, extraRooms);
}

/** Prix d'une semaine d'abonnement (arrondi à 10 €). */
export function cleaningWeeklyPrice(plan: CleaningPlan, visitPrice: number): number {
  return Math.round((visitPrice * plan.days.length * (1 - plan.discount)) / 10) * 10;
}

/** Prix d'un appel ponctuel, le soir même ou en express (arrondi à 10 €). */
export function cleaningCallPrice(visitPrice: number, express: boolean): number {
  const factor = express ? CLEANING.expressPriceFactor : CLEANING.callPriceFactor;
  return Math.round((visitPrice * factor) / 10) * 10;
}

/** Part du travail gardée par un dev présent au bureau, selon la saleté (0 à 100). */
export function dirtProductivity(dirt: number): number {
  const clamped = Math.min(100, Math.max(0, dirt));
  return 1 - (CLEANING.productivityLoss * clamped) / 100;
}

/** Multiplicateur de la vitesse de salissure après `days` jours de semaine sans ménage. */
export function dirtGrowth(days: number): number {
  return 1 + Math.min(CLEANING.growthMax, CLEANING.growthPerDay * Math.max(0, days));
}

/** Abonnement de ménage en cours. */
export const CleaningSubscriptionSchema = z.object({
  plan: CleaningPlanIdSchema,
  /** Tick jusqu'auquel l'abonnement est payé : la semaine suivante est facturée à ce moment-là. */
  paidUntil: z.number().int().nonnegative(),
  /** Sprint de la souscription. */
  since: z.number().int().min(1),
  /** Total payé pour cet abonnement. */
  totalPaid: z.number().nonnegative(),
});
export type CleaningSubscription = z.infer<typeof CleaningSubscriptionSchema>;

export const CleaningStateSchema = z.object({
  /** Saleté du bureau, de 0 (impeccable) à 100 %. */
  dirt: z.number().min(0).max(100),
  /** Jours de semaine écoulés depuis le dernier ménage (la saleté monte de plus en plus vite). */
  daysSinceClean: z.number().int().nonnegative(),
  /** L'équipe s'est déjà plainte de la saleté depuis le dernier ménage. */
  alerted: z.boolean(),
  plan: CleaningSubscriptionSchema.nullable(),
  /** Appel ponctuel réservé : l'équipe arrive à ce tick. */
  booking: z.object({ start: z.number().int().nonnegative(), express: z.boolean() }).nullable(),
  /** Ménage en cours : du tick `start` au tick `end` (exclu), saleté de départ `from`. */
  visit: z
    .object({
      start: z.number().int().nonnegative(),
      end: z.number().int().nonnegative(),
      from: z.number().min(0).max(100),
      express: z.boolean(),
    })
    .nullable(),
  /** Passages effectués depuis le début de la partie. */
  visits: z.number().int().nonnegative(),
  /** Dépensé en ménage depuis le début de la partie (appels et abonnements). */
  spent: z.number().nonnegative(),
});
export type CleaningState = z.infer<typeof CleaningStateSchema>;

/** Bureau propre, sans abonnement : début de partie et vieilles sauvegardes. */
export function emptyCleaningState(): CleaningState {
  return {
    dirt: 0,
    daysSinceClean: 0,
    alerted: false,
    plan: null,
    booking: null,
    visit: null,
    visits: 0,
    spent: 0,
  };
}
