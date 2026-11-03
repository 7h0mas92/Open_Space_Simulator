import { z } from 'zod';
import type { Phase } from '../game.js';

/**
 * Support client : les utilisateurs écrivent, il faut leur répondre.
 *
 * Chaque jour de semaine, des tickets arrivent : plus il y a d'utilisateurs (sur une échelle
 * logarithmique), plus la dette est haute et la prod instable, plus il y en a. On y répond avec
 * des agents de support (salariés à part, sans fiche de dev) et, si on veut, en mettant les devs
 * de garde au support (ils codent moins pendant ce temps).
 *
 * Les tickets en attente font baisser la **satisfaction** (0 à 100, une note façon NPS) :
 * - en dessous de 60, les utilisateurs partent plus vite (jusqu'à +60 % de départs à 0) ;
 * - au-dessus de 80, ils recommandent le produit (+15 % de croissance organique, un peu de hype).
 *
 * Aucun tirage aléatoire. Le système tourne dans toutes les parties : c'est une règle nouvelle,
 * comme le ménage (les replays des anciens scores ne rejouent plus à l'identique).
 */

export const SUPPORT_DUTIES = ['NONE', 'LIGHT', 'HEAVY'] as const;
export const SupportDutySchema = z.enum(SUPPORT_DUTIES);
export type SupportDuty = z.infer<typeof SupportDutySchema>;

export const SUPPORT = {
  /** Satisfaction au départ d'une partie. */
  startSatisfaction: 75,
  /**
   * Tickets par jour de semaine : `perSqrtThousand × √(utilisateurs / 1000)`, puis × (1 + dette
   * / 100 + instabilité). 1 000 utilisateurs : 3 tickets ; 1 M : 95 ; 10 M : 300.
   */
  ticketsPerSqrtThousand: 3,
  /** Tickets traités par jour par un agent de support. */
  agentCapacity: 30,
  /** Salaire mensuel chargé d'un agent. */
  agentSalary: 3_500,
  /** Part du temps d'un dev passée au support (il code d'autant moins). */
  dutyShare: { NONE: 0, LIGHT: 0.1, HEAVY: 0.25 } as Record<SupportDuty, number>,
  /** Tickets traités par jour par un dev à plein temps au support (moins qu'un agent). */
  devCapacity: 20,
  /** Satisfaction visée sans attente, et points perdus par jour d'attente moyen. */
  targetMax: 92,
  targetPerWaitDay: 18,
  /** La satisfaction rejoint sa cible de 15 % de l'écart par jour. */
  dailyConvergence: 0.15,
  /** En dessous : départs en plus ; au-dessus : recommandations. */
  churnThreshold: 60,
  maxExtraChurn: 0.6,
  happyThreshold: 80,
  happyGrowth: 0.06,
  happyHypePerDay: 0.04,
} as const;

/** Agents de support au plus, selon la phase (la taille du plateau). */
export const SUPPORT_MAX_AGENTS: Record<Phase, number> = {
  GARAGE: 1,
  SEED: 4,
  SERIES_A: 10,
  UNICORN: 25,
  END: 25,
};

export const SupportStateSchema = z.object({
  /** Tickets en attente. */
  backlog: z.number().min(0),
  /** Satisfaction des utilisateurs, de 0 à 100. */
  satisfaction: z.number().min(0).max(100),
  agents: z.number().int().min(0),
  duty: SupportDutySchema,
  /** Tickets arrivés et traités dans la partie. */
  received: z.number().min(0),
  solved: z.number().min(0),
  /** Tickets arrivés et traités le dernier jour ouvré (affichage). */
  lastReceived: z.number().min(0),
  lastSolved: z.number().min(0),
});
export type SupportState = z.infer<typeof SupportStateSchema>;

export function emptySupportState(): SupportState {
  return {
    backlog: 0,
    satisfaction: SUPPORT.startSatisfaction,
    agents: 0,
    duty: 'NONE',
    received: 0,
    solved: 0,
    lastReceived: 0,
    lastSolved: 0,
  };
}

/** Tickets qui arrivent un jour de semaine. */
export function dailyTickets(users: number, debt: number, stability: number): number {
  const pressure = 1 + debt / 100 + (1 - stability / 100);
  return SUPPORT.ticketsPerSqrtThousand * Math.sqrt(Math.max(0, users) / 1000) * pressure;
}

/** Satisfaction visée selon l'attente moyenne (tickets en attente / tickets par jour). */
export function satisfactionTarget(backlog: number, perDay: number): number {
  const waitDays = backlog / Math.max(1, perDay);
  return Math.max(0, SUPPORT.targetMax - waitDays * SUPPORT.targetPerWaitDay);
}

/** Départs d'utilisateurs en plus selon la satisfaction (0 au-dessus du seuil). */
export function supportChurnFactor(satisfaction: number): number {
  if (satisfaction >= SUPPORT.churnThreshold) return 1;
  return 1 + SUPPORT.maxExtraChurn * (1 - satisfaction / SUPPORT.churnThreshold);
}

/** Croissance organique en plus quand les utilisateurs sont contents. */
export function supportGrowthFactor(satisfaction: number): number {
  return satisfaction >= SUPPORT.happyThreshold ? 1 + SUPPORT.happyGrowth : 1;
}
