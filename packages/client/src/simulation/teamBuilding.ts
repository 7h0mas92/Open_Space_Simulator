import {
  OUTING_DEFINITIONS,
  TEAM_BUILDING,
  type CommandResult,
  type EntityId,
  type GameState,
  type OutingDefinition,
  type OutingId,
} from '@oss/shared';
import { phaseIndex } from './furniture';
import {
  addGauge,
  addMoney,
  changeMoral,
  clamp,
  devIds,
  moneyText,
  notify,
  text,
  type SimContext,
} from './helpers';
import { Rng } from './rng';
import { absenceOn } from './teamLife';
import type { SimClock } from './time';

/*
 * Team building (voir `packages/shared/src/sim/teamBuilding.ts`) : la sortie est réservée et
 * payée pendant la planification, l'équipe quitte le bureau en fin de 2e semaine, et les effets
 * tombent à 18h le dernier jour. Le hasard passe par `outingRng`, jamais par `ctx.rng`.
 */

/** Ni le Dev Fantôme (invisible) ni l'IA Agent (un serveur) ne viennent aux sorties. */
function joinsOutings(state: GameState, id: EntityId): boolean {
  const role = state.components.identity[id]?.role;
  return role !== undefined && role !== 'GHOST' && role !== 'AI_AGENT';
}

/** Devs qui participeraient à une sortie aujourd'hui (pas en congé ni en arrêt). */
export function outingParticipants(state: GameState, gameDay: number): EntityId[] {
  return devIds(state).filter(
    (id) => joinsOutings(state, id) && absenceOn(state, id, gameDay) === null,
  );
}

/** Prix d'une sortie pour l'équipe actuelle (au moins un participant compté). */
export function outingPrice(state: GameState, outing: OutingDefinition): number {
  const participants = devIds(state).filter((id) => joinsOutings(state, id)).length;
  return outing.pricePerDev * Math.max(1, participants);
}

/** Raison pour laquelle une sortie ne peut pas être réservée, ou null. */
export function outingBlocker(
  state: GameState,
  outing: OutingDefinition,
): 'LOCKED' | 'NOT_ENOUGH_MONEY' | 'COOLDOWN' | null {
  if (phaseIndex(state.phase) < phaseIndex(outing.phase)) return 'LOCKED';
  if (state.teamBuilding.booked?.sprint === state.sprint) return 'COOLDOWN';
  if (state.gauges.treasury < outingPrice(state, outing)) return 'NOT_ENOUGH_MONEY';
  return null;
}

/** Sortie réservée pour le sprint en cours, ou null. */
export function bookedOuting(state: GameState): OutingDefinition | null {
  const booked = state.teamBuilding.booked;
  return booked && booked.sprint === state.sprint ? OUTING_DEFINITIONS[booked.outing] : null;
}

/** L'équipe est-elle partie en sortie à cette heure ? */
export function isOnOuting(state: GameState, clock: SimClock): boolean {
  const outing = bookedOuting(state);
  if (!outing || state.stage !== 'EXECUTION') return false;
  const { dayInSprint: day, hour } = clock;
  if (day < outing.startDay || day > outing.endDay) return false;
  if (day === outing.startDay && hour < outing.startHour) return false;
  return hour < TEAM_BUILDING.endHour || outing.startHour >= TEAM_BUILDING.endHour;
}

/** Ce dev est-il parti en sortie à cette heure ? (Les absents et le Dev Fantôme, non.) */
export function awayOnOuting(state: GameState, id: EntityId, clock: SimClock): boolean {
  return (
    isOnOuting(state, clock) && joinsOutings(state, id) && absenceOn(state, id, clock.day) === null
  );
}

/** Commande BOOK_TEAM_BUILDING : réserve et paie la sortie pour la fin du sprint. */
export function bookTeamBuilding(
  state: GameState,
  ctx: SimContext,
  outingId: OutingId,
): CommandResult {
  if (state.stage !== 'PLANNING') return { ok: false, error: 'WRONG_STAGE' };
  const outing = OUTING_DEFINITIONS[outingId];
  const blocker = outingBlocker(state, outing);
  if (blocker) return { ok: false, error: blocker };
  const cost = outingPrice(state, outing);
  addMoney(state, -cost);
  state.teamBuilding.booked = { outing: outingId, sprint: state.sprint, cost };
  notify(
    state,
    ctx,
    'TEAM_BUILDING_BOOKED',
    text(
      [
        '{icon} Sortie d’équipe réservée pour la fin du sprint ({cost}).',
        '{icon} Team outing booked for the end of the sprint ({cost}).',
      ],
      { icon: outing.icon, cost: moneyText(cost) },
    ),
  );
  return { ok: true };
}

/** Commande CANCEL_TEAM_BUILDING : annule pendant la planification, remboursée à moitié. */
export function cancelTeamBuilding(state: GameState): CommandResult {
  if (state.stage !== 'PLANNING') return { ok: false, error: 'WRONG_STAGE' };
  const booked = state.teamBuilding.booked;
  if (!booked || booked.sprint !== state.sprint) return { ok: false, error: 'NOT_FOUND' };
  addMoney(state, booked.cost * TEAM_BUILDING.cancelRefund);
  state.teamBuilding.booked = null;
  return { ok: true };
}

/** Générateur dédié : même graine, même sprint ⇒ même sortie. */
function outingRng(state: GameState): Rng {
  return Rng.fromSeed(`${state.seed}#teambuilding#${state.sprint}`);
}

/** Ajoute `delta` à l'affinité de deux collègues, dans les deux sens. */
function bond(state: GameState, a: EntityId, b: EntityId, delta: number): void {
  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as const) {
    const relations = state.components.relations[from];
    if (relations) relations[to] = clamp((relations[to] ?? 0) + delta, -100, 100);
  }
}

const DONE_MESSAGES: Record<OutingId, readonly [string, string]> = {
  afterwork: [
    '🍕 Afterwork : pizzas, bières et un karaoké que personne n’avait demandé. Demain sera dur.',
    '🍕 Afterwork: pizza, beer and karaoke nobody asked for. Tomorrow will hurt.',
  ],
  'escape-game': ['🔐 Escape game terminé : {result}', '🔐 Escape game over: {result}'],
  'laser-game': [
    '🔫 Laser game : l’équipe de {winner} gagne. Les perdants demandent une revanche.',
    '🔫 Laser game: {winner}’s team wins. The losers want a rematch.',
  ],
  seminar: [
    '🌳 Séminaire au vert : ateliers post-it, balade en forêt, et des photos plein LinkedIn.',
    '🌳 Off-site in the countryside: sticky-note workshops, a forest walk and LinkedIn photos galore.',
  ],
  offsite: [
    '✈️ Retour de Lisbonne : l’équipe est soudée, bronzée, et a refactoré au bord de la piscine.',
    '✈️ Back from Lisbon: the team is united, tanned, and refactored by the pool.',
  ],
};

/**
 * Système « team building » : à 18h le dernier jour de la sortie, ses effets s'appliquent
 * (moral, relations, énergie, hype, dette) et la sortie est comptée.
 */
export function teamBuildingSystem(state: GameState, ctx: SimContext, clock: SimClock): void {
  const outing = bookedOuting(state);
  if (!outing || clock.dayInSprint !== outing.endDay || clock.hour !== TEAM_BUILDING.endHour)
    return;
  const rng = outingRng(state);
  const people = outingParticipants(state, clock.day);
  const repeat =
    state.teamBuilding.last?.outing === outing.id &&
    state.teamBuilding.last.sprint === state.sprint - 1;
  const moralFactor = repeat ? TEAM_BUILDING.repeatMoralFactor : 1;

  for (const id of people) {
    const trait = state.components.identity[id]?.trait;
    const taste =
      trait === 'GRUMPY'
        ? TEAM_BUILDING.grumpyFactor
        : trait === 'CHATTERBOX' || trait === 'GAMER'
          ? TEAM_BUILDING.partyFactor
          : 1;
    changeMoral(state, id, outing.moral * moralFactor * taste);
    const mood = state.components.mood[id];
    if (mood) mood.energy = clamp(mood.energy + outing.energy, 0, 100);
  }

  // Relations : tout le monde se rapproche, les paires en conflit un peu plus à l'escape game.
  const conflicts: [EntityId, EntityId][] = [];
  for (const [i, a] of people.entries()) {
    for (const b of people.slice(i + 1)) {
      if ((state.components.relations[a]?.[b] ?? 0) < TEAM_BUILDING.conflictThreshold)
        conflicts.push([a, b]);
      bond(state, a, b, outing.affinity);
    }
  }
  let result: readonly [string, string] = [
    'tout le monde est sorti à temps, et ensemble.',
    'everyone got out in time, together.',
  ];
  if (outing.conflictAffinity > 0) {
    for (const [a, b] of conflicts) bond(state, a, b, outing.conflictAffinity);
    if (conflicts.length > 0 && rng.chance(TEAM_BUILDING.escapeBackfireChance)) {
      const [a, b] = rng.pick(conflicts);
      bond(state, a, b, TEAM_BUILDING.escapeBackfireAffinity - outing.conflictAffinity);
      const names = (line: string) =>
        line
          .replace('{a}', state.components.identity[a]?.name ?? '?')
          .replace('{b}', state.components.identity[b]?.name ?? '?');
      result = [
        names('{a} a caché la clé à {b}. Ça ne s’arrange pas entre eux.'),
        names('{a} hid the key from {b}. Things are not getting better between them.'),
      ];
    }
  }

  // Laser game : deux équipes tirées au sort ; les gros egos perdants boudent.
  let winner = '?';
  const captain = people[0];
  if (outing.id === 'laser-game' && captain !== undefined) {
    const losers = people.filter(() => rng.chance(0.5));
    const winners = people.filter((id) => !losers.includes(id));
    winner = state.components.identity[winners[0] ?? captain]?.name ?? '?';
    for (const id of losers)
      if ((state.components.stats[id]?.ego ?? 0) >= TEAM_BUILDING.laserEgoThreshold)
        changeMoral(state, id, TEAM_BUILDING.laserLoserMoral);
  }

  if (outing.hype !== 0) addGauge(state, 'hype', outing.hype);
  if (outing.debt !== 0) addGauge(state, 'debt', outing.debt);
  state.teamBuilding.last = { outing: outing.id, sprint: state.sprint };
  state.teamBuilding.count += 1;
  state.teamBuilding.booked = null;
  notify(
    state,
    ctx,
    'TEAM_BUILDING_DONE',
    text(DONE_MESSAGES[outing.id], {
      result: { fr: result[0], en: result[1] },
      winner,
    }),
  );
}
