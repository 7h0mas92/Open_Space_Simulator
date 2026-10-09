import {
  MEETINGS,
  PHASES,
  ROLE_TRADE,
  getMeetingFormat,
  type CommandError,
  type CommandResult,
  type EntityId,
  type GameState,
  type MeetingFormat,
  type MeetingFormatId,
  type Phase,
} from '@oss/shared';
import {
  addDevLog,
  addGauge,
  addMoney,
  clamp,
  devIds,
  notify,
  text,
  type SimContext,
} from './helpers';
import { assignTask } from './tasks';
import { Rng } from './rng';
import type { SimClock } from './time';

/*
 * Salle de réunion : le joueur choisit une formule (stand-up, brainstorming, aquarium, zen,
 * war room, salle du conseil). Chacune a un effet permanent, bon et mauvais (ajouté aux
 * effets du mobilier dans `computeOfficeEffects`), et organise une réunion d'équipe chaque
 * matin de semaine, utile ou inutile, et une réunion de crise chaque fois que la prod tombe.
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

// ─── Réunion de crise ───────────────────────────────────────────────────────

/** Dev présent au bureau (ni rentré chez lui, ni en télétravail) : il peut venir en salle. */
function onSite(state: GameState, id: EntityId): boolean {
  const kind = state.components.activity[id]?.kind;
  return kind !== undefined && kind !== 'GONE' && !(id in state.components.remote);
}

/** Solidité d'un dev face à une panne : qualité et expérience (à égalité, l'ordre de l'équipe). */
function firefighterScore(state: GameState, id: EntityId): number {
  const quality = state.components.stats[id]?.quality ?? 0;
  const level = state.components.employment[id]?.level ?? 1;
  return quality + level * 0.5;
}

/**
 * Les personnes concernées par une panne : le coupable s'il est là, puis les devs du code les
 * plus solides jusqu'à `MEETINGS.crisisDevs`, et le Product Owner (c'est lui qui prévient les
 * clients). Le premier dev qui n'est pas le coupable mène la réparation.
 */
export function crisisAttendees(
  state: GameState,
  culpritId: EntityId | null,
): { attendees: EntityId[]; leadId: EntityId | null } {
  const present = devIds(state).filter((id) => onSite(state, id));
  const role = (id: EntityId) => state.components.identity[id]?.role;
  const coders = present
    .filter((id) => {
      const devRole = role(id);
      return devRole !== undefined && ROLE_TRADE[devRole] === 'DEV' && devRole !== 'AI_AGENT';
    })
    .sort((a, b) => firefighterScore(state, b) - firefighterScore(state, a));
  const attendees: EntityId[] = [];
  if (culpritId && present.includes(culpritId)) attendees.push(culpritId);
  for (const id of coders) {
    if (attendees.length >= MEETINGS.crisisDevs) break;
    if (!attendees.includes(id)) attendees.push(id);
  }
  const leadId = attendees.find((id) => id !== culpritId) ?? attendees[0] ?? null;
  const owner = present.find((id) => role(id) === 'PRODUCT_OWNER');
  if (owner && !attendees.includes(owner)) attendees.push(owner);
  return { attendees, leadId };
}

/**
 * La prod vient de tomber : réunion de crise dans la salle aménagée, avec les personnes
 * concernées. Elles y passent la demi-heure suivante ; en sortant, le meneur prend « Réparer la
 * prod », déjà avancée selon la formule (la war room diagnostique deux fois plus vite).
 * Aucun hasard : rien n'est tiré, ni sur le générateur de la partie, ni ailleurs.
 */
export function holdCrisisMeeting(
  state: GameState,
  ctx: SimContext,
  fixTaskId: EntityId,
  culpritId: EntityId | null,
): boolean {
  const format = meetingFormat(state);
  const task = state.components.task[fixTaskId];
  if (!format || !task || !meetingRoomUnlocked(state) || state.stage !== 'EXECUTION') return false;
  const { attendees, leadId } = crisisAttendees(state, culpritId);
  if (!leadId) return false;
  for (const id of attendees) {
    const activity = state.components.activity[id];
    if (!activity) continue;
    activity.kind = 'MEETING';
    // La demi-heure de la panne, plus `crisisTicks` : le système d'activité les y laisse.
    activity.untilTick = state.tick + 1 + MEETINGS.crisisTicks;
    activity.withId = null;
  }
  if (culpritId && attendees.includes(culpritId)) {
    const mood = state.components.mood[culpritId];
    if (mood) mood.moral = clamp(mood.moral + MEETINGS.crisisCulpritMoral, 0, 100);
  }
  // Diagnostic fait à plusieurs : la réparation démarre avec de l'avance, sans se finir en salle.
  const headStart = Math.min(task.work * format.crisisHeadStart, task.work * 0.9 - task.progress);
  if (headStart > 0) {
    task.progress += headStart;
    task.qualitySum += headStart * 0.5;
    task.debtFactor += headStart;
  }
  if (task.assigneeId === null || !attendees.includes(task.assigneeId)) {
    assignTask(state, fixTaskId, leadId);
  }
  state.stats.meetings += 1;
  state.stats.crisisMeetings += 1;
  // Le meneur est celui qui a la réparation en main en sortant de la salle.
  const fixerId = task.assigneeId ?? leadId;
  const lead = state.components.identity[fixerId]?.name ?? '?';
  const message = text(
    attendees.length > 1
      ? [
          'Réunion de crise ({room}) : {count} personnes autour de la table, {lead} mène la réparation.',
          'Crisis meeting ({room}): {count} people around the table, {lead} leads the fix.',
        ]
      : [
          'Réunion de crise ({room}) : {lead}, seul·e autour de la table, mène la réparation.',
          'Crisis meeting ({room}): {lead}, alone at the table, leads the fix.',
        ],
    { room: format.name, count: attendees.length, lead },
  );
  addDevLog(
    state,
    fixerId,
    text(['A mené la réunion de crise sur la panne.', 'Led the crisis meeting on the outage.']),
  );
  notify(state, ctx, 'CRISIS_MEETING', message, fixerId);
  return true;
}
