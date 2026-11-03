import {
  RETRO,
  RETRO_ACTIONS,
  type CommandResult,
  type DevRole,
  type DevTrait,
  type EntityId,
  type GameState,
  type RetroAction,
} from '@oss/shared';
import { changeMoral, devIds, hasRole, notify, teamMoral, text, type SimContext } from './helpers';
import { Rng } from './rng';

/*
 * Rétrospective de sprint (voir `packages/shared/src/sim/retro.ts`).
 *
 * 1. Au début de chaque planification (dès le sprint 2), `retroPlanning` repère les problèmes
 *    du sprint écoulé et propose les 3 actions qui y répondent le mieux. Chaque dev vote.
 * 2. Le joueur choisit une action (`HOLD_RETRO`) ou passe. Lancer le sprint sans choisir revient
 *    à passer.
 * 3. Pendant le sprint suivant, `retroActive` dit aux systèmes quel bonus appliquer.
 *
 * Aucun tirage dans le générateur de la partie : les égalités de vote passent par `retroRng`.
 */

/** Action en vigueur pendant le sprint en cours, ou null. */
export function activeRetro(state: GameState): RetroAction | null {
  const active = state.retro.active;
  return active && active.sprint === state.sprint ? active.action : null;
}

/** L'action `action` est-elle en vigueur ce sprint ? */
export function retroActive(state: GameState, action: RetroAction): boolean {
  return activeRetro(state) === action;
}

/** Gravité de chaque problème du sprint écoulé (0 : rien à signaler). */
export function retroProblems(state: GameState): Record<RetroAction, number> {
  const report = state.history.sprints.at(-1);
  const sprintDays = state.history.daily.filter((point) => point.sprint === state.sprint - 1);
  const ids = devIds(state);
  const energy =
    ids.length > 0
      ? ids.reduce((total, id) => total + (state.components.mood[id]?.energy ?? 100), 0) /
        ids.length
      : 100;
  let conflicts = 0;
  for (const id of ids)
    for (const affinity of Object.values(state.components.relations[id] ?? {}))
      if (affinity < RETRO.conflictAffinity) conflicts += 1;
  const lost = report?.lost ?? false;
  const scores: Record<RetroAction, number> = {
    MORE_TESTS: Math.max(0, (report?.incidents ?? 0) - RETRO.incidentsThreshold + 1) * 2,
    CODE_REVIEW: Math.max(0, state.gauges.debt - RETRO.debtThreshold) / 10,
    COFFEE_BAR: sprintDays.some((point) => point.coffee <= 0) ? 3 : 0,
    NO_MEETING_WEDNESDAY: hasRole(state, 'PRODUCT_OWNER') ? 2 : 0,
    MEDIATION: conflicts / 2,
    ON_CALL: (report?.specialMissed ?? 0) * 2,
    FLEX_HOURS: Math.max(0, RETRO.energyThreshold - energy) / 10,
    SMALLER_TICKETS:
      !lost && report && report.featuresShipped <= RETRO.shippedThreshold && ids.length > 0 ? 2 : 0,
    KUDOS: Math.max(0, RETRO.moralThreshold - teamMoral(state)) / 8,
    KEEP_GOING: 1,
  };
  return scores;
}

/** Les 3 actions proposées : les problèmes les plus graves (ordre fixe en cas d'égalité). */
export function retroOptions(state: GameState): RetroAction[] {
  const scores = retroProblems(state);
  return [...RETRO_ACTIONS]
    .sort((a, b) => scores[b] - scores[a] || RETRO_ACTIONS.indexOf(a) - RETRO_ACTIONS.indexOf(b))
    .slice(0, RETRO.options);
}

/** Préférences de vote de chaque profil, puis de chaque trait (ajoutées aux problèmes). */
const ROLE_TASTE: Partial<Record<DevRole, Partial<Record<RetroAction, number>>>> = {
  SENIOR_BEARD: { MORE_TESTS: 3, CODE_REVIEW: 2 },
  TEN_X: { KEEP_GOING: 3, SMALLER_TICKETS: 1 },
  INTERN: { KUDOS: 3, COFFEE_BAR: 2 },
  RUSTACEAN: { CODE_REVIEW: 3, MORE_TESTS: 1 },
  DESIGNER: { CODE_REVIEW: 2, KUDOS: 1 },
  PRODUCT_OWNER: { SMALLER_TICKETS: 3, KEEP_GOING: 1 },
  AI_AGENT: { KEEP_GOING: 2 },
  GHOST: { NO_MEETING_WEDNESDAY: 3, FLEX_HOURS: 2 },
  QA_TESTER: { MORE_TESTS: 3 },
  DEVOPS: { ON_CALL: 3, MORE_TESTS: 1 },
  TECH_LEAD: { CODE_REVIEW: 3 },
  SCRUM_MASTER: { NO_MEETING_WEDNESDAY: 2, MEDIATION: 2 },
  MANAGER: { MEDIATION: 2, KEEP_GOING: 1 },
};

const TRAIT_TASTE: Record<DevTrait, Partial<Record<RetroAction, number>>> = {
  COFFEE_ADDICT: { COFFEE_BAR: 3 },
  NIGHT_OWL: { FLEX_HOURS: 3 },
  WORKAHOLIC: { KEEP_GOING: 2, ON_CALL: 1 },
  CHATTERBOX: { KUDOS: 2, MEDIATION: 1 },
  PERFECTIONIST: { CODE_REVIEW: 2, MORE_TESTS: 2 },
  GRUMPY: { NO_MEETING_WEDNESDAY: 3 },
  ZEN: { MEDIATION: 2, FLEX_HOURS: 1 },
  GAMER: { FLEX_HOURS: 2, KUDOS: 1 },
};

/** Générateur dédié : même graine, même sprint ⇒ mêmes votes. */
function retroRng(state: GameState): Rng {
  return Rng.fromSeed(`${state.seed}#retro#${state.sprint}`);
}

/** Vote de chaque dev parmi les actions proposées. */
export function retroVotes(
  state: GameState,
  options: readonly RetroAction[],
): Record<EntityId, RetroAction> {
  const rng = retroRng(state);
  const scores = retroProblems(state);
  const votes: Record<EntityId, RetroAction> = {};
  for (const id of devIds(state)) {
    const identity = state.components.identity[id];
    if (!identity) continue;
    let best: RetroAction | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const action of options) {
      // Un petit bruit départage les égalités sans favoriser toujours la première action.
      const score =
        scores[action] +
        (ROLE_TASTE[identity.role]?.[action] ?? 0) +
        (TRAIT_TASTE[identity.trait][action] ?? 0) +
        rng.next() * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = action;
      }
    }
    if (best) votes[id] = best;
  }
  return votes;
}

/** Action qui a le plus de voix (la première proposée en cas d'égalité). */
export function retroWinner(
  options: readonly RetroAction[],
  votes: Readonly<Record<EntityId, RetroAction>>,
): RetroAction | null {
  let winner: RetroAction | null = null;
  let best = 0;
  for (const action of options) {
    const count = Object.values(votes).filter((vote) => vote === action).length;
    if (count > best) {
      best = count;
      winner = action;
    }
  }
  return winner ?? options[0] ?? null;
}

/** Début de planification : prépare la rétro du sprint écoulé (dès le sprint 2). */
export function retroPlanning(state: GameState): void {
  state.retro.pending = null;
  if (state.sprint < 2 || devIds(state).length === 0) return;
  const options = retroOptions(state);
  state.retro.pending = { sprint: state.sprint, options, votes: retroVotes(state, options) };
}

/** Lancement du sprint : une rétro sans décision est passée. */
export function closeRetro(state: GameState): void {
  state.retro.pending = null;
}

const ACTION_NAMES: Record<RetroAction, readonly [string, string]> = {
  MORE_TESTS: ['Plus de tests', 'More tests'],
  CODE_REVIEW: ['Revue de code obligatoire', 'Mandatory code review'],
  COFFEE_BAR: ['Café en libre-service', 'Self-service coffee'],
  NO_MEETING_WEDNESDAY: ['Mercredi sans réunion', 'No-meeting Wednesday'],
  MEDIATION: ['Médiation', 'Mediation'],
  ON_CALL: ['Astreinte organisée', 'Organised on-call'],
  FLEX_HOURS: ['Horaires flexibles', 'Flexible hours'],
  SMALLER_TICKETS: ['Découper les tickets', 'Smaller tickets'],
  KUDOS: ['Kudos du vendredi', 'Friday kudos'],
  KEEP_GOING: ['Continuer comme ça', 'Keep it up'],
};

/**
 * Commande HOLD_RETRO : le joueur retient une action (ou passe avec `null`). Suivre le vote
 * remonte le moral de tous ; imposer autre chose vexe ceux qui avaient voté autrement.
 */
export function holdRetro(
  state: GameState,
  ctx: SimContext,
  action: RetroAction | null,
): CommandResult {
  if (state.stage !== 'PLANNING') return { ok: false, error: 'WRONG_STAGE' };
  const pending = state.retro.pending;
  if (!pending || pending.sprint !== state.sprint) return { ok: false, error: 'NOT_AVAILABLE' };
  if (action === null) {
    state.retro.pending = null;
    return { ok: true };
  }
  if (!pending.options.includes(action)) return { ok: false, error: 'INVALID_CHOICE' };
  const winner = retroWinner(pending.options, pending.votes);
  const followed = action === winner;
  for (const [id, vote] of Object.entries(pending.votes)) {
    if (followed) changeMoral(state, id, RETRO.followMoral);
    else if (vote !== action) changeMoral(state, id, -RETRO.imposeMoral);
  }
  if (!followed) state.retro.imposed += 1;
  state.retro.held += 1;
  state.retro.active = { action, sprint: state.sprint };
  state.retro.pending = null;
  // Médiation : effet immédiat sur les relations tendues.
  if (action === 'MEDIATION') {
    for (const id of devIds(state)) {
      const relations = state.components.relations[id];
      if (!relations) continue;
      for (const [otherId, affinity] of Object.entries(relations))
        if (affinity < 0) relations[otherId] = Math.min(0, affinity + RETRO.mediationAffinity);
    }
  }
  notify(
    state,
    ctx,
    'RETRO_HELD',
    text(
      followed
        ? ['Rétro : l’équipe a choisi « {action} ».', 'Retro: the team picked "{action}".']
        : [
            'Rétro : tu as imposé « {action} ». Certains font la tête.',
            'Retro: you imposed "{action}". Some people are sulking.',
          ],
      { action: { fr: ACTION_NAMES[action][0], en: ACTION_NAMES[action][1] } },
    ),
  );
  return { ok: true };
}
