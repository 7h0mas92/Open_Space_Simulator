import {
  SUPPORT,
  SUPPORT_MAX_AGENTS,
  dailyTickets,
  satisfactionTarget,
  type CommandResult,
  type GameState,
  type SupportDuty,
} from '@oss/shared';
import { addGauge, clamp, notify, teamSize, text, type SimContext } from './helpers';
import type { SimClock } from './time';

/*
 * Support client (constantes et règles dans `shared/sim/support.ts`) : tickets du jour, réponses
 * des agents et des devs de garde, satisfaction, commande `SET_SUPPORT`. Aucun tirage.
 */

/** Tickets qui arrivent aujourd'hui avec les jauges actuelles. */
export function ticketsToday(state: GameState): number {
  const { users, debt, stability } = state.gauges;
  return dailyTickets(users, debt, stability);
}

/** Tickets traités par jour : agents, plus les devs de garde au support. */
export function supportCapacity(state: GameState): number {
  const { agents, duty } = state.support;
  return (
    agents * SUPPORT.agentCapacity + teamSize(state) * SUPPORT.devCapacity * SUPPORT.dutyShare[duty]
  );
}

/** Salaires des agents de support, par mois. */
export function supportMonthly(state: GameState): number {
  return state.support.agents * SUPPORT.agentSalary;
}

/** Part du travail gardée par un dev (les devs de garde au support codent moins). */
export function supportWorkFactor(state: GameState): number {
  return 1 - SUPPORT.dutyShare[state.support.duty];
}

/**
 * Journée du support, à minuit : les jours de semaine, les tickets arrivent et l'équipe en traite
 * autant qu'elle peut ; chaque jour, la satisfaction se rapproche de sa cible.
 */
export function supportDay(state: GameState, ctx: SimContext, clock: SimClock): void {
  const support = state.support;
  if (!clock.isWeekend) {
    const received = ticketsToday(state);
    const solved = Math.min(support.backlog + received, supportCapacity(state));
    support.backlog = Math.max(0, support.backlog + received - solved);
    support.received += received;
    support.solved += solved;
    support.lastReceived = received;
    support.lastSolved = solved;
  }
  const target = satisfactionTarget(support.backlog, ticketsToday(state));
  const before = support.satisfaction;
  support.satisfaction = clamp(before + (target - before) * SUPPORT.dailyConvergence, 0, 100);
  if (support.satisfaction >= SUPPORT.happyThreshold)
    addGauge(state, 'hype', SUPPORT.happyHypePerDay);
  if (before >= SUPPORT.churnThreshold && support.satisfaction < SUPPORT.churnThreshold) {
    notify(
      state,
      ctx,
      'SUPPORT_UNHAPPY',
      text(
        [
          '{count} tickets sans réponse : les utilisateurs s’énervent et commencent à partir.',
          '{count} unanswered tickets: users are getting angry and starting to leave.',
        ],
        { count: Math.round(support.backlog) },
      ),
    );
  }
}

/** Règle le support : nombre d'agents (embauchés ou remerciés sans frais) et devs de garde. */
export function setSupport(
  state: GameState,
  ctx: SimContext,
  agents: number,
  duty: SupportDuty,
): CommandResult {
  if (state.stage === 'PITCH' || state.stage === 'ENDED')
    return { ok: false, error: 'WRONG_STAGE' };
  const support = state.support;
  if (agents === support.agents && duty === support.duty)
    return { ok: false, error: 'NOT_ELIGIBLE' };
  if (agents > SUPPORT_MAX_AGENTS[state.phase]) return { ok: false, error: 'TEAM_FULL' };
  const hired = agents - support.agents;
  support.agents = agents;
  support.duty = duty;
  if (hired !== 0)
    notify(
      state,
      ctx,
      'SUPPORT_STAFFED',
      hired > 0
        ? text(
            [
              '{count} agent(s) de support en plus : {total} au casque.',
              '{count} more support agent(s): {total} on the phones.',
            ],
            { count: hired, total: agents },
          )
        : text(
            [
              '{count} agent(s) de support en moins : {total} au casque.',
              '{count} fewer support agent(s): {total} on the phones.',
            ],
            { count: -hired, total: agents },
          ),
    );
  return { ok: true };
}
