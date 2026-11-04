import {
  TEAM_LIFE,
  calendarStartDays,
  civilFromDays,
  isBridgeDay,
  workingHolidayOn,
  type Absence,
  type AbsenceKind,
  type CommandResult,
  type EntityId,
  type GameState,
  type PublicHoliday,
  type TeamLifeState,
} from '@oss/shared';
import { resignDev } from './devs';
import { addDevLog, changeMoral, clamp, devIds, notify, text, type SimContext } from './helpers';
import { sideRng } from './rng';
import type { SimClock } from './time';

/*
 * Vie de l'équipe : congés payés, jours fériés, ponts et arrêts maladie.
 *
 * - Chaque dev gagne 1 jour de congé par sprint (10 au plus). Le joueur les pose pendant la
 *   planification ; un dev qui garde sa réserve pleine finit par les poser lui-même.
 * - Les jours fériés français sont chômés ; un férié le jeudi ou le mardi crée un pont.
 * - Un moral à 0 ne mène plus directement à la démission : d'abord un arrêt d'un sprint,
 *   la démission seulement en cas de rechute dans les 10 sprints.
 * - Petits arrêts maladie (rhume, gastro) tirés sur une graine à part : `ctx.rng` n'est
 *   jamais utilisé ici, le reste de la partie tire les mêmes nombres.
 *
 * Tout dépend de `state.teamLife` : null (vieilles sauvegardes, défi « 3 sprints »), rien ne
 * change par rapport à avant.
 */

/** Profils qui ne prennent ni congés ni arrêts : le Dev Fantôme est invisible, l'IA ne dort pas. */
function takesLeave(state: GameState, id: EntityId): boolean {
  const role = state.components.identity[id]?.role;
  return role !== undefined && role !== 'GHOST' && role !== 'AI_AGENT';
}

/** Jour de partie → jours depuis 1970. */
function realDay(state: GameState, gameDay: number): number {
  return calendarStartDays(state.seed) + gameDay;
}

/** Jour férié chômé ce jour de partie, ou null (toujours null sans vie d'équipe). */
export function holidayOf(state: GameState, gameDay: number): PublicHoliday | null {
  return state.teamLife ? workingHolidayOn(realDay(state, gameDay)) : null;
}

/** Jour de pont ce jour de partie (sans vie d'équipe : jamais). */
export function isBridge(state: GameState, gameDay: number): boolean {
  return state.teamLife !== null && isBridgeDay(realDay(state, gameDay));
}

/** Absence du dev à ce jour de partie, ou null. */
export function absenceOn(state: GameState, id: EntityId, gameDay: number): Absence | null {
  const absence = state.teamLife?.absences[id];
  return absence && absence.from <= gameDay && gameDay < absence.until ? absence : null;
}

/** Le dev est-il absent aujourd'hui (congé, pont, arrêt) ? */
export function isAbsent(state: GameState, id: EntityId, clock: SimClock): boolean {
  return absenceOn(state, id, clock.day) !== null;
}

/** Devs absents aujourd'hui (pour la clé du cache des effets du bureau). */
export function absentIds(state: GameState, gameDay: number): EntityId[] {
  const absences = state.teamLife?.absences;
  if (!absences) return [];
  return Object.keys(absences).filter((id) => absenceOn(state, id, gameDay) !== null);
}

/** Jour de partie qui suit `count` jours ouvrés à partir de `from` (week-ends et fériés sautés). */
function afterWorkingDays(state: GameState, from: number, count: number): number {
  let day = from;
  let left = count;
  while (left > 0) {
    const weekday = (day % 7) + 1;
    if (weekday <= 5 && holidayOf(state, day) === null) left -= 1;
    day += 1;
  }
  return day;
}

/** Premier jour de partie du sprint `sprint` (un lundi). */
function sprintFirstDay(sprint: number): number {
  return (sprint - 1) * 14;
}

/** Libère la tâche d'un dev qui s'absente : elle repart dans « À faire ». */
function releaseTask(state: GameState, id: EntityId): void {
  const worker = state.components.worker[id];
  const taskId = worker?.taskId;
  if (!worker || !taskId) return;
  const task = state.components.task[taskId];
  if (task) task.assigneeId = null;
  worker.taskId = null;
}

const ABSENCE_MESSAGES: Record<AbsenceKind, readonly [string, string]> = {
  LEAVE: [
    '{name} est en congés pour {days} jour(s). Pas de Slack sur la plage.',
    '{name} is on leave for {days} day(s). No Slack on the beach.',
  ],
  BRIDGE: ['{name} fait le pont.', '{name} takes the bridge day off.'],
  SICK: [
    '{name} est malade ({days} jour(s)) et a envoyé un selfie avec un thermomètre.',
    '{name} is sick ({days} day(s)) and sent a selfie with a thermometer.',
  ],
  BURNOUT: [
    '{name} fait un burn-out : arrêt maladie de {days} jours ouvrés.',
    '{name} burned out: {days} working days of sick leave.',
  ],
};

const ABSENCE_NOTIFICATIONS = {
  LEAVE: 'DEV_ON_LEAVE',
  BRIDGE: 'DEV_ON_LEAVE',
  SICK: 'DEV_SICK',
  BURNOUT: 'DEV_BURNOUT',
} as const;

/** Annonce une absence qui commence aujourd'hui. */
function announceAbsence(state: GameState, ctx: SimContext, id: EntityId, absence: Absence): void {
  const name = state.components.identity[id]?.name ?? '?';
  const message = text(ABSENCE_MESSAGES[absence.kind], { name, days: absence.days });
  addDevLog(state, id, message);
  notify(state, ctx, ABSENCE_NOTIFICATIONS[absence.kind], message, id);
}

/** Retour d'absence : moral et énergie selon le type d'absence. */
function endAbsence(state: GameState, ctx: SimContext, life: TeamLifeState, id: EntityId): void {
  const absence = life.absences[id];
  if (!absence) return;
  Reflect.deleteProperty(life.absences, id);
  const mood = state.components.mood[id];
  if (!mood) return;
  mood.energy = 100;
  if (absence.kind === 'BURNOUT') mood.moral = Math.max(mood.moral, TEAM_LIFE.burnoutReturnMoral);
  else if (absence.kind === 'LEAVE' || absence.kind === 'BRIDGE')
    changeMoral(
      state,
      id,
      Math.min(TEAM_LIFE.moralLeaveMax, absence.days * TEAM_LIFE.moralPerLeaveDay),
    );
  const name = state.components.identity[id]?.name ?? '?';
  const message = text(
    absence.kind === 'BURNOUT' || absence.kind === 'SICK'
      ? ['{name} est de retour, en meilleure forme.', '{name} is back and feeling better.']
      : [
          '{name} rentre de congés, bronzé·e et reposé·e.',
          '{name} is back from leave, tanned and rested.',
        ],
    { name },
  );
  addDevLog(state, id, message);
  notify(state, ctx, 'DEV_BACK', message, id);
}

/** Congé prévu annulé par un arrêt maladie : les jours reviennent dans la réserve. */
function refundLeave(state: GameState, life: TeamLifeState, id: EntityId, absence: Absence): void {
  if (absence.kind !== 'LEAVE') return;
  life.leave[id] = (life.leave[id] ?? 0) + absence.days;
  state.stats.leaveDays = Math.max(0, state.stats.leaveDays - absence.days);
}

/** Probabilité d'un petit arrêt maladie aujourd'hui, selon la saison et l'endurance. */
function sickChance(state: GameState, id: EntityId, gameDay: number): number {
  const { month } = civilFromDays(realDay(state, gameDay));
  const winter = TEAM_LIFE.sickWinterMonths.includes(month) ? TEAM_LIFE.sickWinterMultiplier : 1;
  const endurance = state.components.stats[id]?.endurance ?? 5;
  return TEAM_LIFE.sickDaily * winter * (1 - TEAM_LIFE.enduranceProtection * endurance);
}

/**
 * Système « vie de l'équipe », chaque matin de semaine à 8h (avant le télétravail) : retours
 * d'absence, congés qui commencent, ponts, petits arrêts maladie, réserves pleines.
 */
export function teamLifeSystem(state: GameState, ctx: SimContext, clock: SimClock): void {
  const life = state.teamLife;
  if (!life || clock.hour !== TEAM_LIFE.decisionHour || clock.dayOfWeek > 5) return;
  const today = clock.day;
  const holiday = holidayOf(state, today);
  if (holiday) {
    announceHoliday(state, ctx, holiday);
    return;
  }

  // Retours : l'absence est finie avant aujourd'hui.
  for (const id of Object.keys(life.absences)) {
    const absence = life.absences[id];
    if (absence && absence.until <= today) endAbsence(state, ctx, life, id);
  }

  const bridge = isBridge(state, today) && life.bridgesRefusedSprint !== state.sprint;
  const rng = sideRng(state.seed, 'leave', today);
  for (const id of devIds(state)) {
    if (!takesLeave(state, id)) continue;
    const absence = life.absences[id];
    // Congé posé qui commence aujourd'hui (un burn-out est annoncé dès minuit).
    if (absence?.from === today && absence.kind === 'LEAVE') {
      releaseTask(state, id);
      announceAbsence(state, ctx, id, absence);
      continue;
    }
    if (absence && absence.from <= today) continue;
    // Pont : ceux qui ont encore un jour en réserve en profitent (sauf le bourreau de travail).
    const trait = state.components.identity[id]?.trait;
    if (bridge && !absence && trait !== 'WORKAHOLIC' && (life.leave[id] ?? 0) >= 1) {
      life.leave[id] = (life.leave[id] ?? 0) - 1;
      const bridgeDay: Absence = { kind: 'BRIDGE', from: today, until: today + 1, days: 1 };
      life.absences[id] = bridgeDay;
      state.stats.leaveDays += 1;
      releaseTask(state, id);
      announceAbsence(state, ctx, id, bridgeDay);
      continue;
    }
    // Petit arrêt maladie. Un congé prévu plus tard dans le sprint est alors annulé (rendu).
    if (rng.chance(sickChance(state, id, today))) {
      const days = rng.int(TEAM_LIFE.sickDaysMin, TEAM_LIFE.sickDaysMax);
      if (absence) refundLeave(state, life, id, absence);
      const sick: Absence = {
        kind: 'SICK',
        from: today,
        until: afterWorkingDays(state, today, days),
        days,
      };
      life.absences[id] = sick;
      state.stats.sickDays += days;
      releaseTask(state, id);
      announceAbsence(state, ctx, id, sick);
      continue;
    }
    // Réserve pleine : le dev réclame ses vacances.
    if (!absence && (life.leave[id] ?? 0) >= TEAM_LIFE.leaveMax)
      changeMoral(state, id, -TEAM_LIFE.claimMoralPerDay);
  }
}

const HOLIDAY_NAMES: Record<PublicHoliday, readonly [string, string]> = {
  NEW_YEAR: ['Jour de l’an', 'New Year’s Day'],
  EASTER_MONDAY: ['Lundi de Pâques', 'Easter Monday'],
  LABOUR_DAY: ['Fête du Travail', 'Labour Day'],
  VICTORY_1945: ['Victoire 1945', 'Victory in Europe Day'],
  ASCENSION: ['Ascension', 'Ascension Day'],
  WHIT_MONDAY: ['Lundi de Pentecôte', 'Whit Monday'],
  BASTILLE_DAY: ['Fête nationale', 'Bastille Day'],
  ASSUMPTION: ['Assomption', 'Assumption Day'],
  ALL_SAINTS: ['Toussaint', 'All Saints’ Day'],
  ARMISTICE: ['Armistice', 'Armistice Day'],
  CHRISTMAS: ['Noël', 'Christmas Day'],
};

function announceHoliday(state: GameState, ctx: SimContext, holiday: PublicHoliday): void {
  const [fr, en] = HOLIDAY_NAMES[holiday];
  notify(
    state,
    ctx,
    'PUBLIC_HOLIDAY',
    text(
      [
        'Jour férié ({holiday}) : le bureau est fermé, la prod reste allumée.',
        'Public holiday ({holiday}): the office is closed, prod stays up.',
      ],
      { holiday: { fr, en } },
    ),
  );
}

/**
 * Début de planification : chaque dev gagne ses jours de congé du sprint écoulé. Un dev dont
 * la réserve est pleine depuis 2 sprints pose lui-même 5 jours en début de sprint.
 */
export function leavePlanning(state: GameState, ctx: SimContext): void {
  const life = state.teamLife;
  if (!life) return;
  if (life.bridgesRefusedSprint !== null && life.bridgesRefusedSprint < state.sprint)
    life.bridgesRefusedSprint = null;
  if (state.sprint <= 1) return;
  for (const id of devIds(state)) {
    if (!takesLeave(state, id)) continue;
    const before = life.leave[id] ?? 0;
    life.leave[id] = Math.min(TEAM_LIFE.leaveMax, before + TEAM_LIFE.leavePerSprint);
    if (before < TEAM_LIFE.leaveMax || life.absences[id]) {
      life.claims[id] = 0;
      continue;
    }
    const claims = (life.claims[id] ?? 0) + 1;
    life.claims[id] = claims;
    if (claims >= TEAM_LIFE.claimSprintsBeforeAuto) {
      book(state, life, id, 0, TEAM_LIFE.autoLeaveDays);
      life.claims[id] = 0;
      const name = state.components.identity[id]?.name ?? '?';
      const message = text(
        [
          '{name} n’a pas pris de vacances depuis des mois : il·elle pose 5 jours lundi.',
          '{name} hasn’t taken a holiday in months: booking 5 days off from Monday.',
        ],
        { name },
      );
      addDevLog(state, id, message);
      notify(state, ctx, 'DEV_ON_LEAVE', message, id);
    }
  }
}

/** Places de congé par semaine : une par tranche de 4 devs, au moins une. */
export function leaveSlots(state: GameState): number {
  return Math.max(1, Math.floor(devIds(state).length / TEAM_LIFE.devsPerLeaveSlot));
}

/** Devs qui ont des congés posés pendant la semaine `week` du sprint qui commence. */
function bookedInWeek(life: TeamLifeState, sprint: number, week: 0 | 1): number {
  const from = sprintFirstDay(sprint) + week * 7;
  return Object.values(life.absences).filter(
    (absence) => absence.kind === 'LEAVE' && absence.from === from,
  ).length;
}

function book(
  state: GameState,
  life: TeamLifeState,
  id: EntityId,
  week: 0 | 1,
  days: number,
): void {
  const from = sprintFirstDay(state.sprint) + week * 7;
  life.absences[id] = { kind: 'LEAVE', from, until: afterWorkingDays(state, from, days), days };
  life.leave[id] = Math.max(0, (life.leave[id] ?? 0) - days);
  state.stats.leaveDays += days;
}

/** Commande BOOK_LEAVE : pose des congés pendant la planification. */
export function bookLeave(
  state: GameState,
  devId: EntityId,
  week: 0 | 1,
  days: number,
): CommandResult {
  const life = state.teamLife;
  if (!life) return { ok: false, error: 'NOT_AVAILABLE' };
  if (state.stage !== 'PLANNING') return { ok: false, error: 'WRONG_STAGE' };
  if (!state.components.identity[devId]) return { ok: false, error: 'NOT_FOUND' };
  if (!takesLeave(state, devId)) return { ok: false, error: 'NOT_ELIGIBLE' };
  if (life.absences[devId]) return { ok: false, error: 'NOT_AVAILABLE' };
  if ((life.leave[devId] ?? 0) < days) return { ok: false, error: 'NOT_ENOUGH_LEAVE' };
  if (bookedInWeek(life, state.sprint, week) >= leaveSlots(state))
    return { ok: false, error: 'LEAVE_SLOTS_FULL' };
  book(state, life, devId, week, days);
  life.claims[devId] = 0;
  addDevLog(
    state,
    devId,
    text(['Congés posés : {days} jour(s).', 'Leave booked: {days} day(s).'], { days }),
  );
  return { ok: true };
}

/** Commande CANCEL_LEAVE : annule des congés posés qui n'ont pas commencé. */
export function cancelLeave(state: GameState, devId: EntityId): CommandResult {
  const life = state.teamLife;
  if (!life) return { ok: false, error: 'NOT_AVAILABLE' };
  if (state.stage !== 'PLANNING') return { ok: false, error: 'WRONG_STAGE' };
  const absence = life.absences[devId];
  if (absence?.kind !== 'LEAVE' || absence.from < sprintFirstDay(state.sprint))
    return { ok: false, error: 'NOT_FOUND' };
  Reflect.deleteProperty(life.absences, devId);
  refundLeave(state, life, devId, absence);
  return { ok: true };
}

/** Le sprint qui commence a-t-il un pont ? */
export function sprintHasBridge(state: GameState): boolean {
  if (!state.teamLife) return false;
  const first = sprintFirstDay(state.sprint);
  for (let day = first; day < first + 14; day++) if (isBridge(state, day)) return true;
  return false;
}

/** Commande REFUSE_BRIDGES : tout le monde vient travailler les jours de pont du sprint. */
export function refuseBridges(state: GameState, refuse: boolean): CommandResult {
  const life = state.teamLife;
  if (!life) return { ok: false, error: 'NOT_AVAILABLE' };
  if (state.stage !== 'PLANNING') return { ok: false, error: 'WRONG_STAGE' };
  if (!sprintHasBridge(state)) return { ok: false, error: 'NOT_AVAILABLE' };
  if (refuse === (life.bridgesRefusedSprint === state.sprint)) return { ok: true };
  // Le moral est perdu (ou rendu) tout de suite par ceux qui auraient fait le pont.
  const delta = refuse ? -TEAM_LIFE.bridgeRefusedMoral : TEAM_LIFE.bridgeRefusedMoral;
  for (const id of devIds(state)) {
    if (!takesLeave(state, id) || state.components.identity[id]?.trait === 'WORKAHOLIC') continue;
    if ((life.leave[id] ?? 0) >= 1) changeMoral(state, id, delta);
  }
  life.bridgesRefusedSprint = refuse ? state.sprint : null;
  return { ok: true };
}

/**
 * Moral à 0. Sans vie d'équipe : démission (comme avant). Avec : arrêt pour burn-out d'un
 * sprint, ou démission en cas de rechute dans les 10 sprints.
 */
export function burnOut(state: GameState, ctx: SimContext, id: EntityId, gameDay: number): void {
  const life = state.teamLife;
  const last = life?.lastBurnout[id];
  if (
    !life ||
    !takesLeave(state, id) ||
    (last !== undefined && state.sprint - last < TEAM_LIFE.burnoutRelapseSprints)
  ) {
    resignDev(state, ctx, id);
    return;
  }
  const previous = life.absences[id];
  if (previous) refundLeave(state, life, id, previous);
  const from = gameDay;
  const absence: Absence = {
    kind: 'BURNOUT',
    from,
    until: afterWorkingDays(state, from, TEAM_LIFE.burnoutDays),
    days: TEAM_LIFE.burnoutDays,
  };
  life.absences[id] = absence;
  life.lastBurnout[id] = state.sprint;
  state.stats.burnouts += 1;
  state.stats.burnoutLeaves += 1;
  state.stats.sickDays += TEAM_LIFE.burnoutDays;
  const mood = state.components.mood[id];
  if (mood) mood.moral = clamp(mood.moral, 1, 100);
  releaseTask(state, id);
  announceAbsence(state, ctx, id, absence);
}
