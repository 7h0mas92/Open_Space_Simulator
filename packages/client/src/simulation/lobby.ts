/**
 * Hall d'entrée et service de sécurité côté simulation : aménagement du hall, secrétaires de
 * l'accueil, souscription et facturation hebdomadaire de la sécurité. Les règles (prix, effets,
 * formules) sont dans `@oss/shared` (`lobby.ts`), partagées avec l'interface. Aucun tirage
 * aléatoire : une partie sans hall reste identique.
 */
import {
  LOBBY,
  PHASES,
  SECURITY_WEEK_TICKS,
  getSecurityPlan,
  type CommandResult,
  type FurnitureEffects,
  type GameState,
  type SecurityPlanId,
} from '@oss/shared';
import { addMoney, moneyText, notify, text, type SimContext } from './helpers';

// Comme `phaseIndex` de furniture.ts, qui importe ce module (pas d'import circulaire).
const phaseIndex = (phase: GameState['phase']) => PHASES.indexOf(phase);

/** Profondeur ajoutée au bureau par le hall (0 sans hall). */
export function lobbyDepth(state: GameState): number {
  return state.lobby ? LOBBY.depth : 0;
}

/** Fait aménager le hall : les travaux sont payés tout de suite. */
export function buildLobby(state: GameState, ctx: SimContext): CommandResult {
  if (state.stage === 'PITCH') return { ok: false, error: 'WRONG_STAGE' };
  if (state.lobby) return { ok: false, error: 'NOT_ELIGIBLE' };
  if (phaseIndex(state.phase) < phaseIndex(LOBBY.minPhase)) return { ok: false, error: 'LOCKED' };
  if (state.gauges.treasury < LOBBY.price) return { ok: false, error: 'NOT_ENOUGH_MONEY' };
  addMoney(state, -LOBBY.price);
  state.lobby = { since: state.sprint, receptionists: 0 };
  notify(
    state,
    ctx,
    'LOBBY_BUILT',
    text([
      'Le hall d’entrée est prêt : comptoir d’accueil et portes à badge au rez-de-chaussée.',
      'The lobby is ready: front desk and badge doors on the ground floor.',
    ]),
  );
  return { ok: true };
}

/**
 * Embauche ou laisse partir des secrétaires (0 à 2). Leur salaire compte dans les dépenses du
 * mois : on embauche seulement si la trésorerie couvre au moins un mois de plus.
 */
export function setReceptionists(state: GameState, ctx: SimContext, count: number): CommandResult {
  if (state.stage === 'PITCH') return { ok: false, error: 'WRONG_STAGE' };
  const lobby = state.lobby;
  if (!lobby) return { ok: false, error: 'NOT_ELIGIBLE' };
  const target = Math.max(0, Math.min(LOBBY.maxReceptionists, Math.round(count)));
  if (target === lobby.receptionists) return { ok: false, error: 'NOT_ELIGIBLE' };
  const hiring = target > lobby.receptionists;
  if (hiring && state.gauges.treasury < (target - lobby.receptionists) * LOBBY.receptionistMonthly)
    return { ok: false, error: 'NOT_ENOUGH_MONEY' };
  lobby.receptionists = target;
  notify(
    state,
    ctx,
    hiring ? 'RECEPTIONIST_HIRED' : 'RECEPTIONIST_LEFT',
    hiring
      ? text(
          [
            'Nouvelle recrue à l’accueil : {count} secrétaire(s) au comptoir.',
            'New hire at the front desk: {count} receptionist(s) at the counter.',
          ],
          { count: target },
        )
      : text(
          [
            'Départ à l’accueil : {count} secrétaire(s) au comptoir.',
            'Front desk departure: {count} receptionist(s) left at the counter.',
          ],
          { count: target },
        ),
  );
  return { ok: true };
}

/** Salaires mensuels des secrétaires. */
export function receptionistsMonthly(state: GameState): number {
  return (state.lobby?.receptionists ?? 0) * LOBBY.receptionistMonthly;
}

/** Coût mensuel de la sécurité (30 jours de jeu), pour le calcul des mois de trésorerie. */
export function securityMonthly(state: GameState): number {
  return state.security ? (getSecurityPlan(state.security.plan).weeklyPrice * 30) / 7 : 0;
}

/**
 * Effets du hall : le hall et ses portes à badge, chaque secrétaire, puis le service de
 * sécurité souscrit (mêmes unités que le mobilier).
 */
export function lobbyEffects(state: GameState): FurnitureEffects[] {
  const lobby = state.lobby;
  if (!lobby) return [];
  const effects: FurnitureEffects[] = [LOBBY.effects, LOBBY.badgeEffects];
  for (let i = 0; i < lobby.receptionists; i++) effects.push(LOBBY.receptionistEffects);
  if (state.security) effects.push(getSecurityPlan(state.security.plan).effects);
  return effects;
}

/**
 * Souscrit à un service de sécurité, ou passe à un autre : la première semaine de la nouvelle
 * formule est payée tout de suite (la semaine entamée de l'ancienne n'est pas remboursée). Il
 * faut un hall : l'agent et les portes à badge y sont.
 */
export function subscribeSecurity(
  state: GameState,
  ctx: SimContext,
  planId: SecurityPlanId,
): CommandResult {
  if (state.stage === 'PITCH') return { ok: false, error: 'WRONG_STAGE' };
  const plan = getSecurityPlan(planId);
  if (phaseIndex(state.phase) < phaseIndex(plan.minPhase)) return { ok: false, error: 'LOCKED' };
  if (!state.lobby) return { ok: false, error: 'NOT_ELIGIBLE' };
  if (state.security?.plan === planId) return { ok: false, error: 'NOT_ELIGIBLE' };
  if (state.gauges.treasury < plan.weeklyPrice) return { ok: false, error: 'NOT_ENOUGH_MONEY' };
  addMoney(state, -plan.weeklyPrice);
  const previous = state.security;
  state.security = {
    plan: planId,
    paidUntil: state.tick + SECURITY_WEEK_TICKS,
    since: previous ? previous.since : state.sprint,
    totalPaid: (previous?.totalPaid ?? 0) + plan.weeklyPrice,
  };
  notify(
    state,
    ctx,
    'SECURITY_SUBSCRIBED',
    text(
      previous
        ? ['Nouvelle formule de sécurité : {plan}.', 'New security plan: {plan}.']
        : [
            'Sécurité en place : {plan}, {price} par semaine.',
            'Security in place: {plan}, {price} a week.',
          ],
      { plan: plan.name, price: moneyText(plan.weeklyPrice) },
    ),
  );
  return { ok: true };
}

/** Résilie le service de sécurité : il s'arrête tout de suite, sans remboursement. */
export function cancelSecurity(state: GameState, ctx: SimContext): CommandResult {
  if (state.stage === 'PITCH') return { ok: false, error: 'WRONG_STAGE' };
  if (!state.security) return { ok: false, error: 'NOT_FOUND' };
  state.security = null;
  notify(
    state,
    ctx,
    'SECURITY_CANCELLED',
    text(['Contrat de sécurité résilié.', 'Security contract cancelled.']),
  );
  return { ok: true };
}

/**
 * Facture de la sécurité, chaque semaine de jeu. Si la trésorerie ne la couvre pas, la société
 * de sécurité suspend le contrat plutôt que de pousser la startup à la faillite.
 */
export function securitySystem(state: GameState, ctx: SimContext): void {
  const security = state.security;
  if (!security || state.tick < security.paidUntil) return;
  const plan = getSecurityPlan(security.plan);
  if (state.gauges.treasury < plan.weeklyPrice) {
    state.security = null;
    notify(
      state,
      ctx,
      'SECURITY_CUT',
      text([
        'Facture de sécurité impayée : le contrat est suspendu.',
        'Unpaid security bill: the contract is suspended.',
      ]),
    );
    return;
  }
  addMoney(state, -plan.weeklyPrice);
  security.paidUntil += SECURITY_WEEK_TICKS;
  security.totalPaid += plan.weeklyPrice;
}
