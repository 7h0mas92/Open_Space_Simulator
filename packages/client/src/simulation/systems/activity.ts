import { BALANCE, type Activity, type DevTrait, type EntityId, type GameState } from '@oss/shared';
import { clamp, devIds, devsWithRole, type SimContext } from '../helpers';
import { autoAssign } from '../tasks';
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
 * (travailler, café, réunion, discuter, se disputer, dormir, crier, babyfoot, rentrer).
 * C'est la partie « décision » des behavior trees ; le déplacement à l'écran (A*)
 * est l'affaire du rendu, qui lit `activity.kind` et `activity.withId`.
 */
export function activitySystem(state: GameState, ctx: SimContext, clock: SimClock): void {
  const ids = devIds(state);
  const hasPO = devsWithRole(state, 'PRODUCT_OWNER').length > 0;
  const meeting = hasPO && isMeetingTime(clock);
  if (meeting) state.stats.meetings += 1;
  const { activity: odds } = BALANCE;
  // Y a-t-il encore des tâches à prendre ? Calculé seulement si un dev est sans tâche,
  // pour ne pas parcourir le Kanban à chaque tick.
  let tasksAvailable: boolean | undefined = state.stage === 'EXECUTION' ? undefined : false;
  const hasFreeTask = (): boolean => {
    for (const id in state.components.task) {
      const task = state.components.task[id];
      if (
        task &&
        task.assigneeId === null &&
        (task.column === 'TODO' || task.column === 'IN_PROGRESS')
      )
        return true;
    }
    return false;
  };

  // Devs disponibles pour une discussion ou une dispute (au bureau, pas en pause).
  const available = new Set<EntityId>();
  for (const id of ids) {
    const identity = state.components.identity[id];
    const current = state.components.activity[id];
    if (!identity || !current || id in state.components.remote) continue;
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

    if (!isPresent(identity.trait, clock)) {
      setActivity(state, id, 'GONE', 1);
      continue;
    }
    // Une pause en cours continue jusqu'à son terme.
    const onBreak =
      current.kind !== 'WORKING' && current.kind !== 'IDLE' && current.kind !== 'GONE';
    if (onBreak && current.untilTick > state.tick) continue;

    if (!worker.taskId && BALANCE.work.autoAssign && tasksAvailable !== false) {
      tasksAvailable ??= hasFreeTask();
      if (tasksAvailable) tasksAvailable = autoAssign(state, id) !== null;
    }
    const work: Activity = worker.taskId && state.stage === 'EXECUTION' ? 'WORKING' : 'IDLE';

    // Les télétravailleurs et l'IA Agent ne font jamais de pause visible
    // (un télétravailleur épuisé fait quand même la sieste sur son canapé).
    if (id in state.components.remote || identity.role === 'AI_AGENT') {
      const nap = mood.energy < BALANCE.energy.sleepThreshold && identity.role !== 'AI_AGENT';
      setActivity(state, id, nap ? 'SLEEPING' : work, 1);
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
}
