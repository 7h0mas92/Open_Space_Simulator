import {
  BALANCE,
  TIME,
  type Activity,
  type DevTrait,
  type EntityId,
  type GameState,
  isManagementRole,
} from '@oss/shared';
import { clamp, devIds, devsWithRole, type SimContext } from '../helpers';
import { holdTeamMeeting, isTeamMeetingTime } from '../meetings';
import { autoAssign, devQueueKey, devTrade, hasFreeTask } from '../tasks';
import { isAbsent } from '../teamLife';
import { retroActive } from '../retro';
import type { SimClock } from '../time';

/** Le dev est-il au bureau (ou connecté, pour le Dev Fantôme) à cette heure ? */
export function isPresent(trait: DevTrait, clock: SimClock): boolean {
  if (clock.dayOfWeek === 7) return false;
  if (clock.dayOfWeek === 6 && trait !== 'WORKAHOLIC') return false;
  const shift = trait === 'NIGHT_OWL' ? BALANCE.work.nightOwlShift : 0;
  const extra = trait === 'WORKAHOLIC' ? BALANCE.work.workaholicExtraHours : 0;
  return (
    clock.hour >= BALANCE.work.arrivalHour + shift &&
    clock.hour < BALANCE.work.leaveHour + shift + extra
  );
}

export const BREAK_SLOTS = ['morning', 'lunch', 'afternoon'] as const;
export type BreakSlot = (typeof BREAK_SLOTS)[number];

/**
 * Vraie pause à heure fixe en cours pour un dev, ou null. `rank` (son rang dans l'équipe)
 * décale un dev sur deux d'une demi-heure. Le bourreau de travail saute les pauses courtes,
 * mais pas le déjeuner.
 */
export function scheduledBreak(
  trait: DevTrait,
  rank: number,
  clock: SimClock,
): { slot: BreakSlot; endHour: number } | null {
  if (clock.isWeekend) return null;
  const shift =
    (trait === 'NIGHT_OWL' ? BALANCE.work.nightOwlShift : 0) + (rank % 2) * BALANCE.breaks.stagger;
  for (const slot of BREAK_SLOTS) {
    if (slot !== 'lunch' && trait === 'WORKAHOLIC') continue;
    const { hour, hours } = BALANCE.breaks[slot];
    const start = hour + shift;
    if (clock.hour >= start && clock.hour < start + hours) return { slot, endHour: start + hours };
  }
  return null;
}

/** Que faire d'une pause courte ? Café, babyfoot ou balade dans la cuisine, selon le caractère. */
function pickShortBreak(state: GameState, ctx: SimContext, trait: DevTrait): Activity {
  const b = BALANCE.breaks;
  const options: readonly (readonly [Activity, number])[] = [
    ['COFFEE', state.gauges.coffee > 0 ? b.coffeeWeight * (trait === 'COFFEE_ADDICT' ? 2 : 1) : 0],
    ['BABYFOOT', ctx.office.babyfoot ? b.babyfootWeight * (trait === 'GAMER' ? 3 : 1) : 0],
    ['BREAK', b.strollWeight * (trait === 'CHATTERBOX' ? 2 : 1)],
  ];
  const total = options.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = ctx.rng.next() * total;
  for (const [kind, weight] of options) {
    roll -= weight;
    if (roll < 0) return kind;
  }
  return 'BREAK';
}

/** Heure de réunion du Product Owner (4 par jour). */
export function isMeetingTime(clock: SimClock): boolean {
  return !clock.isWeekend && BALANCE.work.poMeetingHours.some((hour) => hour === clock.hour);
}

function setActivity(
  state: GameState,
  id: EntityId,
  kind: Activity,
  ticks: number,
  withId: EntityId | null = null,
): void {
  const activity = state.components.activity[id];
  if (!activity) return;
  activity.kind = kind;
  activity.untilTick = state.tick + ticks;
  activity.withId = withId;
}

function changeAffinity(state: GameState, a: EntityId, b: EntityId, delta: number): void {
  const ab = state.components.relations[a];
  const ba = state.components.relations[b];
  if (ab && b in ab) ab[b] = clamp((ab[b] ?? 0) + delta, -100, 100);
  if (ba && a in ba) ba[a] = clamp((ba[a] ?? 0) + delta, -100, 100);
}

/** Collègue présent avec la meilleure (ou la pire) affinité. */
function pickColleague(
  state: GameState,
  id: EntityId,
  available: ReadonlySet<EntityId>,
  best: boolean,
): { id: EntityId; affinity: number } | null {
  const relations = state.components.relations[id] ?? {};
  let chosen: { id: EntityId; affinity: number } | null = null;
  for (const [otherId, affinity] of Object.entries(relations)) {
    if (!available.has(otherId)) continue;
    if (!chosen || (best ? affinity > chosen.affinity : affinity < chosen.affinity)) {
      chosen = { id: otherId, affinity };
    }
  }
  return chosen;
}

/**
 * Système « activité » : décide à chaque tick ce que fait chaque personnage
 * (travailler, pause, déjeuner, café, réunion, discuter, se disputer, dormir, crier,
 * babyfoot, rentrer).
 * C'est la partie « décision » des behavior trees ; le déplacement à l'écran (A*)
 * est l'affaire du rendu, qui lit `activity.kind` et `activity.withId`.
 */
export function activitySystem(state: GameState, ctx: SimContext, clock: SimClock): void {
  const ids = devIds(state);
  const hasPO = devsWithRole(state, 'PRODUCT_OWNER').length > 0;
  // Rétro « mercredi sans réunion » : le Product Owner garde ses réunions pour les autres jours.
  const meeting =
    hasPO &&
    isMeetingTime(clock) &&
    !(clock.dayOfWeek === 3 && retroActive(state, 'NO_MEETING_WEDNESDAY'));
  if (meeting) state.stats.meetings += 1;
  // Réunion d'équipe du matin, dès que la salle de réunion est aménagée.
  const teamMeeting = isTeamMeetingTime(state, clock);
  if (teamMeeting) state.stats.meetings += 1;
  const attendees: EntityId[] = [];
  const { activity: odds } = BALANCE;
  // Reste-t-il des tâches à prendre, métier par métier (et côté de la stack) ? Calculé
  // seulement si un dev est sans tâche, pour ne pas parcourir le Kanban à chaque tick.
  const tasksAvailable = new Map<string, boolean>();

  // Pause à heure fixe de chaque dev en ce moment (l'IA Agent n'en prend jamais).
  const pauses = new Map<EntityId, NonNullable<ReturnType<typeof scheduledBreak>>>();
  ids.forEach((id, rank) => {
    const identity = state.components.identity[id];
    if (!identity || identity.role === 'AI_AGENT') return;
    const pause = scheduledBreak(identity.trait, rank, clock);
    if (pause) pauses.set(id, pause);
  });

  // Devs disponibles pour une discussion ou une dispute (au bureau, pas en pause).
  const available = new Set<EntityId>();
  for (const id of ids) {
    const identity = state.components.identity[id];
    const current = state.components.activity[id];
    if (!identity || !current || id in state.components.remote || pauses.has(id)) continue;
    if (clock.holiday || isAbsent(state, id, clock)) continue;
    if (
      isPresent(identity.trait, clock) &&
      (current.untilTick <= state.tick || current.kind === 'WORKING' || current.kind === 'IDLE')
    ) {
      available.add(id);
    }
  }

  for (const id of ids) {
    const identity = state.components.identity[id];
    const mood = state.components.mood[id];
    const current = state.components.activity[id];
    const worker = state.components.worker[id];
    if (!identity || !mood || !current || !worker) continue;

    if (!isPresent(identity.trait, clock) || clock.holiday || isAbsent(state, id, clock)) {
      setActivity(state, id, 'GONE', 1);
      continue;
    }
    // Une pause en cours continue jusqu'à son terme.
    const onBreak =
      current.kind !== 'WORKING' && current.kind !== 'IDLE' && current.kind !== 'GONE';
    if (onBreak && current.untilTick > state.tick) continue;

    const trade = devTrade(state, id);
    const queueKey = devQueueKey(state, id);
    if (
      !worker.taskId &&
      trade &&
      queueKey &&
      BALANCE.work.autoAssign &&
      state.stage === 'EXECUTION'
    ) {
      if (tasksAvailable.get(queueKey) ?? hasFreeTask(state, trade))
        tasksAvailable.set(queueKey, autoAssign(state, id) !== null);
      else tasksAvailable.set(queueKey, false);
    }
    // L'encadrement « travaille » sans ticket : il pilote l'équipe depuis son bureau.
    const managing = isManagementRole(identity.role);
    const work: Activity =
      (worker.taskId || managing) && state.stage === 'EXECUTION' ? 'WORKING' : 'IDLE';

    // Vraie pause à heure fixe : elle dure jusqu'à la fin du créneau, réunion ou pas.
    const pause = pauses.get(id);
    if (pause) {
      const ticks = Math.max(1, Math.ceil((pause.endHour - clock.hour) * TIME.ticksPerHour));
      const kind: Activity =
        pause.slot === 'lunch'
          ? 'LUNCH'
          : id in state.components.remote
            ? 'BREAK'
            : pickShortBreak(state, ctx, identity.trait);
      setActivity(state, id, kind, ticks);
      continue;
    }

    // Hors des pauses à heure fixe, les télétravailleurs et l'IA Agent ne font pas de pause
    // imprévue (un télétravailleur épuisé fait quand même la sieste sur son canapé).
    if (id in state.components.remote || identity.role === 'AI_AGENT') {
      const nap = mood.energy < BALANCE.energy.sleepThreshold && identity.role !== 'AI_AGENT';
      setActivity(state, id, nap ? 'SLEEPING' : work, 1);
      continue;
    }
    if (teamMeeting) {
      setActivity(state, id, 'MEETING', 1);
      attendees.push(id);
      continue;
    }
    if (meeting && !ctx.office.meetingShielded[id]) {
      setActivity(state, id, 'MEETING', 1);
      continue;
    }
    if (mood.energy < BALANCE.energy.sleepThreshold) {
      setActivity(state, id, 'SLEEPING', 1);
      continue;
    }

    const rng = ctx.rng;
    const trait = identity.trait;
    const coffeeOdds =
      odds.coffeeBreak *
      (trait === 'COFFEE_ADDICT' ? 2 : 1) *
      (mood.energy < 40 ? 2 : 1) *
      (state.gauges.coffee > 0 ? 1 : 0);
    if (rng.chance(coffeeOdds)) {
      setActivity(state, id, 'COFFEE', 1);
      continue;
    }
    available.delete(id);
    // On tire d'abord au sort, puis on cherche un collègue : c'est beaucoup moins coûteux.
    if (rng.chance(odds.chat * (trait === 'CHATTERBOX' ? 2.5 : 1))) {
      const friend = pickColleague(state, id, available, true);
      if (friend && friend.affinity > 10) {
        setActivity(state, id, 'CHATTING', 1, friend.id);
        setActivity(state, friend.id, 'CHATTING', 1, id);
        available.delete(friend.id);
        changeAffinity(state, id, friend.id, BALANCE.relations.chatGain);
        continue;
      }
    }
    const egoFactor = (state.components.stats[id]?.ego ?? 5) / 5;
    if (rng.chance(odds.argue * egoFactor * (trait === 'GRUMPY' ? 2 : 1))) {
      const enemy = pickColleague(state, id, available, false);
      if (enemy && enemy.affinity < -30) {
        setActivity(state, id, 'ARGUING', 1, enemy.id);
        setActivity(state, enemy.id, 'ARGUING', 1, id);
        available.delete(enemy.id);
        changeAffinity(state, id, enemy.id, -BALANCE.relations.argueLoss);
        continue;
      }
    }
    if (
      work === 'WORKING' &&
      state.gauges.debt > 50 &&
      rng.chance((odds.yell * state.gauges.debt) / 50)
    ) {
      setActivity(state, id, 'YELLING', 1);
      continue;
    }
    if (
      ctx.office.babyfoot &&
      rng.chance(odds.babyfoot * (trait === 'GAMER' ? 3 : 1) * (work === 'IDLE' ? 3 : 1))
    ) {
      setActivity(state, id, 'BABYFOOT', 1);
      continue;
    }
    setActivity(state, id, work, 1);
    available.add(id);
  }
  if (teamMeeting) holdTeamMeeting(state, ctx, attendees);
}
