import {
  BALANCE,
  type CommandResult,
  type EntityId,
  type GameState,
  type LocalizedText,
  type Stats,
} from '@oss/shared';
import { LINKEDIN_POSTS } from './data/flavor';
import { resignDev } from './devs';
import {
  addDevLog,
  changeMoral,
  clamp,
  devIds,
  moneyText,
  notify,
  teamSize,
  text,
  type SimContext,
} from './helpers';
import { sideRng, type Rng } from './rng';

/*
 * Demandes d'augmentation : tous les 5 à 10 sprints, un dev peut venir réclamer plus d'argent
 * pendant la planification. Le joueur accepte (le dev progresse) ou refuse (il démissionne et
 * part deux planifications plus tard, ou il se démotive et perd des compétences).
 *
 * Tout le hasard passe par `raiseRng`, un générateur créé à la volée à partir de la graine de
 * la partie, d'une clé et du sprint. Le générateur principal (`ctx.rng`) n'est jamais utilisé
 * ici : le reste de la partie tire les mêmes nombres qu'avant l'ajout de la mécanique.
 */

/** Générateur dédié, reproductible : même graine, même clé, même sprint ⇒ même tirage. */
function raiseRng(state: GameState, key: string): Rng {
  return sideRng(state.seed, 'raise', key, state.sprint);
}

/** Compétences qu'une augmentation fait progresser (ou qu'un refus fait baisser). */
const SKILLS = ['speed', 'quality', 'endurance'] as const satisfies readonly (keyof Stats)[];
type Skill = (typeof SKILLS)[number];

const SKILL_NAMES: Record<Skill, LocalizedText> = {
  speed: { fr: 'Vitesse', en: 'Speed' },
  quality: { fr: 'Qualité', en: 'Quality' },
  endurance: { fr: 'Endurance', en: 'Endurance' },
};

/** Liste lisible des compétences modifiées : « Vitesse +1, Qualité +1 ». */
function skillsText(changes: readonly { skill: Skill; delta: number }[]): LocalizedText {
  const line = (locale: 'fr' | 'en') =>
    changes
      .map(
        ({ skill, delta }) =>
          `${SKILL_NAMES[skill][locale]} ${delta > 0 ? '+' : '−'}${Math.abs(delta)}`,
      )
      .join(', ');
  return { fr: line('fr'), en: line('en') };
}

/** Modifie `count` compétences tirées au hasard, dans les bornes 1 à 10. */
function changeSkills(
  state: GameState,
  rng: Rng,
  devId: EntityId,
  count: number,
  delta: number,
): { skill: Skill; delta: number }[] {
  const stats = state.components.stats[devId];
  if (!stats) return [];
  const changes: { skill: Skill; delta: number }[] = [];
  for (const skill of rng.shuffle(SKILLS)) {
    if (changes.length >= count) break;
    const next = clamp(stats[skill] + delta, 1, 10);
    if (next === stats[skill]) continue;
    changes.push({ skill, delta: next - stats[skill] });
    stats[skill] = next;
  }
  return changes;
}

/** Sprints avant la prochaine occasion de demande. */
function nextInterval(rng: Rng): number {
  const { minIntervalSprints, maxIntervalSprints } = BALANCE.raises;
  return rng.int(minIntervalSprints, maxIntervalSprints);
}

/** Devs qui peuvent demander une augmentation : assez d'ancienneté, pas déjà sur le départ. */
export function raiseCandidates(state: GameState): EntityId[] {
  const leaving = new Set(state.raises.departures.map((departure) => departure.devId));
  return devIds(state).filter((id) => {
    const employment = state.components.employment[id];
    return (
      employment !== undefined &&
      !leaving.has(id) &&
      state.sprint - employment.hiredAtSprint >= BALANCE.raises.minTenureSprints
    );
  });
}

/** Sprint de départ d'un dev qui a démissionné après un refus, sinon null. */
export function leavingAtSprint(state: GameState, devId: EntityId): number | null {
  return (
    state.raises.departures.find((departure) => departure.devId === devId)?.leavesAtSprint ?? null
  );
}

/** Les devs dont le préavis est terminé quittent l'équipe (faux post LinkedIn). */
function processDepartures(state: GameState, ctx: SimContext): void {
  const staying = [];
  for (const departure of state.raises.departures) {
    if (!state.components.identity[departure.devId]) continue;
    if (departure.leavesAtSprint > state.sprint) {
      staying.push(departure);
      continue;
    }
    const post = raiseRng(state, `leave:${departure.devId}`).pick(LINKEDIN_POSTS);
    resignDev(state, ctx, departure.devId, post);
  }
  state.raises.departures = staying;
}

/**
 * Occasion de demande : à la date prévue, s'il y a au moins 3 devs, un dev (plutôt un gros ego)
 * demande une augmentation avec une certaine probabilité. Sans assez de devs, l'occasion
 * attend la prochaine planification.
 */
function maybeRequestRaise(state: GameState, ctx: SimContext): void {
  const { raises } = state;
  if (raises.pending || state.phase === 'END') return;
  raises.nextSprint ??= state.sprint + nextInterval(raiseRng(state, 'schedule'));
  if (state.sprint < raises.nextSprint) return;
  if (teamSize(state) < BALANCE.raises.minTeam) return;
  const candidates = raiseCandidates(state);
  if (candidates.length === 0) return;
  const rng = raiseRng(state, 'request');
  raises.nextSprint = state.sprint + nextInterval(rng);
  if (!rng.chance(BALANCE.raises.chance)) return;
  const devId = rng.weighted(candidates, (id) => state.components.stats[id]?.ego ?? 1);
  const identity = devId ? state.components.identity[devId] : undefined;
  const employment = devId ? state.components.employment[devId] : undefined;
  if (!devId || !identity || !employment) return;
  const { minRaise, maxRaise } = BALANCE.raises;
  const requestedSalary =
    Math.round((employment.salary * (1 + rng.range(minRaise, maxRaise))) / 100) * 100;
  raises.pending = {
    devId,
    currentSalary: employment.salary,
    requestedSalary,
    sprint: state.sprint,
  };
  notify(
    state,
    ctx,
    'RAISE_REQUESTED',
    text(
      [
        '{name} frappe à ta porte et demande une augmentation : {salary} par mois.',
        '{name} knocks on your door and asks for a raise: {salary} a month.',
      ],
      { name: identity.name, salary: moneyText(requestedSalary) },
    ),
    devId,
  );
}

/** Début de planification : départs en fin de préavis, puis éventuelle demande d'augmentation. */
export function raisePlanning(state: GameState, ctx: SimContext): void {
  processDepartures(state, ctx);
  maybeRequestRaise(state, ctx);
}

/** Réponse du joueur à la demande en attente. */
export function answerRaise(state: GameState, ctx: SimContext, accept: boolean): CommandResult {
  const request = state.raises.pending;
  if (!request) return { ok: false, error: 'NOT_FOUND' };
  if (state.stage !== 'PLANNING') return { ok: false, error: 'WRONG_STAGE' };
  state.raises.pending = null;
  const { devId } = request;
  const identity = state.components.identity[devId];
  const employment = state.components.employment[devId];
  // Le dev est parti entre-temps : la demande tombe d'elle-même.
  if (!identity || !employment) return { ok: true };
  const rng = raiseRng(state, `answer:${devId}`);
  const { raises } = BALANCE;
  const name = identity.name;

  if (accept) {
    state.raises.granted += 1;
    employment.salary = request.requestedSalary;
    changeMoral(state, devId, raises.acceptMoral);
    const skills = skillsText(
      changeSkills(state, rng, devId, raises.skillsGained, raises.skillGain),
    );
    const message = text(
      [
        '{name} obtient son augmentation ({salary} par mois) et se surpasse : {skills}.',
        '{name} gets the raise ({salary} a month) and steps up: {skills}.',
      ],
      { name, salary: moneyText(request.requestedSalary), skills },
    );
    addDevLog(state, devId, message);
    notify(state, ctx, 'RAISE_GRANTED', message, devId);
    return { ok: true };
  }

  state.raises.refused += 1;
  if (rng.chance(raises.resignChance)) {
    const leavesAtSprint = state.sprint + raises.noticeSprints;
    state.raises.departures.push({ devId, leavesAtSprint });
    changeMoral(state, devId, raises.resignMoral);
    const message = text(
      [
        'Augmentation refusée : {name} pose sa démission et partira au sprint {sprint}.',
        'Raise refused: {name} hands in their notice and will leave at sprint {sprint}.',
      ],
      { name, sprint: leavesAtSprint },
    );
    addDevLog(state, devId, message);
    notify(state, ctx, 'DEV_NOTICE', message, devId);
    return { ok: true };
  }

  changeMoral(state, devId, raises.refuseMoral);
  const changes = changeSkills(state, rng, devId, raises.skillsLost, -raises.skillLoss);
  const message =
    changes.length > 0
      ? text(
          [
            'Augmentation refusée : {name} reste, mais le cœur n’y est plus ({skills}).',
            'Raise refused: {name} stays, but their heart is not in it anymore ({skills}).',
          ],
          { name, skills: skillsText(changes) },
        )
      : text(
          [
            'Augmentation refusée : {name} reste, mais boude.',
            'Raise refused: {name} stays, but sulks.',
          ],
          { name },
        );
  addDevLog(state, devId, message);
  notify(state, ctx, 'RAISE_REFUSED', message, devId);
  return { ok: true };
}
