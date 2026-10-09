import {
  BALANCE,
  DEV_TRAITS,
  birthdayFromKey,
  ROLE_PROFILES,
  type Candidate,
  type CommandResult,
  type DevRole,
  type EntityId,
  type GameState,
  type Identity,
  type Stats,
} from '@oss/shared';
import { BIOS } from './data/bios';
import { LINKEDIN_POSTS } from './data/flavor';
import { AI_NAMES, FIRST_NAMES, LAST_INITIALS } from './data/names';
import { addComponent, createEntity, destroyEntity } from './ecs';
import {
  addDevLog,
  addMoney,
  changeMoral,
  clamp,
  devIds,
  moneyText,
  notify,
  teamMax,
  teamSize,
  text,
  type SimContext,
} from './helpers';
import { emptySprintPerformance } from './performance';
import type { Rng } from './rng';

/** Fréquence des profils parmi les candidats (le Dev Fantôme est rare). */
const ROLE_WEIGHTS: Record<DevRole, number> = {
  SENIOR_BEARD: 3,
  TEN_X: 3,
  INTERN: 4,
  RUSTACEAN: 2,
  DESIGNER: 2,
  PRODUCT_OWNER: 2,
  AI_AGENT: 2,
  GHOST: 1,
};

const ROLES = Object.keys(ROLE_WEIGHTS) as DevRole[];

export interface DevProfile {
  identity: Identity;
  stats: Stats;
  askingSalary: number;
}

function ageFor(rng: Rng, role: DevRole): number {
  switch (role) {
    case 'INTERN':
      return rng.int(19, 23);
    case 'SENIOR_BEARD':
      return rng.int(42, 61);
    case 'AI_AGENT':
      return rng.int(2, 9);
    default:
      return rng.int(23, 41);
  }
}

/** Génère un dev (nom, bio, stats, salaire demandé) pour un profil donné. */
export function generateDev(rng: Rng, role: DevRole): DevProfile {
  const profile = ROLE_PROFILES[role];
  const name =
    role === 'AI_AGENT'
      ? rng.pick(AI_NAMES)
      : `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_INITIALS)}.`;
  const age = ageFor(rng, role);
  const stat = (base: number) => clamp(base + rng.int(-2, 2), 1, 10);
  const stats: Stats = {
    speed: stat(profile.stats.speed),
    quality: stat(profile.stats.quality),
    endurance: stat(profile.stats.endurance),
    ego: stat(profile.stats.ego),
  };
  const talent = (stats.speed + stats.quality + stats.endurance) / 3 - 5;
  const asking = profile.salary * (1 + talent * 0.06) * (1 + (stats.ego - 5) * 0.03);
  return {
    identity: {
      name,
      age,
      role,
      trait: role === 'AI_AGENT' ? 'ZEN' : rng.pick(DEV_TRAITS),
      bio: text(rng.pick(BIOS[role]), { name, age }),
      look: rng.int(0, 17),
    },
    stats,
    askingSalary: Math.round(asking / 100) * 100,
  };
}

/** Tire le profil d'un nouveau candidat (uniquement des stagiaires en mode Stagiaires Only). */
export function pickCandidateRole(state: GameState, rng: Rng): DevRole {
  if (state.mode === 'INTERNS_ONLY') return 'INTERN';
  return rng.weighted(ROLES, (role) => ROLE_WEIGHTS[role]) ?? 'INTERN';
}

/** Remplace les candidats par 3 nouveaux (au début de chaque sprint). */
export function generateCandidates(state: GameState, ctx: SimContext): void {
  state.candidates = [];
  for (let i = 0; i < BALANCE.recruitment.candidatesPerSprint; i++) {
    const role = pickCandidateRole(state, ctx.rng);
    const dev = generateDev(ctx.rng, role);
    const id = `c${state.sprint}-${i}`;
    // L'anniversaire vient d'un hachage (pas du RNG) : les graines existantes restent identiques.
    const identity = { ...dev.identity, birthday: birthdayFromKey(`${state.seed}:${id}`) };
    state.candidates.push({ id, status: 'OPEN', ...dev, identity });
  }
}

/** Crée l'entité d'un dev avec tous ses composants. */
export function hireDev(
  state: GameState,
  ctx: SimContext,
  profile: { identity: Identity; stats: Stats },
  salary: number,
): EntityId {
  const id = createEntity(state);
  const { stats } = profile;
  const identity = {
    ...profile.identity,
    birthday: profile.identity.birthday ?? birthdayFromKey(`${state.seed}:${id}`),
  };
  addComponent(state, id, 'identity', identity);
  addComponent(state, id, 'stats', { ...stats });
  addComponent(state, id, 'employment', {
    salary,
    hiredAtSprint: state.sprint,
    xp: 0,
    level: 1,
    tasksDone: 0,
  });
  addComponent(state, id, 'mood', {
    moral: ctx.rng.range(BALANCE.moral.startMin, BALANCE.moral.startMax),
    energy: 100,
  });
  addComponent(state, id, 'activity', { kind: 'GONE', untilTick: 0, withId: null });
  addComponent(state, id, 'worker', { taskId: null });
  addComponent(state, id, 'devLog', []);
  addComponent(state, id, 'performance', {
    current: emptySprintPerformance(state.sprint),
    sprints: [],
  });
  if (identity.role === 'GHOST') {
    addComponent(state, id, 'remote', true);
    addComponent(state, id, 'remoteReason', 'GHOST');
  }

  // Relations : une affinité de départ avec chaque collègue, dans les deux sens.
  const relations: Record<string, number> = {};
  for (const otherId of devIds(state)) {
    if (otherId === id) continue;
    const other = state.components.identity[otherId];
    let affinity = ctx.rng.int(-25, 40);
    if (identity.trait === 'GRUMPY' || other?.trait === 'GRUMPY')
      affinity -= BALANCE.relations.grumpyMalus;
    relations[otherId] = affinity;
    const otherRelations = state.components.relations[otherId];
    if (otherRelations) otherRelations[id] = affinity;
  }
  addComponent(state, id, 'relations', relations);

  addDevLog(state, id, text(['Arrivée dans l’équipe.', 'Joined the team.']));
  state.stats.hired += 1;
  state.stats.maxTeamSize = Math.max(state.stats.maxTeamSize, teamSize(state));
  notify(
    state,
    ctx,
    'DEV_HIRED',
    text(['{name} rejoint l’équipe !', '{name} joins the team!'], { name: identity.name }),
    id,
  );
  return id;
}

/** Retire un dev de l'équipe : sa tâche est libérée et ses relations effacées. */
export function removeDev(state: GameState, devId: EntityId): void {
  const taskId = state.components.worker[devId]?.taskId;
  const task = taskId ? state.components.task[taskId] : undefined;
  if (task) task.assigneeId = null;
  // Sa demande d'augmentation et son préavis disparaissent avec lui.
  if (state.raises.pending?.devId === devId) state.raises.pending = null;
  state.raises.departures = state.raises.departures.filter((leave) => leave.devId !== devId);
  for (const otherId of devIds(state)) {
    const relations = state.components.relations[otherId];
    if (relations) Reflect.deleteProperty(relations, devId);
  }
  destroyEntity(state, devId);
}

/** Licenciement : indemnités et baisse du moral, surtout chez les amis du dev. */
export function fireDev(state: GameState, ctx: SimContext, devId: EntityId): CommandResult {
  const identity = state.components.identity[devId];
  const employment = state.components.employment[devId];
  if (!identity || !employment) return { ok: false, error: 'NOT_FOUND' };
  addMoney(state, -employment.salary * BALANCE.economy.severanceMonths);
  for (const otherId of devIds(state)) {
    if (otherId === devId) continue;
    const affinity = state.components.relations[otherId]?.[devId] ?? 0;
    const friendship = Math.max(0, affinity) / 100;
    changeMoral(
      state,
      otherId,
      -BALANCE.moral.firePenalty - friendship * BALANCE.moral.fireAffinityPenalty,
    );
  }
  removeDev(state, devId);
  state.stats.fired += 1;
  notify(
    state,
    ctx,
    'DEV_FIRED',
    text(['{name} a été licencié·e.', '{name} has been let go.'], { name: identity.name }),
    devId,
  );
  return { ok: true };
}

/**
 * Démission annoncée par un faux post LinkedIn. `post` : texte déjà choisi (sinon tiré par le
 * RNG de la partie), pour les départs qui ne doivent pas toucher à ce générateur.
 */
export function resignDev(
  state: GameState,
  ctx: SimContext,
  devId: EntityId,
  post?: readonly [string, string],
): void {
  const identity = state.components.identity[devId];
  const mood = state.components.mood[devId];
  if (!identity || !mood) return;
  if (mood.energy < 30) state.stats.burnouts += 1;
  state.stats.resignations += 1;
  removeDev(state, devId);
  notify(
    state,
    ctx,
    'DEV_RESIGNED',
    text(post ?? ctx.rng.pick(LINKEDIN_POSTS), { name: identity.name }),
    devId,
  );
}

/** Probabilité qu'un candidat accepte une offre de salaire. */
export function acceptanceChance(
  candidate: Pick<Candidate, 'askingSalary'> & { stats: Pick<Stats, 'ego'> },
  salary: number,
): number {
  const { minRatio, sureRatio } = BALANCE.recruitment;
  const ratio = salary / candidate.askingSalary;
  if (ratio < minRatio) return 0;
  if (ratio >= sureRatio) return 1;
  const base = (ratio - minRatio) / (sureRatio - minRatio);
  // Plus l'ego est grand, plus la négociation est difficile.
  return clamp(base * (1.15 - candidate.stats.ego * 0.03), 0, 1);
}

/** Négociation : le candidat accepte ou refuse (et part chez un concurrent). */
export function makeOffer(
  state: GameState,
  ctx: SimContext,
  candidateId: string,
  salary: number,
): CommandResult {
  const candidate = state.candidates.find((c) => c.id === candidateId && c.status === 'OPEN');
  if (!candidate) return { ok: false, error: 'NOT_FOUND' };
  if (teamSize(state) >= teamMax(state)) return { ok: false, error: 'TEAM_FULL' };
  if (ctx.rng.chance(acceptanceChance(candidate, salary))) {
    candidate.status = 'HIRED';
    hireDev(state, ctx, candidate, Math.round(salary));
  } else {
    candidate.status = 'REFUSED';
    notify(
      state,
      ctx,
      'OFFER_REFUSED',
      text(
        [
          '{name} a refusé {salary} par mois et part chez un concurrent.',
          '{name} turned down {salary} a month and joined a competitor.',
        ],
        {
          name: candidate.identity.name,
          salary: moneyText(salary),
        },
      ),
    );
  }
  return { ok: true };
}

/** Recrutement gratuit imposé par une carte (« spawnDev »). */
export function spawnDev(state: GameState, ctx: SimContext, role: DevRole): EntityId | null {
  if (teamSize(state) >= teamMax(state)) return null;
  const profile = generateDev(ctx.rng, role);
  return hireDev(state, ctx, profile, profile.askingSalary);
}
