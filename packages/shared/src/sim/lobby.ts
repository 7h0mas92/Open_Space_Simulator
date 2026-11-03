import { z } from 'zod';
import type { Phase } from '../game.js';
import type { LocalizedText } from '../i18n.js';
import type { FurnitureEffects, FurnitureId } from './furniture.js';

/**
 * Hall d'entrée au rez-de-chaussée et service de sécurité.
 *
 * Dès la Seed, le joueur peut faire aménager le hall de la tour : une pièce sur toute la largeur
 * du bureau, devant les autres, par laquelle tout le monde arrive. Il est séparé du reste par une
 * cloison percée de deux portes à badge magnétique (des portiques vitrés qui s'ouvrent au
 * passage d'un badge). Il est livré avec un comptoir d'accueil, une banquette et deux plantes,
 * du décor déplaçable comme celui des annexes (clés `L-<rang>`, voir `annexDecor.ts`).
 *
 * Deux secrétaires peuvent tenir l'accueil : elles filtrent les appels, les livreurs et les
 * visiteurs (un peu de productivité et de moral pour l'équipe, de la hype auprès des visiteurs).
 * Leur salaire s'ajoute aux dépenses du mois, comme celui des devs.
 *
 * Le service de sécurité est un abonnement payé chaque semaine de jeu (comme la fibre), en trois
 * formules aux prix du marché : télésurveillance, agent en journée, gardiennage 24 h/24. Il ne
 * se souscrit qu'avec un hall (les portes à badge et le poste de l'agent y sont). Trésorerie
 * insuffisante à l'échéance : la société de sécurité suspend le contrat.
 *
 * Aucun tirage aléatoire : une partie sans hall reste identique (replays, Daily, sauvegardes).
 */

export const LOBBY = {
  /** Phase à partir de laquelle on peut faire aménager le hall (pas de hall dans un garage). */
  minPhase: 'SEED' as Phase,
  /** Travaux du hall : cloison, portes à badge, comptoir, banquette, plantes. */
  price: 18_000,
  /** Profondeur du hall en cases, cloison comprise. */
  depth: 5,
  /** Secrétaires à l'accueil, au plus. */
  maxReceptionists: 2,
  /** Coût mensuel chargé d'une secrétaire (environ 2 000 € nets par mois). */
  receptionistMonthly: 3_100,
  /** Effets du hall lui-même : une vraie entrée qui impressionne les visiteurs. */
  effects: { hypePerDay: 0.04, moral: 0.03 } satisfies FurnitureEffects,
  /** Portes à badge : plus personne n'entre brancher une clé USB « trouvée sur le parking ». */
  badgeEffects: { stabilityPerDay: 0.05 } satisfies FurnitureEffects,
  /** Effets de chaque secrétaire : appels, colis et visiteurs filtrés. */
  receptionistEffects: {
    teamProductivity: 0.01,
    moral: 0.04,
    hypePerDay: 0.02,
  } satisfies FurnitureEffects,
} as const;

/** Prix hebdomadaire d'un abonnement à partir de son prix mensuel (12 mois = 52 semaines). */
export function weeklyFromMonthly(monthly: number): number {
  return Math.round((monthly * 12) / 52);
}

export const SECURITY_PLAN_IDS = ['security-alarm', 'security-day', 'security-24h'] as const;
export const SecurityPlanIdSchema = z.enum(SECURITY_PLAN_IDS);
export type SecurityPlanId = z.infer<typeof SecurityPlanIdSchema>;

export interface SecurityPlan {
  readonly id: SecurityPlanId;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  /** Ce qui est compris, pour l'affichage (horaires, matériel). */
  readonly coverage: LocalizedText;
  /** Prix du marché par mois, hors taxes. */
  readonly monthlyPrice: number;
  /** Prix payé chaque semaine de jeu (`weeklyFromMonthly`). */
  readonly weeklyPrice: number;
  readonly minPhase: Phase;
  /** Un agent se tient dans le hall : en journée seulement, ou jour et nuit. */
  readonly guard: 'none' | 'day' | 'always';
  readonly effects: Pick<FurnitureEffects, 'moral' | 'stabilityPerDay' | 'hypePerDay'>;
}

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

const plan = (p: Omit<SecurityPlan, 'weeklyPrice'>): SecurityPlan => ({
  ...p,
  weeklyPrice: weeklyFromMonthly(p.monthlyPrice),
});

export const SECURITY_PLANS: readonly SecurityPlan[] = [
  plan({
    id: 'security-alarm',
    name: t('Télésurveillance', 'Remote monitoring'),
    description: t(
      'Alarme, détecteurs et caméras reliés à un centre de surveillance, qui envoie un agent en cas d’alerte.',
      'Alarm, sensors and cameras wired to a monitoring centre that sends a guard on alert.',
    ),
    coverage: t('24 h/24 à distance, intervention sur alarme', '24/7 remote, response on alarm'),
    monthlyPrice: 95,
    minPhase: 'SEED',
    guard: 'none',
    effects: { stabilityPerDay: 0.03, moral: 0.02 },
  }),
  plan({
    id: 'security-day',
    name: t('Agent de sécurité en journée', 'Daytime security guard'),
    description: t(
      'Un agent à l’accueil de 8 h à 20 h en semaine : badges, visiteurs, rondes. Alarme la nuit.',
      'A guard at the front desk from 8 am to 8 pm on weekdays: badges, visitors, patrols. Alarm at night.',
    ),
    coverage: t('8 h – 20 h en semaine, alarme la nuit', '8 am – 8 pm weekdays, alarm at night'),
    monthlyPrice: 5_600,
    minPhase: 'SEED',
    guard: 'day',
    effects: { stabilityPerDay: 0.1, moral: 0.08, hypePerDay: 0.02 },
  }),
  plan({
    id: 'security-24h',
    name: t('Gardiennage 24 h/24', '24/7 guarding'),
    description: t(
      'Des agents qui se relaient jour et nuit, rondes, contrôle des accès et des livraisons.',
      'Guards taking turns day and night: patrols, access and delivery control.',
    ),
    coverage: t('24 h/24, 7 j/7, rondes la nuit', '24/7, night patrols'),
    monthlyPrice: 16_500,
    minPhase: 'SERIES_A',
    guard: 'always',
    effects: { stabilityPerDay: 0.22, moral: 0.14, hypePerDay: 0.05 },
  }),
];

export function getSecurityPlan(id: SecurityPlanId): SecurityPlan {
  return SECURITY_PLANS.find((p) => p.id === id) ?? (SECURITY_PLANS[0] as SecurityPlan);
}

/** Le hall, une fois aménagé. */
export const LobbyStateSchema = z.object({
  /** Sprint de l'aménagement. */
  since: z.number().int().min(1),
  /** Secrétaires à l'accueil (0 à 2). */
  receptionists: z.number().int().min(0).max(LOBBY.maxReceptionists).default(0),
});
export type LobbyState = z.infer<typeof LobbyStateSchema>;

/** Comptoir d'accueil : les secrétaires s'y installent. */
export const RECEPTION_DESK_ID = 'reception-desk';

/**
 * Décor offert avec le hall, dans l'ordre des clés `L-0`, `L-1`… : le comptoir d'accueil, la
 * banquette des visiteurs et deux plantes. Comme celui des annexes, il se déplace et se tourne,
 * sans effet, ni revente, ni rangement.
 */
export const LOBBY_DECOR: readonly FurnitureId[] = [RECEPTION_DESK_ID, 'bench', 'plant', 'plant'];

/** Clé d'un objet du décor du hall (« L-0 » : le comptoir d'accueil). */
export function lobbyDecorKey(index: number): string {
  return `L-${index}`;
}

/** Objet du décor du hall désigné par une clé, si le hall est aménagé. */
export function lobbyDecorItem(key: string, lobby: boolean): FurnitureId | undefined {
  const match = /^L-(\d)$/.exec(key);
  if (!match || !lobby) return undefined;
  return LOBBY_DECOR[Number(match[1])];
}
