/**
 * Hall d'entrée côté simulation : aménagement du hall et secrétaires de l'accueil. Les règles
 * (prix, effets) sont dans `@oss/shared` (`lobby.ts`), partagées avec l'interface. Le service de
 * sécurité est un abonnement du modèle commun (service `security`, `subscriptions.ts`), qui
 * demande un hall. Aucun tirage aléatoire : une partie sans hall reste identique.
 */
import {
  LOBBY,
  PHASES,
  type CommandResult,
  type FurnitureEffects,
  type GameState,
} from '@oss/shared';
import { addMoney, notify, text, type SimContext } from './helpers';

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

/**
 * Effets du hall : le hall et ses portes à badge, puis chaque secrétaire (mêmes unités que le
 * mobilier). Le service de sécurité est un abonnement (`subscriptions.ts`) : ses effets passent
 * par `subscriptionEffects`.
 */
export function lobbyEffects(state: GameState): FurnitureEffects[] {
  const lobby = state.lobby;
  if (!lobby) return [];
  const effects: FurnitureEffects[] = [LOBBY.effects, LOBBY.badgeEffects];
  for (let i = 0; i < lobby.receptionists; i++) effects.push(LOBBY.receptionistEffects);
  return effects;
}
