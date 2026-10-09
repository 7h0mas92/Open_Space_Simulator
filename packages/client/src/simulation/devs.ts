import {
  BALANCE,
  DEV_TRAITS,
  birthdayFromKey,
  hasOpening,
  ROLE_PROFILES,
  ROLE_STACK,
  SPECIALTIES_BY_STACK,
  type ClassicRole,
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
import { teamShape } from './leadership';
import { emptySprintPerformance } from './performance';
import { Rng } from './rng';

/**
 * Fréquence des profils historiques parmi les 3 candidats habituels (le Dev Fantôme est rare).
 * Cette liste ne doit pas changer : elle fixe les tirages des replays et du Daily.
 */
const ROLE_WEIGHTS: Record<ClassicRole, number> = {
  SENIOR_BEARD: 3,
  TEN_X: 3,
  INTERN: 4,
  RUSTACEAN: 2,
  DESIGNER: 2,
  PRODUCT_OWNER: 2,
  AI_AGENT: 2,
  GHOST: 1,
};

const ROLES = Object.keys(ROLE_WEIGHTS) as ClassicRole[];

/** Devs de l'équipe web proposés en 4e candidat (front, back et fullstack surtout). */
const WEB_DEV_WEIGHTS: Partial<Record<DevRole, number>> = {
  FRONTEND: 4,
  BACKEND: 4,
  FULLSTACK: 3,
  TECH_LEAD: 1,
  DEVOPS: 1,
};

/** Postes d'équipe proposés en 5e candidat, quand ils sont ouverts. */
const WEB_TEAM_WEIGHTS: Partial<Record<DevRole, number>> = {
  QA_TESTER: 3,
  SCRUM_MASTER: 2,
  MANAGER: 3,
  DEPUTY_DIRECTOR: 1,
  DIRECTOR: 2,
};

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
    case 'DIRECTOR':
    case 'DEPUTY_DIRECTOR':
      return rng.int(36, 58);
    case 'TECH_LEAD':
    case 'MANAGER':
      return rng.int(30, 50);
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
  const identity: Identity = {
    name,
    age,
    role,
    trait: role === 'AI_AGENT' ? 'ZEN' : rng.pick(DEV_TRAITS),
    bio: text(rng.pick(BIOS[role]), { name, age }),
    look: rng.int(0, 17),
  };
  // Spécialité des devs front et back (tirée en dernier : les profils historiques ne tirent
  // rien de plus). Le DevOps est toujours spécialiste du cloud.
  const stack = ROLE_STACK[role];
  if (role === 'DEVOPS') identity.specialty = 'CLOUD';
  else if (stack === 'FRONT' || stack === 'BACK')
    identity.specialty = rng.pick(SPECIALTIES_BY_STACK[stack]);
  return {
    identity,
    stats,
    askingSalary: Math.round(asking / 100) * 100,
  };
}

/** Tire le profil d'un nouveau candidat (uniquement des stagiaires en mode Stagiaires Only). */
export function pickCandidateRole(state: GameState, rng: Rng): DevRole {
  if (state.mode === 'INTERNS_ONLY') return 'INTERN';
  return rng.weighted(ROLES, (role) => ROLE_WEIGHTS[role]) ?? 'INTERN';
}

/** Graine à part des candidats de l'équipe web : le RNG de la partie n'est pas touché. */
function webRng(state: GameState): Rng {
  return Rng.fromSeed(`${state.seed}#web-roles#${state.sprint}`);
}

/**
 * Profils de l'équipe web proposés ce sprint : un dev (front, back, fullstack, tech lead ou
 * DevOps si le poste est ouvert), puis un poste d'équipe ouvert (testeur, scrum master,
 * manager, directeur...) ou, s'il n'y en a pas, un deuxième dev.
 */
export function pickWebRoles(state: GameState, rng: Rng): DevRole[] {
  const shape = teamShape(state);
  const open = (weights: Partial<Record<DevRole, number>>) =>
    (Object.keys(weights) as DevRole[]).filter((role) => hasOpening(role, shape));
  const devRoles = open(WEB_DEV_WEIGHTS);
  const teamRoles = open(WEB_TEAM_WEIGHTS);
  const roles: DevRole[] = [];
  for (let i = 0; i < BALANCE.recruitment.webCandidatesPerSprint; i++) {
    const pool = i > 0 && teamRoles.length > 0 ? teamRoles : devRoles;
    const weights = pool === teamRoles ? WEB_TEAM_WEIGHTS : WEB_DEV_WEIGHTS;
    const role = rng.weighted(pool, (r) => weights[r] ?? 0);
    if (role) roles.push(role);
  }
  return roles;
}

/**
 * Remplace les candidats au début de chaque sprint : 3 profils historiques (RNG de la partie,
 * inchangés), puis 2 profils de l'équipe web tirés sur une graine à part. Le mode Stagiaires
 * Only n'a que ses 3 stagiaires.
 */
export function generateCandidates(state: GameState, ctx: SimContext): void {
  state.candidates = [];
  const add = (index: number, dev: DevProfile) => {
    const id = `c${state.sprint}-${index}`;
    // L'anniversaire vient d'un hachage (pas du RNG) : les graines existantes restent identiques.
    const identity = { ...dev.identity, birthday: birthdayFromKey(`${state.seed}:${id}`) };
    state.candidates.push({ id, status: 'OPEN', ...dev, identity });
  };
  const classic = BALANCE.recruitment.candidatesPerSprint;
  for (let i = 0; i < classic; i++) {
    const role = pickCandidateRole(state, ctx.rng);
    add(i, generateDev(ctx.rng, role));
  }
  if (state.mode === 'INTERNS_ONLY') return;
  const rng = webRng(state);
  pickWebRoles(state, rng).forEach((role, i) => add(classic + i, generateDev(rng, role)));
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
