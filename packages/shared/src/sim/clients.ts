import { z } from 'zod';
import type { Phase } from '../game.js';
import type { LocalizedText } from '../i18n.js';

/**
 * Clients B2B : de grosses entreprises proposent des contrats à la startup.
 *
 * À chaque planification, jusqu'à 3 offres arrivent (dès le garage). Un contrat signé :
 * - rapporte une prime à la signature et un forfait mensuel tant qu'il court ;
 * - demande de livrer des points de travail d'un type précis (features, infra ou bugfix)
 *   avant une échéance en sprints : l'équipe y passe du temps qu'elle ne met pas ailleurs ;
 * - a un engagement de service (SLA) : chaque panne de prod coûte une pénalité, et après
 *   `CLIENTS.maxBreaches` pannes le client s'en va.
 * Livré à temps : prime de livraison, utilisateurs et hype, puis le client reste en maintenance
 * quelques sprints (une part du forfait chaque mois, SLA toujours dû) avant la fin du contrat. Échéance ratée ou contrat rompu : pénalité
 * et hype perdue.
 *
 * Les offres sont tirées sur une graine à part (`seed#clients#sprint`) : une partie qui ne signe
 * aucun contrat reste identique (replays, Daily).
 */

export const CLIENT_NEEDS = ['FEATURE', 'INFRA', 'BUGFIX'] as const;
export const ClientNeedSchema = z.enum(CLIENT_NEEDS);
export type ClientNeed = z.infer<typeof ClientNeedSchema>;

export const CLIENT_SIZES = ['SMALL', 'MEDIUM', 'LARGE'] as const;
export const ClientSizeSchema = z.enum(CLIENT_SIZES);
export type ClientSize = z.infer<typeof ClientSizeSchema>;

export const CLIENTS = {
  /** Offres proposées à chaque planification. */
  offersPerSprint: 3,
  /** Prime à la signature, en mois de forfait. */
  signingMonths: 1,
  /** Prime de livraison, en mois de forfait. */
  deliveryMonths: 2,
  /** Rupture (échéance ratée, abandon, trop de pannes) : pénalité en mois de forfait. */
  penaltyMonths: 2,
  /** Pénalité de SLA à chaque panne, en mois de forfait. */
  slaPenaltyMonths: 0.5,
  /** Pannes tolérées : à la suivante, le client part. */
  maxBreaches: 3,
  /** Part du forfait payée chaque mois en maintenance, une fois le travail livré… */
  maintenanceShare: 0.25,
  /** … pendant ce nombre de sprints, puis le contrat s'achève. */
  maintenanceSprints: 6,
  /** Hype à la livraison et à la rupture. */
  deliveryHype: 2,
  breakHype: -6,
} as const;

/** Contrats en cours (pas encore livrés) au plus, selon la phase. */
export const CLIENT_SLOTS: Record<Phase, number> = {
  GARAGE: 1,
  SEED: 2,
  SERIES_A: 3,
  UNICORN: 4,
  END: 0,
};

/** Forfait mensuel de base d'un petit contrat, selon la phase. */
export const CLIENT_BASE_FEE: Record<Phase, number> = {
  GARAGE: 4_000,
  SEED: 12_000,
  SERIES_A: 35_000,
  UNICORN: 100_000,
  END: 100_000,
};

/** Utilisateurs apportés à la livraison par un petit contrat, selon la phase. */
export const CLIENT_BASE_USERS: Record<Phase, number> = {
  GARAGE: 150,
  SEED: 700,
  SERIES_A: 3_500,
  UNICORN: 12_000,
  END: 12_000,
};

export interface ClientSizeInfo {
  readonly name: LocalizedText;
  /** Multiplicateur du forfait et des utilisateurs. */
  readonly scale: number;
  /** Points de travail demandés (min, max) avant la taille de l'équipe. */
  readonly points: readonly [number, number];
  /** Délai en sprints. */
  readonly sprints: number;
}

export const CLIENT_SIZE_INFO: Readonly<Record<ClientSize, ClientSizeInfo>> = {
  SMALL: { name: { fr: 'Petit contrat', en: 'Small deal' }, scale: 1, points: [3, 5], sprints: 2 },
  MEDIUM: {
    name: { fr: 'Contrat moyen', en: 'Medium deal' },
    scale: 2.4,
    points: [6, 9],
    sprints: 3,
  },
  LARGE: {
    name: { fr: 'Gros contrat', en: 'Big deal' },
    scale: 5,
    points: [10, 15],
    sprints: 4,
  },
};

export interface ClientCompany {
  readonly name: string;
  readonly icon: string;
  readonly sector: LocalizedText;
}

/** Entreprises clientes (toutes inventées). */
export const CLIENT_COMPANIES: readonly ClientCompany[] = [
  { name: 'Boulangeries Dupain', icon: '🥖', sector: { fr: 'boulangerie', en: 'bakery' } },
  { name: 'Mutuelle Ronronne', icon: '🐱', sector: { fr: 'assurance', en: 'insurance' } },
  { name: 'Banque Mollo', icon: '🏦', sector: { fr: 'banque', en: 'bank' } },
  {
    name: 'Ministère du Formulaire',
    icon: '🗂️',
    sector: { fr: 'administration', en: 'government' },
  },
  { name: 'Pizzeria Quattro Bugs', icon: '🍕', sector: { fr: 'restauration', en: 'restaurant' } },
  { name: 'TransLog Express', icon: '🚚', sector: { fr: 'logistique', en: 'logistics' } },
  { name: 'Clinique Bobo', icon: '🏥', sector: { fr: 'santé', en: 'healthcare' } },
  { name: 'Groupe Béton Armé', icon: '🏗️', sector: { fr: 'BTP', en: 'construction' } },
  { name: 'Lycée Numérique', icon: '🎓', sector: { fr: 'éducation', en: 'education' } },
  { name: 'Hôtel Wi-Fi Gratuit', icon: '🏨', sector: { fr: 'hôtellerie', en: 'hospitality' } },
  { name: 'Mairie de Sainte-Latence', icon: '🏛️', sector: { fr: 'collectivité', en: 'city hall' } },
  { name: 'Énergie Verte & Co', icon: '⚡', sector: { fr: 'énergie', en: 'energy' } },
  {
    name: 'Supermarché Prix Cassés',
    icon: '🛒',
    sector: { fr: 'grande distribution', en: 'retail' },
  },
  { name: 'Studio Pixel Parfait', icon: '🎮', sector: { fr: 'jeu vidéo', en: 'game studio' } },
  { name: 'Agence Voyage Lointain', icon: '✈️', sector: { fr: 'tourisme', en: 'travel' } },
  { name: 'Club de Foot du Dimanche', icon: '⚽', sector: { fr: 'sport', en: 'sports' } },
];

/** Ce que veut le client, selon le type de travail demandé. */
export const CLIENT_NEED_INFO: Readonly<Record<ClientNeed, { icon: string; ask: LocalizedText }>> =
  {
    FEATURE: {
      icon: '✨',
      ask: {
        fr: 'veut des features sur mesure, « juste un petit bouton ».',
        en: 'wants custom features, "just a tiny button".',
      },
    },
    INFRA: {
      icon: '🏗️',
      ask: {
        fr: 'exige une prod qui tient la charge de ses 40 000 salariés.',
        en: 'demands a platform that holds the load of its 40,000 staff.',
      },
    },
    BUGFIX: {
      icon: '🐛',
      ask: {
        fr: 'a remonté 300 bugs dans un tableur Excel et veut qu’ils disparaissent.',
        en: 'filed 300 bugs in a spreadsheet and wants them gone.',
      },
    },
  };

export const ClientOfferSchema = z.object({
  id: z.string().max(64),
  company: z.number().int().min(0),
  size: ClientSizeSchema,
  need: ClientNeedSchema,
  /** Points de travail du type demandé à livrer. */
  points: z.number().int().min(1),
  /** Délai en sprints à partir de la signature. */
  sprints: z.number().int().min(1),
  /** Forfait mensuel pendant le travail. */
  monthlyFee: z.number().min(0),
  /** Utilisateurs apportés à la livraison. */
  users: z.number().min(0),
});
export type ClientOffer = z.infer<typeof ClientOfferSchema>;

export const ClientContractSchema = ClientOfferSchema.extend({
  /** `ACTIVE` : travail en cours ; `DELIVERED` : livré, en maintenance. */
  status: z.enum(['ACTIVE', 'DELIVERED']),
  signedSprint: z.number().int(),
  /** Dernier sprint pour livrer (inclus : la démo de ce sprint compte). */
  dueSprint: z.number().int(),
  /** Points du type demandé livrés depuis la signature. */
  progress: z.number().min(0),
  /** Pannes de prod subies par ce client. */
  breaches: z.number().int().min(0),
  /** Sprint de la livraison (null tant que le travail n'est pas livré). */
  deliveredSprint: z.number().int().nullable(),
});
export type ClientContract = z.infer<typeof ClientContractSchema>;

export const ClientsStateSchema = z.object({
  offers: z.array(ClientOfferSchema),
  /** Sprint des offres en cours (null : pas encore tirées). */
  offersSprint: z.number().int().nullable(),
  contracts: z.array(ClientContractSchema),
  signed: z.number().int().min(0),
  delivered: z.number().int().min(0),
  lost: z.number().int().min(0),
  /** Tout ce que les clients ont payé (primes, forfaits), pénalités déduites. */
  earned: z.number(),
});
export type ClientsState = z.infer<typeof ClientsStateSchema>;

export function emptyClientsState(): ClientsState {
  return {
    offers: [],
    offersSprint: null,
    contracts: [],
    signed: 0,
    delivered: 0,
    lost: 0,
    earned: 0,
  };
}

/** Forfait mensuel payé par un contrat : plein pendant le travail, réduit en maintenance. */
export function contractMonthly(contract: Pick<ClientContract, 'status' | 'monthlyFee'>): number {
  return contract.status === 'ACTIVE'
    ? contract.monthlyFee
    : contract.monthlyFee * CLIENTS.maintenanceShare;
}
