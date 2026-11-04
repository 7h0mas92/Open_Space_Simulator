import { PHASES, type Phase } from '../game.js';
import { BALANCE } from './balance.js';
import {
  taskTrade,
  type DevRole,
  type DevSpecialty,
  type Task,
  type TaskStack,
  type TaskType,
} from './components.js';

/**
 * L'équipe web : devs front, back ou fullstack, tech lead, DevOps, testeurs et encadrement.
 *
 * - Les devs front et back vont plus vite sur leur côté de la stack, et tâtonnent de l'autre.
 *   Leur spécialité (React, bases de données...) accélère un type de tâche.
 * - Le fullstack prend les deux côtés, un peu moins vite (`BALANCE.stacks`).
 * - Les 8 profils historiques n'ont pas de côté : ils codent partout comme avant.
 * - L'encadrement ne prend pas de tâches ; il rend l'équipe meilleure
 *   (`client/src/simulation/leadership.ts`).
 */

/** Côté de la stack d'un dev : front, back, ou les deux (fullstack). */
export type DevStack = TaskStack | 'FULL';

/** Côté de chaque profil qui en a un. */
export const ROLE_STACK: Readonly<Partial<Record<DevRole, DevStack>>> = {
  FRONTEND: 'FRONT',
  BACKEND: 'BACK',
  FULLSTACK: 'FULL',
  TECH_LEAD: 'FULL',
  DEVOPS: 'BACK',
};

/** Spécialités tirées pour un dev front ou back (le DevOps est toujours « Cloud »). */
export const SPECIALTIES_BY_STACK: Readonly<Record<TaskStack, readonly DevSpecialty[]>> = {
  FRONT: ['REACT', 'ACCESSIBILITY', 'WEB_PERF', 'MOBILE'],
  BACK: ['NODE', 'DATABASE', 'SECURITY', 'CLOUD'],
};

/** Type de tâche accéléré par chaque spécialité. */
export const SPECIALTY_FOCUS: Readonly<Record<DevSpecialty, TaskType>> = {
  REACT: 'FEATURE',
  ACCESSIBILITY: 'BUGFIX',
  WEB_PERF: 'REFACTO',
  MOBILE: 'FEATURE',
  NODE: 'FEATURE',
  DATABASE: 'REFACTO',
  SECURITY: 'BUGFIX',
  CLOUD: 'INFRA',
};

/** L'encadrement : pas de tâches, des effets sur toute l'équipe. */
export const MANAGEMENT_ROLES = ['SCRUM_MASTER', 'MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR'] as const;
export type ManagementRole = (typeof MANAGEMENT_ROLES)[number];

export function isManagementRole(role: DevRole): role is ManagementRole {
  return (MANAGEMENT_ROLES as readonly string[]).includes(role);
}

// ---------------------------------------------------------------------------------------------
// Côté d'une tâche de code, déduit de son titre anglais (aucun tirage, aucune donnée en plus :
// les anciennes sauvegardes et les nouveaux titres sont classés de la même façon).
// ---------------------------------------------------------------------------------------------

const FRONT_WORDS =
  /\b(dark mode|button|logo|page|onboarding|emojis?|spinner|ui|ux|css|design|mobile|webview|animations?|themes?|layout|responsive|badges?|dashboard|accents?|front|jquery|modal|forms?|icons?|fonts?|padding|pixels?|screens?|tooltips?|menu|navbar|carousel|pwa|offline|accessib\w*|dropdown|sharing|share|feed|photos?|landing|widget|scroll\w*|click\w*|display\w*|colou?rs?|dark|light mode|avatars?|browser|safari|chrome|ios|android|keyboard|gamification|chatbot|corner|notifications?)\b/;
const BACK_WORDS =
  /\b(api|database|db|backups?|server\w*|emails?|payments?|billing|subscriptions?|charges?|search|memory|ci|cd|monitoring|deploy\w*|docker|kubernetes|k8s|cache|caching|queues?|cron|sql|migrat\w*|logs?|logging|auth\w*|sign in|passwords?|export|import|pagination|time zones?|dates|500|webhooks?|integration|dependencies|tests?|utils|legacy|backend|infra\w*|scal\w*|load|security|encrypt\w*|tokens?|ssl|https|dns|cloud|aws|microservices?|referral|recommendations?|pdf|excel|null|encoding|prod|production|outage|crash\w*|leak|god class|callbacks|module|feature flags|data\w*|any|types?|rate limit\w*|gdpr|rgpd|invoices?|stripe|sso|oauth|graphql|redis|postgres\w*|indexes|batch|pipeline|terraform|staging|uptime|alerts?)\b/;

const stackCache = new Map<string, TaskStack>();

/** Petit hachage FNV-1a : départage les titres neutres sans toucher au RNG. */
function hashText(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function countMatches(pattern: RegExp, value: string): number {
  return value.match(new RegExp(pattern.source, 'g'))?.length ?? 0;
}

/**
 * Côté d'une tâche de code d'après son titre anglais et son type : des mots-clés (« button »,
 * « dark mode » côté front ; « API », « database » côté back), puis le type (l'infra est côté
 * back), puis un hachage du titre pour les cas neutres.
 */
export function classifyStack(titleEn: string, type: TaskType): TaskStack {
  const key = `${type}:${titleEn}`;
  const cached = stackCache.get(key);
  if (cached) return cached;
  const title = titleEn.toLowerCase();
  const front = countMatches(FRONT_WORDS, title);
  const back = countMatches(BACK_WORDS, title);
  let stack: TaskStack;
  if (front !== back) stack = front > back ? 'FRONT' : 'BACK';
  else if (type === 'INFRA') stack = 'BACK';
  else stack = hashText(title) % 2 === 0 ? 'FRONT' : 'BACK';
  stackCache.set(key, stack);
  return stack;
}

/** Côté d'une tâche, ou `null` si ce n'est pas une tâche de code (design, produit, recette). */
export function taskStack(task: Pick<Task, 'title' | 'type' | 'trade'>): TaskStack | null {
  if (taskTrade(task) !== 'DEV') return null;
  return classifyStack(task.title.en, task.type);
}

/**
 * Multiplicateur de vitesse lié à la stack : 1 pour les profils historiques et les tâches qui ne
 * sont pas du code ; sinon bonus sur son côté, malus de l'autre, fullstack entre les deux, et
 * bonus de spécialité.
 */
export function stackMultiplier(
  role: DevRole,
  specialty: DevSpecialty | undefined,
  task: Pick<Task, 'title' | 'type' | 'trade'>,
): number {
  const stack = ROLE_STACK[role];
  if (!stack) return 1;
  const side = taskStack(task);
  if (!side) return 1;
  const { stacks } = BALANCE;
  const onSide = stack === 'FULL' || stack === side;
  let multiplier =
    stack === 'FULL' ? stacks.fullstack : onSide ? stacks.specialist : stacks.crossStack;
  if (specialty && onSide && SPECIALTY_FOCUS[specialty] === task.type) {
    multiplier *= stacks.specialtyBonus;
  }
  return multiplier;
}

/** Le dev préfère-t-il ne pas prendre cette tâche tout seul ? (dev front devant du back) */
export function wrongSide(role: DevRole, task: Pick<Task, 'title' | 'type' | 'trade'>): boolean {
  const stack = ROLE_STACK[role];
  const side = taskStack(task);
  return stack !== undefined && stack !== 'FULL' && side !== null && stack !== side;
}

// ---------------------------------------------------------------------------------------------
// Postes ouverts : combien de personnes de chaque profil l'entreprise peut recruter.
// ---------------------------------------------------------------------------------------------

/** Ce qu'il faut savoir de l'équipe pour ouvrir un poste. */
export interface TeamShape {
  readonly phase: Phase;
  /** Effectif par profil. */
  readonly roles: Readonly<Partial<Record<DevRole, number>>>;
}

function phaseAtLeast(phase: Phase, minimum: Phase): boolean {
  return PHASES.indexOf(phase) >= PHASES.indexOf(minimum);
}

/** Membres de l'équipe hors encadrement (ceux qu'un manager encadre). */
export function contributorsOf(shape: TeamShape): number {
  let total = 0;
  for (const [role, count] of Object.entries(shape.roles) as [DevRole, number][]) {
    if (!isManagementRole(role)) total += count;
  }
  return total;
}

/** Devs qui codent (tout profil dont le métier est le code). */
function codersOf(shape: TeamShape): number {
  const { roles } = shape;
  const coding: readonly DevRole[] = [
    'SENIOR_BEARD',
    'TEN_X',
    'INTERN',
    'RUSTACEAN',
    'AI_AGENT',
    'GHOST',
    'FRONTEND',
    'BACKEND',
    'FULLSTACK',
    'TECH_LEAD',
    'DEVOPS',
  ];
  return coding.reduce((sum, role) => sum + (roles[role] ?? 0), 0);
}

/**
 * Nombre maximal de personnes de ce profil pour une équipe donnée. Les devs front, back et
 * fullstack ne sont jamais limités ; l'encadrement grandit avec l'équipe :
 * - testeurs : 1 pour 4 personnes ; DevOps : 1 dès 3 personnes, 2 dès 12 ;
 * - tech lead : 1 pour 4 devs qui codent ;
 * - scrum master : 1 dès 4 personnes, puis 1 pour 8 ;
 * - managers : 1 pour 5 personnes encadrées ;
 * - directeur technique : 1, dès la Seed et 4 personnes ;
 * - sous-directeur : 1, en Série A, avec un directeur et 8 personnes.
 */
export function roleLimit(role: DevRole, shape: TeamShape): number {
  const contributors = contributorsOf(shape);
  switch (role) {
    case 'QA_TESTER':
      return Math.floor(contributors / 4);
    case 'DEVOPS':
      return contributors >= 12 ? 2 : contributors >= 3 ? 1 : 0;
    case 'TECH_LEAD':
      return Math.floor(codersOf(shape) / 4);
    case 'SCRUM_MASTER':
      return contributors >= 4 ? Math.max(1, Math.floor(contributors / 8)) : 0;
    case 'MANAGER':
      return Math.floor(contributors / 5);
    case 'DIRECTOR':
      return phaseAtLeast(shape.phase, 'SEED') && contributors >= 4 ? 1 : 0;
    case 'DEPUTY_DIRECTOR':
      return phaseAtLeast(shape.phase, 'SERIES_A') &&
        (shape.roles.DIRECTOR ?? 0) > 0 &&
        contributors >= 8
        ? 1
        : 0;
    default:
      return Number.POSITIVE_INFINITY;
  }
}

/** Reste-t-il un poste ouvert pour ce profil ? */
export function hasOpening(role: DevRole, shape: TeamShape): boolean {
  return (shape.roles[role] ?? 0) < roleLimit(role, shape);
}
