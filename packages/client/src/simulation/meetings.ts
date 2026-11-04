import {
  DAILY_SYNC,
  MEETINGS,
  PHASES,
  ROLE_TRADE,
  getMeetingFormat,
  taskTrade,
  type CommandError,
  type CommandResult,
  type DevRole,
  type EntityId,
  type GameState,
  type MeetingFormat,
  type MeetingFormatId,
  type MorningSyncEntry,
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
import { sideRng, type Rng } from './rng';
import { getClock, type SimClock } from './time';
import { researchUnlocked } from './research';

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
  if (!researchUnlocked(state, `meeting:${format.id}`)) return 'LOCKED';
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
  return sideRng(state.seed, 'meeting', state.tick);
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
  recordMorningSync(state, attendees, useful);
  if (useful) state.stats.meetingsUseful += 1;
  else state.stats.meetingsUseless += 1;
  notify(
    state,
    ctx,
    useful ? 'MEETING_USEFUL' : 'MEETING_USELESS',
    useful ? format.usefulText : format.uselessText,
  );
}

// ─── Daily : le point sur les tickets ──────────────────────────────────────

/**
 * Note le point de chaque participant sur son ticket : avancement du jour et, si le ticket était
 * déjà là au Daily précédent, celui de la veille. C'est ce que montre l'appli de tickets projetée
 * dans la salle. Aucun tirage.
 */
function recordMorningSync(state: GameState, attendees: readonly EntityId[], useful: boolean) {
  const previous = new Map(
    (state.morningSync?.entries ?? []).map((entry) => [entry.taskId, entry.progress]),
  );
  const entries: MorningSyncEntry[] = [];
  for (const devId of attendees) {
    const taskId = state.components.worker[devId]?.taskId;
    const task = taskId ? state.components.task[taskId] : undefined;
    if (!taskId || !task || task.column === 'DONE') continue;
    const progress = clamp(task.progress / task.work, 0, 1);
    entries.push({ devId, taskId, progress, before: previous.get(taskId) ?? null });
  }
  state.morningSync = {
    day: getClock(state).day,
    tick: state.tick,
    useful,
    attendees: [...attendees],
    entries,
  };
}

/** Bonus de productivité d'un dev qui sort d'un Daily utile ce matin (0 sinon). */
export function dailyFocus(state: GameState, devId: EntityId): number {
  const sync = state.morningSync;
  if (!sync?.useful || !sync.attendees.includes(devId)) return 0;
  return sync.day === getClock(state).day ? DAILY_SYNC.focusBonus : 0;
}

/** Devs du code qui ont un ticket de code en cours et sont au travail (au bureau ou chez eux). */
function busyCoders(state: GameState): EntityId[] {
  return devIds(state).filter((id) => {
    const role = state.components.identity[id]?.role;
    if (!role || ROLE_TRADE[role] !== 'DEV') return false;
    const kind = state.components.activity[id]?.kind;
    if (kind === undefined || kind === 'GONE') return false;
    const taskId = state.components.worker[id]?.taskId;
    const task = taskId ? state.components.task[taskId] : undefined;
    return task !== undefined && task.column === 'IN_PROGRESS' && taskTrade(task) === 'DEV';
  });
}

/** Chance du jour que deux devs codent la même chose, sachant qui était au Daily. */
export function duplicateOdds(coders: number, unsynced: number): number {
  if (coders < DAILY_SYNC.duplicateMinCoders || unsynced === 0) return 0;
  const base = Math.min(
    DAILY_SYNC.duplicateMaxOdds,
    DAILY_SYNC.duplicateOddsPerCoder * (coders - 2),
  );
  return (base * unsynced) / coders;
}

/**
 * Travail en double, à 10h en semaine : sans Daily ce matin, personne ne sait qui fait quoi.
 * Un dev qui n'y était pas découvre qu'un collègue a déjà codé une partie de son ticket : cette
 * partie est perdue. Tiré sur une graine à part (graine + tick), jamais sur `ctx.rng`.
 */
export function checkDuplicateWork(state: GameState, ctx: SimContext, clock: SimClock): void {
  if (state.stage !== 'EXECUTION' || clock.isWeekend) return;
  if (clock.hour !== DAILY_SYNC.duplicateHour) return;
  if (phaseIndex(state.phase) < phaseIndex(DAILY_SYNC.duplicatePhase)) return;
  const coders = busyCoders(state);
  const sync = state.morningSync?.day === clock.day ? state.morningSync : null;
  const unsynced = coders.filter((id) => !sync?.attendees.includes(id));
  const odds = duplicateOdds(coders.length, unsynced.length);
  if (odds <= 0) return;
  const rng = sideRng(state.seed, 'duplicate', state.tick);
  if (!rng.chance(odds)) return;
  const victimId = rng.pick(unsynced);
  const partnerId = rng.pick(coders.filter((id) => id !== victimId));
  const taskId = state.components.worker[victimId]?.taskId;
  const task = taskId ? state.components.task[taskId] : undefined;
  if (!task) return;
  const lost = Math.min(
    task.progress,
    task.work * rng.range(DAILY_SYNC.duplicateLossMin, DAILY_SYNC.duplicateLossMax),
  );
  if (lost <= 0) return;
  // Le travail perdu emporte sa part de qualité et de dette.
  const kept = (task.progress - lost) / task.progress;
  task.progress -= lost;
  task.qualitySum *= kept;
  task.debtFactor *= kept;
  state.stats.duplicateWork += 1;
  const victim = state.components.identity[victimId]?.name ?? '?';
  const partner = state.components.identity[partnerId]?.name ?? '?';
  addDevLog(
    state,
    victimId,
    text(
      ['A recodé ce que {partner} avait déjà fait.', 'Re-coded what {partner} had already done.'],
      {
        partner,
      },
    ),
  );
  notify(
    state,
    ctx,
    'DUPLICATE_WORK',
    text(
      [
        'Pas de Daily : {victim} et {partner} ont codé la même chose. {percent} % de « {task} » à refaire.',
        'No Daily: {victim} and {partner} coded the same thing. {percent}% of "{task}" to redo.',
      ],
      { victim, partner, percent: Math.round((lost / task.work) * 100), task: task.title },
    ),
    victimId,
  );
}

// ─── Réunion de crise ───────────────────────────────────────────────────────

/** Dev présent au bureau (ni rentré chez lui, ni en télétravail) : il peut venir en salle. */
function onSite(state: GameState, id: EntityId): boolean {
  const kind = state.components.activity[id]?.kind;
  return kind !== undefined && kind !== 'GONE' && !(id in state.components.remote);
}

/** Les premiers appelés quand la prod tombe : ceux qui la font tourner, puis le back. */
const ON_CALL_BONUS: Partial<Record<DevRole, number>> = { DEVOPS: 6, TECH_LEAD: 5, BACKEND: 2 };

/** Solidité d'un dev face à une panne : métier, qualité et expérience (à égalité, l'ordre de l'équipe). */
function firefighterScore(state: GameState, id: EntityId): number {
  const role = state.components.identity[id]?.role;
  const quality = state.components.stats[id]?.quality ?? 0;
  const level = state.components.employment[id]?.level ?? 1;
  return (role ? (ON_CALL_BONUS[role] ?? 0) : 0) + quality + level * 0.5;
}

/**
 * Les personnes concernées par une panne : le coupable s'il est là, puis les devs du code les
 * plus solides jusqu'à `MEETINGS.crisisDevs` (DevOps et Tech Lead d'abord), et le Product Owner
 * ou, à défaut, un manager (c'est lui qui prévient les clients). Le premier dev qui n'est pas le coupable mène la réparation.
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
  // Quelqu'un pour prévenir les clients : le Product Owner, sinon un manager.
  const owner =
    present.find((id) => role(id) === 'PRODUCT_OWNER') ??
    present.find((id) => role(id) === 'MANAGER');
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
