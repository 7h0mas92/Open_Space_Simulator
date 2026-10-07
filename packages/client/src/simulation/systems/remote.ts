import { BALANCE, type EntityId, type GameState, type RemoteReason } from '@oss/shared';
import { addDevLog, devIds, notify, text, type SimContext } from '../helpers';
import type { SimClock } from '../time';

/** Message affiché (journal du dev, Slack) quand il passe en télétravail, selon la raison. */
const REMOTE_MESSAGES: Record<Exclude<RemoteReason, 'GHOST'>, readonly [string, string]> = {
  FATIGUE: [
    '{name} est épuisé·e et télétravaille aujourd’hui pour récupérer.',
    '{name} is exhausted and works from home today to recover.',
  ],
  CONFLICT: [
    '{name} évite {other} et télétravaille aujourd’hui.',
    '{name} is avoiding {other} and works from home today.',
  ],
  NO_COFFEE: [
    'Plus de café au bureau : {name} télétravaille avec sa propre cafetière.',
    'No coffee at the office: {name} works from home with their own coffee maker.',
  ],
  NO_DESK: [
    'Plus de bureau libre : {name} télétravaille aujourd’hui.',
    'No free desk: {name} works from home today.',
  ],
};

/** Collègue avec qui le dev s'entend le moins (et l'affinité correspondante). */
function worstRelation(state: GameState, id: EntityId): { id: EntityId; affinity: number } | null {
  let worst: { id: EntityId; affinity: number } | null = null;
  for (const [otherId, affinity] of Object.entries(state.components.relations[id] ?? {})) {
    if (!worst || affinity < worst.affinity) worst = { id: otherId, affinity };
  }
  return worst;
}

/**
 * Raison personnelle de rester chez soi, ou `null`. Les seuils de retour sont plus
 * exigeants que les seuils de départ (hystérésis) : un dev ne fait pas l'aller-retour
 * chaque jour à la limite du seuil.
 */
export function personalRemoteReason(state: GameState, id: EntityId): RemoteReason | null {
  const identity = state.components.identity[id];
  const mood = state.components.mood[id];
  if (!identity || !mood) return null;
  if (identity.role === 'GHOST') return 'GHOST';
  if (identity.role === 'AI_AGENT') return null;
  const r = BALANCE.remote;
  const previous = state.components.remoteReason[id];
  if (mood.energy < (previous === 'FATIGUE' ? r.fatigueRecovered : r.fatigueEnergy))
    return 'FATIGUE';
  const worst = worstRelation(state, id);
  if (worst && worst.affinity < (previous === 'CONFLICT' ? r.conflictEased : r.conflictAffinity))
    return 'CONFLICT';
  if (identity.trait === 'COFFEE_ADDICT' && state.gauges.coffee <= 0) return 'NO_COFFEE';
  return null;
}

/** Met un dev en télétravail (`reason`) ou le fait revenir au bureau (`null`). */
export function setRemote(
  state: GameState,
  ctx: SimContext,
  id: EntityId,
  reason: RemoteReason | null,
): void {
  const identity = state.components.identity[id];
  if (!identity) return;
  const previous = state.components.remoteReason[id];
  if (reason === null) {
    Reflect.deleteProperty(state.components.remote, id);
    Reflect.deleteProperty(state.components.remoteReason, id);
    if (previous && previous !== 'GHOST')
      addDevLog(state, id, text(['De retour au bureau.', 'Back at the office.']));
    return;
  }
  state.components.remote[id] = true;
  state.components.remoteReason[id] = reason;
  if (reason === 'GHOST') return;
  state.stats.remoteDays += 1;
  if (previous === reason) return;
  const other = state.components.identity[worstRelation(state, id)?.id ?? '']?.name ?? '?';
  const message = text(REMOTE_MESSAGES[reason], { name: identity.name, other });
  addDevLog(state, id, message);
  notify(state, ctx, 'DEV_REMOTE', message, id);
}

/**
 * Système « télétravail » : chaque matin de semaine, la simulation décide qui travaille
 * de chez soi. D'abord les raisons personnelles (fatigue, conflit, café), puis le manque
 * de bureaux : les derniers arrivés sans poste restent à la maison.
 */
export function remoteSystem(state: GameState, ctx: SimContext, clock: SimClock): void {
  if (clock.isWeekend || clock.hour !== BALANCE.remote.decisionHour) return;
  const decisions = new Map<EntityId, RemoteReason | null>();
  const needDesk: EntityId[] = [];
  for (const id of devIds(state)) {
    const reason = personalRemoteReason(state, id);
    decisions.set(id, reason);
    // L'IA Agent tourne sur un serveur : elle n'occupe pas de bureau.
    if (reason === null && state.components.identity[id]?.role !== 'AI_AGENT') needDesk.push(id);
  }
  for (const id of needDesk.slice(ctx.office.desks)) decisions.set(id, 'NO_DESK');
  for (const [id, reason] of decisions) setRemote(state, ctx, id, reason);
}
