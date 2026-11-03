import { z } from 'zod';
import type { LocalizedText } from '../i18n.js';

/**
 * Modèle économique du produit : comment la startup fait payer ses utilisateurs.
 *
 * Le joueur choisit un **modèle** (gratuit avec pub, freemium, abonnement, achat unique) et un
 * **niveau de prix** (bas, standard, premium). C'est le dilemme argent contre croissance :
 * - plus le produit rapporte par utilisateur, moins il en attire et plus ils partent vite ;
 * - la valorisation suit surtout le nombre d'utilisateurs, la trésorerie suit le revenu.
 *
 * Freemium au prix standard reproduit exactement l'ancienne économie (tous les coefficients à 1) :
 * c'est le réglage par défaut, une partie qui n'y touche pas reste identique (replays, Daily).
 *
 * Changer de modèle ou de prix se fait une fois par sprint. Monter les prix fait fuir une partie
 * des utilisateurs tout de suite et coûte de la hype ; les baisser donne un peu de hype.
 *
 * Aucun tirage aléatoire.
 */

export const PRICING_MODELS = ['FREE_ADS', 'FREEMIUM', 'SUBSCRIPTION', 'ONE_TIME'] as const;
export const PricingModelSchema = z.enum(PRICING_MODELS);
export type PricingModel = z.infer<typeof PricingModelSchema>;

export const PRICE_TIERS = ['LOW', 'STANDARD', 'PREMIUM'] as const;
export const PriceTierSchema = z.enum(PRICE_TIERS);
export type PriceTier = z.infer<typeof PriceTierSchema>;

/** Effet d'un modèle ou d'un niveau de prix, en coefficients (1 = économie d'origine). */
export interface PricingFactors {
  /** Revenu mensuel par utilisateur. */
  readonly arpu: number;
  /** Utilisateurs gagnés : livraisons de la démo et croissance organique. */
  readonly acquisition: number;
  /** Départs quotidiens d'utilisateurs. */
  readonly churn: number;
}

export interface PricingModelInfo extends PricingFactors {
  readonly id: PricingModel;
  readonly icon: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  /** Achat unique : prix payé une fois par chaque nouvel utilisateur (avant le niveau de prix). */
  readonly oneTimePrice: number;
  /**
   * Valeur d'un utilisateur aux yeux des investisseurs (1 = freemium) : un client qui paie vaut
   * plus qu'un visiteur qui regarde de la pub.
   */
  readonly userValue: number;
}

export const PRICING_MODEL_INFO: Readonly<Record<PricingModel, PricingModelInfo>> = {
  FREE_ADS: {
    id: 'FREE_ADS',
    icon: '📺',
    name: { fr: 'Gratuit avec pub', en: 'Free with ads' },
    description: {
      fr: 'Tout le monde vient, presque personne ne paie. La pub rapporte des miettes.',
      en: 'Everyone shows up, almost nobody pays. Ads bring in crumbs.',
    },
    arpu: 0.4,
    acquisition: 1.3,
    churn: 0.85,
    oneTimePrice: 0,
    userValue: 0.55,
  },
  FREEMIUM: {
    id: 'FREEMIUM',
    icon: '🎁',
    name: { fr: 'Freemium', en: 'Freemium' },
    description: {
      fr: 'Gratuit pour commencer, une option payante pour les fans. Le choix équilibré.',
      en: 'Free to start, a paid tier for the fans. The balanced choice.',
    },
    arpu: 1,
    acquisition: 1,
    churn: 1,
    oneTimePrice: 0,
    userValue: 1,
  },
  SUBSCRIPTION: {
    id: 'SUBSCRIPTION',
    icon: '💳',
    name: { fr: 'Abonnement', en: 'Subscription' },
    description: {
      fr: 'Tout le monde paie chaque mois : la caisse se remplit, mais on attire moins de monde.',
      en: 'Everyone pays monthly: cash flows in, but fewer people sign up.',
    },
    arpu: 2.4,
    acquisition: 0.7,
    churn: 1.25,
    oneTimePrice: 0,
    userValue: 1.5,
  },
  ONE_TIME: {
    id: 'ONE_TIME',
    icon: '🏷️',
    name: { fr: 'Achat unique', en: 'One-time purchase' },
    description: {
      fr: 'Chaque nouvel utilisateur paie une fois. Gros encaissements à la démo, peu de revenu ensuite.',
      en: 'Each new user pays once. Big cash at demos, little revenue afterwards.',
    },
    arpu: 0.15,
    acquisition: 0.85,
    churn: 0.75,
    oneTimePrice: 9,
    userValue: 1.15,
  },
};

export interface PriceTierInfo extends PricingFactors {
  readonly id: PriceTier;
  readonly name: LocalizedText;
  /** Valeur d'un utilisateur pour les investisseurs : un client premium vaut plus. */
  readonly userValue: number;
}

export const PRICE_TIER_INFO: Readonly<Record<PriceTier, PriceTierInfo>> = {
  LOW: {
    id: 'LOW',
    name: { fr: 'Bas', en: 'Low' },
    arpu: 0.7,
    acquisition: 1.12,
    churn: 0.92,
    userValue: 0.75,
  },
  STANDARD: {
    id: 'STANDARD',
    name: { fr: 'Standard', en: 'Standard' },
    arpu: 1,
    acquisition: 1,
    churn: 1,
    userValue: 1,
  },
  PREMIUM: {
    id: 'PREMIUM',
    name: { fr: 'Premium', en: 'Premium' },
    arpu: 1.45,
    acquisition: 0.82,
    churn: 1.12,
    userValue: 1.25,
  },
};

export const PRICING = {
  /**
   * Utilisateurs perdus tout de suite quand le revenu par utilisateur augmente : 12 % par
   * doublement du prix effectif, 35 % au plus.
   */
  raiseLossPerDoubling: 0.12,
  maxRaiseLoss: 0.35,
  /** Hype perdue quand les prix montent, gagnée quand ils baissent. */
  raiseHype: -5,
  cutHype: 3,
} as const;

export const PricingStateSchema = z.object({
  model: PricingModelSchema,
  tier: PriceTierSchema,
  /** Sprint du dernier changement (un seul par sprint), null si jamais changé. */
  changedSprint: z.number().int().nullable(),
  /** Nombre de changements dans la partie. */
  changes: z.number().int().min(0),
});
export type PricingState = z.infer<typeof PricingStateSchema>;

/** Freemium au prix standard : l'économie d'origine. */
export function defaultPricing(): PricingState {
  return { model: 'FREEMIUM', tier: 'STANDARD', changedSprint: null, changes: 0 };
}

/** Coefficients combinés d'un modèle et d'un niveau de prix. */
export function pricingFactors(model: PricingModel, tier: PriceTier): PricingFactors {
  const m = PRICING_MODEL_INFO[model];
  const t = PRICE_TIER_INFO[tier];
  return {
    arpu: m.arpu * t.arpu,
    acquisition: m.acquisition * t.acquisition,
    churn: m.churn * t.churn,
  };
}

/** Valeur d'un utilisateur pour la valorisation (1 = freemium au prix standard). */
export function userValue(model: PricingModel, tier: PriceTier): number {
  return PRICING_MODEL_INFO[model].userValue * PRICE_TIER_INFO[tier].userValue;
}

/** Prix payé une fois par chaque nouvel utilisateur (0 hors achat unique). */
export function oneTimePrice(model: PricingModel, tier: PriceTier): number {
  return PRICING_MODEL_INFO[model].oneTimePrice * PRICE_TIER_INFO[tier].arpu;
}

/**
 * Valeur d'un utilisateur pour la comparaison des prix : revenu mensuel, plus l'achat unique
 * étalé sur un an.
 */
function priceLevel(model: PricingModel, tier: PriceTier): number {
  return pricingFactors(model, tier).arpu + oneTimePrice(model, tier) / 12;
}

/**
 * Part des utilisateurs qui partent tout de suite en passant de l'ancien au nouveau réglage :
 * 0 si le prix baisse ou ne change pas.
 */
export function pricingChangeLoss(
  from: PricingState,
  model: PricingModel,
  tier: PriceTier,
): number {
  const before = priceLevel(from.model, from.tier);
  const after = priceLevel(model, tier);
  if (after <= before || before <= 0) return 0;
  return Math.min(PRICING.maxRaiseLoss, Math.log2(after / before) * PRICING.raiseLossPerDoubling);
}

/** Hype gagnée ou perdue en passant de l'ancien au nouveau réglage. */
export function pricingChangeHype(
  from: PricingState,
  model: PricingModel,
  tier: PriceTier,
): number {
  if (pricingChangeLoss(from, model, tier) > 0) return PRICING.raiseHype;
  return priceLevel(model, tier) < priceLevel(from.model, from.tier) ? PRICING.cutHype : 0;
}
