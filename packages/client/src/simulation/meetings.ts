import {
  MEETINGS,
  PHASES,
  getMeetingFormat,
  type CommandError,
  type CommandResult,
  type EntityId,
  type GameState,
  type MeetingFormat,
  type MeetingFormatId,
  type Phase,
} from '@oss/shared';
import { addGauge, addMoney, clamp, notify, text, type SimContext } from './helpers';
import { Rng } from './rng';
import type { SimClock } from './time';

/*
 * Salle de réunion : le joueur choisit une formule (stand-up, brainstorming, aquarium, zen,
 * war room, salle du conseil). Chacune a un effet permanent, bon et mauvais (ajouté aux
 * effets du mobilier dans `computeOfficeEffects`), et organise une réunion d'équipe chaque
 * matin de semaine, utile ou inutile.
 *
 * Le tirage « utile ou inutile » passe par un générateur créé à la volée à partir de la graine
 * et du tick, jamais par `ctx.rng` : sans salle aménagée, la partie tire exactement les mêmes
 * nombres qu'avant, et ses replays restent valides.
 */

// Comme `phaseIndex` de furniture.ts, qui importe ce module (pas d'import circulaire).
const phaseIndex = (phase: Phase) => PHASES.indexOf(phase);

/** Formule de la salle aménagée, ou `undefined` si la salle est vide. */
export function meetingFormat(state: GameState): MeetingFormat | undefined {
  return state.meetingRoom ? getMeetingFormat(state.meetingRoom.format) : undefined;
}

/** Le bureau a-t-il une salle de réunion ? (Pas au garage : il faut la première levée.) */
export function meetingRoomUnlocked(state: GameState): boolean {
  return phaseIndex(state.phase) >= phaseIndex(MEETINGS.unlockPhase);
}

/** Remboursement si l'on démonte l'aménagement actuel. */
export function meetingRoomRefund(state: GameState): number {
  return Math.round((state.meetingRoom?.paid ?? 0) * MEETINGS.refundRatio);
}

export type MeetingBlocker = Extract<
  CommandError,
  'NOT_FOUND' | 'WRONG_STAGE' | 'LOCKED' | 'NOT_ELIGIBLE' | 'NOT_ENOUGH_MONEY'
>;

/** Pourquoi on ne peut pas choisir cette formule (`null` si c'est possible). */
export function meetingFormatBlocker(
  state: GameState,
  format: MeetingFormat | undefined,
): MeetingBlocker | null {
  if (!format) return 'NOT_FOUND';
  if (state.stage === 'PITCH') return 'WRONG_STAGE';
  if (!meetingRoomUnlocked(state) || phaseIndex(state.phase) < phaseIndex(format.minPhase))
    return 'LOCKED';
  if (state.meetingRoom?.format === format.id) return 'NOT_ELIGIBLE';
  if (state.gauges.treasury + meetingRoomRefund(state) < format.price) return 'NOT_ENOUGH_MONEY';
  return null;
}

/** Aménage la salle (l'ancien aménagement est revendu à moitié prix). */
export function fitMeetingRoom(
  state: GameState,
  ctx: SimContext,
  formatId: MeetingFormatId,
): CommandResult {
  const format = getMeetingFormat(formatId);
  const blocker = meetingFormatBlocker(state, format);
  if (blocker || !format) return { ok: false, error: blocker ?? 'NOT_FOUND' };
  const refund = meetingRoomRefund(state);
  if (refund > 0) addMoney(state, refund);
  addMoney(state, -format.price);
  state.meetingRoom = { format: format.id, paid: format.price, fittedAtSprint: state.sprint };
  notify(
    state,
    ctx,
    'MEETING_ROOM_FITTED',
    text(['Nouvelle salle de réunion : {name}.', 'New meeting room: {name}.'], {
      name: format.name,
    }),
  );
  return { ok: true };
}

/** Démonte l'aménagement : la salle redevient vide. */
export function clearMeetingRoom(state: GameState): CommandResult {
  if (!state.meetingRoom) return { ok: false, error: 'NOT_FOUND' };
  if (state.stage === 'PITCH') return { ok: false, error: 'WRONG_STAGE' };
  addMoney(state, meetingRoomRefund(state));
  state.meetingRoom = null;
  return { ok: true };
}

/** Est-ce l'heure de la réunion d'équipe du matin ? (Seulement avec une salle aménagée.) */
export function isTeamMeetingTime(state: GameState, clock: SimClock): boolean {
  return (
    state.meetingRoom !== null &&
    meetingRoomUnlocked(state) &&
    !clock.isWeekend &&
    clock.hour === MEETINGS.dailyHour
  );
}

/** Tirage reproductible d'une réunion : même graine, même tick ⇒ même verdict. */
function meetingRng(state: GameState): Rng {
  return Rng.fromSeed(`${state.seed}#meeting#${state.tick}`);
}

/**
 * Réunion d'équipe du matin : utile ou inutile selon la formule de la salle. Le moral va aux
 * participants, le reste aux jauges.
 */
export function holdTeamMeeting(
  state: GameState,
  ctx: SimContext,
  attendees: readonly EntityId[],
): void {
  const format = meetingFormat(state);
  if (!format || attendees.length === 0) return;
  const useful = meetingRng(state).chance(format.usefulOdds);
  const effects = useful ? format.useful : format.useless;
  if (effects.treasury) addMoney(state, effects.treasury);
  if (effects.hype) addGauge(state, 'hype', effects.hype);
  if (effects.debt) addGauge(state, 'debt', effects.debt);
  if (effects.stability) addGauge(state, 'stability', effects.stability);
  if (effects.moral) {
    for (const id of attendees) {
      const mood = state.components.mood[id];
      if (mood) mood.moral = clamp(mood.moral + (effects.moral ?? 0), 0, 100);
    }
  }
  if (useful) state.stats.meetingsUseful += 1;
  else state.stats.meetingsUseless += 1;
  notify(
    state,
    ctx,
    useful ? 'MEETING_USEFUL' : 'MEETING_USELESS',
    useful ? format.usefulText : format.uselessText,
  );
}
